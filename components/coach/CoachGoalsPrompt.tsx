import React from 'react';
import { Settings, ArrowRight } from 'lucide-react';
import { Card } from '../ui/Card';

interface CoachGoalsPromptProps {
    onGoToProfile: () => void;
    onDismiss: () => void;
}

/**
 * Full-screen modal prompting users to set their training goals
 * before they can use the AI coach features.
 */
export const CoachGoalsPrompt: React.FC<CoachGoalsPromptProps> = ({
    onGoToProfile,
    onDismiss
}) => {
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
                                onClick={onGoToProfile}
                                className="w-full flex items-center justify-center gap-2 py-4 bg-royal-600 hover:bg-royal-700 text-white rounded-[20px] font-bold transition-all shadow-lg shadow-royal-200 dark:shadow-royal-900/40 active:scale-95"
                            >
                                <Settings size={20} />
                                <span>Go to Profile</span>
                                <ArrowRight size={20} />
                            </button>

                            <button
                                onClick={onDismiss}
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
};
