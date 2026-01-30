/**
 * Avatar Controller Service
 * Manages virtual avatar states based on user logging behavior
 */

import { getCurrentUser } from './auth';
import { getEntries, getDailyGoal } from './storage';
import { getCurrentDateString } from '../utils/midnight';

// --- Types ---
export enum AvatarState {
    OPTIMAL = 'optimal',   // Green - happy/energetic
    WARNING = 'warning',   // Yellow - worried/sweaty
    CRITICAL = 'critical', // Red - weak/hungry
}

export interface AvatarStatus {
    state: AvatarState;
    lastLogTimestamp: string | null;
    todayCalories: number;
    calorieLimit: number;
    mealsLogged: number;
    hoursSinceLastLog: number;
    stateReason: string;
}

// --- Constants ---
const MIN_MEALS_FOR_OPTIMAL = 3;
const CRITICAL_HOURS_THRESHOLD = 18;
const LS_LAST_LOG_KEY = 'snapcal_last_log_timestamp';

// --- Local Storage Helpers ---
const getLastLogTimestamp = (): string | null => {
    try {
        return localStorage.getItem(LS_LAST_LOG_KEY);
    } catch (e) {
        return null;
    }
};

export const updateLastLogTimestamp = (): void => {
    try {
        localStorage.setItem(LS_LAST_LOG_KEY, new Date().toISOString());
        // Emit event for real-time UI updates
        window.dispatchEvent(new CustomEvent('avatar-state-changed'));
    } catch (e) {
        console.error('Failed to update last log timestamp:', e);
    }
};

/**
 * Calculate hours since last food log
 */
const calculateHoursSinceLastLog = (lastTimestamp: string | null): number => {
    if (!lastTimestamp) {
        return Infinity; // Never logged
    }

    try {
        const lastLog = new Date(lastTimestamp);
        const now = new Date();
        const diffMs = now.getTime() - lastLog.getTime();
        return diffMs / (1000 * 60 * 60); // Convert to hours
    } catch (e) {
        return Infinity;
    }
};

/**
 * Get current avatar status with all relevant data
 */
export const getAvatarStatus = async (): Promise<AvatarStatus> => {
    const user = await getCurrentUser();

    const defaultStatus: AvatarStatus = {
        state: AvatarState.CRITICAL,
        lastLogTimestamp: null,
        todayCalories: 0,
        calorieLimit: 1600,
        mealsLogged: 0,
        hoursSinceLastLog: Infinity,
        stateReason: 'No logging activity detected',
    };

    if (!user) {
        return defaultStatus;
    }

    // Get today's entries
    const entries = await getEntries();
    const today = getCurrentDateString();
    const todayEntries = entries.filter(e => e.date === today);

    // Calculate totals
    const todayCalories = todayEntries.reduce((sum, e) => sum + e.calories, 0);
    const mealsLogged = todayEntries.length;
    const calorieLimit = await getDailyGoal();

    // Get last log timestamp
    let lastLogTimestamp = getLastLogTimestamp();

    // specific fix: if no local timestamp, check actual entries
    if (!lastLogTimestamp && entries.length > 0) {
        // Sort entries by date/time to find the latest one
        const sortedEntries = [...entries].sort((a, b) => {
            const dateA = new Date(`${a.date}T${a.time || '00:00'}`);
            const dateB = new Date(`${b.date}T${b.time || '00:00'}`);
            return dateB.getTime() - dateA.getTime();
        });

        if (sortedEntries.length > 0) {
            const latest = sortedEntries[0];
            // Construct a timestamp from date and time
            lastLogTimestamp = new Date(`${latest.date}T${latest.time || '00:00'}`).toISOString();
            // Also save it to local storage for next time
            try {
                localStorage.setItem(LS_LAST_LOG_KEY, lastLogTimestamp);
            } catch (e) { }
        }
    }

    const hoursSinceLastLog = calculateHoursSinceLastLog(lastLogTimestamp);

    // Calculate state
    const { state, reason } = calculateStateFromData({
        todayCalories,
        calorieLimit,
        mealsLogged,
        hoursSinceLastLog,
    });

    return {
        state,
        lastLogTimestamp,
        todayCalories,
        calorieLimit,
        mealsLogged,
        hoursSinceLastLog,
        stateReason: reason,
    };
};

/**
 * Determine avatar state based on metrics
 */
interface StateInput {
    todayCalories: number;
    calorieLimit: number;
    mealsLogged: number;
    hoursSinceLastLog: number;
}

const calculateStateFromData = (data: StateInput): { state: AvatarState; reason: string } => {
    const { todayCalories, calorieLimit, mealsLogged, hoursSinceLastLog } = data;

    // CRITICAL: No logging for >18 hours
    if (hoursSinceLastLog > CRITICAL_HOURS_THRESHOLD) {
        const timeDisplay = hoursSinceLastLog === Infinity ? 'a long time' : `${Math.floor(hoursSinceLastLog)} hours`;
        return {
            state: AvatarState.CRITICAL,
            reason: `No activity for ${timeDisplay}`,
        };
    }

    // WARNING: Exceeded calorie limit
    if (todayCalories > calorieLimit) {
        return {
            state: AvatarState.WARNING,
            reason: `Over calorie limit by ${todayCalories - calorieLimit} kcal`,
        };
    }

    // WARNING: Not enough meals logged today (but has logged something)
    if (mealsLogged > 0 && mealsLogged < MIN_MEALS_FOR_OPTIMAL) {
        return {
            state: AvatarState.WARNING,
            reason: `Only ${mealsLogged} meal(s) logged today`,
        };
    }

    // WARNING: No meals logged today yet (but not critical timeframe)
    if (mealsLogged === 0 && hoursSinceLastLog <= CRITICAL_HOURS_THRESHOLD) {
        return {
            state: AvatarState.WARNING,
            reason: 'No meals logged today yet',
        };
    }

    // OPTIMAL: Within limit AND logged enough meals
    if (todayCalories <= calorieLimit && mealsLogged >= MIN_MEALS_FOR_OPTIMAL) {
        return {
            state: AvatarState.OPTIMAL,
            reason: 'Great job! All meals logged and within limit',
        };
    }

    // Default to WARNING for edge cases
    return {
        state: AvatarState.WARNING,
        reason: 'Keep logging your meals!',
    };
};

/**
 * Trigger the "feed" animation when AI identifies food
 * Dispatches a custom event that the Avatar component listens to
 */
export const triggerFeedAnimation = (): void => {
    window.dispatchEvent(new CustomEvent('avatar-feed', {
        detail: { timestamp: Date.now() },
    }));

    // Also update last log timestamp
    updateLastLogTimestamp();
};

/**
 * Get avatar state as a simple string (for quick checks)
 */
export const getAvatarStateSimple = async (): Promise<AvatarState> => {
    const status = await getAvatarStatus();
    return status.state;
};

/**
 * Get state color for UI styling
 */
export const getStateColor = (state: AvatarState): { bg: string; text: string; border: string } => {
    switch (state) {
        case AvatarState.OPTIMAL:
            return {
                bg: 'bg-emerald-500',
                text: 'text-emerald-500',
                border: 'border-emerald-500',
            };
        case AvatarState.WARNING:
            return {
                bg: 'bg-amber-500',
                text: 'text-amber-500',
                border: 'border-amber-500',
            };
        case AvatarState.CRITICAL:
            return {
                bg: 'bg-red-500',
                text: 'text-red-500',
                border: 'border-red-500',
            };
        default:
            return {
                bg: 'bg-gray-500',
                text: 'text-gray-500',
                border: 'border-gray-500',
            };
    }
};

/**
 * Get state emoji for quick visual reference
 */
export const getStateEmoji = (state: AvatarState): string => {
    switch (state) {
        case AvatarState.OPTIMAL:
            return '😊';
        case AvatarState.WARNING:
            return '😅';
        case AvatarState.CRITICAL:
            return '😫';
        default:
            return '🤔';
    }
};

/**
 * Subscribe to avatar state changes
 * Returns a cleanup function to unsubscribe
 */
export const subscribeToAvatarChanges = (callback: () => void): (() => void) => {
    window.addEventListener('avatar-state-changed', callback);
    window.addEventListener('avatar-feed', callback);
    window.addEventListener('food-entry-updated', callback);

    return () => {
        window.removeEventListener('avatar-state-changed', callback);
        window.removeEventListener('avatar-feed', callback);
        window.removeEventListener('food-entry-updated', callback);
    };
};
