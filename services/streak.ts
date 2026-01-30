/**
 * Streak Manager Service
 * Handles daily logging streak tracking and weight goal prediction
 */

import { supabase, shouldUseCloud } from './supabase';
import { getCurrentUser } from './auth';
import { getUserProfile, getDailyGoal, getEntries } from './storage';
import { cache, CACHE_KEYS, withCache } from '../utils/cache';
import { getCurrentDateString } from '../utils/midnight';

// --- Local Storage Keys ---
const LS_STREAK_KEY = 'snapcal_streak_v1';
const LS_WEIGHT_GOAL_KEY = 'snapcal_weight_goal_v1';

// --- Types ---
export interface StreakData {
    currentStreak: number;
    longestStreak: number;
    lastLogDate: string | null;
    streakFreezes: number;
    lastFreezeUsedDate: string | null;
    qualifyingDates: string[]; // Dates with 3+ logs
}

export interface WeightGoal {
    startWeight: number;     // Initial weight when goal was set
    targetWeight: number;    // Target weight (e.g., 63kg)
    dailyCalorieLimit: number; // User's calorie goal
}

export interface WeightPrediction {
    targetWeight: number;
    currentWeight: number;
    dailyDeficit: number;
    estimatedDate: Date;
    daysRemaining: number;
    progressPercentage: number;
}

// --- Constants ---
const MIN_LOGS_FOR_STREAK = 3; // Minimum logs per day to qualify
const CALORIES_PER_KG = 7700; // Approximate calories to lose 1kg of fat
const DEFAULT_START_WEIGHT = 75;
const DEFAULT_TARGET_WEIGHT = 63;

// --- Activity Level Multipliers for TDEE Calculation ---
const ACTIVITY_MULTIPLIERS: Record<string, number> = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    very: 1.725,
    extra: 1.9,
};

// --- Local Storage Helpers ---
const getLocalStreakData = (userId: string): StreakData | null => {
    try {
        const data = localStorage.getItem(LS_STREAK_KEY);
        if (!data) return null;
        const parsed = JSON.parse(data);
        return parsed[userId] || null;
    } catch (e) {
        return null;
    }
};

const saveLocalStreakData = (userId: string, data: StreakData): void => {
    try {
        const existing = localStorage.getItem(LS_STREAK_KEY);
        const parsed = existing ? JSON.parse(existing) : {};
        parsed[userId] = data;
        localStorage.setItem(LS_STREAK_KEY, JSON.stringify(parsed));
    } catch (e) {
        console.error('Failed to save streak data:', e);
    }
};

const getLocalWeightGoal = (userId: string): WeightGoal | null => {
    try {
        const data = localStorage.getItem(LS_WEIGHT_GOAL_KEY);
        if (!data) return null;
        const parsed = JSON.parse(data);
        return parsed[userId] || null;
    } catch (e) {
        return null;
    }
};

const saveLocalWeightGoal = (userId: string, goal: WeightGoal): void => {
    try {
        const existing = localStorage.getItem(LS_WEIGHT_GOAL_KEY);
        const parsed = existing ? JSON.parse(existing) : {};
        parsed[userId] = goal;
        localStorage.setItem(LS_WEIGHT_GOAL_KEY, JSON.stringify(parsed));
    } catch (e) {
        console.error('Failed to save weight goal:', e);
    }
};

// --- Streak Manager ---

/**
 * Get streak data for the current user
 */
export const getStreakData = async (): Promise<StreakData> => {
    const user = await getCurrentUser();
    if (!user) {
        return createDefaultStreakData();
    }

    // Try local storage first
    const localData = getLocalStreakData(user.id);
    if (localData) {
        return localData;
    }

    // Try Supabase if enabled
    if (shouldUseCloud) {
        try {
            const { data, error } = await supabase
                .from('user_streaks')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (!error && data) {
                const streakData: StreakData = {
                    currentStreak: data.current_streak,
                    longestStreak: data.longest_streak,
                    lastLogDate: data.last_log_date,
                    streakFreezes: data.streak_freezes,
                    lastFreezeUsedDate: data.last_freeze_used_date,
                    qualifyingDates: data.qualifying_dates || [],
                };
                // Cache locally
                saveLocalStreakData(user.id, streakData);
                return streakData;
            }
        } catch (e) {
            console.warn('Failed to fetch streak from Supabase:', e);
        }
    }

    return createDefaultStreakData();
};

/**
 * Create default streak data for new users
 */
const createDefaultStreakData = (): StreakData => ({
    currentStreak: 0,
    longestStreak: 0,
    lastLogDate: null,
    streakFreezes: 1, // Start with 1 free freeze
    lastFreezeUsedDate: null,
    qualifyingDates: [],
});

/**
 * Check if a specific date qualifies for streak (has 3+ logs)
 */
export const checkStreakForDate = async (date: string): Promise<boolean> => {
    const user = await getCurrentUser();
    if (!user) return false;

    const entries = await getEntries();
    const dateEntries = entries.filter(e => e.date === date);

    return dateEntries.length >= MIN_LOGS_FOR_STREAK;
};

/**
 * Update streak after a new food log
 * Should be called every time a food entry is saved
 */
export const updateStreak = async (): Promise<StreakData> => {
    const user = await getCurrentUser();
    if (!user) return createDefaultStreakData();

    const today = getCurrentDateString();
    const todayQualifies = await checkStreakForDate(today);

    const currentData = await getStreakData();

    // If today doesn't qualify yet, return current data unchanged
    if (!todayQualifies) {
        return currentData;
    }

    // Check if today is already counted
    if (currentData.qualifyingDates.includes(today)) {
        return currentData;
    }

    // Calculate new streak
    const yesterday = getYesterdayDateString();
    const yesterdayQualified = currentData.qualifyingDates.includes(yesterday);
    const usedFreezeYesterday = currentData.lastFreezeUsedDate === yesterday;

    let newStreak: number;

    if (currentData.lastLogDate === null) {
        // First ever qualifying day
        newStreak = 1;
    } else if (yesterdayQualified || usedFreezeYesterday) {
        // Continuing streak
        newStreak = currentData.currentStreak + 1;
    } else if (currentData.lastLogDate === today) {
        // Already processed today
        newStreak = currentData.currentStreak;
    } else {
        // Streak broken - start fresh
        newStreak = 1;
    }

    const newData: StreakData = {
        currentStreak: newStreak,
        longestStreak: Math.max(currentData.longestStreak, newStreak),
        lastLogDate: today,
        streakFreezes: currentData.streakFreezes,
        lastFreezeUsedDate: currentData.lastFreezeUsedDate,
        qualifyingDates: [...currentData.qualifyingDates.slice(-30), today], // Keep last 30 days
    };

    await saveStreakData(newData);

    // Emit event for UI updates
    window.dispatchEvent(new CustomEvent('streak-updated', { detail: newData }));

    return newData;
};

/**
 * Get yesterday's date string in YYYY-MM-DD format
 */
const getYesterdayDateString = (): string => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    return yesterday.toISOString().split('T')[0];
};

/**
 * Use a streak freeze to preserve the current streak
 */
export const useStreakFreeze = async (): Promise<boolean> => {
    const user = await getCurrentUser();
    if (!user) return false;

    const currentData = await getStreakData();

    if (currentData.streakFreezes <= 0) {
        return false;
    }

    const yesterday = getYesterdayDateString();

    const newData: StreakData = {
        ...currentData,
        streakFreezes: currentData.streakFreezes - 1,
        lastFreezeUsedDate: yesterday,
    };

    await saveStreakData(newData);
    return true;
};

/**
 * Check if user needs streak recovery (missed yesterday but has freezes)
 */
export const needsStreakRecovery = async (): Promise<boolean> => {
    const currentData = await getStreakData();

    if (currentData.currentStreak === 0 || currentData.streakFreezes <= 0) {
        return false;
    }

    const yesterday = getYesterdayDateString();
    const yesterdayQualified = currentData.qualifyingDates.includes(yesterday);
    const alreadyUsedFreeze = currentData.lastFreezeUsedDate === yesterday;

    return !yesterdayQualified && !alreadyUsedFreeze && currentData.lastLogDate !== null;
};

/**
 * Save streak data to storage
 */
const saveStreakData = async (data: StreakData): Promise<void> => {
    const user = await getCurrentUser();
    if (!user) return;

    // Always save locally
    saveLocalStreakData(user.id, data);

    // Sync to Supabase if enabled
    if (shouldUseCloud) {
        try {
            await supabase
                .from('user_streaks')
                .upsert({
                    user_id: user.id,
                    current_streak: data.currentStreak,
                    longest_streak: data.longestStreak,
                    last_log_date: data.lastLogDate,
                    streak_freezes: data.streakFreezes,
                    last_freeze_used_date: data.lastFreezeUsedDate,
                    qualifying_dates: data.qualifyingDates,
                }, { onConflict: 'user_id' });
        } catch (e) {
            console.warn('Failed to sync streak to Supabase:', e);
        }
    }

    // Invalidate cache
    cache.invalidate(CACHE_KEYS.STREAK_DATA);
};

// --- Weight Goal Prediction ---

/**
 * Get or create weight goal for the current user
 * Now reads targetWeight from user profile if set
 */
export const getWeightGoal = async (): Promise<WeightGoal> => {
    const user = await getCurrentUser();
    const profile = await getUserProfile();
    const dailyGoal = await getDailyGoal();

    // Use target weight from profile if set, otherwise use default
    const targetFromProfile = profile?.targetWeight;
    const targetWeight = targetFromProfile && targetFromProfile > 0
        ? targetFromProfile
        : DEFAULT_TARGET_WEIGHT;

    const defaultGoal: WeightGoal = {
        startWeight: profile?.weight || DEFAULT_START_WEIGHT,
        targetWeight: targetWeight,
        dailyCalorieLimit: dailyGoal,
    };

    if (!user) return defaultGoal;

    const localGoal = getLocalWeightGoal(user.id);
    if (localGoal) {
        // Update with current profile data (target weight and calorie limit)
        return {
            ...localGoal,
            targetWeight: targetWeight, // Always use profile's target weight
            dailyCalorieLimit: dailyGoal,
        };
    }

    // Save default goal
    saveLocalWeightGoal(user.id, defaultGoal);
    return defaultGoal;
};

/**
 * Save weight goal
 */
export const saveWeightGoal = async (goal: WeightGoal): Promise<void> => {
    const user = await getCurrentUser();
    if (!user) return;

    saveLocalWeightGoal(user.id, goal);

    if (shouldUseCloud) {
        try {
            await supabase
                .from('user_weight_goals')
                .upsert({
                    user_id: user.id,
                    start_weight: goal.startWeight,
                    target_weight: goal.targetWeight,
                    daily_calorie_limit: goal.dailyCalorieLimit,
                }, { onConflict: 'user_id' });
        } catch (e) {
            console.warn('Failed to sync weight goal to Supabase:', e);
        }
    }

    cache.invalidate(CACHE_KEYS.WEIGHT_GOAL);
};

/**
 * Calculate TDEE (Total Daily Energy Expenditure)
 * Using Mifflin-St Jeor equation
 */
const calculateTDEE = async (): Promise<number> => {
    const profile = await getUserProfile();

    if (!profile || !profile.weight || !profile.height) {
        // Return default maintenance calories
        return 2000;
    }

    const weight = profile.weight; // kg
    const height = profile.height; // cm
    const age = profile.age || 25; // Default age
    const isMale = profile.gender !== 'female';

    // Mifflin-St Jeor BMR calculation
    let bmr: number;
    if (isMale) {
        bmr = 10 * weight + 6.25 * height - 5 * age + 5;
    } else {
        bmr = 10 * weight + 6.25 * height - 5 * age - 161;
    }

    // Apply activity multiplier
    const activityLevel = profile.activityLevel || 'sedentary';
    const multiplier = ACTIVITY_MULTIPLIERS[activityLevel] || 1.2;

    return Math.round(bmr * multiplier);
};

/**
 * Predict when user will reach their weight goal
 */
export const predictWeightGoal = async (): Promise<WeightPrediction | null> => {
    const profile = await getUserProfile();
    const goal = await getWeightGoal();
    const tdee = await calculateTDEE();

    const currentWeight = profile?.weight || goal.startWeight;
    const targetWeight = goal.targetWeight;
    const dailyLimit = goal.dailyCalorieLimit;

    // Calculate daily deficit
    const dailyDeficit = tdee - dailyLimit;

    // If no deficit or already at goal, return null or completed state
    if (dailyDeficit <= 0 || currentWeight <= targetWeight) {
        if (currentWeight <= targetWeight) {
            return {
                targetWeight,
                currentWeight,
                dailyDeficit: 0,
                estimatedDate: new Date(),
                daysRemaining: 0,
                progressPercentage: 100,
            };
        }
        return null;
    }

    // Calculate weight to lose and days required
    const weightToLose = currentWeight - targetWeight; // kg
    const caloriesToBurn = weightToLose * CALORIES_PER_KG;
    const daysRequired = Math.ceil(caloriesToBurn / dailyDeficit);

    // Calculate estimated date
    const estimatedDate = new Date();
    estimatedDate.setDate(estimatedDate.getDate() + daysRequired);

    // Calculate progress (from start weight to target)
    const totalWeightToLose = goal.startWeight - targetWeight;
    const weightLostSoFar = goal.startWeight - currentWeight;
    const progressPercentage = totalWeightToLose > 0
        ? Math.min(100, Math.max(0, (weightLostSoFar / totalWeightToLose) * 100))
        : 0;

    return {
        targetWeight,
        currentWeight,
        dailyDeficit,
        estimatedDate,
        daysRemaining: daysRequired,
        progressPercentage,
    };
};

/**
 * Format prediction message for display
 */
export const formatPredictionMessage = (prediction: WeightPrediction): string => {
    if (prediction.daysRemaining === 0) {
        return "🎉 Congratulations! You've reached your goal!";
    }

    const dateOptions: Intl.DateTimeFormatOptions = {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
    };

    const formattedDate = prediction.estimatedDate.toLocaleDateString('en-US', dateOptions);

    return `Keep this up, and you'll hit ${prediction.targetWeight}kg by ${formattedDate}!`;
};

/**
 * Get current streak count (convenience function)
 */
export const getCurrentStreak = async (): Promise<number> => {
    const data = await getStreakData();
    return data.currentStreak;
};

/**
 * Check if user has available streak freeze
 */
export const hasStreakFreeze = async (): Promise<boolean> => {
    const data = await getStreakData();
    return data.streakFreezes > 0;
};
