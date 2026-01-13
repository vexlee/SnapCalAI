
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
}

export enum AppView {
  DASHBOARD = 'DASHBOARD',
  CAL_COACH = 'CAL_COACH',
  HISTORY = 'HISTORY',
  PROFILE = 'PROFILE',
  ONBOARDING = 'ONBOARDING',
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