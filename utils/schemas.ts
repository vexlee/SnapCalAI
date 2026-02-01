/**
 * Zod Validation Schemas for AI Responses
 * 
 * These schemas provide runtime validation for JSON responses from AI services.
 * This prevents crashes when the AI returns unexpected or malformed data.
 */

import { z } from 'zod';

// --- Food Analysis Schemas ---

export const IngredientSchema = z.object({
    name: z.string().default('Unknown ingredient'),
    grams: z.number().default(0),
    calories: z.number().default(0),
});

export const AnalysisResultSchema = z.object({
    item: z.string().default('Unknown food'),
    calories: z.number().default(0),
    protein: z.number().default(0),
    carbs: z.number().default(0),
    fat: z.number().default(0),
    confidence: z.number().min(0).max(1).default(0.5),
    ingredients: z.array(IngredientSchema).default([]),
});

// --- Recipe Calculation Schema ---

export const RecipeResultSchema = z.object({
    totalCalories: z.number().default(0),
    caloriesPerServing: z.number().default(0),
    proteinPerServing: z.number().default(0),
    carbsPerServing: z.number().default(0),
    fatPerServing: z.number().default(0),
    ingredients: z.array(IngredientSchema).default([]),
});

// --- Coach Report Schemas ---

export const CoachReportTipSchema = z.object({
    emoji: z.string().default('💡'),
    title: z.string().default('Tip'),
    description: z.string().default(''),
});

export const AIReportResponseSchema = z.object({
    summary: z.string().default(''),
    tips: z.array(CoachReportTipSchema).default([]),
});

// --- Type Exports (inferred from schemas) ---

export type Ingredient = z.infer<typeof IngredientSchema>;
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;
export type RecipeResult = z.infer<typeof RecipeResultSchema>;
export type CoachReportTip = z.infer<typeof CoachReportTipSchema>;
export type AIReportResponse = z.infer<typeof AIReportResponseSchema>;

// --- Validation Helper ---

/**
 * Safely parse JSON with Zod validation.
 * Returns the default values if parsing fails.
 */
export function safeParseAIResponse<T>(
    schema: z.ZodType<T>,
    jsonString: string,
    context: string = 'AI Response'
): T {
    try {
        const parsed = JSON.parse(jsonString || '{}');
        const result = schema.safeParse(parsed);

        if (!result.success) {
            console.warn(`[Zod Validation] ${context} had invalid fields:`, result.error.issues);
            // Return with defaults applied
            return schema.parse({});
        }

        return result.data;
    } catch (error) {
        console.warn(`[Zod Validation] ${context} failed to parse JSON:`, error);
        // Return schema defaults
        return schema.parse({});
    }
}
