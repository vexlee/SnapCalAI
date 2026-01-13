import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Send, Loader2, Settings, ArrowRight } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { sendCoachMessage, ChatMessage, buildCoachContext, CoachContext } from '../services/coach';
import { AppView } from '../types';

interface CalCoachProps {
    onNavigate: (view: AppView) => void;
}

export const CalCoach: React.FC<CalCoachProps> = ({ onNavigate }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [context, setContext] = useState<CoachContext | null>(null);
    const [showGoalsPrompt, setShowGoalsPrompt] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLTextAreaElement>(null);

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

            // Add welcome message
            const welcomeMessage: ChatMessage = {
                id: 'welcome',
                role: 'assistant',
                content: `👋 **Welcome to SnapCal AI Elite Coach**

I'm your dual-certified Professional Fitness Trainer (NSCA-CPT) and Clinical Nutritionist. I'm here to provide science-based fitness and nutrition programming tailored specifically to your goals.

${ctx.userName ? `Great to see you, ${ctx.userName}! ` : ''}I can analyze your nutrition data, create personalized workout plans, calculate your TDEE, set macro targets, and provide evidence-based recommendations.

**How can I help you today?**
- "Analyze my recent nutrition"
- "Create a workout plan for me"
- "Calculate my TDEE"
- "Help me set macro targets"

*Disclaimer: Always consult with a physician before starting any new exercise or nutrition program.*`,
                timestamp: Date.now()
            };

            setMessages([welcomeMessage]);
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

        try {
            const response = await sendCoachMessage(inputValue, messages);

            const assistantMessage: ChatMessage = {
                id: `assistant-${Date.now()}`,
                role: 'assistant',
                content: response,
                timestamp: Date.now()
            };

            setMessages(prev => [...prev, assistantMessage]);
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

    // Show training goals prompt modal if training goals not set
    if (showGoalsPrompt) {
        return (
            <div className="flex-1 flex flex-col min-h-0 px-6 pt-10 pb-32 animate-in fade-in duration-500">
                <div className="flex-1 flex items-center justify-center px-6">
                    <Card className="p-8 max-w-md w-full relative overflow-hidden">
                        {/* Background decoration */}
                        <div className="absolute top-0 right-0 -mt-10 -mr-10 w-32 h-32 bg-royal-100 dark:bg-royal-950/20 rounded-full blur-3xl"></div>
                        <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-32 h-32 bg-emerald-100 dark:bg-emerald-950/20 rounded-full blur-3xl"></div>

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
            <div className="flex-1 overflow-y-auto space-y-4 mb-4 no-scrollbar">
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
                            ) : (
                                <p className="text-sm font-medium leading-relaxed">{message.content}</p>
                            )}
                        </div>
                    </div>
                ))}

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
        </div>
    );
};
