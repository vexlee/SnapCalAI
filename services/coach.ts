import { GoogleGenAI } from "@google/genai";
import { getUserProfile, getEntriesLite, getDailyGoal } from './storage';
import { FoodEntry } from '../types';

/**
 * Get the API key for Gemini
 */
const getApiKey = (): string => {
    const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
    if (!apiKey) {
        console.error("VITE_GEMINI_API_KEY is not set in environment variables");
    }
    return apiKey;
};

/**
 * Get or create the AI client instance
 */
const getAIClient = (): GoogleGenAI => {
    const apiKey = getApiKey();
    return new GoogleGenAI({ apiKey });
};

/**
 * Elite Coach System Prompt
 */
const COACH_SYSTEM_PROMPT = `You are **Cal Coach**, an AI fitness and nutrition coach. Your mission is to provide simple, actionable advice to help users reach their goals.

**Core Principles:**
1. **Keep it Simple:** Use short, clear sentences. No jargon or complicated explanations.
2. **Focus on What Matters:** Only highlight the most important insights and actions.
3. **Be Encouraging:** Always stay positive and supportive, even when pointing out areas for improvement.
4. **Card-Friendly Format:** Structure responses to be visually scannable with emojis, bullet points, and short sections.

**Response Guidelines:**

When analyzing nutrition:
- Start with a simple status emoji (✅ Good / ⚠️ Needs Work / 🔥 Excellent)
- Show only the most critical metrics (Calories, Protein)
- Use 2-3 bullet points max for observation
- Give 2-3 actionable next steps
- Keep total response under 150 words

When providing plans (workout/meal):
- Use simple bullet format, not complex tables
- Show only key exercises or meals (3-5 items max)
- Include specific numbers (reps, grams, servings)
- Add emoji indicators for visual appeal

When answering questions:
- Answer directly in 2-3 sentences
- Add one practical example if needed
- No lengthy explanations

**Formatting Style:**
✅ **Status**
Brief one-line summary

**Key Points:**
• Point 1 with number
• Point 2 with number
• Point 3 with number

**Action Steps:**
1. Simple action
2. Simple action

**Never:**
- Use complex tables with multiple columns
- Write long paragraphs
- Include technical disclaimers (assume user knows to consult doctors)
- Use phases like "Phase 1", "Phase 2"
- Repeat the user's data back to them

**Context Provided:**
You will receive user profile data and recent food tracking history in each message. Use this to provide personalized analysis and recommendations.`;

export interface CoachContext {
    userName?: string;
    height?: number;
    weight?: number;
    age?: number;
    gender?: 'male' | 'female';
    activityLevel?: 'sedentary' | 'light' | 'moderate' | 'very' | 'extra';
    goal?: 'cut' | 'bulk' | 'maintain';
    equipmentAccess?: 'gym' | 'home' | 'bodyweight';
    dailyGoal?: number;
    recentEntries?: {
        date: string;
        totalCalories: number;
        totalProtein: number;
        totalCarbs: number;
        totalFat: number;
        entryCount: number;
    }[];
    todayCalories?: number;
    todayProtein?: number;
    todayCarbs?: number;
    todayFat?: number;
}

export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: number;
}

/**
 * Calculate BMR using Mifflin-St Jeor Equation
 * BMR (men) = 10 × weight(kg) + 6.25 × height(cm) - 5 × age(y) + 5
 * BMR (women) = 10 × weight(kg) + 6.25 × height(cm) - 5 × age(y) - 161
 */
export const calculateBMR = (
    weight: number,
    height: number,
    age: number,
    gender: 'male' | 'female'
): number => {
    const base = 10 * weight + 6.25 * height - 5 * age;
    return gender === 'male' ? base + 5 : base - 161;
};

/**
 * Calculate TDEE (Total Daily Energy Expenditure)
 * Activity multipliers:
 * - Sedentary (little or no exercise): 1.2
 * - Lightly active (exercise 1-3 days/week): 1.375
 * - Moderately active (exercise 3-5 days/week): 1.55
 * - Very active (exercise 6-7 days/week): 1.725
 * - Extra active (very intense exercise daily): 1.9
 */
export const calculateTDEE = (
    bmr: number,
    activityLevel: 'sedentary' | 'light' | 'moderate' | 'very' | 'extra'
): number => {
    const multipliers = {
        sedentary: 1.2,
        light: 1.375,
        moderate: 1.55,
        very: 1.725,
        extra: 1.9
    };
    return bmr * multipliers[activityLevel];
};

/**
 * Build context from user data and food entries
 */
export const buildCoachContext = async (): Promise<CoachContext> => {
    try {
        const context: CoachContext = {};

        // Get user profile
        const profile = await getUserProfile();
        if (profile) {
            context.userName = profile.name;
            context.height = profile.height;
            context.weight = profile.weight;
            context.age = profile.age;
            context.gender = profile.gender;
            context.activityLevel = profile.activityLevel;
            context.goal = profile.goal;
            context.equipmentAccess = profile.equipmentAccess;
        }

        // Get daily goal
        const goal = await getDailyGoal();
        context.dailyGoal = goal;

        // Get food entries
        const entries = await getEntriesLite();

        // Calculate today's totals
        const today = new Date().toISOString().split('T')[0];
        const todayEntries = entries.filter(e => e.date === today);

        context.todayCalories = todayEntries.reduce((sum, e) => sum + e.calories, 0);
        context.todayProtein = todayEntries.reduce((sum, e) => sum + e.protein, 0);
        context.todayCarbs = todayEntries.reduce((sum, e) => sum + e.carbs, 0);
        context.todayFat = todayEntries.reduce((sum, e) => sum + e.fat, 0);

        // Group entries by date for last 30 days
        const last30Days = new Map<string, FoodEntry[]>();
        entries.forEach(entry => {
            if (!last30Days.has(entry.date)) {
                last30Days.set(entry.date, []);
            }
            last30Days.get(entry.date)!.push(entry);
        });

        // Calculate daily summaries
        context.recentEntries = Array.from(last30Days.entries())
            .slice(0, 30)
            .map(([date, dayEntries]) => ({
                date,
                totalCalories: dayEntries.reduce((sum, e) => sum + e.calories, 0),
                totalProtein: dayEntries.reduce((sum, e) => sum + e.protein, 0),
                totalCarbs: dayEntries.reduce((sum, e) => sum + e.carbs, 0),
                totalFat: dayEntries.reduce((sum, e) => sum + e.fat, 0),
                entryCount: dayEntries.length
            }));

        return context;
    } catch (error) {
        console.error("Failed to build coach context:", error);
        return {};
    }
};

/**
 * Format context as text for AI
 */
const formatContextForAI = (context: CoachContext): string => {
    let contextText = "**User Profile & Current Data:**\n\n";

    if (context.userName) {
        contextText += `- Name: ${context.userName}\n`;
    }
    if (context.height) {
        contextText += `- Height: ${context.height} cm\n`;
    }
    if (context.weight) {
        contextText += `- Weight: ${context.weight} kg\n`;
    }
    if (context.age) {
        contextText += `- Age: ${context.age} years\n`;
    }
    if (context.gender) {
        contextText += `- Gender: ${context.gender.charAt(0).toUpperCase() + context.gender.slice(1)}\n`;
    }
    if (context.activityLevel) {
        const activityLabels = {
            sedentary: 'Sedentary',
            light: 'Lightly Active',
            moderate: 'Moderately Active',
            very: 'Very Active',
            extra: 'Extra Active'
        };
        contextText += `- Activity Level: ${activityLabels[context.activityLevel]}\n`;
    }
    if (context.goal) {
        const goalLabels = { cut: 'Cut (Lose Fat)', bulk: 'Bulk (Gain Muscle)', maintain: 'Maintain' };
        contextText += `- Goal: ${goalLabels[context.goal]}\n`;
    }
    if (context.equipmentAccess) {
        const equipmentLabels = { gym: 'Gym Access', home: 'Home Equipment', bodyweight: 'Bodyweight Only' };
        contextText += `- Equipment: ${equipmentLabels[context.equipmentAccess]}\n`;
    }
    if (context.dailyGoal) {
        contextText += `- Daily Calorie Goal: ${context.dailyGoal} kcal\n`;
    }

    contextText += `\n**Today's Nutrition (${new Date().toLocaleDateString()}):**\n`;
    contextText += `- Calories: ${context.todayCalories || 0} kcal\n`;
    contextText += `- Protein: ${context.todayProtein || 0}g\n`;
    contextText += `- Carbs: ${context.todayCarbs || 0}g\n`;
    contextText += `- Fat: ${context.todayFat || 0}g\n`;

    if (context.recentEntries && context.recentEntries.length > 0) {
        contextText += `\n**Last 30 Days Summary:**\n`;
        context.recentEntries.forEach(day => {
            contextText += `\n${day.date}:\n`;
            contextText += `  - ${day.totalCalories} kcal | Protein: ${day.totalProtein}g | Carbs: ${day.totalCarbs}g | Fat: ${day.totalFat}g | Meals: ${day.entryCount}\n`;
        });
    }

    contextText += `\n---\n\n`;
    return contextText;
};

/**
 * Send message to AI coach
 */
export const sendCoachMessage = async (
    userMessage: string,
    conversationHistory: ChatMessage[]
): Promise<string> => {
    try {
        const ai = getAIClient();
        const context = await buildCoachContext();

        // Build conversation history for context
        const historyText = conversationHistory
            .slice(-4) // Keep last 4 messages for context
            .map(msg => `${msg.role === 'user' ? 'User' : 'Coach'}: ${msg.content}`)
            .join('\n\n');

        const fullPrompt = `${formatContextForAI(context)}${historyText ? `**Recent Conversation:**\n${historyText}\n\n` : ''}**User's Current Message:**\n${userMessage}`;

        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: [{ parts: [{ text: fullPrompt }] }],
            config: {
                systemInstruction: COACH_SYSTEM_PROMPT,
                temperature: 0.7,
                topP: 0.95,
            }
        });

        return response.text || "I apologize, but I couldn't generate a response. Please try again.";
    } catch (error: any) {
        console.error("Coach message error:", error);
        const message = error?.message || String(error);

        if (message.includes("429") || message.toLowerCase().includes("quota")) {
            throw new Error("Rate limit reached. Please wait a moment and try again.");
        }
        if (message.toLowerCase().includes("api key")) {
            throw new Error("Configuration error. Please check your API settings.");
        }

        throw new Error("Failed to get coach response. Please try again.");
    }
};
