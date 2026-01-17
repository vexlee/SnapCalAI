import { GoogleGenAI, Type } from "@google/genai";

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
 * System instruction for shared meal detection
 * Forces Gemini to identify multiple dishes with bounding boxes
 */
const SHARED_MEAL_SYSTEM_INSTRUCTION = `You are a professional nutritionist and vision AI. Identify all food items in this shared meal image.

For each dish on the table, provide:
1. The dish name (be specific, e.g., "Grilled Chicken Breast" not just "Chicken")
2. A bounding box in [ymin, xmin, ymax, xmax] format with normalized coordinates (0-1000 scale)
3. Total calorie estimate for the ENTIRE portion visible on the table
4. Confidence score (0-1) based on how clearly you can identify the dish

IMPORTANT:
- Detect ALL distinct food items/dishes in the image
- Each dish should have its own bounding box
- Bounding boxes should tightly encompass each dish
- Calorie estimates are for the FULL portion shown, not per serving
- If the image contains no food, return an empty dishes array

Return ONLY a valid JSON object with this exact format:
{
  "dishes": [
    {
      "dish_name": "Dish name here",
      "bounding_box": [ymin, xmin, ymax, xmax],
      "estimated_total_calories": number,
      "confidence_score": 0.95
    }
  ]
}`;

export interface DetectedDish {
    dish_name: string;
    bounding_box: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-1000
    estimated_total_calories: number;
    confidence_score: number;
}

export interface SharedMealAnalysis {
    dishes: DetectedDish[];
}

/**
 * Normalizes common AI error messages to user-friendly ones
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
 * Retry utility for handling quota errors
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

/**
 * Analyzes a shared meal image and detects all dishes with bounding boxes
 * @param base64Image - Base64 encoded image (without data:image prefix)
 * @returns Array of detected dishes with locations and calorie estimates
 */
export const analyzeSharedMeal = async (base64Image: string): Promise<SharedMealAnalysis> => {
    try {
        return await withRetry(async () => {
            const ai = getAIClient();
            const response = await ai.models.generateContent({
                model: 'gemini-2.0-flash-exp',
                contents: {
                    parts: [
                        { inlineData: { mimeType: 'image/jpeg', data: base64Image } },
                        { text: "Analyze this shared meal image and identify all dishes with their locations and calorie estimates." }
                    ]
                },
                config: {
                    systemInstruction: SHARED_MEAL_SYSTEM_INSTRUCTION,
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: Type.OBJECT,
                        properties: {
                            dishes: {
                                type: Type.ARRAY,
                                items: {
                                    type: Type.OBJECT,
                                    properties: {
                                        dish_name: { type: Type.STRING },
                                        bounding_box: {
                                            type: Type.ARRAY,
                                            items: { type: Type.INTEGER }
                                        },
                                        estimated_total_calories: { type: Type.INTEGER },
                                        confidence_score: { type: Type.NUMBER }
                                    },
                                    required: ["dish_name", "bounding_box", "estimated_total_calories", "confidence_score"]
                                }
                            }
                        },
                        required: ["dishes"]
                    },
                    temperature: 0.4, // Lower temperature for more consistent bounding boxes
                    topP: 0.95,
                }
            });

            const result: SharedMealAnalysis = JSON.parse(response.text || "{}");

            // Validation
            if (!result.dishes || !Array.isArray(result.dishes)) {
                throw new Error("Invalid response format from AI");
            }

            // Validate each dish has proper bounding box format
            result.dishes.forEach((dish, index) => {
                if (!Array.isArray(dish.bounding_box) || dish.bounding_box.length !== 4) {
                    throw new Error(`Invalid bounding box format for dish ${index + 1}`);
                }
                // Ensure all coordinates are within 0-1000 range
                dish.bounding_box = dish.bounding_box.map(coord =>
                    Math.max(0, Math.min(1000, coord))
                ) as [number, number, number, number];
            });

            // If no dishes detected, provide helpful feedback
            if (result.dishes.length === 0) {
                throw new Error("No dishes detected in this image. Please ensure the photo clearly shows food items on a table.");
            }

            return result;
        });
    } catch (error) {
        console.error("Gemini Shared Meal Analysis Error:", error);
        throw new Error(handleGeminiError(error));
    }
};
