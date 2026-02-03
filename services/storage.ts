import { supabase, shouldUseCloud } from './supabase';
import { getCurrentUser } from './auth';
import { FoodEntry, DailySummary, UserProfile, WorkoutExercise, DailyWorkout } from '../types';
import { cache, CACHE_KEYS, withCache } from '../utils/cache';
import type { ChatMessage } from './coach';
import { getCurrentDateString } from '../utils/midnight';

// --- Local Storage Fallback Keys ---
const LS_KEY = 'snapcal_data_v1';
const LS_SETTINGS_KEY = 'snapcal_settings_v1';
const LS_PROFILE_KEY = 'snapcal_profile_v1';
const LS_SUMMARIES_KEY = 'snapcal_summaries_v1';
const LS_COACH_MESSAGES_KEY = 'snapcal_coach_messages_v1';
const LS_WORKOUT_PLANS_KEY = 'snapcal_workout_plans_v1';

// --- PostgREST Column Selection (Bandwidth Optimization) ---
// Full columns: for single entry detail views
const ENTRY_COLUMNS_FULL = 'id, user_id, timestamp, date, time, food_item, calories, protein, carbs, fat, confidence, image_url, is_manual, ingredients, original_ai_response';
// Lite columns: for list views (excludes heavy image_url and original_ai_response)
const ENTRY_COLUMNS_LITE = 'id, user_id, timestamp, date, time, food_item, calories, protein, carbs, fat, confidence, is_manual, ingredients';
// Aggregate columns: for cleanup/summary calculations only
const ENTRY_COLUMNS_AGGREGATE = 'id, date, calories, protein, carbs, fat';

// --- Helpers for Local Storage ---
const getLocalEntries = (): FoodEntry[] => {
  try {
    const data = localStorage.getItem(LS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
};

const saveLocalEntries = (entries: FoodEntry[]) => {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(entries));
  } catch (error: any) {
    if (error.name === 'QuotaExceededError' || error.name === 'NS_ERROR_DOM_QUOTA_REACHED' || String(error).toLowerCase().includes('quota')) {
      throw new Error("Browser Storage Full: Your local history (with photos) has reached the browser's 5MB limit. Please delete some old entries in the History tab or connect to Supabase for unlimited cloud storage.");
    }
    throw error;
  }
};

const getLocalSummaries = (): any[] => {
  try {
    const data = localStorage.getItem(LS_SUMMARIES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) { return []; }
};

const saveLocalSummaries = (summaries: any[]) => {
  try {
    localStorage.setItem(LS_SUMMARIES_KEY, JSON.stringify(summaries));
  } catch (error: any) {
    throw new Error("Browser Storage Full: Cannot even save simple summaries. Please clear your browser data.");
  }
};

// Map Supabase snake_case columns to CamelCase TS types
const mapRowToEntry = (row: any): FoodEntry => ({
  id: row.id,
  user_id: row.user_id,
  timestamp: row.timestamp,
  date: row.date,
  time: row.time,
  food_item: row.food_item,
  calories: row.calories,
  protein: row.protein || 0,
  carbs: row.carbs || 0,
  fat: row.fat || 0,
  confidence: row.confidence,
  imageUrl: row.image_url,
  isManual: row.is_manual,
  ingredients: row.ingredients || [],
  originalAiResponse: row.original_ai_response
});

const handleStorageError = (error: any, operation: string): never => {
  console.error(`Supabase ${operation} Error:`, error);
  const message = error?.message || String(error) || "";
  const lowMsg = message.toLowerCase();

  if (lowMsg.includes("quota") || lowMsg.includes("limit") || lowMsg.includes("tier")) {
    throw new Error("Cloud Quota Reached: Your Supabase storage limit has been exceeded. Try deleting old entries.");
  }

  if (lowMsg.includes("relation") || lowMsg.includes("column") || lowMsg.includes("does not exist")) {
    throw new Error(`Database Setup Required: It looks like the 'food_entries' table is missing in Supabase. Please check the Profile tab for the setup SQL script.`);
  }

  if (lowMsg.includes("policy") || lowMsg.includes("permission") || lowMsg.includes("row-level security")) {
    throw new Error("Permission Denied: Supabase RLS policies are blocking this save. Ensure authenticated users have 'INSERT' and 'UPDATE' access.");
  }

  throw new Error(`Cloud Save Failed: ${message}`);
};

// --- Main Exported Functions ---

export const saveEntry = async (entry: FoodEntry): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("User must be logged in to save.");

  if (!shouldUseCloud) {
    const entries = getLocalEntries();
    const existingIndex = entries.findIndex(e => e.id === entry.id);
    const entryWithUser = { ...entry, user_id: user.id };

    if (existingIndex >= 0) {
      entries[existingIndex] = entryWithUser;
    } else {
      entries.push(entryWithUser);
    }

    saveLocalEntries(entries);
    // Invalidate all entry-related caches
    cache.invalidatePattern(/^food:/);
    return;
  }

  const { error } = await supabase
    .from('food_entries')
    .upsert({
      id: entry.id,
      user_id: user.id,
      timestamp: entry.timestamp,
      date: entry.date,
      time: entry.time,
      food_item: entry.food_item,
      calories: entry.calories,
      protein: entry.protein,
      carbs: entry.carbs,
      fat: entry.fat,
      confidence: entry.confidence,
      is_manual: entry.isManual,
      image_url: entry.imageUrl === undefined ? null : entry.imageUrl, // Convert undefined to null for proper DB update
      ingredients: entry.ingredients,
      original_ai_response: entry.originalAiResponse
    });

  if (error) {
    handleStorageError(error, "Save Entry");
  }

  // Invalidate all entry-related caches
  cache.invalidatePattern(/^food:/);
};

export const getEntries = async (): Promise<FoodEntry[]> => {
  return withCache(CACHE_KEYS.ENTRIES, async () => {
    const user = await getCurrentUser();
    if (!user) return [];

    if (!shouldUseCloud) {
      return getLocalEntries()
        .filter(e => e.user_id === user.id)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }

    const { data, error } = await supabase
      .from('food_entries')
      .select(ENTRY_COLUMNS_FULL)
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(200); // Pagination: limit to 200 entries max

    if (error) {
      console.error("Supabase Fetch Error:", error);
      if (error.message.includes("relation")) {
        return [];
      }
      return [];
    }

    return data ? data.map(mapRowToEntry) : [];
  }, 3 * 60 * 1000); // Cache for 3 minutes
};

/**
 * Get entries without image data (for list views - saves significant bandwidth)
 */
export const getEntriesLite = async (): Promise<FoodEntry[]> => {
  return withCache(CACHE_KEYS.ENTRIES_LITE, async () => {
    const user = await getCurrentUser();
    if (!user) return [];

    if (!shouldUseCloud) {
      // For local storage, just omit imageUrl in the returned objects
      return getLocalEntries()
        .filter(e => e.user_id === user.id)
        .map(e => ({ ...e, imageUrl: undefined, originalAiResponse: undefined }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }

    const { data, error } = await supabase
      .from('food_entries')
      .select(ENTRY_COLUMNS_LITE)
      .eq('user_id', user.id)
      .order('timestamp', { ascending: false })
      .limit(200);

    if (error) {
      console.error("Supabase Fetch Lite Error:", error);
      return [];
    }

    return data ? data.map(mapRowToEntry) : [];
  }, 3 * 60 * 1000); // Cache for 3 minutes
};

/**
 * Get daily summaries WITHOUT entries (for charts/reports - saves bandwidth)
 * Only fetches aggregate totals, no individual meal data
 */
export const getDailySummariesLite = async (): Promise<Omit<DailySummary, 'entries'>[]> => {
  return withCache(CACHE_KEYS.DAILY_SUMMARIES_LITE, async () => {
    const user = await getCurrentUser();
    if (!user) return [];

    if (!shouldUseCloud) {
      // Calculate from local entries
      const entries = getLocalEntries().filter(e => e.user_id === user.id);
      const grouped: Record<string, FoodEntry[]> = {};
      entries.forEach(entry => {
        if (!grouped[entry.date]) grouped[entry.date] = [];
        grouped[entry.date].push(entry);
      });

      // Also include stored summaries for older data
      const storedSummaries = getLocalSummaries().filter(s => s.user_id === user.id);
      const result: Record<string, Omit<DailySummary, 'entries'>> = {};

      storedSummaries.forEach(s => {
        result[s.date] = {
          date: s.date,
          totalCalories: s.total_calories || s.totalCalories,
          totalProtein: s.total_protein || s.totalProtein || 0,
          totalCarbs: s.total_carbs || s.totalCarbs || 0,
          totalFat: s.total_fat || s.totalFat || 0
        };
      });

      Object.keys(grouped).forEach(date => {
        const dayEntries = grouped[date];
        result[date] = {
          date,
          totalCalories: dayEntries.reduce((sum, e) => sum + e.calories, 0),
          totalProtein: dayEntries.reduce((sum, e) => sum + (e.protein || 0), 0),
          totalCarbs: dayEntries.reduce((sum, e) => sum + (e.carbs || 0), 0),
          totalFat: dayEntries.reduce((sum, e) => sum + (e.fat || 0), 0)
        };
      });

      return Object.values(result).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    // Cloud: Use SQL aggregation to avoid fetching all entries
    const { data, error } = await supabase
      .from('food_entries')
      .select('date, calories, protein, carbs, fat')
      .eq('user_id', user.id)
      .order('date', { ascending: false });

    if (error) {
      console.error("Supabase summary fetch error:", error);
      return [];
    }

    // Group and aggregate client-side (PostgREST doesn't support GROUP BY directly)
    const grouped: Record<string, { calories: number; protein: number; carbs: number; fat: number }> = {};
    (data || []).forEach((row: any) => {
      if (!grouped[row.date]) {
        grouped[row.date] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      }
      grouped[row.date].calories += row.calories || 0;
      grouped[row.date].protein += row.protein || 0;
      grouped[row.date].carbs += row.carbs || 0;
      grouped[row.date].fat += row.fat || 0;
    });

    // Also fetch stored summaries for archived days
    try {
      const { data: summaryData } = await supabase
        .from('daily_summaries')
        .select('date, total_calories, total_protein, total_carbs, total_fat')
        .eq('user_id', user.id);

      (summaryData || []).forEach((s: any) => {
        if (!grouped[s.date]) {
          grouped[s.date] = {
            calories: s.total_calories,
            protein: s.total_protein,
            carbs: s.total_carbs,
            fat: s.total_fat
          };
        }
      });
    } catch (e) { /* daily_summaries table may not exist */ }

    return Object.entries(grouped)
      .map(([date, totals]) => ({
        date,
        totalCalories: totals.calories,
        totalProtein: totals.protein,
        totalCarbs: totals.carbs,
        totalFat: totals.fat
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, 3 * 60 * 1000); // Cache for 3 minutes
};

/**
 * Get daily summaries for a specific date range (optimized for reports)
 * Only fetches data within the specified period to reduce bandwidth
 */
export const getDailySummariesForRange = async (
  startDate: string,
  endDate: string
): Promise<Omit<DailySummary, 'entries'>[]> => {
  return withCache(CACHE_KEYS.summariesForRange(startDate, endDate), async () => {
    const user = await getCurrentUser();
    if (!user) return [];

    if (!shouldUseCloud) {
      // Local storage: filter by date range
      const entries = getLocalEntries().filter(e =>
        e.user_id === user.id && e.date >= startDate && e.date <= endDate
      );

      const grouped: Record<string, { calories: number; protein: number; carbs: number; fat: number }> = {};
      entries.forEach(entry => {
        if (!grouped[entry.date]) {
          grouped[entry.date] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
        }
        grouped[entry.date].calories += entry.calories || 0;
        grouped[entry.date].protein += entry.protein || 0;
        grouped[entry.date].carbs += entry.carbs || 0;
        grouped[entry.date].fat += entry.fat || 0;
      });

      // Also check local summaries
      const storedSummaries = getLocalSummaries().filter(s =>
        s.user_id === user.id && s.date >= startDate && s.date <= endDate
      );
      storedSummaries.forEach(s => {
        if (!grouped[s.date]) {
          grouped[s.date] = {
            calories: s.total_calories || s.totalCalories,
            protein: s.total_protein || s.totalProtein || 0,
            carbs: s.total_carbs || s.totalCarbs || 0,
            fat: s.total_fat || s.totalFat || 0
          };
        }
      });

      return Object.entries(grouped)
        .map(([date, totals]) => ({
          date,
          totalCalories: totals.calories,
          totalProtein: totals.protein,
          totalCarbs: totals.carbs,
          totalFat: totals.fat
        }))
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }

    // Cloud: Use date range filters to limit data transfer
    const { data, error } = await supabase
      .from('food_entries')
      .select('date, calories, protein, carbs, fat')
      .eq('user_id', user.id)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) {
      console.error("Supabase range summary fetch error:", error);
      return [];
    }

    // Group and aggregate client-side
    const grouped: Record<string, { calories: number; protein: number; carbs: number; fat: number }> = {};
    (data || []).forEach((row: any) => {
      if (!grouped[row.date]) {
        grouped[row.date] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      }
      grouped[row.date].calories += row.calories || 0;
      grouped[row.date].protein += row.protein || 0;
      grouped[row.date].carbs += row.carbs || 0;
      grouped[row.date].fat += row.fat || 0;
    });

    // Also fetch stored summaries for archived days within range
    try {
      const { data: summaryData } = await supabase
        .from('daily_summaries')
        .select('date, total_calories, total_protein, total_carbs, total_fat')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

      (summaryData || []).forEach((s: any) => {
        if (!grouped[s.date]) {
          grouped[s.date] = {
            calories: s.total_calories,
            protein: s.total_protein,
            carbs: s.total_carbs,
            fat: s.total_fat
          };
        }
      });
    } catch (e) { /* daily_summaries table may not exist */ }

    return Object.entries(grouped)
      .map(([date, totals]) => ({
        date,
        totalCalories: totals.calories,
        totalProtein: totals.protein,
        totalCarbs: totals.carbs,
        totalFat: totals.fat
      }))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, 5 * 60 * 1000); // Cache for 5 minutes (reports are less frequently accessed)
};

/**
 * Get entries for a specific date (lazy loading for History dropdowns)
 * Without images for initial load - use getEntryImage() for individual image loading
 */
export const getEntriesForDateLite = async (date: string): Promise<FoodEntry[]> => {
  return withCache(CACHE_KEYS.entriesForDate(date), async () => {
    const user = await getCurrentUser();
    if (!user) return [];

    if (!shouldUseCloud) {
      return getLocalEntries()
        .filter(e => e.user_id === user.id && e.date === date)
        .map(e => ({ ...e, imageUrl: undefined, originalAiResponse: undefined }))
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }

    const { data, error } = await supabase
      .from('food_entries')
      .select(ENTRY_COLUMNS_LITE)
      .eq('user_id', user.id)
      .eq('date', date)
      .order('timestamp', { ascending: false });

    if (error) {
      console.error("Supabase date fetch error:", error);
      return [];
    }

    return data ? data.map(mapRowToEntry) : [];
  }, 5 * 60 * 1000); // Cache for 5 minutes
};

/**
 * Get a single entry's image (for lazy image loading)
 */
export const getEntryImage = async (entryId: string): Promise<string | null> => {
  return withCache(CACHE_KEYS.entryImage(entryId), async () => {
    const user = await getCurrentUser();
    if (!user) return null;

    if (!shouldUseCloud) {
      const entries = getLocalEntries();
      const entry = entries.find(e => e.id === entryId && e.user_id === user.id);
      return entry?.imageUrl || null;
    }

    const { data, error } = await supabase
      .from('food_entries')
      .select('image_url')
      .eq('id', entryId)
      .eq('user_id', user.id)
      .single();

    if (error || !data) return null;
    return data.image_url;
  }, 30 * 60 * 1000); // Cache images for 30 minutes (they rarely change)
};

/**
 * Get today's entry stats (count and calories) - Bandwidth optimized for Avatar
 * Only fetches minimal columns needed for state calculation
 */
export interface TodayStats {
  count: number;
  calories: number;
  latestTimestamp: string | null;
}

export const getTodayStats = async (): Promise<TodayStats> => {
  const today = getCurrentDateString();

  return withCache(CACHE_KEYS.entriesForDate(`stats:${today}`), async () => {
    const user = await getCurrentUser();
    if (!user) return { count: 0, calories: 0, latestTimestamp: null };

    if (!shouldUseCloud) {
      const entries = getLocalEntries().filter(e => e.user_id === user.id && e.date === today);
      const sorted = entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
      return {
        count: entries.length,
        calories: entries.reduce((sum, e) => sum + e.calories, 0),
        latestTimestamp: sorted[0]?.timestamp || null
      };
    }

    // Fetch only minimal columns for today's entries
    const { data, error } = await supabase
      .from('food_entries')
      .select('id, calories, timestamp')
      .eq('user_id', user.id)
      .eq('date', today)
      .order('timestamp', { ascending: false });

    if (error || !data) return { count: 0, calories: 0, latestTimestamp: null };

    return {
      count: data.length,
      calories: data.reduce((sum, e) => sum + (e.calories || 0), 0),
      latestTimestamp: data[0]?.timestamp || null
    };
  }, 2 * 60 * 1000); // Cache for 2 minutes (frequently accessed)
};

/**
 * Get entry count for a specific date - Bandwidth optimized for Streak
 * Only fetches entry IDs to count, not full entry data
 */
export const getEntriesCountForDate = async (date: string): Promise<number> => {
  return withCache(CACHE_KEYS.entriesForDate(`count:${date}`), async () => {
    const user = await getCurrentUser();
    if (!user) return 0;

    if (!shouldUseCloud) {
      return getLocalEntries().filter(e => e.user_id === user.id && e.date === date).length;
    }

    // Supabase: Use count query for maximum efficiency
    const { count, error } = await supabase
      .from('food_entries')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('date', date);

    if (error) {
      console.error('Error counting entries:', error);
      return 0;
    }

    return count || 0;
  }, 5 * 60 * 1000); // Cache for 5 minutes
};

/**
 * @deprecated Use getDailySummariesLite() for charts and getEntriesForDateLite() for lazy loading
 * This function fetches all entries with images - use only when you need full data
 */
export const getDailySummaries = async (): Promise<DailySummary[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  // 1. Get detailed entries to calculate live summaries
  const entries = await getEntries();
  const grouped: Record<string, FoodEntry[]> = {};
  entries.forEach(entry => {
    if (!grouped[entry.date]) grouped[entry.date] = [];
    grouped[entry.date].push(entry);
  });

  // 2. Get stored summaries (if any) to backfill older data if we implement pagination
  let storedSummaries: any[] = [];
  if (!shouldUseCloud) {
    storedSummaries = getLocalSummaries().filter(s => s.user_id === user.id);
  } else {
    // Try catch block for summaries fetch in case table doesn't exist yet
    try {
      const { data, error } = await supabase
        .from('daily_summaries')
        .select('date, total_calories, total_protein, total_carbs, total_fat')
        .eq('user_id', user.id);
      if (!error && data) storedSummaries = data;
    } catch (e) { console.warn("Summary fetch failed, likely missing table"); }
  }

  const finalSummaries: Record<string, DailySummary> = {};

  // Hydrate from storage first (snake_case from DB)
  storedSummaries.forEach(s => {
    finalSummaries[s.date] = {
      date: s.date,
      totalCalories: s.total_calories,
      totalProtein: s.total_protein,
      totalCarbs: s.total_carbs,
      totalFat: s.total_fat,
      entries: []
    };
  });

  // Override with fresh calculations from active entries
  Object.keys(grouped).forEach(date => {
    const dayEntries = grouped[date];
    finalSummaries[date] = {
      date,
      totalCalories: dayEntries.reduce((sum, e) => sum + e.calories, 0),
      totalProtein: dayEntries.reduce((sum, e) => sum + (e.protein || 0), 0),
      totalCarbs: dayEntries.reduce((sum, e) => sum + (e.carbs || 0), 0),
      totalFat: dayEntries.reduce((sum, e) => sum + (e.fat || 0), 0),
      entries: dayEntries
    };
  });

  return Object.values(finalSummaries).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

export const performDataCleanup = async (): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) return;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thresholdDateStr = thirtyDaysAgo.toISOString().split('T')[0];

  let oldEntries: FoodEntry[] = [];
  if (!shouldUseCloud) {
    oldEntries = getLocalEntries().filter(e => e.user_id === user.id && e.date < thresholdDateStr);
  } else {
    try {
      const { data } = await supabase
        .from('food_entries')
        .select(ENTRY_COLUMNS_AGGREGATE)
        .eq('user_id', user.id)
        .lt('date', thresholdDateStr);
      if (data) oldEntries = data.map(mapRowToEntry);
    } catch (e) { return; }
  }

  if (oldEntries.length === 0) return;

  const grouped: Record<string, FoodEntry[]> = {};
  oldEntries.forEach(e => {
    if (!grouped[e.date]) grouped[e.date] = [];
    grouped[e.date].push(e);
  });

  for (const date of Object.keys(grouped)) {
    const dayEntries = grouped[date];
    const summary = {
      id: `${user.id}_${date}`,
      user_id: user.id,
      date,
      total_calories: dayEntries.reduce((sum, e) => sum + e.calories, 0),
      total_protein: dayEntries.reduce((sum, e) => sum + (e.protein || 0), 0),
      total_carbs: dayEntries.reduce((sum, e) => sum + (e.carbs || 0), 0),
      total_fat: dayEntries.reduce((sum, e) => sum + (e.fat || 0), 0),
    };

    if (!shouldUseCloud) {
      const allSummaries = getLocalSummaries();
      const existingIdx = allSummaries.findIndex(s => s.user_id === user.id && s.date === date);
      if (existingIdx >= 0) allSummaries[existingIdx] = summary;
      else allSummaries.push(summary);
      saveLocalSummaries(allSummaries);

      const remainingEntries = getLocalEntries().filter(e => !(e.user_id === user.id && e.date === date));
      saveLocalEntries(remainingEntries);
    } else {
      // We ignore errors here as cleanup is background task
      await supabase.from('daily_summaries').upsert(summary);
      await supabase.from('food_entries').delete().eq('user_id', user.id).eq('date', date);
    }
  }
};

export const deleteEntry = async (id: string): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not logged in");

  if (!shouldUseCloud) {
    const entries = getLocalEntries().filter(e => !(e.id === id && e.user_id === user.id));
    saveLocalEntries(entries);
    // Invalidate all entry-related caches
    cache.invalidatePattern(/^food:/);
    return;
  }

  const { error } = await supabase
    .from('food_entries')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) handleStorageError(error, "Delete Entry");

  // Invalidate all entry-related caches
  cache.invalidatePattern(/^food:/);
};

/**
 * Clear the image from an entry while preserving nutritional data
 */
export const clearEntryImage = async (id: string): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not logged in");

  if (!shouldUseCloud) {
    const entries = getLocalEntries();
    const entryIndex = entries.findIndex(e => e.id === id && e.user_id === user.id);
    if (entryIndex >= 0) {
      entries[entryIndex].imageUrl = undefined;
      saveLocalEntries(entries);
    }
    cache.invalidatePattern(/^food:/);
    return;
  }

  const { error } = await supabase
    .from('food_entries')
    .update({ image_url: null }) // Explicitly set to NULL
    .eq('id', id)
    .eq('user_id', user.id);

  if (error) handleStorageError(error, "Clear Image");

  // Invalidate all entry-related caches
  cache.invalidatePattern(/^food:/);
};

export const getDailyGoal = async (): Promise<number> => {
  return withCache(CACHE_KEYS.DAILY_GOAL, async () => {
    const user = await getCurrentUser();
    if (!user) return 2000;

    if (!shouldUseCloud) {
      const settingsStr = localStorage.getItem(LS_SETTINGS_KEY);
      const settings = settingsStr ? JSON.parse(settingsStr) : {};
      return settings[user.id] || 2000;
    }

    const { data, error } = await supabase
      .from('user_settings')
      .select('daily_goal')
      .eq('user_id', user.id)
      .single();

    return (error || !data) ? 2000 : data.daily_goal;
  }, 30 * 60 * 1000); // Cache for 30 minutes (rarely changes)
};

export const saveDailyGoal = async (goal: number): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not logged in");

  if (!shouldUseCloud) {
    const settingsStr = localStorage.getItem(LS_SETTINGS_KEY);
    const settings = settingsStr ? JSON.parse(settingsStr) : {};
    settings[user.id] = goal;
    localStorage.setItem(LS_SETTINGS_KEY, JSON.stringify(settings));
    cache.invalidate(CACHE_KEYS.DAILY_GOAL);
    return;
  }

  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: user.id, daily_goal: goal }, { onConflict: 'user_id' });

  if (error) handleStorageError(error, "Save Daily Goal");

  cache.invalidate(CACHE_KEYS.DAILY_GOAL);
};

export const getUserProfile = async (): Promise<UserProfile | null> => {
  return withCache(CACHE_KEYS.USER_PROFILE, async () => {
    const user = await getCurrentUser();
    if (!user) return null;

    if (!shouldUseCloud) {
      const profilesStr = localStorage.getItem(LS_PROFILE_KEY);
      const profiles = profilesStr ? JSON.parse(profilesStr) : {};
      return profiles[user.id] || null;
    }

    const { data, error } = await supabase
      .from('user_profiles')
      .select('name, height, weight, age, gender, activity_level, goal, equipment_access, target_weight')
      .eq('user_id', user.id)
      .single();

    if (error || !data) return null;

    return {
      name: data.name,
      height: data.height,
      weight: data.weight,
      age: data.age,
      gender: data.gender,
      activityLevel: data.activity_level,
      goal: data.goal,
      equipmentAccess: data.equipment_access,
      targetWeight: data.target_weight
    };
  }, 30 * 60 * 1000); // Cache for 30 minutes (rarely changes)
};

export const saveUserProfile = async (profile: UserProfile): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) throw new Error("Not logged in");

  if (!shouldUseCloud) {
    const profilesStr = localStorage.getItem(LS_PROFILE_KEY);
    const profiles = profilesStr ? JSON.parse(profilesStr) : {};
    profiles[user.id] = profile;
    localStorage.setItem(LS_PROFILE_KEY, JSON.stringify(profiles));
    cache.invalidate(CACHE_KEYS.USER_PROFILE);
    return;
  }

  const { error } = await supabase
    .from('user_profiles')
    .upsert({
      user_id: user.id,
      name: profile.name,
      height: profile.height,
      weight: profile.weight,
      age: profile.age,
      gender: profile.gender,
      activity_level: profile.activityLevel,
      goal: profile.goal,
      equipment_access: profile.equipmentAccess,
      target_weight: profile.targetWeight
    }, { onConflict: 'user_id' });

  if (error) handleStorageError(error, "Save Profile");

  cache.invalidate(CACHE_KEYS.USER_PROFILE);
};

// --- Migration Helpers ---

export const hasLocalData = (): boolean => {
  const entries = getLocalEntries();
  return entries.length > 0;
};

export const syncLocalDataToSupabase = async (): Promise<void> => {
  if (!shouldUseCloud) throw new Error("Must be in Cloud Mode to sync");
  const user = await getCurrentUser();
  if (!user) throw new Error("Must be logged in to sync");

  const allEntries = getLocalEntries();

  if (allEntries.length > 0) {
    // Map local entries to the current Cloud user ID
    const entriesToUpload = allEntries.map(e => ({
      id: e.id,
      user_id: user.id,
      timestamp: e.timestamp,
      date: e.date,
      time: e.time,
      food_item: e.food_item,
      calories: e.calories,
      protein: e.protein,
      carbs: e.carbs,
      fat: e.fat,
      confidence: e.confidence,
      is_manual: e.isManual,
      image_url: e.imageUrl,
      ingredients: e.ingredients,
      original_ai_response: e.originalAiResponse
    }));

    // Chunk upload to prevent 413 Payload Too Large
    const CHUNK_SIZE = 5;
    for (let i = 0; i < entriesToUpload.length; i += CHUNK_SIZE) {
      const chunk = entriesToUpload.slice(i, i + CHUNK_SIZE);
      const { error } = await supabase.from('food_entries').upsert(chunk);
      if (error) {
        console.error("Chunk upload failed", error);
        throw new Error(`Sync failed at item ${i + 1}: ` + error.message);
      }
    }
  }

  // Sync Settings if they don't exist in cloud
  const settingsStr = localStorage.getItem(LS_SETTINGS_KEY);
  if (settingsStr) {
    const settings = JSON.parse(settingsStr);
    const firstKey = Object.keys(settings)[0];
    if (firstKey && settings[firstKey]) {
      await saveDailyGoal(settings[firstKey]);
    }
  }

  // Sync Profile if it doesn't exist in cloud
  const profilesStr = localStorage.getItem(LS_PROFILE_KEY);
  if (profilesStr) {
    const profiles = JSON.parse(profilesStr);
    const firstKey = Object.keys(profiles)[0];
    if (firstKey && profiles[firstKey]) {
      await saveUserProfile(profiles[firstKey]);
    }
  }

  // Clear local data to complete migration
  localStorage.removeItem(LS_KEY);
  localStorage.removeItem(LS_SUMMARIES_KEY);
  localStorage.removeItem(LS_SETTINGS_KEY);
  localStorage.removeItem(LS_PROFILE_KEY);
};

// --- Diagnostics ---

export interface DBCheckResult {
  ok: boolean;
  error?: string;
  missingTables?: boolean;
}

export const checkDatabaseSchema = async (): Promise<DBCheckResult> => {
  if (!shouldUseCloud) return { ok: true };
  const user = await getCurrentUser();
  if (!user) return { ok: true };

  // Try to select 1 row. If table doesn't exist, it throws error code 42P01 (relation does not exist)
  const { error } = await supabase.from('food_entries').select('id').limit(1);

  if (error) {
    if (error.message.includes('relation') || error.code === '42P01') {
      return { ok: false, missingTables: true, error: "Tables missing" };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true };
};

// --- Onboarding Status Management ---

const LS_ONBOARDING_KEY = 'snapcal_onboarding_v1';

export const hasCompletedOnboarding = async (user: any): Promise<boolean> => {
  if (!user || !user.id) return false;

  // Always check local storage first as a cache/fallback
  const onboardingStr = localStorage.getItem(LS_ONBOARDING_KEY);
  const onboarding = onboardingStr ? JSON.parse(onboardingStr) : {};

  if (onboarding[user.id] === true) return true;

  if (!shouldUseCloud) {
    return false;
  }

  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('has_completed_onboarding')
      .eq('user_id', user.id)
      .maybeSingle(); // maybeSingle is safer as it doesn't throw on 0 rows

    const completed = data?.has_completed_onboarding || false;

    // If completed in cloud, cache it locally
    if (completed) {
      onboarding[user.id] = true;
      localStorage.setItem(LS_ONBOARDING_KEY, JSON.stringify(onboarding));
    }

    return completed;
  } catch (e) {
    return false;
  }
};

export const markOnboardingComplete = async (user: any): Promise<void> => {
  if (!user || !user.id) return;

  // 1. Save to Local Storage (Always do this as immediate cache)
  const onboardingStr = localStorage.getItem(LS_ONBOARDING_KEY);
  const onboarding = onboardingStr ? JSON.parse(onboardingStr) : {};
  onboarding[user.id] = true;
  localStorage.setItem(LS_ONBOARDING_KEY, JSON.stringify(onboarding));

  // 2. Save to Cloud if enabled
  if (shouldUseCloud) {
    try {
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user.id,
          has_completed_onboarding: true
        }, { onConflict: 'user_id' });

      if (error) console.error("Cloud mark onboarding error:", error);
    } catch (e) {
      console.error("Cloud mark onboarding exception:", e);
    }
  }
};

export const skipOnboarding = async (user: any): Promise<void> => {
  await markOnboardingComplete(user);
};


/**
 * Manually clear all data caches (useful for debugging or force refresh)
 */
export const clearAllCaches = (): void => {
  cache.clear();
  console.log('✨ All data caches cleared');
};

// --- Chat History Management ---

/**
 * Helper to get local chat messages from localStorage
 */
const getLocalChatMessages = (): ChatMessage[] => {
  try {
    const data = localStorage.getItem(LS_COACH_MESSAGES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

/**
 * Helper to save local chat messages to localStorage
 */
const saveLocalChatMessages = (messages: ChatMessage[]) => {
  try {
    localStorage.setItem(LS_COACH_MESSAGES_KEY, JSON.stringify(messages));
  } catch (error: any) {
    console.error('Failed to save chat messages to local storage:', error);
  }
};

/**
 * Save a single chat message to database
 */
export const saveChatMessage = async (message: ChatMessage): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) {
    console.warn('User not logged in, cannot save chat message');
    return;
  }

  // Extract date from timestamp (YYYY-MM-DD format)
  const date = new Date(message.timestamp).toISOString().split('T')[0];

  if (!shouldUseCloud) {
    const messages = getLocalChatMessages();
    const messageWithUser = { ...message, user_id: user.id, date };
    messages.push(messageWithUser);
    saveLocalChatMessages(messages);
    return;
  }

  try {
    const { error } = await supabase
      .from('coach_messages')
      .insert({
        id: message.id,
        user_id: user.id,
        role: message.role,
        content: message.content,
        timestamp: message.timestamp,
        date: date
      });

    if (error) {
      console.error('Failed to save chat message to Supabase:', error);
    }
  } catch (error) {
    console.error('Exception saving chat message:', error);
  }
};

/**
 * Get chat messages for a specific date
 * Returns messages in chronological order (oldest first)
 */
export const getChatMessagesForDate = async (date: string): Promise<ChatMessage[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  if (!shouldUseCloud) {
    const allMessages = getLocalChatMessages();
    return allMessages
      .filter((m: any) => m.user_id === user.id && m.date === date)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  try {
    const { data, error } = await supabase
      .from('coach_messages')
      .select('id, role, content, timestamp')
      .eq('user_id', user.id)
      .eq('date', date)
      .order('timestamp', { ascending: true });

    if (error) {
      console.error('Failed to fetch chat messages:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Exception fetching chat messages:', error);
    return [];
  }
};

/**
 * Get today's chat messages
 * Convenience function for loading same-day conversation
 */
export const getTodayChatMessages = async (): Promise<ChatMessage[]> => {
  const today = new Date().toISOString().split('T')[0];
  return getChatMessagesForDate(today);
};

/**
 * Clean up chat messages older than 30 days (one month)
 * Called automatically when loading chat history
 */
export const cleanupOldChatMessages = async (): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) return;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thresholdDate = thirtyDaysAgo.toISOString().split('T')[0];

  if (!shouldUseCloud) {
    const messages = getLocalChatMessages();
    const filtered = messages.filter((m: any) =>
      m.user_id !== user.id || m.date >= thresholdDate
    );
    saveLocalChatMessages(filtered);
    return;
  }

  try {
    const { error } = await supabase
      .from('coach_messages')
      .delete()
      .eq('user_id', user.id)
      .lt('date', thresholdDate);

    if (error) {
      console.error('Failed to cleanup old chat messages:', error);
    }
  } catch (error) {
    console.error('Exception during chat cleanup:', error);
  }
};

// --- Workout Plan Management ---

/**
 * Helper to get local workout plans from localStorage
 */
const getLocalWorkoutPlans = (): any[] => {
  try {
    const data = localStorage.getItem(LS_WORKOUT_PLANS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (e) {
    return [];
  }
};

/**
 * Helper to save local workout plans to localStorage
 */
const saveLocalWorkoutPlans = (plans: any[]) => {
  try {
    localStorage.setItem(LS_WORKOUT_PLANS_KEY, JSON.stringify(plans));
  } catch (error: any) {
    console.error('Failed to save workout plans to local storage:', error);
  }
};

/**
 * Save a workout plan for a specific date
 * Now supports multiple workouts per date by generating unique IDs
 */
export const saveWorkoutPlan = async (
  date: string,
  title: string,
  exercises: WorkoutExercise[],
  workoutId?: string, // Optional: provide existing ID for updates
  workoutTypeId?: string // Optional: reference to workout type for icon/color
): Promise<string> => {
  const user = await getCurrentUser();
  if (!user) {
    console.warn('User not logged in, cannot save workout plan');
    return '';
  }

  // Generate unique ID if not provided (for new workouts)
  const id = workoutId || `${user.id}_${date}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const planWithUser = {
    id,
    user_id: user.id,
    date,
    title,
    workout_type_id: workoutTypeId,
    exercises
  };

  // Always save to localStorage as backup
  const plans = getLocalWorkoutPlans();
  const existingIndex = plans.findIndex(
    (p: any) => p.id === id
  );

  if (existingIndex >= 0) {
    plans[existingIndex] = planWithUser;
  } else {
    plans.push(planWithUser);
  }
  saveLocalWorkoutPlans(plans);

  // Also try to save to Supabase if in cloud mode
  if (shouldUseCloud) {
    try {
      const { error } = await supabase
        .from('workout_plans')
        .upsert({
          id,
          user_id: user.id,
          date,
          title,
          workout_type_id: workoutTypeId,
          exercises
        });

      if (error) {
        console.warn('Supabase save failed, using localStorage fallback:', error.message);
      }
    } catch (error) {
      console.warn('Exception saving workout plan to Supabase, using localStorage fallback:', error);
    }
  }

  return id;
};

/**
 * Get workout plan for a specific date (legacy - returns first workout)
 * @deprecated Use getWorkoutPlansForDate to get all workouts for a date
 */
export const getWorkoutPlan = async (date: string): Promise<DailyWorkout | null> => {
  const workouts = await getWorkoutPlansForDate(date);
  return workouts.length > 0 ? workouts[0] : null;
};

/**
 * Get all workout plans for a specific date
 * Returns array of workouts to support multiple workouts per day
 */
export const getWorkoutPlansForDate = async (date: string): Promise<DailyWorkout[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  const workouts: DailyWorkout[] = [];

  // Always check localStorage first
  const plans = getLocalWorkoutPlans();
  const localPlans = plans.filter((p: any) => p.user_id === user.id && p.date === date);

  localPlans.forEach((p: any) => {
    workouts.push({
      id: p.id,
      date: p.date,
      title: p.title,
      exercises: p.exercises
    });
  });

  // If cloud is enabled, also get from Supabase and merge
  if (shouldUseCloud) {
    try {
      const { data, error } = await supabase
        .from('workout_plans')
        .select('id, date, title, exercises')
        .eq('user_id', user.id)
        .eq('date', date);

      if (!error && data) {
        // Merge cloud data, avoiding duplicates by ID
        const localIds = new Set(workouts.map(w => w.id));
        data.forEach((cloudPlan: any) => {
          if (!localIds.has(cloudPlan.id)) {
            workouts.push({
              id: cloudPlan.id,
              date: cloudPlan.date,
              title: cloudPlan.title,
              exercises: cloudPlan.exercises
            });
          }
        });
      }
    } catch (error) {
      console.warn('Exception fetching workout plans from Supabase, using localStorage only:', error);
    }
  }

  return workouts;
};

/**
 * Get all workout plan dates for a specific month
 * Returns array of date strings that have workout plans
 */
export const getWorkoutPlansForMonth = async (
  year: number,
  month: number
): Promise<string[]> => {
  const user = await getCurrentUser();
  if (!user) return [];

  // Create date range for the month (YYYY-MM format)
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

  // Always check localStorage first
  const plans = getLocalWorkoutPlans();
  const localDates = plans
    .filter((p: any) =>
      p.user_id === user.id &&
      p.date >= startDate &&
      p.date <= endDate
    )
    .map((p: any) => p.date);

  // If cloud is enabled, also get from Supabase and merge
  if (shouldUseCloud) {
    try {
      const { data, error } = await supabase
        .from('workout_plans')
        .select('date')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

      if (!error && data) {
        const cloudDates = data.map((row: any) => row.date);
        // Merge and deduplicate
        return Array.from(new Set([...localDates, ...cloudDates]));
      }
    } catch (error) {
      console.warn('Exception fetching workout plans from Supabase, using localStorage only:', error);
    }
  }

  return localDates;
};

/**
 * Save a multi-day workout plan starting from a specific date
 * Each day is saved to consecutive dates
 */
export const saveMultiDayWorkoutPlan = async (
  startDate: string,
  days: Array<{
    title: string;
    exercises: WorkoutExercise[];
    isRestDay: boolean;
  }>
): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) {
    console.warn('User not logged in, cannot save multi-day workout plan');
    return;
  }

  // Calculate dates for each day
  const startDateObj = new Date(startDate);

  for (let i = 0; i < days.length; i++) {
    const day = days[i];

    // Skip rest days (don't save them)
    if (day.isRestDay) {
      continue;
    }

    // Calculate date for this day
    const dayDate = new Date(startDateObj);
    dayDate.setDate(dayDate.getDate() + i);
    const dateStr = dayDate.toISOString().split('T')[0];

    // Save this day's workout
    await saveWorkoutPlan(dateStr, day.title, day.exercises);
  }
};

/**
 * Delete a workout plan for a specific date (legacy - deletes all workouts)
 * @deprecated Use deleteWorkoutPlanById to delete specific workout
 */
export const deleteWorkoutPlan = async (date: string): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) {
    console.warn('User not logged in, cannot delete workout plan');
    return;
  }

  if (!shouldUseCloud) {
    const plans = getLocalWorkoutPlans();
    const filtered = plans.filter(
      (p: any) => !(p.user_id === user.id && p.date === date)
    );
    saveLocalWorkoutPlans(filtered);
    return;
  }

  try {
    const { error } = await supabase
      .from('workout_plans')
      .delete()
      .eq('user_id', user.id)
      .eq('date', date);

    if (error) {
      console.error('Failed to delete workout plan:', error);
    }
  } catch (error) {
    console.error('Exception deleting workout plan:', error);
  }
};

/**
 * Delete a specific workout plan by ID
 * Supports deleting individual workouts when multiple exist per day
 */
export const deleteWorkoutPlanById = async (workoutId: string): Promise<void> => {
  const user = await getCurrentUser();
  if (!user) {
    console.warn('User not logged in, cannot delete workout plan');
    return;
  }

  // Delete from localStorage
  const plans = getLocalWorkoutPlans();
  const filtered = plans.filter(
    (p: any) => p.id !== workoutId
  );
  saveLocalWorkoutPlans(filtered);

  // Also delete from Supabase if in cloud mode
  if (shouldUseCloud) {
    try {
      const { error } = await supabase
        .from('workout_plans')
        .delete()
        .eq('id', workoutId)
        .eq('user_id', user.id);

      if (error) {
        console.warn('Failed to delete workout plan from Supabase:', error.message);
      }
    } catch (error) {
      console.warn('Exception deleting workout plan from Supabase:', error);
    }
  }
};