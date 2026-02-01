import { GoogleGenAI, Type } from "@google/genai";
import { safeParseAIResponse, AnalysisResultSchema, RecipeResultSchema } from '../utils/schemas';

/**
 * Get the API key dynamically to ensure it's always fresh
 * Updated: 2026-01-11 - Fix for production deployment
 */
const getApiKey = (): string => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  if (!apiKey) {
    console.error("VITE_GEMINI_API_KEY is not set in environment variables");
  }
  return apiKey;
};

/**
 * Get or create the AI client instance with current API key
 */
const getAIClient = (): GoogleGenAI => {
  const apiKey = getApiKey();
  // Only log in development mode, and never log key details
  if (import.meta.env.DEV && !apiKey) {
    console.warn("Gemini API key is not configured");
  }
  return new GoogleGenAI({ apiKey });
};

const SYSTEM_INSTRUCTION = `
You are an expert AI nutritionist and mathematical calculator. 

SCENARIO 1: IMAGE/TEXT ESTIMATION
- Analyze food descriptions or images.
- Provide a detailed "receipt" breakdown of every ingredient.
- Estimate weights in grams (g) and calculate nutrition.

SCENARIO 2: STRICT RECALCULATION (User provided weights)
- If a list of ingredients with specific weights (grams) is provided, you MUST act as a precise calculator.
- IGNORE your previous estimations.
- Use the provided weights as the ABSOLUTE GROUND TRUTH.
- Calculate calories and macros strictly based on these weights.
- Return the recalculated totals.
`;

const RECIPE_INSTRUCTION = `
You are an expert culinary nutritionist.
Parse ingredients and calculate Total and Per Serving values.
Return a structured breakdown of each ingredient with its estimated calories and weight.
`;

export interface Ingredient {
  name: string;
  grams: number;
  calories: number;
}

export interface AnalysisResult {
  item: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
  ingredients: Ingredient[];
}

export interface RecipeResult {
  totalCalories: number;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  ingredients: Ingredient[];
}

/**
 * Normalizes common AI error messages to user-friendly ones.
 */
const handleGeminiError = (error: any): string => {
  const message = error?.message || String(error) || "";
  const lowMsg = message.toLowerCase();

  if (message.includes("429") || lowMsg.includes("quota") || lowMsg.includes("limit") || lowMsg.includes("exhausted")) {
    return "AI Limit Reached: You've sent too many requests. Please wait about 60 seconds for the quota to reset.";
  }
  if (lowMsg.includes("api key")) {
    return "Configuration Error: Invalid API key. Please check your settings.";
  }
  if (lowMsg.includes("network") || lowMsg.includes("fetch")) {
    return "Connection Error: Please check your internet connection and try again.";
  }
  return message || "An unexpected AI error occurred.";
};

/**
 * Utility to retry a function if it fails with a quota error.
 */
async function withRetry<T>(fn: () => Promise<T>, retries = 2, delayMs = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    const message = error?.message || "";
    const isQuota = message.includes("429") || message.toLowerCase().includes("quota");

    if (isQuota && retries > 0) {
      console.warn(`Gemini Quota hit. Retrying in ${delayMs}ms... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delayMs));
      return withRetry(fn, retries - 1, delayMs * 2);
    }
    throw error;
  }
}

export const analyzeFoodImage = async (base64Image: string): Promise<AnalysisResult> => {
  try {
    return await withRetry(async () => {
      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
            { text: "Analyze this image. Breakdown into ingredients, weights in grams, calories, and total nutrition." }
          ]
        },
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              item: { type: Type.STRING },
              calories: { type: Type.INTEGER },
              protein: { type: Type.INTEGER },
              carbs: { type: Type.INTEGER },
              fat: { type: Type.INTEGER },
              confidence: { type: Type.NUMBER },
              ingredients: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    grams: { type: Type.INTEGER },
                    calories: { type: Type.INTEGER }
                  },
                  required: ["name", "grams", "calories"]
                }
              }
            },
            required: ["item", "calories", "protein", "carbs", "fat", "confidence", "ingredients"]
          }
        }
      });
      return safeParseAIResponse(AnalysisResultSchema, response.text || "{}", 'Food Image Analysis');
    });
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw new Error(handleGeminiError(error));
  }
};

export const calculateCaloriesFromText = async (description: string, existingIngredients?: Ingredient[]): Promise<AnalysisResult> => {
  try {
    return await withRetry(async () => {
      let prompt = "";

      if (existingIngredients && existingIngredients.length > 0) {
        // User is correcting weights. We must strip previous calorie calculations 
        // to force the model to calculate fresh values based ONLY on the new grams.
        const weightInput = existingIngredients.map(i => `- ${i.name}: ${i.grams}g`).join('\n');

        prompt = `USER MANUAL WEIGHT CORRECTION:
        The following ingredients have been updated with exact weights. 
        Perform a mathematical calculation for the nutrition of each item based strictly on these grams:
        
        ${weightInput}
        
        CRITICAL: 
        1. Calculate calories/macros from scratch for each item.
        2. Sum the totals.
        3. Do not adjust the weights provided.
        4. Return the new AnalysisResult.`;
      } else {
        prompt = `Estimate nutrition for: "${description}".`;
      }

      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: prompt }] }],
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              item: { type: Type.STRING },
              calories: { type: Type.INTEGER },
              protein: { type: Type.INTEGER },
              carbs: { type: Type.INTEGER },
              fat: { type: Type.INTEGER },
              confidence: { type: Type.NUMBER },
              ingredients: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    grams: { type: Type.INTEGER },
                    calories: { type: Type.INTEGER }
                  },
                  required: ["name", "grams", "calories"]
                }
              }
            },
            required: ["item", "calories", "protein", "carbs", "fat", "confidence", "ingredients"]
          }
        }
      });
      return safeParseAIResponse(AnalysisResultSchema, response.text || "{}", 'Food Text Analysis');
    });
  } catch (error) {
    console.error("Gemini Text Analysis Error:", error);
    throw new Error(handleGeminiError(error));
  }
};

export const calculateRecipe = async (ingredients: string, servings: number): Promise<RecipeResult> => {
  try {
    return await withRetry(async () => {
      const ai = getAIClient();
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: [{ parts: [{ text: `Ingredients: ${ingredients}\nNumber of Servings: ${servings}` }] }],
        config: {
          systemInstruction: RECIPE_INSTRUCTION,
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              totalCalories: { type: Type.INTEGER },
              caloriesPerServing: { type: Type.INTEGER },
              proteinPerServing: { type: Type.INTEGER },
              carbsPerServing: { type: Type.INTEGER },
              fatPerServing: { type: Type.INTEGER },
              ingredients: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    grams: { type: Type.INTEGER },
                    calories: { type: Type.INTEGER }
                  }
                }
              }
            },
            required: ["totalCalories", "caloriesPerServing", "proteinPerServing", "carbsPerServing", "fatPerServing", "ingredients"]
          }
        }
      });
      return safeParseAIResponse(RecipeResultSchema, response.text || "{}", 'Recipe Calculation');
    });
  } catch (error) {
    console.error("Gemini Recipe Error:", error);
    throw new Error(handleGeminiError(error));
  }
};