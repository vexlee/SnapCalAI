/**
 * Midnight Detection Utility
 * Provides functionality to detect and schedule callbacks for midnight
 */

/**
 * Calculate milliseconds until next midnight (local time)
 */
export const getMillisecondsUntilMidnight = (): number => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setHours(24, 0, 0, 0); // Set to midnight of next day
    return tomorrow.getTime() - now.getTime();
};

/**
 * Schedule a callback to run at midnight, and then reschedule itself
 * Returns a cleanup function to cancel the timer
 */
export const scheduleAtMidnight = (callback: () => void): (() => void) => {
    let timeoutId: NodeJS.Timeout;

    const scheduleNext = () => {
        const msUntilMidnight = getMillisecondsUntilMidnight();

        console.log(`⏰ Scheduling midnight refresh in ${Math.round(msUntilMidnight / 1000 / 60)} minutes`);

        timeoutId = setTimeout(() => {
            console.log('🌙 Midnight detected! Running callback...');
            callback();
            // Reschedule for next midnight
            scheduleNext();
        }, msUntilMidnight);
    };

    // Initial schedule
    scheduleNext();

    // Return cleanup function
    return () => {
        if (timeoutId) {
            clearTimeout(timeoutId);
            console.log('⏰ Midnight timer canceled');
        }
    };
};

/**
 * Get current date string in YYYY-MM-DD format (local time)
 */
export const getCurrentDateString = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const LAST_ACTIVE_DATE_KEY = 'snapcal_last_active_date';

/**
 * Check if we're in a new day compared to the last time the app was active
 * Returns true if the day has changed
 */
export const hasDateChanged = (): boolean => {
    const currentDate = getCurrentDateString();
    const lastActiveDate = localStorage.getItem(LAST_ACTIVE_DATE_KEY);

    if (!lastActiveDate) {
        // First time running or no previous date stored
        localStorage.setItem(LAST_ACTIVE_DATE_KEY, currentDate);
        return false;
    }

    const dateChanged = lastActiveDate !== currentDate;

    if (dateChanged) {
        console.log(`📅 Day changed detected: ${lastActiveDate} → ${currentDate}`);
        // Update to current date
        localStorage.setItem(LAST_ACTIVE_DATE_KEY, currentDate);
    }

    return dateChanged;
};

/**
 * Update the last active date to current date
 */
export const updateLastActiveDate = (): void => {
    localStorage.setItem(LAST_ACTIVE_DATE_KEY, getCurrentDateString());
};
