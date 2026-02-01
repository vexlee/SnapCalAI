/**
 * Coach Reports Service
 * Handles AI report generation and storage for Daily/Weekly/Monthly reviews
 */

import { GoogleGenAI, Type } from "@google/genai";
import { supabase, shouldUseCloud } from './supabase';
import { getCurrentUser } from './auth';
import { getUserProfile, getDailySummariesForRange, getDailyGoal } from './storage';
import { CoachReport, CoachReportTip, CoachReportMetrics, UserProfile, DailyWorkout } from '../types';
import { safeParseAIResponse, AIReportResponseSchema } from '../utils/schemas';

// --- API Key Management ---

const getApiKey = (): string => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
    if (!apiKey) {
        console.error("VITE_GEMINI_API_KEY is not set");
    }
    return apiKey;
};

const getAIClient = (): GoogleGenAI => {
    return new GoogleGenAI({ apiKey: getApiKey() });
};

// --- Local Storage Keys ---

const LS_REPORTS_KEY = 'snapcal_coach_reports_v1';

// --- Report System Prompt ---

const REPORT_SYSTEM_PROMPT = `You are **Cal Coach**, providing personalized health and fitness reviews.

**Your Role:**
Generate concise, motivating, and actionable reports based on the user's tracking data.

**Report Guidelines:**
1. **Summary**: 2-3 sentences highlighting key achievements and areas for improvement
2. **Tips**: Exactly 3 specific, actionable tips 
3. **Tone**: Encouraging but honest. Celebrate wins, gently address gaps

**Tip Format:**
Each tip should have:
- emoji: A relevant emoji (🥗, 💪, 🎯, ⚡, 💧, 🔥, etc.)
- title: Short action phrase (3-5 words)
- description: One sentence explaining the tip

**Never:**
- Be negative or discouraging
- Give generic advice that doesn't relate to the user's data
- Use medical disclaimers or suggest consulting doctors
- Repeat the same tip twice`;

// --- Helper: Get Workout Plans for Date Range ---

const getWorkoutPlansForRange = async (startDate: string, endDate: string): Promise<DailyWorkout[]> => {
    if (!shouldUseCloud) {
        const stored = localStorage.getItem('snapcal_workouts');
        if (!stored) return [];
        const workouts: DailyWorkout[] = JSON.parse(stored);
        return workouts.filter(w => w.date >= startDate && w.date <= endDate);
    }

    const user = await getCurrentUser();
    if (!user) return [];

    const { data, error } = await supabase
        .from('workout_plans')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', startDate)
        .lte('date', endDate);

    if (error) {
        console.error('Failed to fetch workout plans:', error);
        return [];
    }

    return data.map(row => ({
        id: row.id,
        date: row.date,
        title: row.title,
        exercises: row.exercises || []
    }));
};

// --- Build Report Context ---

interface ReportContext {
    profile: UserProfile | null;
    dailyGoal: number;
    periodStart: string;
    periodEnd: string;
    reportType: 'daily' | 'weekly' | 'monthly';
    metrics: CoachReportMetrics;
    dailyBreakdown: {
        date: string;
        calories: number;
        protein: number;
        carbs: number;
        fat: number;
        meals: number;
    }[];
    workoutsCompleted: number;
}

const buildReportContext = async (
    reportType: 'daily' | 'weekly' | 'monthly',
    periodStart: string,
    periodEnd: string
): Promise<ReportContext> => {
    // Optimized: Only fetch data for the specific date range
    const [profile, dailyGoal, periodSummaries, workouts] = await Promise.all([
        getUserProfile(),
        getDailyGoal(),
        getDailySummariesForRange(periodStart, periodEnd),
        getWorkoutPlansForRange(periodStart, periodEnd)
    ]);

    // periodSummaries is already filtered by date range from the optimized query

    // Calculate metrics
    const daysTracked = periodSummaries.length;
    const totalMeals = periodSummaries.reduce((sum, s) => {
        // Estimate based on daily totals (we don't have entry count in lite summaries)
        return sum + (s.totalCalories > 0 ? 1 : 0);
    }, 0);

    const avgCalories = daysTracked > 0
        ? Math.round(periodSummaries.reduce((sum, s) => sum + s.totalCalories, 0) / daysTracked)
        : 0;
    const avgProtein = daysTracked > 0
        ? Math.round(periodSummaries.reduce((sum, s) => sum + s.totalProtein, 0) / daysTracked)
        : 0;
    const avgCarbs = daysTracked > 0
        ? Math.round(periodSummaries.reduce((sum, s) => sum + s.totalCarbs, 0) / daysTracked)
        : 0;
    const avgFat = daysTracked > 0
        ? Math.round(periodSummaries.reduce((sum, s) => sum + s.totalFat, 0) / daysTracked)
        : 0;

    // Calculate goal hit rate (within 10% of goal)
    const goalHits = periodSummaries.filter(s => {
        const diff = Math.abs(s.totalCalories - dailyGoal);
        return diff <= dailyGoal * 0.1;
    }).length;
    const calorieGoalHitRate = daysTracked > 0
        ? Math.round((goalHits / daysTracked) * 100)
        : 0;

    // Count completed workouts (workouts where at least one exercise is completed)
    const workoutsCompleted = workouts.filter(w =>
        w.exercises.some(e => e.completed)
    ).length;

    const metrics: CoachReportMetrics = {
        avgCalories,
        avgProtein,
        avgCarbs,
        avgFat,
        totalMeals,
        workoutsCompleted,
        daysTracked,
        calorieGoalHitRate
    };

    const dailyBreakdown = periodSummaries.map(s => ({
        date: s.date,
        calories: s.totalCalories,
        protein: s.totalProtein,
        carbs: s.totalCarbs,
        fat: s.totalFat,
        meals: s.totalCalories > 0 ? 1 : 0
    }));

    return {
        profile,
        dailyGoal,
        periodStart,
        periodEnd,
        reportType,
        metrics,
        dailyBreakdown,
        workoutsCompleted
    };
};

// --- Format Context for AI ---

const formatContextForAI = (context: ReportContext): string => {
    const { profile, dailyGoal, periodStart, periodEnd, reportType, metrics, dailyBreakdown } = context;

    let prompt = `**${reportType.charAt(0).toUpperCase() + reportType.slice(1)} Health Review**\n`;
    prompt += `Period: ${periodStart} to ${periodEnd}\n\n`;

    if (profile) {
        prompt += `**User Profile:**\n`;
        if (profile.name) prompt += `- Name: ${profile.name}\n`;
        if (profile.weight) prompt += `- Weight: ${profile.weight} kg\n`;
        if (profile.height) prompt += `- Height: ${profile.height} cm\n`;
        if (profile.goal) {
            const goalLabels = { cut: 'Lose weight', bulk: 'Build muscle', maintain: 'Maintain weight' };
            prompt += `- Goal: ${goalLabels[profile.goal]}\n`;
        }
        prompt += `- Daily Calorie Goal: ${dailyGoal} kcal\n\n`;
    }

    prompt += `**Period Statistics:**\n`;
    prompt += `- Days tracked: ${metrics.daysTracked}\n`;
    prompt += `- Average daily calories: ${metrics.avgCalories} kcal (Goal: ${dailyGoal})\n`;
    prompt += `- Average protein: ${metrics.avgProtein}g\n`;
    prompt += `- Average carbs: ${metrics.avgCarbs}g\n`;
    prompt += `- Average fat: ${metrics.avgFat}g\n`;
    prompt += `- Calorie goal hit rate: ${metrics.calorieGoalHitRate}%\n`;
    prompt += `- Workouts completed: ${metrics.workoutsCompleted}\n\n`;

    if (dailyBreakdown.length > 0 && dailyBreakdown.length <= 7) {
        prompt += `**Daily Breakdown:**\n`;
        dailyBreakdown.forEach(day => {
            prompt += `- ${day.date}: ${day.calories} kcal, P: ${day.protein}g, C: ${day.carbs}g, F: ${day.fat}g\n`;
        });
    }

    prompt += `\n---\n\nProvide a summary and 3 actionable tips based on this data.`;
    return prompt;
};

// --- Generate AI Report ---

interface AIReportResponse {
    summary: string;
    tips: CoachReportTip[];
}

const generateAIReport = async (context: ReportContext): Promise<AIReportResponse> => {
    const ai = getAIClient();
    const prompt = formatContextForAI(context);

    const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
            systemInstruction: REPORT_SYSTEM_PROMPT,
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    summary: { type: Type.STRING },
                    tips: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                emoji: { type: Type.STRING },
                                title: { type: Type.STRING },
                                description: { type: Type.STRING }
                            },
                            required: ["emoji", "title", "description"]
                        }
                    }
                },
                required: ["summary", "tips"]
            }
        }
    });

    return safeParseAIResponse(AIReportResponseSchema, response.text || '{}', 'Coach Report');
};

// --- Local Storage Helpers ---

const getLocalReports = (): CoachReport[] => {
    try {
        const stored = localStorage.getItem(LS_REPORTS_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch {
        return [];
    }
};

const saveLocalReports = (reports: CoachReport[]): void => {
    localStorage.setItem(LS_REPORTS_KEY, JSON.stringify(reports));
};

// --- Main Export Functions ---

/**
 * Get existing report for a period
 */
export const getReport = async (
    reportType: 'daily' | 'weekly' | 'monthly',
    periodStart: string,
    periodEnd: string
): Promise<CoachReport | null> => {
    if (!shouldUseCloud) {
        const reports = getLocalReports();
        return reports.find(r =>
            r.reportType === reportType &&
            r.periodStart === periodStart &&
            r.periodEnd === periodEnd
        ) || null;
    }

    const user = await getCurrentUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('coach_reports')
        .select('*')
        .eq('user_id', user.id)
        .eq('report_type', reportType)
        .eq('period_start', periodStart)
        .eq('period_end', periodEnd)
        .single();

    if (error || !data) return null;

    return {
        id: data.id,
        userId: data.user_id,
        reportType: data.report_type,
        periodStart: data.period_start,
        periodEnd: data.period_end,
        summary: data.summary,
        tips: data.tips,
        metrics: data.metrics,
        weightAtReport: data.weight_at_report,
        createdAt: data.created_at
    };
};

/**
 * Save report to storage
 */
export const saveReport = async (report: CoachReport): Promise<void> => {
    if (!shouldUseCloud) {
        const reports = getLocalReports();
        // Remove existing report for same period
        const filtered = reports.filter(r =>
            !(r.reportType === report.reportType &&
                r.periodStart === report.periodStart &&
                r.periodEnd === report.periodEnd)
        );
        filtered.push(report);
        saveLocalReports(filtered);
        return;
    }

    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    // Upsert: delete existing and insert new
    await supabase
        .from('coach_reports')
        .delete()
        .eq('user_id', user.id)
        .eq('report_type', report.reportType)
        .eq('period_start', report.periodStart)
        .eq('period_end', report.periodEnd);

    const { error } = await supabase
        .from('coach_reports')
        .insert({
            id: report.id,
            user_id: user.id,
            report_type: report.reportType,
            period_start: report.periodStart,
            period_end: report.periodEnd,
            summary: report.summary,
            tips: report.tips,
            metrics: report.metrics,
            weight_at_report: report.weightAtReport
        });

    if (error) {
        console.error('Failed to save report:', error);
        throw new Error('Failed to save report');
    }
};

/**
 * Generate a new report (or regenerate existing)
 */
export const generateReport = async (
    reportType: 'daily' | 'weekly' | 'monthly',
    periodStart: string,
    periodEnd: string,
    currentWeight?: number
): Promise<CoachReport> => {
    const user = await getCurrentUser();
    if (!user) throw new Error('User not authenticated');

    // Build context and generate AI report
    const context = await buildReportContext(reportType, periodStart, periodEnd);
    const aiResponse = await generateAIReport(context);

    const report: CoachReport = {
        id: `${reportType}_${periodStart}_${Date.now()}`,
        userId: user.id,
        reportType,
        periodStart,
        periodEnd,
        summary: aiResponse.summary,
        tips: aiResponse.tips.slice(0, 3), // Ensure max 3 tips
        metrics: context.metrics,
        weightAtReport: currentWeight || context.profile?.weight,
        createdAt: new Date().toISOString()
    };

    // Save to storage
    await saveReport(report);

    return report;
};

/**
 * Get or generate report (uses cached if available)
 */
export const getOrGenerateReport = async (
    reportType: 'daily' | 'weekly' | 'monthly',
    periodStart: string,
    periodEnd: string,
    forceRegenerate: boolean = false,
    currentWeight?: number
): Promise<CoachReport> => {
    // Check for existing report if not forcing regeneration
    if (!forceRegenerate) {
        const existing = await getReport(reportType, periodStart, periodEnd);
        if (existing) return existing;
    }

    // Generate new report
    return generateReport(reportType, periodStart, periodEnd, currentWeight);
};

/**
 * Calculate period dates based on report type
 */
export const calculatePeriodDates = (
    reportType: 'daily' | 'weekly' | 'monthly',
    referenceDate: string // YYYY-MM-DD for daily, YYYY-MM-DD (Monday) for weekly, YYYY-MM for monthly
): { start: string; end: string } => {
    if (reportType === 'daily') {
        return { start: referenceDate, end: referenceDate };
    }

    if (reportType === 'weekly') {
        // referenceDate is the Monday of the week
        const start = new Date(referenceDate);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);

        const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
        return { start: referenceDate, end: endStr };
    }

    // Monthly: referenceDate is YYYY-MM
    const [year, month] = referenceDate.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0); // Last day of month

    const startStr = `${year}-${String(month).padStart(2, '0')}-01`;
    const endStr = `${year}-${String(month).padStart(2, '0')}-${String(endDate.getDate()).padStart(2, '0')}`;

    return { start: startStr, end: endStr };
};
