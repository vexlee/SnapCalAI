import React, { useState, useEffect, useRef } from 'react';
import { Send, Sparkles, Loader2 } from 'lucide-react';
import { getCurrentDateString } from '../utils/midnight';
import { Card } from '../components/ui/Card';
import { sendCoachMessage, ChatMessage, buildCoachContext, CoachContext } from '../services/coach';
import { saveChatMessage, getTodayChatMessages, getChatMessagesForDate, cleanupOldChatMessages, saveWorkoutPlan } from '../services/storage';
import { AppView, WorkoutExercise } from '../types';
import { WorkoutSuggestion } from '../utils/workoutParser';
import { SaveWorkoutModal } from '../components/SaveWorkoutModal';
import { getWorkoutTypeById } from '../constants/workoutTypes';
import { CoachChatMessage, CoachSuggestionCards, CoachGoalsPrompt } from '../components/coach';

interface CalCoachProps {
    onNavigate: (view: AppView) => void;
}

export const CalCoach: React.FC<CalCoachProps> = ({ onNavigate }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [context, setContext] = useState<CoachContext | null>(null);
    const [showGoalsPrompt, setShowGoalsPrompt] = useState(false);
    const [loadedDates, setLoadedDates] = useState<Set<string>>(new Set());
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [canLoadMore, setCanLoadMore] = useState(true);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [workoutToSave, setWorkoutToSave] = useState('');
    const [quickAddLoading, setQuickAddLoading] = useState<string | null>(null);
    const [addedWorkouts, setAddedWorkouts] = useState<Set<string>>(new Set());
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    // Check if training goals are filled
    const hasTrainingGoals = (ctx: CoachContext): boolean => {
        return !!(ctx.activityLevel && ctx.goal && ctx.equipmentAccess);
    };

    // Load context and initialize chat
    useEffect(() => {
        const initChat = async () => {
            const ctx = await buildCoachContext();
            setContext(ctx);

            // Check if training goals are set
            if (!hasTrainingGoals(ctx)) {
                setShowGoalsPrompt(true);
                return;
            }

            // Cleanup old messages (30+ days)
            await cleanupOldChatMessages();

            // Load today's chat history
            const today = getCurrentDateString();
            const todayMessages = await getTodayChatMessages();

            if (todayMessages.length > 0) {
                setMessages(todayMessages);
                setLoadedDates(new Set([today]));
            } else {
                const welcomeMessage: ChatMessage = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: `👋 ** Hi ${ctx.userName || 'there'} !I'm Cal Coach.**\n\nHow can I help you today?`,
                    timestamp: Date.now()
                };
                setMessages([welcomeMessage]);
            }
        };

        initChat();
    }, []);

    // Auto-scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Send a message (used by both input and suggestion cards)
    const handleSendMessage = async (text?: string) => {
        const messageText = text || inputValue.trim();
        if (!messageText || isLoading) return;

        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: messageText,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMessage]);
        if (!text) setInputValue('');
        setIsLoading(true);

        // Save user message to database (non-blocking)
        saveChatMessage(userMessage).catch(err =>
            console.error('Failed to save user message:', err)
        );

        try {
            const response = await sendCoachMessage(messageText, messages);

            const assistantMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: response,
                timestamp: Date.now()
            };

            setMessages(prev => [...prev, assistantMessage]);

            // Save assistant message to database (non-blocking)
            saveChatMessage(assistantMessage).catch(err =>
                console.error('Failed to save assistant message:', err)
            );
        } catch (error: any) {
            const errorMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: `⚠️ ${error.message || 'Failed to get response. Please try again.'}`,
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
            inputRef.current?.focus();
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleGoToProfile = () => {
        onNavigate(AppView.PROFILE);
    };

    // Handle quick add workout from AI suggestion
    const handleQuickAddWorkout = async (suggestion: WorkoutSuggestion) => {
        const suggestionKey = `${suggestion.activity}-${suggestion.durationMin}`;

        if (addedWorkouts.has(suggestionKey)) return;

        setQuickAddLoading(suggestionKey);

        try {
            const today = getCurrentDateString();
            const workoutType = getWorkoutTypeById(suggestion.workoutTypeId);

            const exercises: WorkoutExercise[] = [{
                id: `ex-${Date.now()}-0`,
                name: suggestion.title,
                sets: 1,
                reps: `${suggestion.durationMin} min`,
                rest: '0s',
                completed: false
            }];

            await saveWorkoutPlan(
                today,
                workoutType?.name || suggestion.title,
                exercises,
                undefined,
                suggestion.workoutTypeId
            );

            setAddedWorkouts(prev => new Set([...prev, suggestionKey]));
        } catch (error) {
            console.error('Failed to add workout:', error);
        } finally {
            setQuickAddLoading(null);
        }
    };

    // Handle save workout from full workout plan
    const handleSaveWorkout = (content: string) => {
        setWorkoutToSave(content);
        setShowSaveModal(true);
    };

    // Load previous day's messages when scrolling to top
    const loadPreviousDay = async () => {
        if (isLoadingHistory || !canLoadMore) return;

        setIsLoadingHistory(true);

        try {
            const sortedDates = Array.from(loadedDates).sort();
            const earliestDate = sortedDates[0];

            if (!earliestDate) {
                setCanLoadMore(false);
                return;
            }

            const prevDate = new Date(earliestDate);
            prevDate.setDate(prevDate.getDate() - 1);
            const prevDateStr = prevDate.toISOString().split('T')[0];

            const today = new Date().toISOString().split('T')[0];
            const daysDiff = Math.floor(
                (new Date(today).getTime() - new Date(prevDateStr).getTime()) / (1000 * 60 * 60 * 24)
            );

            if (daysDiff >= 30) {
                setCanLoadMore(false);
                return;
            }

            const previousMessages = await getChatMessagesForDate(prevDateStr);

            if (previousMessages.length > 0) {
                const container = messagesContainerRef.current;
                const scrollHeightBefore = container?.scrollHeight || 0;

                setMessages(prev => [...previousMessages, ...prev]);
                setLoadedDates(prev => new Set([...prev, prevDateStr]));

                setTimeout(() => {
                    if (container) {
                        const scrollHeightAfter = container.scrollHeight;
                        container.scrollTop = scrollHeightAfter - scrollHeightBefore;
                    }
                }, 0);
            } else {
                setLoadedDates(prev => new Set([...prev, prevDateStr]));
            }
        } catch (error) {
            console.error('Failed to load previous day messages:', error);
        } finally {
            setIsLoadingHistory(false);
        }
    };

    // Handle scroll to detect when user reaches top
    const handleScroll = () => {
        const container = messagesContainerRef.current;
        if (!container) return;

        const hasInteracted = loadedDates.size > 0;

        if (container.scrollTop < 100 && !isLoadingHistory && canLoadMore && hasInteracted) {
            loadPreviousDay();
        }
    };

    // Show training goals prompt if needed
    if (showGoalsPrompt) {
        return (
            <CoachGoalsPrompt
                onGoToProfile={handleGoToProfile}
                onDismiss={() => setShowGoalsPrompt(false)}
            />
        );
    }

    const isInitialState = messages.length === 1 && messages[0].role === 'assistant' && !isLoading;
    const showCompactSuggestions = messages.length > 1 && !isLoading;

    return (
        <div className="flex-1 flex flex-col min-h-0 px-6 pt-10 pb-32 animate-in fade-in duration-500 bg-transparent">
            {/* Header */}
            <header className="flex justify-between items-end mb-6 flex-shrink-0">
                <div>
                    <p className="text-secondary-400 text-xs font-bold uppercase tracking-widest mb-2">
                        Your Personal Coach
                    </p>
                    <h1 className="text-3xl font-black text-primary-900 tracking-tight leading-none font-display">
                        Cal Coach
                    </h1>
                </div>
                <div className="w-12 h-12 bg-[#3D745B] rounded-full flex items-center justify-center text-white shadow-lg shadow-primary-200/50">
                    <Sparkles size={20} />
                </div>
            </header>

            {/* Messages Container */}
            <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto space-y-4 mb-4 no-scrollbar"
            >
                {/* Load More Indicator at top */}
                {isLoadingHistory && (
                    <div className="flex justify-center py-3 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2 text-secondary-400 text-sm">
                            <Loader2 size={14} className="animate-spin" />
                            <span>Loading previous messages...</span>
                        </div>
                    </div>
                )}

                {/* Show hint when can load more */}
                {!isLoadingHistory && canLoadMore && messages.length > 1 && (
                    <div className="flex justify-center py-2">
                        <div className="text-xs text-secondary-400">
                            ↑ Scroll up to load older messages
                        </div>
                    </div>
                )}

                {/* Chat Messages */}
                {messages.map((message) => (
                    <CoachChatMessage
                        key={message.id}
                        message={message}
                        onSaveWorkout={handleSaveWorkout}
                        onQuickAddWorkout={handleQuickAddWorkout}
                        quickAddLoading={quickAddLoading}
                        addedWorkouts={addedWorkouts}
                    />
                ))}

                {/* Initial Suggestion Cards */}
                {isInitialState && (
                    <CoachSuggestionCards
                        variant="initial"
                        onSendMessage={handleSendMessage}
                        isLoading={isLoading}
                    />
                )}

                {/* Loading indicator */}
                {isLoading && (
                    <div className="flex justify-start animate-in fade-in duration-300">
                        <Card className="p-5 bg-white rounded-br-3xl rounded-tr-3xl rounded-bl-3xl shadow-soft">
                            <div className="flex items-center gap-2 text-secondary-500">
                                <Loader2 size={16} className="animate-spin text-primary-500" />
                                <span className="text-sm font-medium">Coach is thinking...</span>
                            </div>
                        </Card>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Compact Suggestion Bar */}
            {showCompactSuggestions && (
                <CoachSuggestionCards
                    variant="compact"
                    onSendMessage={handleSendMessage}
                    isLoading={isLoading}
                />
            )}

            {/* Input Area */}
            <div className="flex-shrink-0 bg-white rounded-4xl p-3 shadow-soft border border-white/50">
                <div className="flex gap-2 items-end">
                    <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask your coach anything..."
                        className="flex-1 bg-transparent text-primary-900 placeholder-secondary-300 resize-none outline-none text-sm min-h-[40px] max-h-[120px] py-2 px-3 font-medium"
                        rows={1}
                        disabled={isLoading}
                    />
                    <button
                        onClick={() => handleSendMessage()}
                        disabled={!inputValue.trim() || isLoading}
                        className="flex-shrink-0 w-10 h-10 bg-[#3D745B] text-white rounded-full flex items-center justify-center hover:bg-[#315C49] active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-200/50 border border-white/20"
                    >
                        {isLoading ? (
                            <Loader2 size={18} className="animate-spin" />
                        ) : (
                            <Send size={18} />
                        )}
                    </button>
                </div>
            </div>

            {/* Save Workout Modal */}
            <SaveWorkoutModal
                isOpen={showSaveModal}
                onClose={() => setShowSaveModal(false)}
                workoutText={workoutToSave}
            />
        </div>
    );
};
