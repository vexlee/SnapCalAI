import React, { useState } from 'react';
import { X, Plus, Trash2, ChevronLeft, Dumbbell, Heart, Leaf, Trophy, Footprints, Target, Zap, Flame, Bike, PersonStanding, Sparkles, Waves, Music, Sword, LucideIcon } from 'lucide-react';
import { Card } from './ui/Card';
import { WorkoutExercise } from '../types';
import { saveWorkoutPlan } from '../services/storage';
import { WORKOUT_TYPES, WORKOUT_CATEGORIES, WorkoutType } from '../constants/workoutTypes';

interface AddWorkoutModalProps {
    isOpen: boolean;
    onClose: () => void;
    defaultDate: Date;
    onSave?: () => void;
}

// Icon mapping for dynamic rendering
const iconMap: Record<string, LucideIcon> = {
    Dumbbell, Heart, Leaf, Trophy, Footprints, Target, Zap, Flame, Bike,
    PersonStanding, Sparkles, Waves, Music, Sword
};

export const AddWorkoutModal: React.FC<AddWorkoutModalProps> = ({ isOpen, onClose, defaultDate, onSave }) => {
    const [step, setStep] = useState<'select' | 'customize'>('select');
    const [selectedType, setSelectedType] = useState<WorkoutType | null>(null);
    const [selectedDate, setSelectedDate] = useState(defaultDate.toISOString().split('T')[0]);
    const [exercises, setExercises] = useState<Omit<WorkoutExercise, 'id' | 'completed'>[]>([]);
    const [saving, setSaving] = useState(false);
    const [activeCategory, setActiveCategory] = useState<string>('strength');

    if (!isOpen) return null;

    const handleSelectType = (type: WorkoutType) => {
        setSelectedType(type);
        setExercises([...type.defaultExercises]);
        setStep('customize');
    };

    const handleBack = () => {
        setStep('select');
        setSelectedType(null);
        setExercises([]);
    };

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
        if (!selectedType) return;

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

            await saveWorkoutPlan(selectedDate, selectedType.name, workoutExercises, undefined, selectedType.id);

            // Reset form
            setStep('select');
            setSelectedType(null);
            setExercises([]);
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

    const handleClose = () => {
        setStep('select');
        setSelectedType(null);
        setExercises([]);
        onClose();
    };

    const filteredWorkouts = WORKOUT_TYPES.filter(type => type.category === activeCategory);

    const renderIcon = (iconName: string, size: number = 24, className: string = '') => {
        const IconComponent = iconMap[iconName];
        return IconComponent ? <IconComponent size={size} className={className} /> : null;
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm animate-in fade-in duration-300 px-4">
            <Card className="w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col bg-[#F3F0E7] animate-in zoom-in-95 duration-300 border-none">
                {/* Header */}
                <div className="flex items-center justify-between p-5 bg-[#3D745B] text-white">
                    <div className="flex items-center gap-3">
                        {step === 'customize' && (
                            <button
                                onClick={handleBack}
                                className="p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors"
                            >
                                <ChevronLeft size={20} className="text-white" />
                            </button>
                        )}
                        <h2 className="text-xl font-extrabold">
                            {step === 'select' ? 'Choose Workout' : selectedType?.name}
                        </h2>
                    </div>
                    <button
                        onClick={handleClose}
                        className="p-2 hover:bg-white/10 rounded-full transition-colors"
                    >
                        <X size={20} className="text-white" />
                    </button>
                </div>

                {/* Content */}
                {step === 'select' ? (
                    <div className="flex-1 overflow-y-auto p-5">
                        {/* Category Tabs */}
                        <div className="flex gap-2 mb-5 overflow-x-auto no-scrollbar pb-1">
                            {WORKOUT_CATEGORIES.map((cat) => (
                                <button
                                    key={cat.id}
                                    onClick={() => setActiveCategory(cat.id)}
                                    className={`
                                        flex items-center gap-2 px-4 py-2.5 rounded-full font-bold text-sm whitespace-nowrap transition-all border-2
                                        ${activeCategory === cat.id
                                            ? 'bg-[#3D745B] text-white border-[#3D745B] shadow-lg shadow-primary-200'
                                            : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                        }
                                    `}
                                >
                                    {renderIcon(cat.icon, 16)}
                                    <span>{cat.name}</span>
                                </button>
                            ))}
                        </div>

                        {/* Workout Type Grid */}
                        <div className="grid grid-cols-2 gap-3">
                            {filteredWorkouts.map((type) => (
                                <button
                                    key={type.id}
                                    onClick={() => handleSelectType(type)}
                                    className="group relative p-5 bg-white hover:bg-gray-50 rounded-2xl transition-all hover:scale-[1.02] active:scale-[0.98] text-left border-2 border-gray-200/50 hover:border-[#3D745B]/30 shadow-sm"
                                >
                                    <div className={`w-12 h-12 bg-gray-50 rounded-xl flex items-center justify-center mb-3 shadow-sm group-hover:scale-110 transition-transform`}>
                                        {renderIcon(type.icon, 24, type.color.split(' ')[0])}
                                    </div>
                                    <h3 className="font-bold text-gray-900 dark:text-gray-50 mb-1">
                                        {type.name}
                                    </h3>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {type.defaultExercises.length} exercises
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="flex-1 overflow-y-auto p-5 space-y-5">
                        {/* Workout Type Badge */}
                        {selectedType && (
                            <div className="flex items-center gap-3 p-4 bg-white rounded-xl border-2 border-gray-100 shadow-sm">
                                <div className={`w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center`}>
                                    {renderIcon(selectedType.icon, 20, selectedType.color.split(' ')[0])}
                                </div>
                                <div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold uppercase tracking-wide">
                                        {WORKOUT_CATEGORIES.find(c => c.id === selectedType.category)?.name}
                                    </p>
                                    <p className="font-bold text-gray-900 dark:text-gray-50">
                                        {selectedType.name}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* Date Input */}
                        <div>
                            <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-2">
                                Date
                            </label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="w-full px-4 py-3 bg-white border-2 border-gray-100 rounded-xl text-gray-900 focus:outline-none focus:border-[#3D745B] transition-colors"
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
                                    className="flex items-center gap-1 px-3 py-1.5 bg-[#3D745B] hover:bg-[#2D5A45] text-white text-sm font-semibold rounded-lg transition-colors shadow-md"
                                >
                                    <Plus size={16} />
                                    <span>Add</span>
                                </button>
                            </div>

                            <div className="space-y-3">
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
                                                    className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-gray-50 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400"
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
                                                            className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-gray-50 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400"
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
                                                            className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-gray-50 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400"
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
                                                            className="w-full px-3 py-2 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg text-sm text-gray-900 dark:text-gray-50 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400"
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
                )}

                {/* Footer */}
                {step === 'customize' && (
                    <div className="flex items-center justify-end gap-3 p-5 border-t border-gray-100 dark:border-white/10">
                        <button
                            onClick={handleClose}
                            disabled={saving}
                            className="px-6 py-3 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-white/5 rounded-xl font-semibold transition-colors disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="px-6 py-3 bg-[#3D745B] hover:bg-[#2D5A45] text-white rounded-xl font-semibold transition-colors disabled:opacity-50 shadow-lg shadow-primary-200"
                        >
                            {saving ? 'Saving...' : 'Save Workout'}
                        </button>
                    </div>
                )}
            </Card>
        </div>
    );
};
