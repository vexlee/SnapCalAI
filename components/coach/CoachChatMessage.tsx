import React from 'react';
import { Check, Loader2, Plus, Save } from 'lucide-react';
import { Card } from '../ui/Card';
import { ChatMessage } from '../../services/coach';
import { detectWorkoutPlan, findWorkoutSuggestions, WorkoutSuggestion } from '../../utils/workoutParser';

interface CoachChatMessageProps {
    message: ChatMessage;
    onSaveWorkout: (content: string) => void;
    onQuickAddWorkout: (suggestion: WorkoutSuggestion) => void;
    quickAddLoading: string | null;
    addedWorkouts: Set<string>;
}

/**
 * Renders a single chat message in the coach chat interface.
 * Handles both user and assistant messages with different styling.
 * For assistant messages, includes workout detection and save buttons.
 */
export const CoachChatMessage: React.FC<CoachChatMessageProps> = ({
    message,
    onSaveWorkout,
    onQuickAddWorkout,
    quickAddLoading,
    addedWorkouts
}) => {
    const isUser = message.role === 'user';

    // Parse markdown-like formatting for assistant messages
    const formatContent = (content: string) => {
        return content
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n/g, '<br/>');
    };

    if (isUser) {
        return (
            <div className="flex justify-end animate-in fade-in slide-in-from-bottom-2 duration-300">
                <div className="max-w-[85%] bg-[#3D745B] text-white rounded-3xl rounded-tr-sm px-5 py-3 shadow-lg shadow-primary-200/50">
                    <p className="text-sm font-medium leading-relaxed">{message.content}</p>
                </div>
            </div>
        );
    }

    // Assistant message
    const suggestions = findWorkoutSuggestions(message.content);
    const hasWorkoutPlan = detectWorkoutPlan(message.content);

    return (
        <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="max-w-[85%]">
                <Card className="p-5 bg-white rounded-3xl rounded-tl-sm shadow-soft">
                    <div className="prose prose-sm max-w-none">
                        <div
                            className="text-secondary-800 leading-relaxed whitespace-pre-wrap font-medium"
                            dangerouslySetInnerHTML={{ __html: formatContent(message.content) }}
                        />
                    </div>
                </Card>

                {/* Quick Add Workout Buttons for detected suggestions */}
                {suggestions.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                        {suggestions.map((suggestion, idx) => {
                            const suggestionKey = `${suggestion.activity}-${suggestion.durationMin}`;
                            const isAdded = addedWorkouts.has(suggestionKey);
                            const isLoading = quickAddLoading === suggestionKey;

                            return (
                                <button
                                    key={idx}
                                    onClick={() => onQuickAddWorkout(suggestion)}
                                    disabled={isAdded || isLoading}
                                    className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-2xl transition-all active:scale-95 ${isAdded
                                        ? 'bg-green-100 text-green-700 cursor-default shadow-none'
                                        : 'bg-primary-100 text-primary-700 hover:bg-primary-200:bg-primary-900/50 shadow-sm'
                                        }`}
                                >
                                    {isLoading ? (
                                        <Loader2 size={16} className="animate-spin" />
                                    ) : isAdded ? (
                                        <Check size={16} />
                                    ) : (
                                        <Plus size={16} />
                                    )}
                                    <span>{isAdded ? 'Added!' : `Add ${suggestion.title}`}</span>
                                </button>
                            );
                        })}
                    </div>
                )}

                {/* Save Workout Button for full workout plans */}
                {hasWorkoutPlan && (
                    <button
                        onClick={() => onSaveWorkout(message.content)}
                        className="mt-3 flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold rounded-full transition-all shadow-lg shadow-primary-200/50 active:scale-95"
                    >
                        <Save size={16} />
                        <span>Save as Workout Plan</span>
                    </button>
                )}
            </div>
        </div>
    );
};
