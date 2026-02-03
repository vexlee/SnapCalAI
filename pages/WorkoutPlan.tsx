import React, { useState, useEffect } from 'react';
import { Dumbbell, Calendar, CheckCircle2, Circle, ChevronLeft, ChevronRight, Plus, Sparkles, Pencil, Trash2 } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { WorkoutExercise, DailyWorkout, AppView } from '../types';
import { getWorkoutPlansForDate, getWorkoutPlansForMonth, saveWorkoutPlan, deleteWorkoutPlanById } from '../services/storage';
import { AddWorkoutModal } from '../components/AddWorkoutModal';
import { EditExerciseModal } from '../components/EditExerciseModal';

interface WorkoutPlanProps {
    onNavigate?: (view: AppView) => void;
}

export const WorkoutPlan: React.FC<WorkoutPlanProps> = ({ onNavigate }) => {
    const [currentMonth, setCurrentMonth] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date>(new Date());
    const [workoutPlans, setWorkoutPlans] = useState<DailyWorkout[]>([]); // Changed to array
    const [planDates, setPlanDates] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(false);
    const [showAddModal, setShowAddModal] = useState(false);
    const [editingExercise, setEditingExercise] = useState<WorkoutExercise | null>(null);
    const [editingWorkoutId, setEditingWorkoutId] = useState<string | null>(null); // Track which workout is being edited
    const [showEditModal, setShowEditModal] = useState(false);

    // Reload function for when a workout is saved
    const reloadWorkout = async () => {
        // Reload plan dates for month
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth() + 1;
        const dates = await getWorkoutPlansForMonth(year, month);
        setPlanDates(new Set(dates));

        // Reload current workout plans
        const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        const plans = await getWorkoutPlansForDate(dateStr);
        setWorkoutPlans(plans);
    };

    // Load workout plans for current month
    useEffect(() => {
        const loadPlanDatesForMonth = async () => {
            const year = currentMonth.getFullYear();
            const month = currentMonth.getMonth() + 1;
            const dates = await getWorkoutPlansForMonth(year, month);
            setPlanDates(new Set(dates));
        };

        loadPlanDatesForMonth();
    }, [currentMonth]);

    // Load workout plan for selected date
    useEffect(() => {
        const loadWorkoutPlan = async () => {
            setLoading(true);
            const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
            const plans = await getWorkoutPlansForDate(dateStr);
            setWorkoutPlans(plans);
            setLoading(false);
        };

        loadWorkoutPlan();
    }, [selectedDate]);

    // Get calendar grid for current month
    const getMonthDays = (): (Date | null)[] => {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();

        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);

        const startDay = firstDay.getDay(); // 0 = Sunday
        const daysInMonth = lastDay.getDate();

        const days: (Date | null)[] = [];

        // Add empty cells for days before month starts
        for (let i = 0; i < startDay; i++) {
            days.push(null);
        }

        // Add all days in month
        for (let day = 1; day <= daysInMonth; day++) {
            days.push(new Date(year, month, day));
        }

        return days;
    };

    const monthDays = getMonthDays();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isSameDay = (date1: Date, date2: Date): boolean => {
        return date1.getFullYear() === date2.getFullYear() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getDate() === date2.getDate();
    };

    const handlePreviousMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
    };

    const handleNextMonth = () => {
        setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
    };

    const handleDateSelect = (date: Date) => {
        setSelectedDate(date);
    };

    const toggleExerciseComplete = async (workoutId: string, exerciseId: string) => {
        // Find the workout and update the exercise completion status
        const workout = workoutPlans.find(w => w.id === workoutId);
        if (!workout) return;

        const updatedExercises = workout.exercises.map(ex =>
            ex.id === exerciseId ? { ...ex, completed: !ex.completed } : ex
        );

        // Update local state
        setWorkoutPlans(prevPlans =>
            prevPlans.map(plan =>
                plan.id === workoutId
                    ? { ...plan, exercises: updatedExercises }
                    : plan
            )
        );

        // Save to storage to persist the completion status
        const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        await saveWorkoutPlan(dateStr, workout.title, updatedExercises, workoutId);
    };

    const handleEditExercise = (workoutId: string, exercise: WorkoutExercise) => {
        setEditingWorkoutId(workoutId);
        setEditingExercise(exercise);
        setShowEditModal(true);
    };

    const handleDeleteExercise = async (workoutId: string, exerciseId: string) => {
        const workout = workoutPlans.find(w => w.id === workoutId);
        if (!workout) return;

        if (confirm('Are you sure you want to delete this exercise?')) {
            const updatedExercises = workout.exercises.filter(ex => ex.id !== exerciseId);

            // Update local state
            setWorkoutPlans(prevPlans =>
                prevPlans.map(plan =>
                    plan.id === workoutId
                        ? { ...plan, exercises: updatedExercises }
                        : plan
                )
            );

            // Save to storage
            const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
            await saveWorkoutPlan(dateStr, workout.title, updatedExercises, workoutId);
        }
    };

    const handleDeleteWorkout = async (workoutId: string) => {
        if (confirm('Are you sure you want to delete this entire workout plan?')) {
            await deleteWorkoutPlanById(workoutId);
            await reloadWorkout();
        }
    };

    const handleSaveEdit = async (updatedExercise: WorkoutExercise) => {
        if (!editingWorkoutId) return;

        const workout = workoutPlans.find(w => w.id === editingWorkoutId);
        if (!workout) return;

        const updatedExercises = workout.exercises.map(ex =>
            ex.id === updatedExercise.id ? updatedExercise : ex
        );

        // Update local state
        setWorkoutPlans(prevPlans =>
            prevPlans.map(plan =>
                plan.id === editingWorkoutId
                    ? { ...plan, exercises: updatedExercises }
                    : plan
            )
        );

        // Save to storage
        const dateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
        await saveWorkoutPlan(dateStr, workout.title, updatedExercises, editingWorkoutId);

        setShowEditModal(false);
        setEditingExercise(null);
        setEditingWorkoutId(null);
    };

    // Calculate total progress across all workouts
    const allExercises = workoutPlans.flatMap(w => w.exercises);
    const completedCount = allExercises.filter(ex => ex.completed).length;
    const totalCount = allExercises.length;
    const progressPercent = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];

    return (
        <div className="flex-1 flex flex-col min-h-0 px-6 pt-10 pb-32 animate-in fade-in duration-500">
            {/* Header */}
            <header className="flex justify-between items-end mb-6 flex-shrink-0">
                <div>
                    <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-2">
                        Your Training Schedule
                    </p>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight leading-none">
                        Workout Plan
                    </h1>
                </div>
                <div className="w-12 h-12 bg-[#3D745B] rounded-full flex items-center justify-center text-white shadow-sm">
                    <Dumbbell size={20} />
                </div>
            </header>

            <div className="flex-1 overflow-y-auto space-y-6 no-scrollbar">
                {/* Monthly Calendar Card */}
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-primary-600" />
                            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wide">
                                {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
                            </h2>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handlePreviousMonth}
                                className="p-1.5 hover:bg-gray-100:bg-white/5 rounded-lg transition-colors"
                            >
                                <ChevronLeft size={18} className="text-gray-600" />
                            </button>
                            <button
                                onClick={handleNextMonth}
                                className="p-1.5 hover:bg-gray-100:bg-white/5 rounded-lg transition-colors"
                            >
                                <ChevronRight size={18} className="text-gray-600" />
                            </button>
                        </div>
                    </div>

                    {/* Day names */}
                    <div className="grid grid-cols-7 gap-1 mb-2">
                        {dayNames.map((day, idx) => (
                            <div key={idx} className="text-center text-xs font-bold text-gray-400 py-1">
                                {day}
                            </div>
                        ))}
                    </div>

                    {/* Calendar grid */}
                    <div className="grid grid-cols-7 gap-1">
                        {monthDays.map((date, idx) => {
                            if (!date) {
                                return <div key={`empty-${idx}`} className="aspect-square" />;
                            }

                            const isSelected = isSameDay(date, selectedDate);
                            const isToday = isSameDay(date, today);
                            // Use local timezone to avoid one-day offset
                            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                            const hasPlan = planDates.has(dateStr);

                            return (
                                <button
                                    key={idx}
                                    onClick={() => handleDateSelect(date)}
                                    className={`
                                        aspect-square flex flex-col items-center justify-center p-1 rounded-xl transition-all relative text-sm
                                        ${isSelected
                                            ? 'bg-[#3D745B] text-white shadow-lg shadow-primary-200 scale-105 font-bold'
                                            : 'bg-gray-50 text-gray-700 hover:bg-primary-100 hover:scale-105'
                                        }
                                    `}
                                >
                                    <span>{date.getDate()}</span>
                                    {isToday && !isSelected && (
                                        <div className="absolute bottom-1 w-1 h-1 bg-[#3D745B] rounded-full" />
                                    )}
                                    {hasPlan && (
                                        <div className={`absolute top-1 right-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-white' : 'bg-[#3D745B]'}`} />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </Card>

                {/* Workout Content */}
                {loading ? (
                    <Card className="p-8">
                        <div className="flex items-center justify-center">
                            <div className="w-8 h-8 border-2 border-primary-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    </Card>
                ) : workoutPlans.length > 0 ? (
                    /* Workout Display - Multiple Workouts */
                    <div className="space-y-6">
                        {/* Overall Progress Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-extrabold text-gray-900">
                                    {isSameDay(selectedDate, today) ? "Today's Workouts" : "Workout Plans"}
                                </h2>
                                <p className="text-xs text-gray-500 font-semibold mt-0.5">
                                    {workoutPlans.length} {workoutPlans.length === 1 ? 'workout' : 'workouts'} scheduled
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-2xl font-extrabold text-primary-600">
                                    {completedCount}/{totalCount}
                                </p>
                                <p className="text-xs text-gray-500 font-semibold">
                                    Overall Progress
                                </p>
                            </div>
                        </div>

                        {/* Overall Progress Bar */}
                        <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500 ease-out rounded-full"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>

                        {/* Individual Workout Plans */}
                        {workoutPlans.map((workout) => {
                            const workoutCompletedCount = workout.exercises.filter(ex => ex.completed).length;
                            const workoutTotalCount = workout.exercises.length;
                            const workoutProgressPercent = workoutTotalCount > 0 ? (workoutCompletedCount / workoutTotalCount) * 100 : 0;

                            return (
                                <Card key={workout.id} className="p-6 border-2 border-gray-200">
                                    {/* Workout Header */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <h3 className="text-base font-extrabold text-gray-900 mb-1">
                                                {workout.title}
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-primary-600">
                                                    {workoutCompletedCount}/{workoutTotalCount} completed
                                                </span>
                                                <span className="text-xs text-gray-400">•</span>
                                                <span className="text-xs text-gray-500">
                                                    {Math.round(workoutProgressPercent)}%
                                                </span>
                                            </div>
                                        </div>
                                        {/* Delete Workout Button */}
                                        <button
                                            onClick={() => handleDeleteWorkout(workout.id!)}
                                            className="p-2 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete entire workout"
                                        >
                                            <Trash2 size={16} className="text-red-600" />
                                        </button>
                                    </div>

                                    {/* Workout Progress Bar */}
                                    <div className="mb-4 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-primary-500 to-primary-600 transition-all duration-500 ease-out rounded-full"
                                            style={{ width: `${workoutProgressPercent}%` }}
                                        />
                                    </div>

                                    {/* Exercise List */}
                                    <div className="space-y-3">
                                        {workout.exercises.map((exercise) => (
                                            <button
                                                key={exercise.id}
                                                onClick={() => toggleExerciseComplete(workout.id!, exercise.id)}
                                                className={`
                                                    w-full text-left transition-all active:scale-[0.98]
                                                    ${exercise.completed ? 'opacity-60' : ''}
                                                `}
                                            >
                                                <Card className={`p-4 ${exercise.completed ? 'bg-primary-50/50' : ''}`}>
                                                    <div className="flex items-start gap-3">
                                                        <div className="flex-shrink-0 mt-0.5">
                                                            {exercise.completed ? (
                                                                <CheckCircle2
                                                                    size={20}
                                                                    className="text-primary-600"
                                                                    strokeWidth={2.5}
                                                                />
                                                            ) : (
                                                                <Circle
                                                                    size={20}
                                                                    className="text-gray-300"
                                                                    strokeWidth={2}
                                                                />
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className={`
                                                                font-bold text-sm mb-1.5
                                                                ${exercise.completed
                                                                    ? 'text-gray-500 line-through'
                                                                    : 'text-gray-900'
                                                                }
                                                            `}>
                                                                {exercise.name}
                                                            </h4>
                                                            <div className="flex items-center gap-3 text-xs">
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-semibold text-gray-500">
                                                                        Sets:
                                                                    </span>
                                                                    <span className="font-bold text-gray-700">
                                                                        {exercise.sets}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-semibold text-gray-500">
                                                                        Reps:
                                                                    </span>
                                                                    <span className="font-bold text-gray-700">
                                                                        {exercise.reps}
                                                                    </span>
                                                                </div>
                                                                <div className="flex items-center gap-1">
                                                                    <span className="font-semibold text-gray-500">
                                                                        Rest:
                                                                    </span>
                                                                    <span className="font-bold text-gray-700">
                                                                        {exercise.rest}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {/* Edit and Delete Buttons */}
                                                        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleEditExercise(workout.id!, exercise);
                                                                }}
                                                                className="p-1.5 hover:bg-blue-50 rounded-lg transition-colors"
                                                                title="Edit exercise"
                                                            >
                                                                <Pencil size={14} className="text-blue-600" />
                                                            </button>
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteExercise(workout.id!, exercise.id);
                                                                }}
                                                                className="p-1.5 hover:bg-red-50 rounded-lg transition-colors"
                                                                title="Delete exercise"
                                                            >
                                                                <Trash2 size={14} className="text-red-600" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                </Card>
                                            </button>
                                        ))}
                                    </div>

                                    {/* Workout Completion Message */}
                                    {workoutCompletedCount === workoutTotalCount && workoutTotalCount > 0 && (
                                        <div className="mt-4 p-4 bg-gradient-to-br from-primary-50 to-primary-100 border-2 border-primary-200 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <CheckCircle2 size={20} className="text-primary-600" strokeWidth={2.5} />
                                                <p className="text-sm font-bold text-primary-900">
                                                    Workout Complete! 🎉
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </Card>
                            );
                        })}

                        {/* Add Another Workout Button */}
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="w-full flex items-center justify-center gap-2 py-4 bg-white hover:bg-primary-100 text-gray-900 rounded-[20px] font-bold transition-all border-2 border-dashed border-gray-300 hover:border-primary-400:border-primary-600 active:scale-95"
                        >
                            <Plus size={20} />
                            <span>Add Another Workout</span>
                        </button>

                        {/* Overall Completion Message */}
                        {completedCount === totalCount && totalCount > 0 && (
                            <Card className="p-6 bg-gradient-to-br from-primary-50 to-primary-100 border-2 border-primary-200 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="text-center">
                                    <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
                                        <CheckCircle2 size={32} className="text-white" strokeWidth={2.5} />
                                    </div>
                                    <h3 className="text-xl font-extrabold text-primary-900 mb-2">
                                        All Workouts Complete! 🎉
                                    </h3>
                                    <p className="text-sm text-primary-700 font-semibold">
                                        Amazing work! You've completed all exercises for {isSameDay(selectedDate, today) ? 'today' : 'this day'}.
                                    </p>
                                </div>
                            </Card>
                        )}
                    </div>
                ) : (
                    /* Empty State */
                    <Card className="p-8">
                        <div className="text-center max-w-sm mx-auto">
                            <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-6">
                                <Dumbbell size={32} className="text-gray-400" />
                            </div>
                            <h3 className="text-xl font-extrabold text-gray-900 mb-2">
                                No Workout Plan Yet
                            </h3>
                            <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                                {isSameDay(selectedDate, today)
                                    ? "Ready to crush today's workout? Get a personalized plan from your AI coach or create your own!"
                                    : "No workout plan for this date. Add one to stay on track!"
                                }
                            </p>

                            <div className="space-y-3">
                                <button
                                    onClick={() => onNavigate?.(AppView.CAL_COACH)}
                                    className="w-full flex items-center justify-center gap-2 py-4 bg-[#3D745B] hover:bg-primary-700 text-white rounded-[20px] font-bold transition-all shadow-lg shadow-primary-200 active:scale-95"
                                >
                                    <Sparkles size={20} />
                                    <span>Get AI Plan from Coach</span>
                                </button>

                                <button
                                    onClick={() => setShowAddModal(true)}
                                    className="w-full flex items-center justify-center gap-2 py-4 bg-white hover:bg-gray-50 text-gray-900 rounded-[20px] font-bold transition-all border-2 border-gray-200 active:scale-95"
                                >
                                    <Plus size={20} />
                                    <span>Create Custom Plan</span>
                                </button>
                            </div>
                        </div>
                    </Card>
                )}
            </div>

            {/* Edit Exercise Modal */}
            <EditExerciseModal
                isOpen={showEditModal}
                onClose={() => {
                    setShowEditModal(false);
                    setEditingExercise(null);
                    setEditingWorkoutId(null);
                }}
                exercise={editingExercise}
                onSave={handleSaveEdit}
            />

            {/* Add Workout Modal */}
            <AddWorkoutModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                defaultDate={selectedDate}
                onSave={reloadWorkout}
            />

        </div>
    );
};
