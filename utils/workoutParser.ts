import { WorkoutExercise } from '../types';

/**
 * Detect if a message contains a workout plan
 * Looks for workout-related keywords and structured exercise information
 */
export const detectWorkoutPlan = (message: string): boolean => {
    const lowerMsg = message.toLowerCase();

    // Must contain workout-related keywords
    const hasWorkoutKeywords = /\b(workout|exercise|training|routine|fitness|gym)\b/i.test(message);

    // Check for day-based structure (multi-day plans)
    const hasDayStructure = /day\s+\d+:/i.test(message);

    // Must have some structured format (numbers followed by sets/reps indicators)
    const hasStructure = /\d+\s*(sets?|reps?|x)/i.test(message) ||
        /sets?:\s*\d+/i.test(message) ||
        /\d+\s*x\s*\d+/i.test(message);

    // Check for common exercise names
    const hasExerciseNames = /(push-?up|pull-?up|squat|deadlift|bench\s+press|plank|lunge|curl|press|row)/i.test(message);

    // Return true if we have workout keywords AND (structure OR day structure OR exercise names)
    return hasWorkoutKeywords && (hasStructure || hasDayStructure || hasExerciseNames);
};

/**
 * Parse workout plan from AI-generated text
 * Extracts exercise name, sets, reps, and rest time
 */
export const parseWorkoutPlan = (message: string): { title: string; exercises: WorkoutExercise[] } => {
    const exercises: WorkoutExercise[] = [];

    // Try to extract title from the message
    let title = 'AI Workout Plan';
    const titleMatch = message.match(/(?:^|\n)(?:##?\s*)?([A-Z][\w\s&]+(?:Day|Workout|Training|Routine))/i);
    if (titleMatch) {
        title = titleMatch[1].trim();
    }

    // Split message into lines
    const lines = message.split('\n').map(l => l.trim());

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Skip empty lines, headers, and non-exercise content
        if (!line || line.startsWith('#') || line.startsWith('**Action') || line.startsWith('**Key')) {
            continue;
        }

        // Try to parse exercise from various formats:
        // Format 1: "• Exercise Name - 3 sets x 8-10 reps, 90s rest"
        // Format 2: "1. Exercise Name: 3 sets of 8-10 reps (90s rest)"
        // Format 3: "Exercise Name | Sets: 3 | Reps: 8-10 | Rest: 90s"
        // Format 4: "Exercise Name (3x8-10, 90s)"

        let exerciseName = '';
        let sets = 3;
        let reps = '10';
        let rest = '60s';

        // Remove bullet points and numbers
        let cleanLine = line.replace(/^[•\-\*]\s*/, '').replace(/^\d+\.\s*/, '');

        // Extract sets (look for patterns like "3 sets", "4x", "Sets: 3")
        const setsMatch = cleanLine.match(/(\d+)\s*(?:sets?|x)/i) || cleanLine.match(/sets?:\s*(\d+)/i);
        if (setsMatch) {
            sets = parseInt(setsMatch[1]);
        }

        // Extract reps (look for patterns like "8-10 reps", "12 reps", "Reps: 10")
        const repsMatch = cleanLine.match(/(\d+(?:-\d+)?)\s*reps?/i) || cleanLine.match(/reps?:\s*(\d+(?:-\d+)?)/i);
        if (repsMatch) {
            reps = repsMatch[1];
        } else {
            // Look for "3x8" or "4×10" format
            const altRepsMatch = cleanLine.match(/\dx(\d+(?:-\d+)?)/i);
            if (altRepsMatch) {
                reps = altRepsMatch[1];
            }
        }

        // Extract rest time (look for patterns like "90s", "60 seconds", "Rest: 2min")
        const restMatch = cleanLine.match(/(\d+(?:s|sec|seconds?|min|minutes?))/i) || cleanLine.match(/rest:\s*(\d+(?:s|sec|min)?)/i);
        if (restMatch) {
            rest = restMatch[1].toLowerCase().replace('seconds', 's').replace('sec', 's').replace('minutes', 'min').replace('minute', 'min');
        }

        // Extract exercise name (everything before the first number or colon)
        const nameMatch = cleanLine.match(/^([A-Za-z][\w\s\-'()]+?)(?:\s*[-:|]|\s+\d)/);
        if (nameMatch) {
            exerciseName = nameMatch[1].trim();
        } else {
            // If no structured format, check if it's just an exercise name
            if (/^[A-Za-z][\w\s\-'()]+$/.test(cleanLine) && cleanLine.length < 50) {
                exerciseName = cleanLine;
            }
        }

        // Only add if we found a valid exercise name
        if (exerciseName && !exerciseName.match(/^(sets?|reps?|rest|action|next|step)/i)) {
            exercises.push({
                id: `ex-${Date.now()}-${exercises.length}`,
                name: exerciseName,
                sets,
                reps,
                rest,
                completed: false
            });
        }
    }

    return { title, exercises };
};

/**
 * Extract title from AI workout message (fallback for format detection)
 */
export const extractWorkoutTitle = (message: string): string => {
    // Look for common workout day patterns
    const patterns = [
        /(?:^|\n)(?:##?\s*)?([A-Z][\w\s&]+Day)/i, // "Chest Day", "Push Day"
        /(?:^|\n)(?:##?\s*)?([A-Z][\w\s&]+Workout)/i, // "Upper Body Workout"
        /(?:^|\n)(?:##?\s*)?([A-Z][\w\s&]+Training)/i, // "Strength Training"
    ];

    for (const pattern of patterns) {
        const match = message.match(pattern);
        if (match) {
            return match[1].trim();
        }
    }

    return 'AI Workout Plan';
};

/**
 * Parse multi-day workout plan from AI-generated text
 * Detects day separators and returns structured multi-day plan
 */
export const parseMultiDayWorkoutPlan = (message: string): {
    isMultiDay: boolean;
    days: Array<{
        dayNumber: number;
        title: string;
        exercises: WorkoutExercise[];
        isRestDay: boolean;
    }>;
} => {
    // Check if message contains day separators
    const dayPattern = /Day\s+(\d+):?\s*(.+?)(?=Day\s+\d+:|$)/gis;
    const matches = Array.from(message.matchAll(dayPattern));

    if (matches.length < 2) {
        // Not a multi-day plan, return single day
        const { title, exercises } = parseWorkoutPlan(message);
        return {
            isMultiDay: false,
            days: [{
                dayNumber: 1,
                title,
                exercises,
                isRestDay: exercises.length === 0
            }]
        };
    }

    // Parse each day
    const days = matches.map(match => {
        const dayNumber = parseInt(match[1]);
        const dayContent = match[2].trim();

        // Check if this is a rest day
        const isRestDay = /^(rest|recovery|off)\s*$/i.test(dayContent) ||
            dayContent.toLowerCase().includes('rest day');

        // Check if this references another day (e.g., "Repeat Day 1")
        const repeatMatch = dayContent.match(/repeat\s+day\s+(\d+)/i);

        if (isRestDay) {
            return {
                dayNumber,
                title: 'Rest Day',
                exercises: [],
                isRestDay: true
            };
        }

        if (repeatMatch) {
            // This day repeats another day - we'll handle this after parsing all days
            return {
                dayNumber,
                title: dayContent,
                exercises: [],
                isRestDay: false,
                repeatsDayNumber: parseInt(repeatMatch[1])
            };
        }

        // Parse exercises for this day
        const { title, exercises } = parseWorkoutPlan(dayContent);

        return {
            dayNumber,
            title: title === 'AI Workout Plan' ? dayContent.split('\n')[0] : title,
            exercises,
            isRestDay: exercises.length === 0
        };
    });

    // Handle "Repeat Day X" by copying exercises from the referenced day
    days.forEach(day => {
        if ((day as any).repeatsDayNumber) {
            const repeatsDayNumber = (day as any).repeatsDayNumber;
            const sourceDay = days.find(d => d.dayNumber === repeatsDayNumber);
            if (sourceDay) {
                day.title = sourceDay.title;
                day.exercises = sourceDay.exercises.map(ex => ({
                    ...ex,
                    id: `ex-${Date.now()}-${Math.random()}`
                }));
            }
            delete (day as any).repeatsDayNumber;
        }
    });

    return {
        isMultiDay: true,
        days
    };
};
