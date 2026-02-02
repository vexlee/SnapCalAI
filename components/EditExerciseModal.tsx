import React, { useState, useEffect } from 'react';
import { X, Save } from 'lucide-react';
import { Card } from './ui/Card';
import { WorkoutExercise } from '../types';

interface EditExerciseModalProps {
    isOpen: boolean;
    onClose: () => void;
    exercise: WorkoutExercise | null;
    onSave: (exercise: WorkoutExercise) => void;
}

export const EditExerciseModal: React.FC<EditExerciseModalProps> = ({ isOpen, onClose, exercise, onSave }) => {
    const [name, setName] = useState('');
    const [sets, setSets] = useState(3);
    const [reps, setReps] = useState('10');
    const [rest, setRest] = useState('60s');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (exercise) {
            setName(exercise.name);
            setSets(exercise.sets);
            setReps(exercise.reps);
            setRest(exercise.rest);
        }
    }, [exercise]);

    if (!isOpen || !exercise) return null;

    const handleSave = async () => {
        if (!name.trim()) {
            alert('Please enter an exercise name');
            return;
        }

        setSaving(true);

        const updatedExercise: WorkoutExercise = {
            ...exercise,
            name: name.trim(),
            sets,
            reps: reps.trim(),
            rest: rest.trim()
        };

        onSave(updatedExercise);
        setSaving(false);
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300 px-6">
            <Card className="w-full max-w-md animate-in zoom-in-95 duration-300">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-100">
                    <h2 className="text-xl font-extrabold text-gray-900">
                        Edit Exercise
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100:bg-white/5 rounded-full transition-colors"
                    >
                        <X size={20} className="text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-4">
                    {/* Exercise Name */}
                    <div>
                        <label className="block text-sm font-bold text-gray-700 mb-2">
                            Exercise Name
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Bench Press"
                            className="w-full px-4 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary-500:border-primary-400 transition-colors"
                        />
                    </div>

                    {/* Sets, Reps, Rest */}
                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2">
                                Sets
                            </label>
                            <input
                                type="number"
                                value={sets}
                                onChange={(e) => setSets(parseInt(e.target.value) || 0)}
                                min="1"
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:border-primary-500:border-primary-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2">
                                Reps
                            </label>
                            <input
                                type="text"
                                value={reps}
                                onChange={(e) => setReps(e.target.value)}
                                placeholder="8-10"
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary-500:border-primary-400"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-2">
                                Rest
                            </label>
                            <input
                                type="text"
                                value={rest}
                                onChange={(e) => setRest(e.target.value)}
                                placeholder="60s"
                                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:border-primary-500:border-primary-400"
                            />
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-100">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-6 py-3 text-gray-700 hover:bg-gray-100:bg-white/5 rounded-xl font-semibold transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-xl font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-primary-200"
                    >
                        <Save size={18} />
                        <span>{saving ? 'Saving...' : 'Save Changes'}</span>
                    </button>
                </div>
            </Card>
        </div>
    );
};
