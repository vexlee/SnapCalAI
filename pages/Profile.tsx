import React, { useEffect, useState } from 'react';
import { User, Ruler, Weight, Check, RefreshCw, Activity, ArrowRight, Database, LogOut, UploadCloud, AlertCircle, HardDrive, Cloud, Code, Copy, Calendar, Users, TrendingUp, Target, Dumbbell, ChevronDown, Scale } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { getUserProfile, saveUserProfile, saveDailyGoal, hasLocalData, syncLocalDataToSupabase, checkDatabaseSchema } from '../services/storage';
import { isSupabaseConfigured, getAppMode, setAppMode, shouldUseCloud } from '../services/supabase';
import { signOut } from '../services/auth';

const SUPABASE_SCHEMA_SQL = `
-- Run this in your Supabase SQL Editor

-- 1. Create Food Entries Table
create table if not exists food_entries (
  id uuid primary key,
  user_id uuid not null references auth.users(id),
  timestamp text not null,
  date text not null,
  time text not null,
  food_item text not null,
  calories integer not null,
  protein integer default 0,
  carbs integer default 0,
  fat integer default 0,
  confidence float default 1.0,
  is_manual boolean default false,
  image_url text,
  ingredients jsonb default '[]'::jsonb,
  original_ai_response jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 2. Create User Profiles Table
create table if not exists user_profiles (
  user_id uuid primary key references auth.users(id),
  name text,
  height float,
  weight float,
  age integer,
  gender text check (gender in ('male', 'female')),
  activity_level text check (activity_level in ('sedentary', 'light', 'moderate', 'very', 'extra')),
  goal text check (goal in ('cut', 'bulk', 'maintain')),
  equipment_access text check (equipment_access in ('gym', 'home', 'bodyweight')),
  created_at timestamp with time zone default timezone('utc'::text, now())
);

-- 3. Create Settings Table
create table if not exists user_settings (
  user_id uuid primary key references auth.users(id),
  daily_goal integer default 2000,
  has_completed_onboarding boolean default false
);

-- 4. Create Summaries Table (Optional optimization)
create table if not exists daily_summaries (
  id text primary key, -- Composite key user_id + date usually
  user_id uuid not null references auth.users(id),
  date text not null,
  total_calories integer default 0,
  total_protein integer default 0,
  total_carbs integer default 0,
  total_fat integer default 0
);

-- 5. Enable Row Level Security (RLS)
alter table food_entries enable row level security;
alter table user_profiles enable row level security;
alter table user_settings enable row level security;
alter table daily_summaries enable row level security;

-- 6. Create Policies (Allow users to see/edit ONLY their own data)

-- Food Entries
create policy "Users can all own entries" on food_entries
  for all using (auth.uid() = user_id);

-- Profiles
create policy "Users can all own profile" on user_profiles
  for all using (auth.uid() = user_id);

-- Settings
create policy "Users can all own settings" on user_settings
  for all using (auth.uid() = user_id);

-- Summaries
create policy "Users can all own summaries" on daily_summaries
  for all using (auth.uid() = user_id);
`;

export const Profile: React.FC = () => {
  const [name, setName] = useState('');
  const [height, setHeight] = useState(''); // cm
  const [weight, setWeight] = useState(''); // kg
  const [age, setAge] = useState('');
  const [gender, setGender] = useState<'male' | 'female' | ''>('');
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'light' | 'moderate' | 'very' | 'extra' | ''>('');
  const [goal, setGoal] = useState<'cut' | 'bulk' | 'maintain' | ''>('');
  const [equipmentAccess, setEquipmentAccess] = useState<'gym' | 'home' | 'bodyweight' | ''>('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [recommendedCalories, setRecommendedCalories] = useState<number | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [hasUnsyncedData, setHasUnsyncedData] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [dbStatus, setDbStatus] = useState<'ok' | 'missing_tables' | 'error' | 'checking'>('checking');
  const [showSql, setShowSql] = useState(false);
  const [showTrainingGoals, setShowTrainingGoals] = useState(false);
  const [targetWeight, setTargetWeight] = useState('');

  useEffect(() => {
    loadProfile();
    if (shouldUseCloud) {
      setHasUnsyncedData(hasLocalData());
      checkDB();
    } else {
      setDbStatus('ok');
    }
  }, []);

  const checkDB = async () => {
    const res = await checkDatabaseSchema();
    if (res.missingTables) setDbStatus('missing_tables');
    else if (!res.ok) setDbStatus('error');
    else setDbStatus('ok');
  };



  const handleModeSwitch = (mode: 'local' | 'cloud') => {
    if (mode === getAppMode()) return;

    const msg = mode === 'local'
      ? "Switching to Local Mode means your data will stay on this device only. You will be logged out of Cloud to create a local profile."
      : "Switching to Cloud Mode allows you to sync data across devices. You will be redirected to log in or sign up.";

    if (confirm(msg)) {
      setAppMode(mode);
    }
  };

  const loadProfile = async () => {
    const profile = await getUserProfile();
    if (profile) {
      setName(profile.name);
      setHeight(profile.height.toString());
      setWeight(profile.weight.toString());
      if (profile.age) setAge(profile.age.toString());
      if (profile.gender) setGender(profile.gender);
      if (profile.activityLevel) setActivityLevel(profile.activityLevel);
      if (profile.goal) setGoal(profile.goal);
      if (profile.equipmentAccess) setEquipmentAccess(profile.equipmentAccess);
      if (profile.targetWeight) setTargetWeight(profile.targetWeight.toString());
    }
  };

  const calculateBMI = () => {
    const h = parseFloat(height);
    const w = parseFloat(weight);
    if (!h || !w) return null;
    const bmi = w / ((h / 100) * (h / 100));
    return bmi;
  };

  const getBMIStatus = (bmi: number) => {
    if (bmi < 18.5) return { label: 'Underweight', color: 'text-blue-300' };
    if (bmi < 25) return { label: 'Healthy', color: 'text-emerald-300' };
    if (bmi < 30) return { label: 'Overweight', color: 'text-orange-300' };
    return { label: 'Obese', color: 'text-red-300' };
  };

  const calculateRecommendation = (bmi: number) => {
    const w = parseFloat(weight);
    const bmr = 10 * w + 6.25 * parseFloat(height) - 5 * 25 + 5;
    const tdee = bmr * 1.2;

    if (bmi < 18.5) return Math.round(tdee + 400);
    if (bmi > 25) return Math.round(tdee - 400);
    return Math.round(tdee);
  };

  const handleSave = async () => {
    if (!name || !height || !weight) return;
    setIsSaving(true);
    try {
      await saveUserProfile({
        name,
        height: parseFloat(height),
        weight: parseFloat(weight),
        age: age ? parseInt(age) : undefined,
        gender: gender || undefined,
        activityLevel: activityLevel || undefined,
        goal: goal || undefined,
        equipmentAccess: equipmentAccess || undefined,
        targetWeight: targetWeight ? parseFloat(targetWeight) : undefined
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);

      const bmi = calculateBMI();
      if (bmi) {
        const rec = calculateRecommendation(bmi);
        setRecommendedCalories(rec);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  const handleApplyRecommendation = async () => {
    if (recommendedCalories) {
      await saveDailyGoal(recommendedCalories);
      alert(`Daily goal updated to ${recommendedCalories} kcal!`);
    }
  };

  const handleSignOut = async () => {
    if (confirm("Are you sure you want to sign out?")) {
      setIsLoggingOut(true);
      try {
        await signOut();
      } catch (e) {
        console.error(e);
      } finally {
        setIsLoggingOut(false);
      }
    }
  };

  const handleSync = async () => {
    if (!confirm("This will upload your local history to your Supabase account and clear local storage. Continue?")) return;
    setIsSyncing(true);
    try {
      await syncLocalDataToSupabase();
      setHasUnsyncedData(false);
      alert("Migration successful! Your local history is now in the cloud.");
    } catch (e: any) {
      alert("Sync failed: " + e.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const copySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    alert("SQL Copied to clipboard! Paste it into the Supabase SQL Editor.");
  };

  const bmi = calculateBMI();
  const bmiStatus = bmi ? getBMIStatus(bmi) : null;
  const currentRecommendation = bmi ? calculateRecommendation(bmi) : null;
  const currentMode = getAppMode();

  return (
    <div className="flex-1 overflow-y-auto no-scrollbar pb-32 px-6 pt-10 space-y-8 animate-in fade-in duration-500 bg-transparent">
      <header>
        <p className="text-secondary-400 text-xs font-bold uppercase tracking-widest mb-2">My Profile</p>
        <h1 className="text-3xl font-black text-primary-900 tracking-tight font-display">Personal Details</h1>
      </header>

      {/* Sync Banner */}
      {shouldUseCloud && hasUnsyncedData && (
        <div className="bg-indigo-50 border border-indigo-100 p-5 rounded-4xl animate-in slide-in-from-top-4 shadow-soft">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-indigo-100 rounded-2xl text-indigo-600">
              <UploadCloud size={24} />
            </div>
            <div>
              <h3 className="text-sm font-black text-indigo-900">Local Data Found</h3>
              <p className="text-xs text-indigo-700 mt-1 mb-3 leading-relaxed font-medium">
                We found meal history on this device that isn't in the cloud yet. Sync now to secure your data.
              </p>
              <Button
                onClick={handleSync}
                isLoading={isSyncing}
                className="py-3 px-6 text-xs bg-[#3D745B] hover:bg-[#2D5A45] shadow-lg shadow-primary-200/50 rounded-full"
              >
                Sync to Cloud
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Database Issue Banner */}
      {shouldUseCloud && dbStatus === 'missing_tables' && (
        <div className="bg-rose-50 border border-rose-100 p-5 rounded-[32px] animate-in slide-in-from-top-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-rose-100 rounded-2xl text-rose-600">
              <Database size={24} />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-extrabold text-rose-900">Database Setup Required</h3>
              <p className="text-xs text-rose-700 mt-1 mb-3 leading-relaxed">
                Your Supabase project is connected, but the required tables don't exist yet. Saving will fail until you run the setup script.
              </p>
              <button
                onClick={() => setShowSql(!showSql)}
                className="flex items-center gap-2 py-2 px-4 rounded-xl text-xs font-bold bg-white text-rose-600 shadow-sm"
              >
                <Code size={14} /> {showSql ? 'Hide SQL' : 'View SQL Script'}
              </button>

              {showSql && (
                <div className="mt-4 animate-in slide-in-from-top-2">
                  <div className="bg-gray-900 rounded-xl p-3 mb-2 overflow-x-auto border border-white/10">
                    <pre className="text-[10px] text-emerald-400 font-mono leading-relaxed">{SUPABASE_SCHEMA_SQL}</pre>
                  </div>
                  <Button onClick={copySql} className="w-full py-3 text-xs bg-[#3D745B] hover:bg-[#2D5A45] text-white">
                    <Copy size={14} className="mr-2" /> Copy SQL to Clipboard
                  </Button>
                  <p className="text-[10px] text-rose-600/70 mt-2 italic text-center">
                    Paste this into the SQL Editor in your Supabase Dashboard.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}


      {/* Insight Container */}
      {bmi && bmiStatus && currentRecommendation && (
        <div className="relative rounded-4xl p-6 text-white overflow-hidden shadow-xl bg-[#3D745B] shadow-primary-200/50 animate-in slide-in-from-bottom-4 duration-500">
          <div className="absolute top-0 right-0 -mt-10 -mr-10 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 -mb-10 -ml-10 w-40 h-40 bg-black/10 rounded-full blur-3xl"></div>

          <div className="relative z-10">
            <div className="flex justify-between items-start mb-6">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Activity size={16} className="text-primary-200" />
                  <span className="text-primary-200 text-xs font-bold uppercase tracking-widest">Body Insight</span>
                </div>
                <h2 className="text-3xl font-black tracking-tight font-display">BMI: {bmi.toFixed(1)}</h2>
              </div>
              <div className={`px-3 py-1 rounded-full bg-white/10 backdrop-blur-md border border-white/10 text-sm font-black ${bmiStatus.color}`}>
                {bmiStatus.label}
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-md rounded-3xl p-5 border border-white/5">
              <p className="text-white/70 text-xs font-bold mb-3">
                Based on your profile, we recommend a daily calorie limit of:
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-1">
                  <span className="text-4xl font-black tracking-tighter">{currentRecommendation}</span>
                  <span className="text-lg font-bold text-white/60">kcal</span>
                </div>
                <button
                  onClick={handleApplyRecommendation}
                  className="w-10 h-10 bg-white text-[#3D745B] rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-all shadow-lg"
                >
                  <ArrowRight size={20} strokeWidth={3} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white p-6 rounded-4xl border border-white/50 shadow-soft space-y-5">
        <div>
          <label className="block text-xs font-black text-secondary-400 uppercase tracking-wider mb-2 ml-1">Display Name</label>
          <div className="relative">
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              className="w-full p-4 pl-12 bg-secondary-50 border border-secondary-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 font-bold text-primary-900 transition-all placeholder:text-secondary-300"
            />
            <User className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-400" size={20} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-black text-secondary-400 uppercase tracking-wider mb-2 ml-1">Height (cm)</label>
            <div className="relative">
              <input
                type="number"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="175"
                className="w-full p-4 pl-12 bg-secondary-50 border border-secondary-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 font-bold text-primary-900 transition-all placeholder:text-secondary-300"
              />
              <Ruler className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-400" size={20} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-secondary-400 uppercase tracking-wider mb-2 ml-1">Weight (kg)</label>
            <div className="relative">
              <input
                type="number"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                placeholder="70"
                className="w-full p-4 pl-12 bg-secondary-50 border border-secondary-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 font-bold text-primary-900 transition-all placeholder:text-secondary-300"
              />
              <Weight className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-400" size={20} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-black text-secondary-400 uppercase tracking-wider mb-2 ml-1">Age</label>
            <div className="relative">
              <input
                type="number"
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="25"
                className="w-full p-4 pl-12 bg-secondary-50 border border-secondary-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 font-bold text-primary-900 transition-all placeholder:text-secondary-300"
              />
              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-400" size={20} />
            </div>
          </div>
          <div>
            <label className="block text-xs font-black text-secondary-400 uppercase tracking-wider mb-2 ml-1">Gender</label>
            <div className="relative">
              <select
                value={gender}
                onChange={(e) => setGender(e.target.value as 'male' | 'female' | '')}
                className="w-full p-4 pl-12 bg-secondary-50 border border-secondary-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 font-bold text-primary-900 transition-all appearance-none cursor-pointer"
              >
                <option value="">Select</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
              </select>
              <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-400 pointer-events-none" size={20} />
            </div>
          </div>
        </div>

        {/* Training Goal Setting - Collapsible Section */}
        <div className="pt-4 border-t border-secondary-100">
          <button
            type="button"
            onClick={() => setShowTrainingGoals(!showTrainingGoals)}
            className="w-full flex items-center justify-between mb-3 group"
          >
            <div className="flex items-center gap-2">
              <Target size={16} className="text-[#3D745B]" />
              <p className="text-xs font-black text-[#3D745B] uppercase tracking-wider">
                Training Goal Setting
              </p>
            </div>
            <ChevronDown
              size={18}
              className={`text-[#3D745B] transition-transform duration-300 ${showTrainingGoals ? 'rotate-180' : ''}`}
            />
          </button>
          <p className="text-[10px] text-secondary-400 mb-3 ml-1 font-medium">Optional - Fill this for personalized AI Coach recommendations</p>

          {showTrainingGoals && (
            <div className="space-y-5 animate-in slide-in-from-top-2 duration-300">
              <div>
                <label className="block text-xs font-black text-secondary-400 uppercase tracking-wider mb-2 ml-1">Activity Level</label>
                <div className="relative">
                  <select
                    value={activityLevel}
                    onChange={(e) => setActivityLevel(e.target.value as any)}
                    className="w-full p-4 pl-12 bg-secondary-50 border border-secondary-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 font-bold text-primary-900 transition-all appearance-none cursor-pointer"
                  >
                    <option value="">Select</option>
                    <option value="sedentary">Sedentary (Little or no exercise)</option>
                    <option value="light">Lightly Active (1-3 days/week)</option>
                    <option value="moderate">Moderately Active (3-5 days/week)</option>
                    <option value="very">Very Active (6-7 days/week)</option>
                    <option value="extra">Extra Active (Intense daily)</option>
                  </select>
                  <TrendingUp className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-400 pointer-events-none" size={20} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-secondary-400 uppercase tracking-wider mb-2 ml-1">Goal</label>
                  <div className="relative">
                    <select
                      value={goal}
                      onChange={(e) => setGoal(e.target.value as any)}
                      className="w-full p-4 pl-12 bg-secondary-50 border border-secondary-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 font-bold text-primary-900 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select</option>
                      <option value="cut">Cut (Lose Fat)</option>
                      <option value="bulk">Bulk (Gain Muscle)</option>
                      <option value="maintain">Maintain</option>
                    </select>
                    <Target className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-400 pointer-events-none" size={20} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-black text-secondary-400 uppercase tracking-wider mb-2 ml-1">Equipment</label>
                  <div className="relative">
                    <select
                      value={equipmentAccess}
                      onChange={(e) => setEquipmentAccess(e.target.value as any)}
                      className="w-full p-4 pl-12 bg-secondary-50 border border-secondary-100 rounded-2xl focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 font-bold text-primary-900 transition-all appearance-none cursor-pointer"
                    >
                      <option value="">Select</option>
                      <option value="gym">Gym Access</option>
                      <option value="home">Home Equipment</option>
                      <option value="bodyweight">Bodyweight Only</option>
                    </select>
                    <Dumbbell className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary-400 pointer-events-none" size={20} />
                  </div>
                </div>
              </div>

              {/* Target Weight - Only show for weight loss goal */}
              {goal === 'cut' && (
                <div className="mt-4 animate-in slide-in-from-top-2 duration-300">
                  <label className="block text-xs font-black text-secondary-400 uppercase tracking-wider mb-2 ml-1">Target Weight (kg)</label>
                  <div className="relative">
                    <input
                      type="number"
                      value={targetWeight}
                      onChange={(e) => setTargetWeight(e.target.value)}
                      placeholder="e.g. 63"
                      step="0.1"
                      min="30"
                      max="200"
                      className="w-full p-4 pl-12 bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-200 rounded-2xl focus:outline-none focus:ring-2 focus:ring-emerald-200 focus:border-emerald-400 font-bold text-primary-900 transition-all"
                    />
                    <Scale className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500" size={20} />
                  </div>
                  <p className="text-[10px] text-emerald-600 mt-2 ml-1 font-medium">This powers your weight prediction on the Dashboard</p>
                </div>
              )}
            </div>
          )}
        </div>

        <Button
          className="w-full py-5 text-lg shadow-lg bg-[#3D745B] hover:bg-[#2D5A45] shadow-primary-200/50 rounded-full transition-all"
          onClick={handleSave}
          isLoading={isSaving}
        >
          {saveSuccess ? (
            <span className="flex items-center gap-2">
              <Check size={20} /> Saved
            </span>
          ) : 'Save Profile'}
        </Button>
      </div>


      {/* Storage Mode Toggle (Only if Supabase is configured) */}
      {isSupabaseConfigured && (
        <div className="bg-white p-6 rounded-4xl border border-white/50 shadow-soft">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${currentMode === 'cloud' ? 'bg-emerald-50 text-emerald-600' : 'bg-secondary-100 text-secondary-500'}`}>
                {currentMode === 'cloud' ? <Cloud size={20} /> : <HardDrive size={20} />}
              </div>
              <div>
                <p className="text-sm font-black text-primary-900">Storage Mode</p>
                <p className="text-xs text-secondary-500 font-bold">
                  {currentMode === 'cloud' ? 'Connected to Supabase' : 'Device Storage Only'}
                </p>
              </div>
            </div>
            {shouldUseCloud && (
              <button onClick={checkDB} className="p-2 text-secondary-400 hover:text-primary-500 transition-colors" title="Check Connection">
                <RefreshCw size={16} className={dbStatus === 'checking' ? 'animate-spin' : ''} />
              </button>
            )}
          </div>

          <div className="flex p-1 bg-secondary-50 rounded-2xl">
            <button
              onClick={() => handleModeSwitch('local')}
              className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${currentMode === 'local'
                ? 'bg-white text-primary-900 shadow-sm'
                : 'text-secondary-400 hover:text-secondary-600'
                }`}
            >
              Device Only
            </button>
            <button
              onClick={() => handleModeSwitch('cloud')}
              className={`flex-1 py-3 text-xs font-black rounded-xl transition-all ${currentMode === 'cloud'
                ? 'bg-[#3D745B] text-white shadow-sm'
                : 'text-secondary-400 hover:text-secondary-600'
                }`}
            >
              Cloud Sync
            </button>
          </div>
        </div>
      )}

      {/* Logout Action */}
      <div className="pt-4">
        <button
          onClick={handleSignOut}
          disabled={isLoggingOut}
          className="w-full flex items-center justify-center gap-3 py-5 rounded-3xl border border-red-200 text-red-500 font-black hover:bg-red-50 active:scale-95 transition-all shadow-sm"
        >
          {isLoggingOut ? (
            <RefreshCw size={20} className="animate-spin" />
          ) : (
            <>
              <LogOut size={20} />
              <span>Sign Out</span>
            </>
          )}
        </button>
      </div>

      {/* Storage Status Footer */}
      <div className="text-center pt-4 pb-2">
        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black border transition-colors ${shouldUseCloud
          ? 'bg-emerald-50 text-emerald-700 border-emerald-100'
          : 'bg-amber-50 text-amber-700 border-amber-100'
          }`}>
          <Database size={12} />
          <div className={`w-1.5 h-1.5 rounded-full ${shouldUseCloud ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
            }`}></div>
          {shouldUseCloud ? 'Syncing to Supabase' : 'Local Storage Mode'}
        </div>
      </div>
    </div>
  );
};