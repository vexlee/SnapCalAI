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
        color: "from-blue-500/30 to-primary-500/30",
        baseBg: "bg-blue-50",
        iconBg: "bg-blue-100",
        iconBorder: "border-blue-300"
    },
    {
        title: "Workout Plan",
        desc: "Create a personalized fitness routine",
        icon: "💪",
        text: "Create a workout plan for me",
        color: "from-primary-500/30 to-emerald-500/30",
        baseBg: "bg-primary-50",
        iconBg: "bg-primary-100",
        iconBorder: "border-primary-300"
    },
    {
        title: "Calculate TDEE",
        desc: "Find out your daily energy expenditure",
        icon: "🔥",
        text: "Calculate my TDEE",
        color: "from-orange-500/30 to-primary-500/30",
        baseBg: "bg-orange-50",
        iconBg: "bg-orange-100",
        iconBorder: "border-orange-300"
    },
    {
        title: "Macro Targets",
        desc: "Set optimal protein, carb, and fat goals",
        icon: "🎯",
        text: "Help me set macro targets",
        color: "from-primary-600/30 to-teal-500/30",
        baseBg: "bg-teal-50",
        iconBg: "bg-teal-100",
        iconBorder: "border-teal-300"
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
                        className={`flex flex-shrink-0 items-center gap-3 p-3 min-w-[180px] ${item.baseBg} border-2 border-gray-200 rounded-2xl hover:border-primary-400 transition-all text-left group active:scale-[0.98] relative overflow-hidden disabled:opacity-50 shadow-sm`}
                    >
                        <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                        <div className={`relative z-10 w-10 h-10 ${item.iconBg} ${item.iconBorder} border rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform shadow-sm`}>
                            {item.icon}
                        </div>
                        <div className="relative z-10 flex-1">
                            <h3 className="font-extrabold text-gray-900 text-xs tracking-tight leading-tight">{item.title}</h3>
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
                    className={`flex items-center gap-4 p-4 ${item.baseBg} border-2 border-gray-100 rounded-4xl hover:border-primary-400 hover:shadow-soft transition-all text-left group active:scale-[0.98] relative overflow-hidden disabled:opacity-50 shadow-sm`}
                >
                    <div className={`absolute inset-0 bg-gradient-to-br ${item.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
                    <div className={`relative z-10 w-12 h-12 ${item.iconBg} ${item.iconBorder} border rounded-2xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform shadow-sm group-hover:shadow-md`}>
                        {item.icon}
                    </div>
                    <div className="relative z-10 flex-1">
                        <h3 className="font-black text-primary-900 text-sm tracking-tight">{item.title}</h3>
                        <p className="text-xs text-secondary-500 mt-0.5 font-bold opacity-80">{item.desc}</p>
                    </div>
                    <div className="relative z-10 w-8 h-8 flex items-center justify-center rounded-full bg-white group-hover:bg-primary-600 group-hover:text-white transition-all shadow-sm">
                        <ArrowRight size={16} className="text-secondary-300 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                    </div>
                </button>
            ))}
        </div>
    );
};
