
export interface Ingredient {
  name: string;
  grams: number;
  calories: number;
}

export interface FoodEntry {
  id: string;
  user_id?: string;
  timestamp: string;
  date: string;
  time: string;
  food_item: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
  imageUrl?: string;
  isManual?: boolean;
  ingredients?: Ingredient[];
  originalAiResponse?: {
    item: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    ingredients?: Ingredient[];
  };
}

export interface DailySummary {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  entries: FoodEntry[];
}

export interface UserProfile {
  name: string;
  height: number;
  weight: number;
  age?: number;
  gender?: 'male' | 'female';
  activityLevel?: 'sedentary' | 'light' | 'moderate' | 'very' | 'extra';
  goal?: 'cut' | 'bulk' | 'maintain';
  equipmentAccess?: 'gym' | 'home' | 'bodyweight';
  targetWeight?: number;
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  CAL_COACH = 'CAL_COACH',
  WORKOUT_PLAN = 'WORKOUT_PLAN',
  HISTORY = 'HISTORY',
  PROFILE = 'PROFILE',
  ONBOARDING = 'ONBOARDING',
}

export interface WorkoutExercise {
  id: string;
  name: string;
  sets: number;
  reps: string;
  rest: string;
  completed: boolean;
}

export interface DailyWorkout {
  id?: string; // Unique identifier for each workout plan
  date: string;
  title: string;
  workoutTypeId?: string; // Reference to workout type for icon/color
  exercises: WorkoutExercise[];
}

export interface OnboardingState {
  currentStep: number;
  totalSteps: number;
  completed: boolean;
  profileData?: {
    name: string;
    height: number;
    weight: number;
  };
}

export interface DetectedDish {
  dish_name: string;
  bounding_box: [number, number, number, number]; // [ymin, xmin, ymax, xmax] normalized 0-1000
  estimated_total_calories: number;
  confidence_score: number;
}

export interface SharedMealAnalysis {
  dishes: DetectedDish[];
}

export interface SelectedPortion {
  dishIndex: number;
  percentage: number;
}

// --- Engagement System Types ---

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastLogDate: string | null;
  streakFreezes: number;
  lastFreezeUsedDate: string | null;
  qualifyingDates: string[];
}

export interface WeightGoal {
  startWeight: number;
  targetWeight: number;
  dailyCalorieLimit: number;
}

// --- Coach Reports Types ---

export interface CoachReportTip {
  emoji: string;
  title: string;
  description: string;
}

export interface CoachReportMetrics {
  avgCalories: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  totalMeals: number;
  workoutsCompleted: number;
  daysTracked: number;
  calorieGoalHitRate: number; // percentage 0-100
}

export interface CoachReport {
  id: string;
  userId: string;
  reportType: 'daily' | 'weekly' | 'monthly';
  periodStart: string;  // YYYY-MM-DD
  periodEnd: string;    // YYYY-MM-DD
  summary: string;
  tips: CoachReportTip[];
  metrics: CoachReportMetrics;
  weightAtReport?: number;
  createdAt: string;
}