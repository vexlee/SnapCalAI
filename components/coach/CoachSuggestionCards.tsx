import React from 'react';
import { ArrowRight } from 'lucide-react';

interface SuggestionItem {
    title: string;
    desc?: string;
    icon: string;
    text: string;
    color: string;
    baseBg: string;
    iconBg: string;
    iconBorder: string;
}

interface CoachSuggestionCardsProps {
    onSendMessage: (text: string) => void;
    isLoading: boolean;
    variant: 'initial' | 'compact';
}

const SUGGESTIONS: SuggestionItem[] = [
    {
        title: "Analyze Nutrition",
        desc: "Get insights on your recent eating habits",
        icon: "📊",
        text: "Analyze my recent nutrition",
        color: "from-blue-500/30 to-royal-500/30",
        baseBg: "bg-blue-50/40 dark:bg-blue-900/10",
        iconBg: "bg-blue-100 dark:bg-blue-900/40",
        iconBorder: "border-blue-200 dark:border-blue-700/50"
    },
    {
        title: "Workout Plan",
        desc: "Create a personalized fitness routine",
        icon: "💪",
        text: "Create a workout plan for me",
        color: "from-royal-500/30 to-indigo-500/30",
        baseBg: "bg-royal-50/40 dark:bg-royal-950/20",
        iconBg: "bg-royal-100 dark:bg-royal-950/40",
        iconBorder: "border-royal-200 dark:border-royal-700/50"
    },
    {
        title: "Calculate TDEE",
        desc: "Find out your daily energy expenditure",
        icon: "🔥",
        text: "Calculate my TDEE",
        color: "from-orange-500/30 to-royal-500/30",
        baseBg: "bg-orange-50/40 dark:bg-orange-900/10",
        iconBg: "bg-orange-100 dark:bg-orange-900/40",
        iconBorder: "border-orange-200 dark:border-orange-700/50"
    },
    {
        title: "Macro Targets",
        desc: "Set optimal protein, carb, and fat goals",
        icon: "🎯",
        text: "Help me set macro targets",
        color: "from-violet-500/30 to-fuchsia-500/30",
        baseBg: "bg-violet-50/40 dark:bg-violet-900/10",
        iconBg: "bg-violet-100 dark:bg-violet-900/40",
        iconBorder: "border-violet-200 dark:border-violet-700/50"
    }
];

/**
 * Renders suggestion cards for quick actions in the coach chat.
 * Has two variants: 'initial' (full cards with descriptions) and 'compact' (horizontal scroll bar).
 */
export const CoachSuggestionCards: React.FC<CoachSuggestionCardsProps> = ({
    onSendMessage,
    isLoading,
    variant
}) => {
    if (variant === 'compact') {
        return (
            <div className="flex gap-3 overflow-x-auto pb-4 px-1 no-scrollbar animate-in fade-in slide-in-from-bottom-2 duration-500">
                {SUGGESTIONS.map((item, idx) => (
                    <button
                        key={idx}
                        onClick={() => !isLoading && onSendMessage(item.text)}
                        disabled={isLoading}
                        className={`flex flex-shrink-0 items-center gap-3 p-3 min-w-[180px] ${item.baseBg} border-2 border-gray-100 dark:border-white/10 rounded-2xl hover:border-royal-500 dark:hover:border-royal-400 transition-all text-left group active:scale-[0.98] relative overflow-hidden disabled:opacity-50`}
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
        );
    }

    // Initial variant - full cards with descriptions
    return (
        <div className="grid grid-cols-1 gap-3 mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-300">
            {SUGGESTIONS.map((item, idx) => (
                <button
                    key={idx}
                    onClick={() => !isLoading && onSendMessage(item.text)}
                    disabled={isLoading}
                    className={`flex items-center gap-4 p-4 ${item.baseBg} border-2 border-gray-100 dark:border-white/10 rounded-2xl hover:border-royal-500 dark:hover:border-royal-400 hover:shadow-xl hover:shadow-royal-500/10 transition-all text-left group active:scale-[0.98] relative overflow-hidden disabled:opacity-50`}
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
    );
};
