import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, Loader2, Settings, ArrowRight, Save } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { sendCoachMessage, ChatMessage, buildCoachContext, CoachContext } from '../services/coach';
import { saveChatMessage, getTodayChatMessages, getChatMessagesForDate, cleanupOldChatMessages } from '../services/storage';
import { AppView } from '../types';
import { detectWorkoutPlan } from '../utils/workoutParser';
import { SaveWorkoutModal } from '../components/SaveWorkoutModal';

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

            // Cleanup old messages (7+ days)
            await cleanupOldChatMessages();

            // Load today's chat history
            const today = new Date().toISOString().split('T')[0];
            const todayMessages = await getTodayChatMessages();

            if (todayMessages.length > 0) {
                // Load existing conversation
                setMessages(todayMessages);
                setLoadedDates(new Set([today]));
            } else {
                // Add welcome message for new conversation
                const welcomeMessage: ChatMessage = {
                    id: 'welcome',
                    role: 'assistant',
                    content: `👋 **Hi ${ctx.userName || 'there'}! I'm Cal Coach.**\n\nHow can I help you today?`,
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

    const handleSendMessage = async () => {
        if (!inputValue.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: `user-${Date.now()}`,
            role: 'user',
            content: inputValue,
            timestamp: Date.now()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputValue('');
        setIsLoading(true);

        // Save user message to database (non-blocking)
        saveChatMessage(userMessage).catch(err =>
            console.error('Failed to save user message:', err)
        );

        try {
            const response = await sendCoachMessage(inputValue, messages);

            const assistantMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
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
                id: `error-${Date.now()}`,
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
        // Navigate to Profile view using the passed onNavigate function
        onNavigate(AppView.PROFILE);
    };

    // Load previous day's messages when scrolling to top
    const loadPreviousDay = async () => {
        if (isLoadingHistory || !canLoadMore) return;

        setIsLoadingHistory(true);

        try {
            // Find the earliest loaded date
            const sortedDates = Array.from(loadedDates).sort();
            const earliestDate = sortedDates[0];

            if (!earliestDate) {
                setCanLoadMore(false);
                return;
            }

            // Calculate previous day
            const prevDate = new Date(earliestDate);
            prevDate.setDate(prevDate.getDate() - 1);
            const prevDateStr = prevDate.toISOString().split('T')[0];

            // Check if we've gone back 7 days
            const today = new Date().toISOString().split('T')[0];
            const daysDiff = Math.floor(
                (new Date(today).getTime() - new Date(prevDateStr).getTime()) / (1000 * 60 * 60 * 24)
            );

            if (daysDiff >= 7) {
                setCanLoadMore(false);
                return;
            }

            // Load previous day's messages
            const previousMessages = await getChatMessagesForDate(prevDateStr);

            if (previousMessages.length > 0) {
                // Prepend messages to existing state
                setMessages(prev => [...previousMessages, ...prev]);
                setLoadedDates(prev => new Set([...prev, prevDateStr]));
            } else {
                // No messages found, check even earlier
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

        // If scrolled to top (with small threshold)
        if (container.scrollTop < 50 && !isLoadingHistory && canLoadMore) {
            loadPreviousDay();
        }
    };

    // Show training goals prompt modal if training goals not set
    if (showGoalsPrompt) {
        return (
            <div className="flex-1 flex flex-col min-h-0 px-6 pt-10 pb-32 animate-in fade-in duration-500">
                <div className="flex-1 flex items-center justify-center px-6">
                    <Card className="p-8 max-w-md w-full relative overflow-hidden">
                        {/* Background decoration */}
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-royal-100 dark:bg-royal-950/20 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-32 h-32 bg-royal-100 dark:bg-royal-950/20 rounded-full blur-3xl"></div>

                        <div className="relative z-10">
                            {/* Icon */}
                            <div className="w-16 h-16 bg-gradient-to-br from-royal-500 to-royal-700 rounded-full flex items-center justify-center text-white shadow-lg mx-auto mb-6">
                                <Settings size={32} />
                            </div>

                            {/* Title */}
                            <h2 className="text-2xl font-extrabold text-gray-900 dark:text-gray-50 text-center mb-3">
                                Set Your Training Goals
                            </h2>

                            {/* Message */}
                            <p className="text-gray-600 dark:text-gray-400 text-center mb-6 leading-relaxed">
                                To provide you with personalized AI coaching, please complete your{' '}
                                <span className="font-bold text-royal-600 dark:text-royal-400">Training Goal Setting</span>{' '}
                                in your Profile.
                            </p>

                            {/* What we need */}
                            <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-4 mb-6">
                                <p className="text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                                    We need to know:
                                </p>
                                <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                                    <li className="flex items-start gap-2">
                                        <span className="text-royal-600 dark:text-royal-400 mt-0.5">•</span>
                                        <span>Your activity level (sedentary to extra active)</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-royal-600 dark:text-royal-400 mt-0.5">•</span>
                                        <span>Your fitness goal (cut, bulk, or maintain)</span>
                                    </li>
                                    <li className="flex items-start gap-2">
                                        <span className="text-royal-600 dark:text-royal-400 mt-0.5">•</span>
                                        <span>Your equipment access (gym, home, or bodyweight)</span>
                                    </li>
                                </ul>
                            </div>

                            {/* Action buttons */}
                            <div className="space-y-3">
                                <button
                                    onClick={handleGoToProfile}
                                    className="w-full flex items-center justify-center gap-2 py-4 bg-royal-600 hover:bg-royal-700 text-white rounded-[20px] font-bold transition-all shadow-lg shadow-royal-200 dark:shadow-royal-900/40 active:scale-95"
                                >
                                    <Settings size={20} />
                                    <span>Go to Profile</span>
                                    <ArrowRight size={20} />
                                </button>

                                <button
                                    onClick={() => setShowGoalsPrompt(false)}
                                    className="w-full py-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 rounded-[20px] font-semibold transition-all text-sm"
                                >
                                    I'll do this later
                                </button>
                            </div>
                        </div>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="flex-1 flex flex-col min-h-0 px-6 pt-10 pb-32 animate-in fade-in duration-500">
            {/* Header */}
            <header className="flex justify-between items-end mb-6 flex-shrink-0">
                <div>
                    <p className="text-gray-400 dark:text-gray-500 text-xs font-semibold uppercase tracking-widest mb-2">
                        Your Personal Coach
                    </p>
                    <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-50 tracking-tight leading-none">
                        Cal Coach
                    </h1>
                </div>
                <div className="w-12 h-12 bg-gradient-to-br from-royal-500 to-royal-700 rounded-full flex items-center justify-center text-white shadow-sm">
                    <Sparkles size={20} />
                </div>
            </header>

            {/* Messages Container */}
            <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto space-y-4 mb-4 no-scrollbar"
            >
                {/* Load More Indicator */}
                {isLoadingHistory && (
                    <div className="flex justify-center py-3 animate-in fade-in duration-300">
                        <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-sm">
                            <Loader2 size={14} className="animate-spin" />
                            <span>Loading earlier messages...</span>
                        </div>
                    </div>
                )}

                {/* Show "Load More" button when at top and there's more to load */}
                {!isLoadingHistory && canLoadMore && messages.length > 0 && loadedDates.size > 0 && (
                    <div className="flex justify-center py-2">
                        <button
                            onClick={loadPreviousDay}
                            className="text-xs text-gray-400 dark:text-gray-500 hover:text-royal-600 dark:hover:text-royal-400 transition-colors"
                        >
                            ↑ Load previous day
                        </button>
                    </div>
                )}
                {messages.map((message) => (
                    <div
                        key={message.id}
                        className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
                    >
                        <div
                            className={`max-w-[85%] ${message.role === 'user'
                                ? 'bg-royal-600 text-white rounded-[24px] px-5 py-3 shadow-lg'
                                : ''
                                }`}
                        >
                            {message.role === 'assistant' ? (
                                <div>
                                    <Card className="p-5">
                                        <div className="prose prose-sm dark:prose-invert max-w-none">
                                            <div
                                                className="text-gray-800 dark:text-gray-200 leading-relaxed whitespace-pre-wrap"
                                                dangerouslySetInnerHTML={{
                                                    __html: message.content
                                                        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                                                        .replace(/\n/g, '<br/>')
                                                }}
                                            />
                                        </div>
                                    </Card>
                                    {/* Save Workout Button */}
                                    {detectWorkoutPlan(message.content) && (
                                        <button
                                            onClick={() => {
                                                setWorkoutToSave(message.content);
                                                setShowSaveModal(true);
                                            }}
                                            className="mt-3 flex items-center gap-2 px-4 py-2 bg-royal-600 hover:bg-royal-700 text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-royal-200 dark:shadow-royal-900/40 active:scale-95"
                                        >
                                            <Save size={16} />
                                            <span>Save as Workout Plan</span>
                                        </button>
                                    )}
                                </div>
                            ) : (
                                <p className="text-sm font-medium leading-relaxed">{message.content}</p>
                            )}
                        </div>
                    </div>
                ))}
                {/* Initial Phase Suggestion Cards - Centrally in Message List */}
                {messages.length === 1 && messages[0].id === 'welcome' && !isLoading && (
                    <div className="grid grid-cols-1 gap-3 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
                        {[
                            { title: "Analyze Nutrition", desc: "Get insights on your recent eating habits", icon: "📊", text: "Analyze my recent nutrition", color: "from-blue-500/30 to-royal-500/30", baseBg: "bg-blue-50/40 dark:bg-blue-900/10", iconBg: "bg-blue-100 dark:bg-blue-900/40", iconBorder: "border-blue-200 dark:border-blue-700/50" },
                            { title: "Workout Plan", desc: "Create a personalized fitness routine", icon: "💪", text: "Create a workout plan for me", color: "from-royal-500/30 to-indigo-500/30", baseBg: "bg-royal-50/40 dark:bg-royal-950/20", iconBg: "bg-royal-100 dark:bg-royal-950/40", iconBorder: "border-royal-200 dark:border-royal-700/50" },
                            { title: "Calculate TDEE", desc: "Find out your daily energy expenditure", icon: "🔥", text: "Calculate my TDEE", color: "from-orange-500/30 to-royal-500/30", baseBg: "bg-orange-50/40 dark:bg-orange-900/10", iconBg: "bg-orange-100 dark:bg-orange-900/40", iconBorder: "border-orange-200 dark:border-orange-700/50" },
                            { title: "Macro Targets", desc: "Set optimal protein, carb, and fat goals", icon: "🎯", text: "Help me set macro targets", color: "from-violet-500/30 to-fuchsia-500/30", baseBg: "bg-violet-50/40 dark:bg-violet-900/10", iconBg: "bg-violet-100 dark:bg-violet-900/40", iconBorder: "border-violet-200 dark:border-violet-700/50" }
                        ].map((item, idx) => (
                            <button
                                key={idx}
                                onClick={() => {
                                    const sendDirectly = async (text: string) => {
                                        if (isLoading) return;
                                        const userMsg: ChatMessage = {
                                            id: `user-${Date.now()}`,
                                            role: 'user',
                                            content: text,
                                            timestamp: Date.now()
                                        };
                                        setMessages(prev => [...prev, userMsg]);
                                        setIsLoading(true);

                                        // Save user message to database (non-blocking)
                                        saveChatMessage(userMsg).catch(err =>
                                            console.error('Failed to save user message:', err)
                                        );

                                        try {
                                            const response = await sendCoachMessage(text, messages);
                                            const assistantMsg: ChatMessage = {
                                                id: `assistant-${Date.now()}`,
                                                role: 'assistant',
                                                content: response,
                                                timestamp: Date.now()
                                            };
                                            setMessages(prev => [...prev, assistantMsg]);

                                            // Save assistant message to database (non-blocking)
                                            saveChatMessage(assistantMsg).catch(err =>
                                                console.error('Failed to save assistant message:', err)
                                            );
                                        } catch (error: any) {
                                            const errorMsg: ChatMessage = {
                                                id: `error-${Date.now()}`,
                                                role: 'assistant',
                                                content: `⚠️ ${error.message || 'Failed to get response.'}`,
                                                timestamp: Date.now()
                                            };
                                            setMessages(prev => [...prev, errorMsg]);
                                        } finally {
                                            setIsLoading(false);
                                        }
                                    };
                                    sendDirectly(item.text);
                                }}
                                className={`flex items-center gap-4 p-4 ${item.baseBg} border-2 border-gray-100 dark:border-white/10 rounded-2xl hover:border-royal-500 dark:hover:border-royal-400 hover:shadow-xl hover:shadow-royal-500/10 transition-all text-left group active:scale-[0.98] relative overflow-hidden`}
                            >
                                <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                                <div className={`relative z-10 w-12 h-12 ${item.iconBg} ${item.iconBorder} border rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform shadow-sm group-hover:shadow-md`}>
                                    {item.icon}
                                </div>
                                <div className="relative z-10 flex-1">
                                    <h3 className="font-extrabold text-gray-900 dark:text-gray-50 text-sm tracking-tight">{item.title}</h3>
                                    <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 font-semibold opacity-80">{item.desc}</p>
                                </div>
                                <div className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 dark:bg-white/10 group-hover:bg-royal-500 group-hover:text-white transition-all shadow-sm">
                                    <ArrowRight size={16} className="text-gray-400 dark:text-gray-500 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                                </div>
                            </button>
                        ))}
                    </div>
                )}

                {isLoading && (
                    <div className="flex justify-start animate-in fade-in duration-300">
                        <Card className="p-5">
                            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                                <Loader2 size={16} className="animate-spin" />
                                <span className="text-sm">Coach is thinking...</span>
                            </div>
                        </Card>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {/* Active Phase Persistent Suggestion Bar - Compact Horizontal Scroll */}
            {messages.length > 1 && !isLoading && (
                <div className="flex gap-3 overflow-x-auto pb-4 px-1 no-scrollbar animate-in fade-in slide-in-from-bottom-2 duration-500">
                    {[
                        { title: "Analyze Nutrition", icon: "📊", text: "Analyze my recent nutrition", color: "from-blue-500/30 to-royal-500/30", baseBg: "bg-blue-50/40 dark:bg-blue-900/10", iconBg: "bg-blue-100 dark:bg-blue-900/40", iconBorder: "border-blue-200 dark:border-blue-700/50" },
                        { title: "Workout Plan", icon: "💪", text: "Create a workout plan for me", color: "from-royal-500/30 to-indigo-500/30", baseBg: "bg-royal-50/40 dark:bg-royal-950/20", iconBg: "bg-royal-100 dark:bg-royal-950/40", iconBorder: "border-royal-200 dark:border-royal-700/50" },
                        { title: "Calculate TDEE", icon: "🔥", text: "Calculate my TDEE", color: "from-orange-500/30 to-royal-500/30", baseBg: "bg-orange-50/40 dark:bg-orange-900/10", iconBg: "bg-orange-100 dark:bg-orange-900/40", iconBorder: "border-orange-200 dark:border-orange-700/50" },
                        { title: "Macro Targets", icon: "🎯", text: "Help me set macro targets", color: "from-violet-500/30 to-fuchsia-500/30", baseBg: "bg-violet-50/40 dark:bg-violet-900/10", iconBg: "bg-violet-100 dark:bg-violet-900/40", iconBorder: "border-violet-200 dark:border-violet-700/50" }
                    ].map((item, idx) => (
                        <button
                            key={idx}
                            onClick={() => {
                                const sendDirectly = async (text: string) => {
                                    if (isLoading) return;
                                    const userMsg: ChatMessage = {
                                        id: `user-${Date.now()}`,
                                        role: 'user',
                                        content: text,
                                        timestamp: Date.now()
                                    };
                                    setMessages(prev => [...prev, userMsg]);
                                    setIsLoading(true);

                                    // Save user message to database (non-blocking)
                                    saveChatMessage(userMsg).catch(err =>
                                        console.error('Failed to save user message:', err)
                                    );

                                    try {
                                        const response = await sendCoachMessage(text, messages);
                                        const assistantMsg: ChatMessage = {
                                            id: `assistant-${Date.now()}`,
                                            role: 'assistant',
                                            content: response,
                                            timestamp: Date.now()
                                        };
                                        setMessages(prev => [...prev, assistantMsg]);

                                        // Save assistant message to database (non-blocking)
                                        saveChatMessage(assistantMsg).catch(err =>
                                            console.error('Failed to save assistant message:', err)
                                        );
                                    } catch (error: any) {
                                        const errorMsg: ChatMessage = {
                                            id: `error-${Date.now()}`,
                                            role: 'assistant',
                                            content: `⚠️ ${error.message || 'Failed to get response.'}`,
                                            timestamp: Date.now()
                                        };
                                        setMessages(prev => [...prev, errorMsg]);
                                    } finally {
                                        setIsLoading(false);
                                    }
                                };
                                sendDirectly(item.text);
                            }}
                            className={`flex flex-shrink-0 items-center gap-3 p-3 min-w-[180px] ${item.baseBg} border-2 border-gray-100 dark:border-white/10 rounded-2xl hover:border-royal-500 dark:hover:border-royal-400 transition-all text-left group active:scale-[0.98] relative overflow-hidden`}
                        >
                            <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                            <div className={`relative z-10 w-10 h-10 ${item.iconBg} ${item.iconBorder} border rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform shadow-sm`}>
                                {item.icon}
                            </div>
                            <div className="relative z-10 flex-1">
                                <h3 className="font-extrabold text-gray-900 dark:text-gray-50 text-xs tracking-tight leading-tight">{item.title}</h3>
                            </div>
                        </button>
                    ))}
                </div>
            )}


            {/* Input Area */}
            <div className="flex-shrink-0 bg-white dark:bg-[#1a1c26] rounded-[24px] p-3 shadow-diffused dark:shadow-diffused-dark border border-gray-100 dark:border-white/5">
                <div className="flex gap-2 items-end">
                    <textarea
                        ref={inputRef}
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Ask your coach anything..."
                        className="flex-1 bg-transparent text-gray-900 dark:text-gray-50 placeholder-gray-400 dark:placeholder-gray-500 resize-none outline-none text-sm min-h-[40px] max-h-[120px] py-2 px-3"
                        rows={1}
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={!inputValue.trim() || isLoading}
                        className="flex-shrink-0 w-10 h-10 bg-royal-600 text-white rounded-[16px] flex items-center justify-center hover:bg-royal-700 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-royal-200 dark:shadow-royal-900/40"
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
