import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Card } from './ui/Card';
import { parseMultiDayWorkoutPlan } from '../utils/workoutParser';
import { saveMultiDayWorkoutPlan } from '../services/storage';

interface SaveWorkoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    workoutText: string;
}

export const SaveWorkoutModal: React.FC<SaveWorkoutModalProps> = ({ isOpen, onClose, workoutText }) => {
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [saving, setSaving] = useState(false);
    const [parsedPlan, setParsedPlan] = useState<ReturnType<typeof parseMultiDayWorkoutPlan> | null>(null);

    // Parse workout plan when modal opens
    useEffect(() => {
        if (isOpen && workoutText) {
            const plan = parseMultiDayWorkoutPlan(workoutText);
            setParsedPlan(plan);
        }
    }, [isOpen, workoutText]);

    if (!isOpen) return null;

    const handleSave = async () => {
        if (!parsedPlan) return;

        setSaving(true);

        try {
            await saveMultiDayWorkoutPlan(selectedDate, parsedPlan.days);

            const dayCount = parsedPlan.days.length;
            const planType = parsedPlan.isMultiDay ? `${dayCount}-day` : 'single-day';

            alert(`${planType} workout plan saved successfully! Go check it out in the Workout Plan page.`);
            onClose();
        } catch (error) {
            console.error('Failed to save workout:', error);
            alert('Failed to save workout plan');
        } finally {
            setSaving(false);
        }
    };

    // Calculate end date for multi-day plans
    const getEndDate = () => {
        if (!parsedPlan || !parsedPlan.isMultiDay) return null;

        const startDate = new Date(selectedDate);
        const endDate = new Date(startDate);
        endDate.setDate(endDate.getDate() + parsedPlan.days.length - 1);

        return endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    const startDateFormatted = new Date(selectedDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    const endDate = getEndDate();
    const dayCount = parsedPlan?.days.length || 0;
    const isMultiDay = parsedPlan?.isMultiDay || false;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300 px-6">
            <Card className="w-full max-w-md animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/10">
                    <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-50">
                        Save Workout Plan
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
                    >
                        <X size={20} className="text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Plan Summary for Multi-Day */}
                    {isMultiDay && (
                        <div className="p-4 bg-primary-50 dark:bg-primary-950/20 border-2 border-primary-200 dark:border-primary-800/50 rounded-xl">
                            <p className="text-sm font-bold text-primary-900 dark:text-primary-100 mb-1">
                                📅 {dayCount}-Day Workout Plan
                            </p>
                            <p className="text-xs text-primary-700 dark:text-primary-300">
                                Will be saved from <strong>{startDateFormatted}</strong> to <strong>{endDate}</strong>
                            </p>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            {isMultiDay ? 'Choose Start Date' : 'Choose Date'}
                        </label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border-2 border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-gray-50 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 transition-colors"
                        />
                        <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
                            {isMultiDay
                                ? `Select the first day of your ${dayCount}-day plan`
                                : 'Select which day you want to use this workout plan'
                            }
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100 dark:border-white/10">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-6 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl font-semibold transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-primary-200 dark:shadow-primary-900/40"
                    >
                        <Save size={18} />
                        <span>{saving ? 'Saving...' : (isMultiDay ? `Save ${dayCount}-Day Plan` : 'Save Plan')}</span>
                    </button>
                </div>

            </Card>
        </div>
    );
};
