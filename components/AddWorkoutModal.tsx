import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Card } from './ui/Card';
import { WorkoutExercise } from '../types';
import { saveWorkoutPlan } from '../services/storage';

interface AddWorkoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultDate: Date;
    onSave?: () => void;
}

export const AddWorkoutModal: React.FC<AddWorkoutModalProps> = ({ isOpen, onClose, defaultDate, onSave }) => {
    const [title, setTitle] = useState('');
    const [selectedDate, setSelectedDate] = useState(defaultDate.toISOString().split('T')[0]);
    const [exercises, setExercises] = useState<Omit<WorkoutExercise, 'id' | 'completed'>[]>([
        { name: '', sets: 3, reps: '10', rest: '60s' }
    ]);
    const [saving, setSaving] = useState(false);

    if (!isOpen) return null;

    const addExercise = () => {
        setExercises([...exercises, { name: '', sets: 3, reps: '10', rest: '60s' }]);
    };

    const removeExercise = (index: number) => {
        setExercises(exercises.filter((_, i) => i !== index));
    };

    const updateExercise = (index: number, field: keyof Omit<WorkoutExercise, 'id' | 'completed'>, value: any) => {
        const updated = [...exercises];
        updated[index] = { ...updated[index], [field]: value };
        setExercises(updated);
    };

    const handleSave = async () => {
        // Validation
        if (!title.trim()) {
            alert('Please enter a workout title');
            return;
        }

        const validExercises = exercises.filter(ex => ex.name.trim());
        if (validExercises.length === 0) {
            alert('Please add at least one exercise');
            return;
        }

        setSaving(true);

        try {
            const workoutExercises: WorkoutExercise[] = validExercises.map((ex, idx) => ({
                ...ex,
                id: `ex-${Date.now()}-${idx}`,
                completed: false
            }));

            await saveWorkoutPlan(selectedDate, title, workoutExercises);

            // Reset form
            setTitle('');
            setExercises([{ name: '', sets: 3, reps: '10', rest: '60s' }]);
            setSelectedDate(defaultDate.toISOString().split('T')[0]);

            onSave?.();
            onClose();
        } catch (error) {
            console.error('Failed to save workout:', error);
            alert('Failed to save workout plan');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300 px-6">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-white/10">
                    <h2 className="text-xl font-extrabold text-gray-900 dark:text-gray-50">
                        Create Workout Plan
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 dark:hover:bg-white/5 rounded-full transition-colors"
                    >
                        <X size={20} className="text-gray-500 dark:text-gray-400" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Title Input */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Workout Title
                        </label>
                        <input
                            type="text"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            placeholder="e.g., Chest & Triceps, Leg Day"
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border-2 border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-gray-50 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-royal-500 dark:focus:border-royal-400 transition-colors"
                        />
                    </div>

                    {/* Date Input */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                            Date
                        </label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="w-full px-4 py-3 bg-gray-50 dark:bg-white/5 border-2 border-gray-200 dark:border-white/10 rounded-xl text-gray-900 dark:text-gray-50 focus:outline-none focus:border-royal-500 dark:focus:border-royal-400 transition-colors"
                        />
                    </div>

                    {/* Exercises */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300">
                                Exercises
                            </label>
                            <button
                                onClick={addExercise}
                                className="flex items-center gap-1 px-3 py-1.5 bg-royal-600 hover:bg-royal-700 text-white text-sm font-semibold rounded-lg transition-colors"
                            >
                                <Plus size={16} />
                                <span>Add Exercise</span>
                            </button>
                        </div>

                        <div className="space-y-4">
                            {exercises.map((exercise, idx) => (
                                <div key={idx} className="p-4 bg-gray-50 dark:bg-white/5 rounded-xl border-2 border-gray-100 dark:border-white/5">
                                    <div className="flex items-start gap-3">
                                        <div className="flex-1 space-y-3">
                                            {/* Exercise Name */}
                                            <input
                                                type="text"
                                                value={exercise.name}
                                                onChange={(e) => updateExercise(idx, 'name', e.target.value)}
                                                placeholder="Exercise name"
                                                className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-gray-50 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-royal-500 dark:focus:border-royal-400"
                                            />

                                            {/* Sets, Reps, Rest */}
                                            <div className="grid grid-cols-3 gap-2">
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                                                        Sets
                                                    </label>
                                                    <input
                                                        type="number"
                                                        value={exercise.sets}
                                                        onChange={(e) => updateExercise(idx, 'sets', parseInt(e.target.value) || 0)}
                                                        min="1"
                                                        className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-gray-50 focus:outline-none focus:border-royal-500 dark:focus:border-royal-400"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                                                        Reps
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={exercise.reps}
                                                        onChange={(e) => updateExercise(idx, 'reps', e.target.value)}
                                                        placeholder="8-10"
                                                        className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-gray-50 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-royal-500 dark:focus:border-royal-400"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-semibold text-gray-500 dark:text-gray-400 mb-1">
                                                        Rest
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={exercise.rest}
                                                        onChange={(e) => updateExercise(idx, 'rest', e.target.value)}
                                                        placeholder="60s"
                                                        className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-gray-50 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-royal-500 dark:focus:border-royal-400"
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Remove Button */}
                                        {exercises.length > 1 && (
                                            <button
                                                onClick={() => removeExercise(idx)}
                                                className="p-2 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg transition-colors"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
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
                        className="px-6 py-3 bg-royal-600 hover:bg-royal-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-royal-200 dark:shadow-royal-900/40"
                    >
                        {saving ? 'Saving...' : 'Save Workout'}
                    </button>
                </div>

            </Card>
        </div>
    );
};
