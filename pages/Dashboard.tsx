import React, { useEffect, useState } from 'react';
import { Plus, Sparkles, User, PenTool, Edit2, AlertTriangle, Utensils, TrendingUp, Users, Flame, Target } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { getEntries, deleteEntry, getDailyGoal, saveDailyGoal, getUserProfile, getDailySummaries } from '../services/storage';
import { FoodEntry, DailySummary } from '../types';
import { AddFoodModal } from '../components/AddFoodModal';
import { EditGoalModal } from '../components/EditGoalModal';
import { MealDetailModal } from '../components/MealDetailModal';
import { SharedMealModal } from '../components/SharedMealModal';
import { getCurrentDateString } from '../utils/midnight';
import { Avatar } from '../components/Avatar';
import { getStreakData, predictWeightGoal, formatPredictionMessage, WeightPrediction } from '../services/streak';

export const Dashboard: React.FC = () => {
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  // Weekly data removed
  const [showAddModal, setShowAddModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<FoodEntry | null>(null);
  const [entryToEdit, setEntryToEdit] = useState<FoodEntry | null>(null);
  const [todayCalories, setTodayCalories] = useState(0);
  const [todayProtein, setTodayProtein] = useState(0);
  const [todayCarbs, setTodayCarbs] = useState(0);
  const [todayFat, setTodayFat] = useState(0);
  const [dailyGoal, setDailyGoal] = useState(2000);
  const [progress, setProgress] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [showSharedMealModal, setShowSharedMealModal] = useState(false);
  const [initialSharedImage, setInitialSharedImage] = useState<string | null>(null);
  // Engagement system state
  const [currentStreak, setCurrentStreak] = useState(0);
  const [weightPrediction, setWeightPrediction] = useState<WeightPrediction | null>(null);
  const [showAvatarTooltip, setShowAvatarTooltip] = useState(false);

  const loadData = async () => {
    try {
      const allEntries = await getEntries();
      const today = getCurrentDateString(); // Use local date, not UTC
      const todaysEntries = allEntries.filter(e => e.date === today);
      todaysEntries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      setEntries(todaysEntries);
      setTodayCalories(todaysEntries.reduce((acc, curr) => acc + curr.calories, 0));
      setTodayProtein(todaysEntries.reduce((acc, curr) => acc + (curr.protein || 0), 0));
      setTodayCarbs(todaysEntries.reduce((acc, curr) => acc + (curr.carbs || 0), 0));
      setTodayFat(todaysEntries.reduce((acc, curr) => acc + (curr.fat || 0), 0));

      const goal = await getDailyGoal();
      setDailyGoal(goal);

      const profile = await getUserProfile();
      if (profile?.name) {
        setUserName(profile.name);
      }

      // Load engagement system data
      const streakData = await getStreakData();
      setCurrentStreak(streakData.currentStreak);

      const prediction = await predictWeightGoal();
      setWeightPrediction(prediction);

    } catch (error) {
      console.error("Failed to load dashboard data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    // Listener for specific record updates (like clearing an image)
    const handleUpdate = () => loadData();
    window.addEventListener('food-entry-updated', handleUpdate);

    // Listener for streak updates
    const handleStreakUpdate = () => loadData();
    window.addEventListener('streak-updated', handleStreakUpdate);

    // Listener for midnight refresh
    const handleMidnightRefresh = () => {
      console.log('📊 Dashboard: Midnight detected, reloading data...');
      loadData();
    };
    window.addEventListener('midnight-refresh', handleMidnightRefresh);

    return () => {
      window.removeEventListener('food-entry-updated', handleUpdate);
      window.removeEventListener('streak-updated', handleStreakUpdate);
      window.removeEventListener('midnight-refresh', handleMidnightRefresh);
    };
  }, []);

  useEffect(() => {
    if (isLoading) return;
    const targetPercentage = Math.min((todayCalories / dailyGoal) * 100, 100);
    const timer = setTimeout(() => {
      setProgress(targetPercentage);
    }, 100);
    return () => clearTimeout(timer);
  }, [todayCalories, dailyGoal, isLoading]);

  const handleDeleteEntry = async (id: string) => {
    await deleteEntry(id);
    await loadData();
  };

  const handleEditEntry = (entry: FoodEntry) => {
    setSelectedEntry(null);
    setEntryToEdit(entry);
    setShowAddModal(true);
  };

  const handleUpdateGoal = async (newGoal: number) => {
    await saveDailyGoal(newGoal);
    setDailyGoal(newGoal);
    setShowGoalModal(false);
  };

  const getBarStyle = () => {
    const percentage = (todayCalories / dailyGoal) * 100;

    if (percentage >= 100) {
      return {
        background: 'repeating-linear-gradient(45deg, #facc15, #facc15 12px, #171717 12px, #171717 24px)',
        boxShadow: '0 0 12px rgba(250, 204, 21, 0.4)'
      };
    }

    if (percentage <= 60) {
      return {
        background: '#10b981',
        boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)'
      };
    }

    if (percentage <= 80) {
      // 60% to 80%: Gradient Green to Yellow
      const greenStop = (60 / percentage) * 100;
      return {
        background: `linear-gradient(90deg, #10b981 0%, #10b981 ${greenStop}%, #facc15 100%)`,
        boxShadow: '0 0 12px rgba(250, 204, 21, 0.3)'
      };
    }

    // 80% to 99%: Gradient Yellow to Orange
    const greenStop = (60 / percentage) * 100;
    const yellowStop = (80 / percentage) * 100;
    return {
      background: `linear-gradient(90deg, #10b981 0%, #10b981 ${greenStop}%, #facc15 ${yellowStop}%, #f97316 100%)`,
      boxShadow: '0 0 12px rgba(249, 115, 22, 0.3)'
    };
  };

  const renderStatusBadge = (entry: FoodEntry) => {
    if (entry.isManual) {
      if (entry.imageUrl) {
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold tracking-wide">
            <PenTool size={10} />
            EDITED
          </span>
        );
      }
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-gray-400 text-[10px] font-bold tracking-wide">
          <User size={10} />
          MANUAL
        </span>
      );
    }

    const score = Math.round(entry.confidence * 100);
    const colorClass = score > 80 ? "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400" :
      score > 50 ? "bg-orange-50 dark:bg-orange-950/20 text-orange-600 dark:text-orange-400" :
        "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400";

    return (
      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-wide ${colorClass}`}>
        <Sparkles size={10} />
        {score}% AI
      </span>
    );
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 animate-in fade-in duration-500 overflow-hidden relative">
      {/* Fixed Top Section */}
      <div className="flex-shrink-0 px-6 pt-10 space-y-8 pb-4">
        <header className="flex justify-between items-end">
          <div>
            <p className="text-gray-400 dark:text-gray-500 text-xs font-semibold uppercase tracking-widest mb-2">{new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-50 tracking-tight leading-none">
              Hello {userName || 'there'}, <br />Let's Eat Well.
            </h1>
          </div>
          {/* Virtual Avatar */}
          <div
            className="relative"
            onMouseEnter={() => setShowAvatarTooltip(true)}
            onMouseLeave={() => setShowAvatarTooltip(false)}
          >
            <Avatar size="md" showStatus={showAvatarTooltip} />
          </div>
        </header>

        {/* Streak Counter Badge */}
        {currentStreak > 0 && (
          <div className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 text-white px-4 py-2.5 rounded-2xl shadow-lg shadow-orange-200 dark:shadow-orange-900/30 animate-in slide-in-from-left duration-500">
            <Flame size={20} className="animate-pulse" />
            <div>
              <span className="text-xl font-extrabold">{currentStreak}</span>
              <span className="ml-1.5 text-sm font-bold text-white/90">day streak!</span>
            </div>
            {currentStreak >= 7 && currentStreak < 14 && (
              <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-full">🔥 Keep it up!</span>
            )}
            {currentStreak >= 14 && currentStreak < 30 && (
              <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-full">🚀 On fire!</span>
            )}
            {currentStreak >= 30 && (
              <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded-full">👑 Legend!</span>
            )}
          </div>
        )}

        {/* Hero Stats Card - Royal Purple */}
        <div className={`relative rounded-[32px] p-6 text-white overflow-hidden shadow-xl transition-all duration-500 ${todayCalories > dailyGoal ? 'bg-red-500 shadow-red-200 dark:shadow-red-900/40' : 'bg-royal-600 shadow-royal-200 dark:shadow-royal-900/40'}`}>
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-black/10 rounded-full blur-3xl"></div>

          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Calories Consumed</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tighter">{isLoading ? "..." : todayCalories}</span>
                  <span className="text-lg text-white/60 font-medium">kcal</span>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center justify-end gap-2 text-white/80 mb-1">
                  <span className="text-xs font-semibold">Goal: {dailyGoal}</span>
                  <button
                    onClick={() => setShowGoalModal(true)}
                    className="p-1.5 rounded-full bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-sm"
                  >
                    <Edit2 size={10} />
                  </button>
                </div>
              </div>
            </div>

            <div className="w-full bg-black/20 rounded-full h-4 mb-3 overflow-hidden backdrop-blur-sm relative">
              <div
                className="h-full rounded-full transition-all duration-1000 ease-out will-change-[width] flex items-center justify-center overflow-hidden"
                style={{
                  width: `${progress}%`,
                  ...getBarStyle()
                }}
              >
                {(todayCalories / dailyGoal) >= 1 && (
                  <span className="text-[10px] font-black tracking-tighter text-white drop-shadow-md animate-pulse">
                    OVER LIMIT
                  </span>
                )}
              </div>
            </div>

            <div className="flex justify-end mb-6">
              {todayCalories > dailyGoal ? (
                <div className="flex items-center gap-1.5 bg-white/20 backdrop-blur-md px-3 py-1 rounded-full animate-pulse">
                  <AlertTriangle size={14} className="text-white" fill="white" />
                  <span className="font-bold text-xs text-white">
                    {Math.abs(dailyGoal - todayCalories).toLocaleString()} kcal over limit
                  </span>
                </div>
              ) : (
                <p className="text-xs font-medium text-white/80">
                  {Math.max(dailyGoal - todayCalories, 0).toLocaleString()} kcal remaining
                </p>
              )}
            </div>

            {/* Macro Breakdown */}
            <div className="grid grid-cols-3 gap-3 mt-5 pt-4 border-t border-white/10">
              <div className="flex flex-col items-center justify-center p-2 rounded-2xl bg-royal-800 border border-royal-700 shadow-sm relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-royal-400/10 to-transparent opacity-50" />
                <p className="text-[9px] uppercase font-bold text-royal-200 mb-0.5 relative z-10 tracking-wider">Protein</p>
                <div className="flex items-baseline gap-0.5 relative z-10">
                  <span className="text-xl font-black text-white shadow-black/10 drop-shadow-sm">{todayProtein}</span>
                  <span className="text-[10px] font-bold text-royal-300">g</span>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center p-2 rounded-2xl bg-royal-800 border border-royal-700 shadow-sm relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-royal-400/10 to-transparent opacity-50" />
                <p className="text-[9px] uppercase font-bold text-royal-200 mb-0.5 relative z-10 tracking-wider">Carbs</p>
                <div className="flex items-baseline gap-0.5 relative z-10">
                  <span className="text-xl font-black text-white shadow-black/10 drop-shadow-sm">{todayCarbs}</span>
                  <span className="text-[10px] font-bold text-royal-300">g</span>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center p-2 rounded-2xl bg-royal-800 border border-royal-700 shadow-sm relative overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-royal-400/10 to-transparent opacity-50" />
                <p className="text-[9px] uppercase font-bold text-royal-200 mb-0.5 relative z-10 tracking-wider">Fat</p>
                <div className="flex items-baseline gap-0.5 relative z-10">
                  <span className="text-xl font-black text-white shadow-black/10 drop-shadow-sm">{todayFat}</span>
                  <span className="text-[10px] font-bold text-royal-300">g</span>
                </div>
              </div>
            </div>

            {/* Weight Goal Progress */}
            {weightPrediction && weightPrediction.daysRemaining > 0 && (
              <div className="mt-5 pt-4 border-t border-white/10">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Target size={14} className="text-white/70" />
                    <span className="text-xs font-bold text-white/70 uppercase tracking-wider">Weight Goal</span>
                  </div>
                  <span className="text-xs font-bold text-white/90">
                    {weightPrediction.currentWeight}kg → {weightPrediction.targetWeight}kg
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-white/10 rounded-full h-2 mb-2 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-green-500 transition-all duration-1000"
                    style={{ width: `${weightPrediction.progressPercentage}%` }}
                  />
                </div>

                {/* Prediction message */}
                <p className="text-xs text-white/80 font-medium leading-relaxed">
                  {formatPredictionMessage(weightPrediction)}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Entries List Header - Still Fixed */}
      <div className="flex-shrink-0 px-6 mb-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">Recent Meals</h2>
          <span className="text-xs font-medium text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-lg">{entries.length} items</span>
        </div>
      </div>

      {/* Entries List Content - Scrollable Only */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-32">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2].map(i => (
              <div key={i} className="h-24 bg-white dark:bg-[#1a1c26] rounded-[32px] animate-pulse shadow-sm border border-white/5 dark:border-white/5"></div>
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-[#1a1c26] rounded-[32px] border border-gray-100 dark:border-white/5 shadow-diffused dark:shadow-diffused-dark">
            <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-300 dark:text-gray-700">
              <Utensils size={24} />
            </div>
            <p className="text-gray-400 dark:text-gray-500 font-medium mb-1">No meals tracked today.</p>
            <p className="text-xs text-gray-300 dark:text-gray-700">Tap the + button to add one.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {entries.map(entry => (
              <Card key={entry.id} className="flex gap-4 items-center p-4 group" onClick={() => setSelectedEntry(entry)}>
                <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-2xl overflow-hidden flex-shrink-0 shadow-inner">
                  {entry.imageUrl ? (
                    <img src={entry.imageUrl} alt={entry.food_item} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300 dark:text-gray-700">
                      <User size={20} />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-bold text-gray-900 dark:text-gray-50 truncate text-base">{entry.food_item}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-gray-400 dark:text-gray-500">{entry.time}</p>
                    {renderStatusBadge(entry)}
                  </div>
                </div>
                <div className="text-right pl-2">
                  <span className="block font-extrabold text-gray-900 dark:text-gray-50 text-lg">{entry.calories}</span>
                  <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase">kcal</span>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Floating Action Button - Absolute within Dashboard container */}
      <button
        onClick={() => { setEntryToEdit(null); setShowAddModal(true); }}
        className="absolute bottom-28 right-6 w-16 h-16 bg-royal-600 text-white rounded-[24px] shadow-[0_12px_24px_-6px_rgba(124,58,237,0.5)] flex items-center justify-center hover:scale-105 hover:bg-royal-700 active:scale-95 transition-all z-[60]"
      >
        <Plus size={32} strokeWidth={2.5} />
      </button>

      {showAddModal && (
        <AddFoodModal
          editEntry={entryToEdit}
          onClose={() => { setShowAddModal(false); setEntryToEdit(null); }}
          onSuccess={() => {
            setShowAddModal(false);
            setEntryToEdit(null);
            loadData();
          }}
          onOpenSharedMeal={(image?: string) => {
            setShowAddModal(false);
            setEntryToEdit(null);
            if (image) setInitialSharedImage(image);
            setTimeout(() => setShowSharedMealModal(true), 100); // Small delay for smooth transition
          }}
        />
      )}

      {showGoalModal && (
        <EditGoalModal
          currentGoal={dailyGoal}
          onClose={() => setShowGoalModal(false)}
          onSave={handleUpdateGoal}
        />
      )}

      {selectedEntry && (
        <MealDetailModal
          entry={selectedEntry}
          onClose={() => setSelectedEntry(null)}
          onDelete={handleDeleteEntry}
          onEdit={handleEditEntry}
        />
      )}

      {showSharedMealModal && (
        <SharedMealModal
          initialImage={initialSharedImage}
          onClose={() => {
            setShowSharedMealModal(false);
            setInitialSharedImage(null);
          }}
          onSuccess={() => {
            setShowSharedMealModal(false);
            setInitialSharedImage(null);
            loadData();
          }}
        />
      )}
    </div>
  );
};
