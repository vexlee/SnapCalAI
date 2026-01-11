import React, { useState } from 'react';
import { Camera, Sparkles, TrendingUp, User, Ruler, Weight, Check, ChevronRight, ChevronLeft, X, Zap, Target, Heart } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { saveUserProfile, saveDailyGoal, markOnboardingComplete, skipOnboarding } from '../services/storage';

interface OnboardingProps {
    onComplete: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete }) => {
    const [currentStep, setCurrentStep] = useState(0);
    const [name, setName] = useState('');
    const [height, setHeight] = useState('');
    const [weight, setWeight] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const totalSteps = 5;

    const calculateBMI = () => {
        const h = parseFloat(height);
        const w = parseFloat(weight);
        if (!h || !w) return null;
        return w / ((h / 100) * (h / 100));
    };

    const calculateRecommendedCalories = (bmi: number) => {
        const w = parseFloat(weight);
        const bmr = 10 * w + 6.25 * parseFloat(height) - 5 * 25 + 5;
        const tdee = bmr * 1.2;

        if (bmi < 18.5) return Math.round(tdee + 400);
        if (bmi > 25) return Math.round(tdee - 400);
        return Math.round(tdee);
    };

    const handleNext = () => {
        if (currentStep < totalSteps - 1) {
            setCurrentStep(currentStep + 1);
        }
    };

    const handleBack = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const handleSkip = async () => {
        await skipOnboarding();
        onComplete();
    };

    const handleComplete = async () => {
        setIsSaving(true);
        try {
            // Save profile if data exists
            if (name && height && weight) {
                await saveUserProfile({
                    name,
                    height: parseFloat(height),
                    weight: parseFloat(weight)
                });

                // Calculate and save recommended goal
                const bmi = calculateBMI();
                if (bmi) {
                    const recommendedGoal = calculateRecommendedCalories(bmi);
                    await saveDailyGoal(recommendedGoal);
                }
            }

            // Mark onboarding as complete
            await markOnboardingComplete();

            // Navigate to dashboard
            onComplete();
        } catch (e) {
            console.error("Failed to save onboarding data:", e);
            alert("Failed to save your profile. Please try again.");
        } finally {
            setIsSaving(false);
        }
    };

    const canProceedFromProfile = name && height && weight;
    const bmi = calculateBMI();
    const recommendedCalories = bmi ? calculateRecommendedCalories(bmi) : null;

    return (
        <div className="min-h-screen bg-gradient-to-br from-surface via-royal-50/30 to-royal-100/40 dark:from-surface-dark dark:via-royal-950/20 dark:to-black flex items-center justify-center p-4 relative overflow-hidden">
            {/* Decorative Background Elements */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-royal-200/20 dark:bg-royal-800/10 rounded-full blur-3xl animate-pulse"></div>
            <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-200/20 dark:bg-purple-900/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>

            {/* Skip Button */}
            <button
                onClick={handleSkip}
                className="absolute top-6 right-6 z-50 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors text-sm font-medium flex items-center gap-1"
            >
                Skip <X size={16} />
            </button>

            {/* Main Content Container */}
            <div className="relative z-10 w-full max-w-2xl">
                {/* Progress Indicator */}
                <div className="flex justify-center gap-2 mb-8">
                    {Array.from({ length: totalSteps }).map((_, idx) => (
                        <div
                            key={idx}
                            className={`h-1.5 rounded-full transition-all duration-500 ${idx === currentStep
                                    ? 'w-12 bg-royal-600 dark:bg-royal-500'
                                    : idx < currentStep
                                        ? 'w-8 bg-royal-400 dark:bg-royal-600'
                                        : 'w-8 bg-gray-200 dark:bg-gray-700'
                                }`}
                        />
                    ))}
                </div>

                {/* Step Content */}
                <div className="bg-white dark:bg-[#1a1c26] rounded-[40px] shadow-diffused-lg dark:shadow-diffused-dark p-8 md:p-12 min-h-[500px] flex flex-col">
                    {/* Step 0: Welcome */}
                    {currentStep === 0 && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="relative mb-8">
                                <div className="w-24 h-24 bg-gradient-to-br from-royal-500 to-purple-600 rounded-[32px] flex items-center justify-center shadow-xl shadow-royal-200 dark:shadow-royal-900/40 animate-in zoom-in duration-700">
                                    <Sparkles size={48} className="text-white" strokeWidth={2} />
                                </div>
                                <div className="absolute -top-2 -right-2 w-8 h-8 bg-yellow-400 rounded-full animate-bounce"></div>
                            </div>

                            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-gray-50 mb-4 tracking-tight">
                                Welcome to SnapCal AI
                            </h1>
                            <p className="text-xl text-gray-600 dark:text-gray-400 font-medium mb-2">
                                Your AI-Powered Nutrition Companion
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-500 max-w-md leading-relaxed">
                                Track calories effortlessly with the power of artificial intelligence. Just snap a photo of your meal and let AI do the rest.
                            </p>

                            <div className="mt-12 grid grid-cols-3 gap-6 w-full max-w-md">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-14 h-14 bg-royal-50 dark:bg-royal-950/30 rounded-2xl flex items-center justify-center">
                                        <Camera size={28} className="text-royal-600 dark:text-royal-400" />
                                    </div>
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Snap</span>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-14 h-14 bg-purple-50 dark:bg-purple-950/30 rounded-2xl flex items-center justify-center">
                                        <Zap size={28} className="text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Analyze</span>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-950/30 rounded-2xl flex items-center justify-center">
                                        <TrendingUp size={28} className="text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Track</span>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 1: How It Works */}
                    {currentStep === 1 && (
                        <div className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="mb-8 text-center">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-royal-50 dark:bg-royal-950/30 rounded-full mb-4">
                                    <Camera size={16} className="text-royal-600 dark:text-royal-400" />
                                    <span className="text-xs font-bold text-royal-600 dark:text-royal-400 uppercase tracking-wider">How It Works</span>
                                </div>
                                <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-gray-50 mb-3">
                                    Instant Nutrition Insights
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400 text-sm max-w-lg mx-auto">
                                    Our AI analyzes your food photos to provide accurate calorie counts and nutritional breakdowns in seconds.
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-start gap-4 p-5 bg-gray-50 dark:bg-white/5 rounded-[24px] border border-gray-100 dark:border-white/5">
                                    <div className="w-12 h-12 bg-royal-100 dark:bg-royal-900/30 rounded-2xl flex items-center justify-center flex-shrink-0">
                                        <Camera size={24} className="text-royal-600 dark:text-royal-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-gray-50 mb-1">1. Capture Your Meal</h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Take a photo of any dish, snack, or beverage</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4 p-5 bg-gray-50 dark:bg-white/5 rounded-[24px] border border-gray-100 dark:border-white/5">
                                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center flex-shrink-0">
                                        <Sparkles size={24} className="text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-gray-50 mb-1">2. AI Recognition</h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Advanced AI identifies ingredients and portions instantly</p>
                                    </div>
                                </div>

                                <div className="flex items-start gap-4 p-5 bg-gray-50 dark:bg-white/5 rounded-[24px] border border-gray-100 dark:border-white/5">
                                    <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center flex-shrink-0">
                                        <TrendingUp size={24} className="text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 dark:text-gray-50 mb-1">3. Get Detailed Breakdown</h3>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">Calories, protein, carbs, and fats—all automatically calculated</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 2: Profile Importance */}
                    {currentStep === 2 && (
                        <div className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="mb-8 text-center">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-50 dark:bg-purple-950/30 rounded-full mb-4">
                                    <Heart size={16} className="text-purple-600 dark:text-purple-400" />
                                    <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider">Personalization</span>
                                </div>
                                <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-gray-50 mb-3">
                                    Why Your Profile Matters
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400 text-sm max-w-lg mx-auto">
                                    Share a few details to unlock truly personalized nutrition recommendations tailored just for you.
                                </p>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div className="p-6 bg-gradient-to-br from-royal-50 to-purple-50 dark:from-royal-950/20 dark:to-purple-950/20 rounded-[28px] border border-royal-100 dark:border-royal-900/30">
                                    <div className="w-12 h-12 bg-white dark:bg-white/10 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                                        <Target size={24} className="text-royal-600 dark:text-royal-400" />
                                    </div>
                                    <h3 className="font-extrabold text-gray-900 dark:text-gray-50 mb-2">Accurate Goals</h3>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                        Get a science-backed daily calorie target based on your unique body metrics and health objectives.
                                    </p>
                                </div>

                                <div className="p-6 bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 rounded-[28px] border border-emerald-100 dark:border-emerald-900/30">
                                    <div className="w-12 h-12 bg-white dark:bg-white/10 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                                        <TrendingUp size={24} className="text-emerald-600 dark:text-emerald-400" />
                                    </div>
                                    <h3 className="font-extrabold text-gray-900 dark:text-gray-50 mb-2">Smart Insights</h3>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                        Receive personalized BMI analysis and recommendations to help you reach your ideal weight.
                                    </p>
                                </div>

                                <div className="p-6 bg-gradient-to-br from-orange-50 to-amber-50 dark:from-orange-950/20 dark:to-amber-950/20 rounded-[28px] border border-orange-100 dark:border-orange-900/30">
                                    <div className="w-12 h-12 bg-white dark:bg-white/10 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                                        <Sparkles size={24} className="text-orange-600 dark:text-orange-400" />
                                    </div>
                                    <h3 className="font-extrabold text-gray-900 dark:text-gray-50 mb-2">Better Tracking</h3>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                        See how your intake compares to your goals and adjust your habits for optimal results.
                                    </p>
                                </div>

                                <div className="p-6 bg-gradient-to-br from-pink-50 to-rose-50 dark:from-pink-950/20 dark:to-rose-950/20 rounded-[28px] border border-pink-100 dark:border-pink-900/30">
                                    <div className="w-12 h-12 bg-white dark:bg-white/10 rounded-2xl flex items-center justify-center mb-4 shadow-sm">
                                        <Heart size={24} className="text-pink-600 dark:text-pink-400" />
                                    </div>
                                    <h3 className="font-extrabold text-gray-900 dark:text-gray-50 mb-2">Long-term Success</h3>
                                    <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                                        Build sustainable habits with data-driven feedback tailored to your wellness journey.
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Profile Setup */}
                    {currentStep === 3 && (
                        <div className="flex-1 flex flex-col justify-center animate-in fade-in slide-in-from-right-4 duration-500">
                            <div className="mb-6 text-center">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-royal-50 dark:bg-royal-950/30 rounded-full mb-4">
                                    <User size={16} className="text-royal-600 dark:text-royal-400" />
                                    <span className="text-xs font-bold text-royal-600 dark:text-royal-400 uppercase tracking-wider">Your Details</span>
                                </div>
                                <h2 className="text-3xl md:text-4xl font-extrabold text-gray-900 dark:text-gray-50 mb-3">
                                    Set Up Your Profile
                                </h2>
                                <p className="text-gray-600 dark:text-gray-400 text-sm max-w-lg mx-auto">
                                    Just a few quick details to personalize your experience
                                </p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 ml-1">
                                        Display Name
                                    </label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={name}
                                            onChange={(e) => setName(e.target.value)}
                                            placeholder="Enter your name"
                                            className="w-full p-4 pl-12 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-royal-200 focus:border-royal-400 font-bold text-gray-900 dark:text-gray-50 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600"
                                        />
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 ml-1">
                                            Height (cm)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={height}
                                                onChange={(e) => setHeight(e.target.value)}
                                                placeholder="175"
                                                className="w-full p-4 pl-12 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-royal-200 focus:border-royal-400 font-bold text-gray-900 dark:text-gray-50 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600"
                                            />
                                            <Ruler className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2 ml-1">
                                            Weight (kg)
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={weight}
                                                onChange={(e) => setWeight(e.target.value)}
                                                placeholder="70"
                                                className="w-full p-4 pl-12 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-royal-200 focus:border-royal-400 font-bold text-gray-900 dark:text-gray-50 transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600"
                                            />
                                            <Weight className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
                                        </div>
                                    </div>
                                </div>

                                {bmi && (
                                    <div className="p-5 bg-gradient-to-r from-royal-50 to-purple-50 dark:from-royal-950/20 dark:to-purple-950/20 rounded-[24px] border border-royal-100 dark:border-royal-900/30 animate-in slide-in-from-bottom-2">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-royal-700 dark:text-royal-300 uppercase tracking-wider">Your BMI</span>
                                            <span className="text-2xl font-extrabold text-royal-900 dark:text-royal-100">{bmi.toFixed(1)}</span>
                                        </div>
                                        {recommendedCalories && (
                                            <p className="text-xs text-royal-600 dark:text-royal-400">
                                                Recommended daily goal: <span className="font-bold">{recommendedCalories} kcal</span>
                                            </p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Step 4: Complete */}
                    {currentStep === 4 && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center animate-in fade-in zoom-in duration-500">
                            <div className="relative mb-8">
                                <div className="w-28 h-28 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-full flex items-center justify-center shadow-2xl shadow-emerald-200 dark:shadow-emerald-900/40 animate-in zoom-in duration-700">
                                    <Check size={56} className="text-white" strokeWidth={3} />
                                </div>
                                <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-teal-500 rounded-full animate-ping opacity-20"></div>
                            </div>

                            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 dark:text-gray-50 mb-4 tracking-tight">
                                You're All Set!
                            </h1>
                            <p className="text-lg text-gray-600 dark:text-gray-400 font-medium mb-2">
                                Your personalized nutrition journey begins now
                            </p>

                            {name && recommendedCalories && (
                                <div className="mt-8 p-6 bg-gradient-to-br from-royal-50 to-purple-50 dark:from-royal-950/20 dark:to-purple-950/20 rounded-[28px] border border-royal-100 dark:border-royal-900/30 max-w-md w-full">
                                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                                        Welcome, <span className="font-bold text-royal-600 dark:text-royal-400">{name}</span>!
                                    </p>
                                    <div className="flex items-baseline gap-2 justify-center">
                                        <span className="text-xs text-gray-500 dark:text-gray-500 font-medium">Daily Goal:</span>
                                        <span className="text-3xl font-extrabold text-royal-900 dark:text-royal-100">{recommendedCalories}</span>
                                        <span className="text-sm font-bold text-gray-500 dark:text-gray-500">kcal</span>
                                    </div>
                                </div>
                            )}

                            <p className="text-sm text-gray-500 dark:text-gray-500 mt-6 max-w-md leading-relaxed">
                                Start snapping photos of your meals to track your nutrition effortlessly. We'll help you stay on track!
                            </p>
                        </div>
                    )}

                    {/* Navigation Buttons */}
                    <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-100 dark:border-white/5">
                        <button
                            onClick={handleBack}
                            disabled={currentStep === 0}
                            className={`flex items-center gap-2 px-5 py-3 rounded-[16px] font-bold text-sm transition-all ${currentStep === 0
                                    ? 'opacity-0 pointer-events-none'
                                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-white/5'
                                }`}
                        >
                            <ChevronLeft size={20} />
                            Back
                        </button>

                        {currentStep === totalSteps - 1 ? (
                            <Button
                                onClick={handleComplete}
                                isLoading={isSaving}
                                className="px-8 py-4 text-base shadow-xl shadow-royal-200 dark:shadow-royal-900/40"
                            >
                                Start Tracking
                                <ChevronRight size={20} className="ml-1" />
                            </Button>
                        ) : currentStep === 3 ? (
                            <Button
                                onClick={handleNext}
                                disabled={!canProceedFromProfile}
                                className="px-8 py-4 text-base shadow-xl shadow-royal-200 dark:shadow-royal-900/40"
                            >
                                Continue
                                <ChevronRight size={20} className="ml-1" />
                            </Button>
                        ) : (
                            <Button
                                onClick={handleNext}
                                className="px-8 py-4 text-base shadow-xl shadow-royal-200 dark:shadow-royal-900/40"
                            >
                                Next
                                <ChevronRight size={20} className="ml-1" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
