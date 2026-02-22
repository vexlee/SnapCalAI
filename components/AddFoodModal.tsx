import React, { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Camera, AlertCircle, ChevronLeft, Sparkles, RefreshCw, ThumbsUp, ChefHat, Image as ImageIcon, Calendar, Clock, Zap, Activity, Droplets, Trash2, PlusCircle, MessageSquare, Hourglass, RotateCcw, Database, HardDrive, Users } from 'lucide-react';
import { getCurrentDateString } from '../utils/midnight';
import { Button } from './ui/Button';
import { analyzeFoodImage, calculateCaloriesFromText, calculateRecipe, RecipeResult, Ingredient } from '../services/gemini';
import { saveEntry } from '../services/storage';
import { FoodEntry } from '../types';
import { v4 as uuidv4 } from 'uuid';
import { ScanningAnimation } from './ScanningAnimation';
import { updateStreak } from '../services/streak';
import { triggerFeedAnimation } from '../services/avatar';

interface AddFoodModalProps {
  onClose: () => void;
  onSuccess: () => void;
  onOpenSharedMeal: (image?: string) => void;
  editEntry?: FoodEntry | null;
}

/**
 * Aggressively optimizes images for minimal storage footprint while maintaining acceptable quality.
 * - Resizes to max 600px width (sufficient for food photos on mobile)
 * - Uses progressive JPEG quality reduction to stay under 150KB target
 * - Reduces storage usage by ~80-90% compared to raw photos
 */
const resizeImage = (file: File, maxWidth: number = 600, targetSizeKB: number = 150, debug: boolean = false): Promise<string> => {
  return new Promise((resolve, reject) => {
    const originalSizeMB = file.size / (1024 * 1024);

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Resize to max width while maintaining aspect ratio
        if (width > maxWidth) {
          height = (maxWidth / width) * height;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);

        // Progressive quality reduction to meet target size
        let quality = 0.5; // Start with lower quality (significant size reduction)
        let result = canvas.toDataURL('image/jpeg', quality);

        // Check if we need to compress further
        const targetSizeBytes = targetSizeKB * 1024;
        const base64Length = result.split(',')[1].length;
        const sizeBytes = (base64Length * 3) / 4; // Approximate size in bytes

        if (sizeBytes > targetSizeBytes) {
          // Too large, reduce quality further
          quality = 0.35;
          result = canvas.toDataURL('image/jpeg', quality);

          // Final check - if still too large, use minimum quality
          const newBase64Length = result.split(',')[1].length;
          const newSizeBytes = (newBase64Length * 3) / 4;

          if (newSizeBytes > targetSizeBytes) {
            quality = 0.25; // Minimum acceptable quality
            result = canvas.toDataURL('image/jpeg', quality);
          }
        }

        // Debug logging
        if (debug) {
          const finalSizeKB = (result.split(',')[1].length * 3) / 4 / 1024;
          const savings = ((originalSizeMB * 1024 - finalSizeKB) / (originalSizeMB * 1024)) * 100;
          console.log(`📸 Image Optimization:
Original: ${originalSizeMB.toFixed(2)} MB(${img.width}×${img.height}px)
Optimized: ${finalSizeKB.toFixed(0)} KB(${Math.round(width)}×${Math.round(height)}px)
Quality: ${(quality * 100).toFixed(0)}%
  Saved: ${savings.toFixed(0)}% 🎉`);
        }

        resolve(result);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

type Mode = 'scan' | 'recipe' | 'chat' | 'shared';

export const AddFoodModal: React.FC<AddFoodModalProps> = ({ onClose, onSuccess, onOpenSharedMeal, editEntry }) => {
  const [mode, setMode] = useState<Mode>('scan');
  const [step, setStep] = useState<'upload' | 'details'>(editEntry ? 'details' : 'upload');
  const [preview, setPreview] = useState<string | null>(editEntry?.imageUrl || null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [chatInput, setChatInput] = useState('');

  const now = new Date();
  const defaultTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')} `;

  const [entryDate, setEntryDate] = useState(editEntry?.date || getCurrentDateString());
  const [entryTime, setEntryTime] = useState(editEntry?.time || defaultTime);

  const [foodName, setFoodName] = useState(editEntry?.food_item || '');
  const [calories, setCalories] = useState<string>(editEntry?.calories.toString() || '');
  const [protein, setProtein] = useState<string>(editEntry?.protein.toString() || '');
  const [carbs, setCarbs] = useState<string>(editEntry?.carbs.toString() || '');
  const [fat, setFat] = useState<string>(editEntry?.fat.toString() || '');
  const [ingredients, setIngredients] = useState<Ingredient[]>(editEntry?.ingredients || []);
  const [aiConfidence, setAiConfidence] = useState<number | null>(editEntry?.confidence || null);
  const [originalAiData, setOriginalAiData] = useState<any | null>(editEntry?.originalAiResponse || null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      try {
        const resizedBase64 = await resizeImage(selectedFile, 600, 150, true); // Enable debug logging
        setPreview(resizedBase64);
        setError(null);
      } catch (err) {
        setError("Failed to process image.");
      }
    }
  };

  const handleAnalyze = async () => {
    if (!preview) return;
    setIsProcessing(true);
    setError(null);
    try {
      const base64Data = preview.split(',')[1];
      const result = await analyzeFoodImage(base64Data);
      updateFieldsFromResult(result);
      setOriginalAiData(result);
      setStep('details');
    } catch (err: any) {
      setError(err.message);
    } finally { setIsProcessing(false); }
  };

  const handleChatAnalyze = async () => {
    if (!chatInput.trim()) return;
    setIsProcessing(true);
    setError(null);
    try {
      const result = await calculateCaloriesFromText(chatInput);
      updateFieldsFromResult(result);
      setOriginalAiData(result);
      setStep('details');
    } catch (err: any) {
      setError(err.message);
    } finally { setIsProcessing(false); }
  };

  const updateFieldsFromResult = (result: any) => {
    setFoodName(result.item);
    setCalories(result.calories.toString());
    setProtein(result.protein.toString());
    setCarbs(result.carbs.toString());
    setFat(result.fat.toString());
    setIngredients(result.ingredients || []);
    setAiConfidence(result.confidence);
  };

  const handleRecalculate = async () => {
    setIsRecalculating(true);
    setError(null);
    try {
      const result = await calculateCaloriesFromText(foodName, ingredients);
      updateFieldsFromResult(result);
    } catch (err: any) {
      setError(err.message);
    } finally { setIsRecalculating(false); }
  };

  const handleIngredientChange = (index: number, field: keyof Ingredient, value: string) => {
    const updated = [...ingredients];
    if (field === 'grams' || field === 'calories') {
      const num = value === '' ? 0 : parseInt(value);
      updated[index] = { ...updated[index], [field]: isNaN(num) ? 0 : num };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setIngredients(updated);
  };

  const removeIngredient = (index: number) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };

  const addIngredient = () => {
    setIngredients([...ingredients, { name: '', grams: 100, calories: 0 }]);
  };

  const handleSave = async () => {
    if (!foodName.trim() || !calories) {
      setError("Please fill required fields.");
      return;
    }

    try {
      const [year, month, day] = entryDate.split('-').map(Number);
      const [hours, minutes] = entryTime.split(':').map(Number);
      const dateObj = new Date(year, month - 1, day, hours, minutes);

      if (isNaN(dateObj.getTime())) {
        throw new Error("Invalid date or time selected.");
      }

      const timestamp = dateObj.toISOString();
      const numCalories = Number(calories);
      const numProtein = Number(protein) || 0;
      const numCarbs = Number(carbs) || 0;
      const numFat = Number(fat) || 0;

      if (isNaN(numCalories)) throw new Error("Calories must be a valid number.");

      const newEntry: FoodEntry = {
        id: editEntry?.id || uuidv4(),
        timestamp,
        date: entryDate,
        time: entryTime,
        food_item: foodName,
        calories: numCalories,
        protein: numProtein,
        carbs: numCarbs,
        fat: numFat,
        confidence: aiConfidence || 1.0,
        imageUrl: preview || undefined,
        ingredients,
        originalAiResponse: originalAiData
      };

      setIsSaving(true);
      setError(null);
      await saveEntry(newEntry);

      // Trigger engagement system updates
      await updateStreak();
      triggerFeedAnimation();

      onSuccess();
    } catch (err: any) {
      console.error("Save failed:", err);
      setError(err.message || "Failed to save record.");
    } finally { setIsSaving(false); }
  };

  const isAiQuotaError = error?.includes("Limit Reached");
  const isDbQuotaError = error?.includes("Database Quota");
  const isBrowserQuotaError = error?.includes("Browser Storage Full");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-md p-4"
    >
      <motion.div
        initial={{ y: 50, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        transition={{ type: "spring", duration: 0.4 }}
        className="bg-surface w-full max-w-md rounded-4xl p-6 shadow-2xl border border-white/50 max-h-[95vh] overflow-y-auto no-scrollbar"
      >

        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-3">
            {step === 'details' && !editEntry && (
              <button onClick={() => setStep('upload')} className="p-2 -ml-2 rounded-full hover:bg-black/5 transition-all active:scale-95">
                <ChevronLeft size={24} className="text-primary-900" />
              </button>
            )}
            <h2 className="text-3xl font-black text-primary-900 tracking-tight font-display">
              {editEntry ? 'Edit Record' : (step === 'upload' ? 'Track Meal' : 'Meal Receipt')}
            </h2>
          </div>
          <button onClick={onClose} className="p-2.5 bg-secondary-50 rounded-full hover:bg-secondary-100 transition-all active:scale-90">
            <X size={22} className="text-secondary-600" />
          </button>
        </div>

        {error && (
          <div className={`mb-4 p-4 rounded-3xl flex flex-col gap-3 animate-in shake-1 duration-300 ${isAiQuotaError ? 'bg-amber-50 border border-amber-100 text-amber-700' :
            isDbQuotaError || isBrowserQuotaError ? 'bg-orange-50 border border-orange-100 text-orange-700' :
              'bg-red-50 border border-red-100 text-red-600'
            } `}>
            <div className="flex items-start gap-3">
              {isAiQuotaError ? <Hourglass className="shrink-0 mt-0.5" size={18} /> :
                isDbQuotaError || isBrowserQuotaError ? <HardDrive className="shrink-0 mt-0.5" size={18} /> :
                  <AlertCircle className="shrink-0 mt-0.5" size={18} />}
              <div className="space-y-1">
                <p className="text-[10px] font-black uppercase tracking-widest">
                  {isAiQuotaError ? 'AI limit reached' : isBrowserQuotaError ? 'Phone Storage Full' : isDbQuotaError ? 'Cloud Storage Full' : 'Action Failed'}
                </p>
                <p className="text-xs font-semibold leading-relaxed">{error}</p>
              </div>
            </div>
            {!isBrowserQuotaError && (isAiQuotaError || !isDbQuotaError) && (
              <button
                onClick={() => { setError(null); if (step === 'upload') handleAnalyze(); else handleRecalculate(); }}
                className="w-full py-2 bg-white/50 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/80 transition-all"
              >
                <RotateCcw size={14} /> Try Again
              </button>
            )}
            {isBrowserQuotaError && (
              <div className="pt-2 border-t border-orange-200">
                <p className="text-[10px] font-medium text-orange-600/70 italic">
                  Tip: Photos take up the most space. Delete old entries in the History tab to free up browser storage.
                </p>
              </div>
            )}
          </div>
        )}

        {step === 'upload' ? (
          <div className="space-y-6">
            <div className="flex p-1.5 bg-[#3D745B] rounded-3xl backdrop-blur-sm border border-white/10">
              <button
                onClick={() => setMode('scan')}
                className={`flex-1 py-3.5 flex items-center justify-center gap-2 rounded-2xl text-[13px] font-bold transition-all duration-300 ${mode === 'scan' ? 'bg-white text-[#3D745B] shadow-soft' : 'text-white/70 hover:text-white hover:bg-white/10'} `}
              >
                <Camera size={18} className={mode === 'scan' ? 'animate-pulse' : ''} />
                <span>Scan</span>
              </button>
              <button
                onClick={() => setMode('chat')}
                className={`flex-1 py-3.5 flex items-center justify-center gap-2 rounded-2xl text-[13px] font-bold transition-all duration-300 ${mode === 'chat' ? 'bg-white text-[#3D745B] shadow-soft' : 'text-white/70 hover:text-white hover:bg-white/10'} `}
              >
                <MessageSquare size={18} />
                <span>Chat</span>
              </button>
              <button
                onClick={() => setMode('shared')}
                className={`flex-1 py-3.5 flex items-center justify-center gap-2 rounded-2xl text-[13px] font-bold transition-all duration-300 ${mode === 'shared' ? 'bg-white text-[#3D745B] shadow-soft' : 'text-white/70 hover:text-white hover:bg-white/10'} `}
              >
                <Users size={18} />
                <span>Shared</span>
              </button>
              <button
                onClick={() => setMode('recipe')}
                className={`flex-1 py-3.5 flex items-center justify-center gap-2 rounded-2xl text-[13px] font-bold transition-all duration-300 ${mode === 'recipe' ? 'bg-white text-[#3D745B] shadow-soft' : 'text-white/70 hover:text-white hover:bg-white/10'} `}
              >
                <ChefHat size={18} />
                <span>Recipe</span>
              </button>
            </div>

            {mode === 'scan' && (
              <>
                {!preview ? (
                  <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-secondary-200 rounded-4xl h-64 flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-black/5 transition-all group">
                    <Camera size={48} className="text-secondary-300 group-hover:text-primary-600 mb-4 transition-colors" />
                    <p className="text-primary-900 font-bold">Snap or Upload Photo</p>
                    <p className="text-secondary-400 text-xs mt-1 italic">Let AI do the calorie math</p>
                  </div>
                ) : (
                  <div className="rounded-4xl overflow-hidden h-64 relative mb-6 shadow-soft-lg border border-white/10">
                    <img src={preview} className="w-full h-full object-cover" />
                    <button onClick={() => setPreview(null)} className="absolute top-4 right-4 bg-black/40 text-white p-2 rounded-full backdrop-blur-md">
                      <X size={20} />
                    </button>
                  </div>
                )}
                <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} className="hidden" />
                <Button className="w-full py-5 text-lg font-black rounded-full bg-[#3D745B] text-white hover:bg-[#315C49]" disabled={!preview || isProcessing} isLoading={isProcessing} onClick={handleAnalyze}>
                  Analyze Plate
                </Button>
              </>
            )}

            {mode === 'chat' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="bg-white p-5 rounded-4xl border border-secondary-100 transition-colors shadow-soft">
                  <p className="text-xs font-bold text-primary-600 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Sparkles size={14} /> Describe your meal
                  </p>
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="e.g. I had two slices of pepperoni pizza and a small Caesar salad with Italian dressing."
                    rows={4}
                    className="w-full bg-transparent border-none outline-none text-primary-900 font-medium text-sm resize-none placeholder-secondary-300"
                  />
                </div>
                <Button
                  className="w-full py-5 text-lg font-black shadow-lg shadow-primary-200/50 rounded-full bg-[#3D745B] text-white hover:bg-[#315C49]"
                  disabled={!chatInput.trim() || isProcessing}
                  isLoading={isProcessing}
                  onClick={handleChatAnalyze}
                >
                  Ask AI
                </Button>
              </div>
            )}

            {mode === 'recipe' && (
              <div className="space-y-4 animate-in fade-in duration-300 text-center py-6">
                <ChefHat size={40} className="mx-auto text-primary-400 mb-2" />
                <p className="text-sm font-bold text-primary-900">Recipe Mode Coming Soon</p>
                <p className="text-xs font-medium text-secondary-400 px-8">For now, use Chat mode to describe your recipe ingredients for estimation.</p>
                <Button className="w-full py-3 mt-4 text-xs font-bold text-secondary-400 hover:text-primary-500 bg-secondary-50 rounded-full" onClick={() => setStep('details')}>
                  Enter Details Manually
                </Button>
              </div>
            )}

            {mode === 'shared' && (
              <>
                <div className="bg-primary-50 p-4 rounded-3xl mb-6 border border-primary-100 flex gap-3 items-start">
                  <div className="p-2 bg-primary-100 rounded-full shrink-0">
                    <Users size={16} className="text-primary-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-primary-900 mb-1">Shared Meal Mode</h4>
                    <p className="text-xs text-secondary-500 leading-relaxed">
                      Upload a photo of the entire table. Connect directly to our multi-dish analysis engine.
                    </p>
                  </div>
                </div>

                {!preview ? (
                  <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-secondary-200 rounded-4xl h-64 flex flex-col items-center justify-center cursor-pointer hover:border-primary-400 hover:bg-black/5 transition-all group">
                    <Camera size={48} className="text-secondary-300 group-hover:text-primary-600 mb-4 transition-colors" />
                    <p className="text-primary-900 font-bold">Snap or Upload Photo</p>
                    <p className="text-secondary-400 text-xs mt-1 italic">Capture the whole table</p>
                  </div>
                ) : (
                  <div className="rounded-4xl overflow-hidden h-64 relative mb-6 shadow-soft-lg border border-white/10">
                    <img src={preview} className="w-full h-full object-cover" alt="preview" />
                    <button onClick={() => setPreview(null)} className="absolute top-4 right-4 bg-black/40 text-white p-2 rounded-full backdrop-blur-md hover:bg-black/60 transition-colors">
                      <X size={20} />
                    </button>
                    <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                      <p className="text-white text-xs font-semibold text-center flex items-center justify-center gap-2">
                        <Sparkles size={14} className="text-yellow-400" />
                        Ready to analyze dishes
                      </p>
                    </div>
                  </div>
                )}

                <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} className="hidden" />

                <div className="flex gap-3">
                  <Button
                    className="w-full py-5 text-lg font-black shadow-lg shadow-primary-200/50 bg-[#3D745B] hover:bg-[#315C49] text-white rounded-full"
                    disabled={!preview}
                    onClick={() => onOpenSharedMeal(preview || undefined)}
                  >
                    Start Shared Meal
                  </Button>
                </div>
              </>
            )}

            {mode !== 'recipe' && mode !== 'shared' && (
              <button
                onClick={() => setStep('details')}
                className="w-full py-4 text-sm font-bold text-secondary-400 hover:text-primary-600 transition-all flex items-center justify-center gap-2 group"
              >
                <span>Enter Details Manually</span>
                <ChevronLeft size={16} className="rotate-180 opacity-0 group-hover:opacity-100 transition-all transform -translate-x-1 group-hover:translate-x-0" />
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            {/* Summary Top Section */}
            <div className="bg-[#3D745B] rounded-4xl p-6 text-white shadow-lg shadow-primary-200/50">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-primary-100 text-[10px] font-black uppercase tracking-widest mb-1">Estimated Calories</p>
                  <div className="flex items-baseline gap-1">
                    <input type="number" value={calories} onChange={(e) => setCalories(e.target.value)} className="bg-transparent text-4xl font-black w-24 outline-none border-b-2 border-white/20 focus:border-white transition-colors" />
                    <span className="text-xl font-bold opacity-70">kcal</span>
                  </div>
                </div>
                <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-md">
                  <Activity size={24} />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white/10 rounded-2xl p-3 flex flex-col items-center">
                  <div className="relative w-full">
                    <input
                      type="number"
                      value={protein}
                      onChange={(e) => setProtein(e.target.value)}
                      className="bg-transparent text-xs font-black w-full outline-none border-b border-white/20 focus:border-white transition-colors text-center pb-1"
                    />
                    <span className="absolute -bottom-0 right-0 text-[10px] font-bold opacity-50">g</span>
                  </div>
                  <span className="text-[8px] uppercase tracking-tighter opacity-70 mt-1">Protein</span>
                </div>
                <div className="bg-white/10 rounded-2xl p-3 flex flex-col items-center">
                  <div className="relative w-full">
                    <input
                      type="number"
                      value={carbs}
                      onChange={(e) => setCarbs(e.target.value)}
                      className="bg-transparent text-xs font-black w-full outline-none border-b border-white/20 focus:border-white transition-colors text-center pb-1"
                    />
                    <span className="absolute -bottom-0 right-0 text-[10px] font-bold opacity-50">g</span>
                  </div>
                  <span className="text-[8px] uppercase tracking-tighter opacity-70 mt-1">Carbs</span>
                </div>
                <div className="bg-white/10 rounded-2xl p-3 flex flex-col items-center">
                  <div className="relative w-full">
                    <input
                      type="number"
                      value={fat}
                      onChange={(e) => setFat(e.target.value)}
                      className="bg-transparent text-xs font-black w-full outline-none border-b border-white/20 focus:border-white transition-colors text-center pb-1"
                    />
                    <span className="absolute -bottom-0 right-0 text-[10px] font-bold opacity-50">g</span>
                  </div>
                  <span className="text-[8px] uppercase tracking-tighter opacity-70 mt-1">Fat</span>
                </div>
              </div>
            </div>

            {/* Time & Date */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-secondary-50 rounded-3xl p-3 flex items-center gap-3 border border-secondary-100">
                <Calendar size={18} className="text-secondary-400" />
                <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="bg-transparent text-sm font-bold w-full outline-none text-primary-900" />
              </div>
              <div className="bg-secondary-50 rounded-3xl p-3 flex items-center gap-3 border border-secondary-100">
                <Clock size={18} className="text-secondary-400" />
                <input type="time" value={entryTime} onChange={(e) => setEntryTime(e.target.value)} className="bg-transparent text-sm font-bold w-full outline-none text-primary-900" />
              </div>
            </div>

            {/* Meal Name */}
            <div>
              <label className="text-[10px] font-black text-secondary-400 uppercase ml-1">Meal Title</label>
              <input type="text" value={foodName} onChange={(e) => setFoodName(e.target.value)} className="w-full p-4 bg-secondary-50 border border-secondary-100 rounded-3xl font-bold text-primary-900 mt-1" />
            </div>

            {/* Ingredient Breakdown "Receipt" */}
            <div className="bg-secondary-50/50 rounded-4xl p-5 border border-secondary-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-black text-secondary-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <Sparkles size={14} className="text-primary-500" /> Ingredient Receipt
                </h3>
                <button onClick={addIngredient} className="text-primary-500 hover:text-primary-600">
                  <PlusCircle size={18} />
                </button>
              </div>
              <div className="space-y-3 max-h-64 overflow-y-auto no-scrollbar pr-1">
                {ingredients.map((ing, idx) => (
                  <div key={idx} className="flex items-center gap-2 group animate-in slide-in-from-left duration-200">
                    <input
                      type="text"
                      value={ing.name}
                      onChange={(e) => handleIngredientChange(idx, 'name', e.target.value)}
                      className="flex-1 bg-white p-2.5 rounded-xl text-xs font-bold border border-secondary-100 outline-none focus:border-primary-300 text-primary-900"
                      placeholder="Ingredient"
                    />
                    <div className="relative w-20">
                      <input
                        type="number"
                        value={ing.grams === 0 ? '' : ing.grams}
                        onChange={(e) => handleIngredientChange(idx, 'grams', e.target.value)}
                        className="w-full bg-white p-2.5 pr-6 rounded-xl text-xs font-bold border border-secondary-100 outline-none text-right text-primary-900"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-secondary-400">g</span>
                    </div>
                    <button onClick={() => removeIngredient(idx)} className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                className="w-full mt-4 py-3 text-[10px] font-black uppercase tracking-widest text-primary-600 bg-primary-100/50 hover:bg-primary-100 rounded-2xl"
                onClick={handleRecalculate}
                isLoading={isRecalculating}
              >
                <RefreshCw size={14} className={`mr-2 ${isRecalculating ? 'animate-spin' : ''} `} />
                Recalculate Totals
              </Button>
            </div>

            <Button className="w-full py-5 text-lg font-black shadow-lg shadow-primary-200/50 rounded-full bg-[#3D745B] text-white hover:bg-[#315C49]" onClick={handleSave} isLoading={isSaving} disabled={isSaving}>
              {editEntry ? 'Update Record' : 'Save & Track'}
            </Button>
          </div>
        )}
      </motion.div>
      <ScanningAnimation isActive={isProcessing} message={mode === 'chat' ? 'Analyzing Request...' : 'Analyzing Meal...'} />
    </motion.div>
  );
};