import React, { useState, useRef } from 'react';
import { X, Camera, AlertCircle, ChevronLeft, Sparkles, RefreshCw, ThumbsUp, ChefHat, Image as ImageIcon, Calendar, Clock, Zap, Activity, Droplets, Trash2, PlusCircle, MessageSquare, Hourglass, RotateCcw, Database, HardDrive } from 'lucide-react';
import { Button } from './ui/Button';
import { analyzeFoodImage, calculateCaloriesFromText, calculateRecipe, RecipeResult, Ingredient } from '../services/gemini';
import { saveEntry } from '../services/storage';
import { FoodEntry } from '../types';
import { v4 as uuidv4 } from 'uuid';

interface AddFoodModalProps {
  onClose: () => void;
  onSuccess: () => void;
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
  Original: ${originalSizeMB.toFixed(2)}MB (${img.width}×${img.height}px)
  Optimized: ${finalSizeKB.toFixed(0)}KB (${Math.round(width)}×${Math.round(height)}px)
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

type Mode = 'scan' | 'recipe' | 'chat';

export const AddFoodModal: React.FC<AddFoodModalProps> = ({ onClose, onSuccess, editEntry }) => {
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
  const defaultTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

  const [entryDate, setEntryDate] = useState(editEntry?.date || now.toISOString().split('T')[0]);
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
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1a1c26] w-full max-w-md rounded-[40px] p-6 shadow-2xl border border-white/50 dark:border-white/5 animate-in slide-in-from-bottom duration-300 max-h-[95vh] overflow-y-auto no-scrollbar">

        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-2">
            {step === 'details' && !editEntry && (
              <button onClick={() => setStep('upload')} className="p-2 -ml-2 rounded-full hover:bg-gray-100 dark:hover:bg-white/5 transition-colors">
                <ChevronLeft size={24} className="text-gray-900 dark:text-gray-50" />
              </button>
            )}
            <h2 className="text-2xl font-black text-gray-900 dark:text-gray-50 tracking-tight">
              {editEntry ? 'Edit Record' : (step === 'upload' ? 'Track Meal' : 'Meal Receipt')}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-white/5 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
            <X size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {error && (
          <div className={`mb-4 p-4 rounded-3xl flex flex-col gap-3 animate-in shake-1 duration-300 ${isAiQuotaError ? 'bg-amber-50 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-900/30 text-amber-700 dark:text-amber-400' :
            isDbQuotaError || isBrowserQuotaError ? 'bg-orange-50 dark:bg-orange-950/30 border border-orange-100 dark:border-orange-900/30 text-orange-700 dark:text-orange-400' :
              'bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400'
            }`}>
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
                className="w-full py-2 bg-white/50 dark:bg-white/10 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white/80 dark:hover:bg-white/20 transition-all"
              >
                <RotateCcw size={14} /> Try Again
              </button>
            )}
            {isBrowserQuotaError && (
              <div className="pt-2 border-t border-orange-200 dark:border-orange-900/40">
                <p className="text-[10px] font-medium text-orange-600/70 dark:text-orange-400/70 italic">
                  Tip: Photos take up the most space. Delete old entries in the History tab to free up browser storage.
                </p>
              </div>
            )}
          </div>
        )}

        {step === 'upload' ? (
          <div className="space-y-6">
            <div className="flex p-1 bg-gray-100 dark:bg-white/5 rounded-[20px]">
              <button
                onClick={() => setMode('scan')}
                className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-[16px] text-xs font-bold transition-all ${mode === 'scan' ? 'bg-white dark:bg-royal-600 text-royal-700 dark:text-white shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'}`}
              >
                <Camera size={16} />
                Scan
              </button>
              <button
                onClick={() => setMode('chat')}
                className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-[16px] text-xs font-bold transition-all ${mode === 'chat' ? 'bg-white dark:bg-royal-600 text-royal-700 dark:text-white shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'}`}
              >
                <MessageSquare size={16} />
                Chat
              </button>
              <button
                onClick={() => setMode('recipe')}
                className={`flex-1 py-3 flex items-center justify-center gap-2 rounded-[16px] text-xs font-bold transition-all ${mode === 'recipe' ? 'bg-white dark:bg-royal-600 text-royal-700 dark:text-white shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600'}`}
              >
                <ChefHat size={16} />
                Recipe
              </button>
            </div>

            {mode === 'scan' && (
              <>
                {!preview ? (
                  <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-200 dark:border-white/10 rounded-[32px] h-64 flex flex-col items-center justify-center cursor-pointer hover:border-royal-400 hover:bg-royal-50 dark:hover:bg-white/5 transition-all group">
                    <Camera size={48} className="text-gray-300 group-hover:text-royal-600 mb-4 transition-colors" />
                    <p className="text-gray-900 dark:text-gray-50 font-bold">Snap or Upload Photo</p>
                    <p className="text-gray-400 text-xs mt-1 italic">Let AI do the calorie math</p>
                  </div>
                ) : (
                  <div className="rounded-[32px] overflow-hidden h-64 relative mb-6 shadow-xl border border-white/10">
                    <img src={preview} className="w-full h-full object-cover" />
                    <button onClick={() => setPreview(null)} className="absolute top-4 right-4 bg-black/40 text-white p-2 rounded-full backdrop-blur-md">
                      <X size={20} />
                    </button>
                  </div>
                )}
                <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} className="hidden" />
                <Button className="w-full py-5 text-lg font-black" disabled={!preview || isProcessing} isLoading={isProcessing} onClick={handleAnalyze}>
                  Analyze Plate
                </Button>
              </>
            )}

            {mode === 'chat' && (
              <div className="space-y-4 animate-in fade-in duration-300">
                <div className="bg-royal-50 dark:bg-royal-950/40 p-5 rounded-[32px] border border-royal-100 dark:border-royal-900/30 transition-colors">
                  <p className="text-xs font-bold text-royal-600 dark:text-royal-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Sparkles size={14} /> Describe your meal
                  </p>
                  <textarea
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="e.g. I had two slices of pepperoni pizza and a small Caesar salad with Italian dressing."
                    rows={4}
                    className="w-full bg-transparent border-none outline-none text-gray-900 dark:text-white font-medium text-sm resize-none placeholder-gray-400 dark:placeholder-gray-600"
                  />
                </div>
                <Button
                  className="w-full py-5 text-lg font-black shadow-xl shadow-royal-200"
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
                <ChefHat size={40} className="mx-auto text-royal-400 mb-2" />
                <p className="text-sm font-bold text-gray-900 dark:text-white">Recipe Mode Coming Soon</p>
                <p className="text-xs font-medium text-gray-400 px-8">For now, use Chat mode to describe your recipe ingredients for estimation.</p>
                <Button className="w-full py-3 mt-4 text-xs font-bold text-gray-400 hover:text-royal-500 bg-gray-50 dark:bg-white/5" onClick={() => setStep('details')}>
                  Enter Details Manually
                </Button>
              </div>
            )}

            {mode !== 'recipe' && (
              <button onClick={() => setStep('details')} className="w-full py-3 text-sm font-bold text-gray-400 dark:text-gray-600 hover:text-royal-500">
                Enter Details Manually
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            {/* Summary Top Section */}
            <div className="bg-royal-600 rounded-[32px] p-6 text-white shadow-xl shadow-royal-200 dark:shadow-none">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <p className="text-royal-100 text-[10px] font-black uppercase tracking-widest mb-1">Estimated Calories</p>
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
                <div className="bg-white/10 rounded-xl p-3 flex flex-col items-center">
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
                <div className="bg-white/10 rounded-xl p-3 flex flex-col items-center">
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
                <div className="bg-white/10 rounded-xl p-3 flex flex-col items-center">
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
              <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-3 flex items-center gap-3 border border-gray-100 dark:border-white/5">
                <Calendar size={18} className="text-royal-400" />
                <input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} className="bg-transparent text-sm font-bold w-full outline-none dark:text-white" />
              </div>
              <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-3 flex items-center gap-3 border border-gray-100 dark:border-white/5">
                <Clock size={18} className="text-royal-400" />
                <input type="time" value={entryTime} onChange={(e) => setEntryTime(e.target.value)} className="bg-transparent text-sm font-bold w-full outline-none dark:text-white" />
              </div>
            </div>

            {/* Meal Name */}
            <div>
              <label className="text-[10px] font-black text-gray-400 uppercase ml-1">Meal Title</label>
              <input type="text" value={foodName} onChange={(e) => setFoodName(e.target.value)} className="w-full p-4 bg-gray-50 dark:bg-white/5 border border-gray-100 dark:border-white/5 rounded-2xl font-bold dark:text-white mt-1" />
            </div>

            {/* Ingredient Breakdown "Receipt" */}
            <div className="bg-gray-50 dark:bg-white/5 rounded-[32px] p-5 border border-gray-100 dark:border-white/5">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                  <Sparkles size={14} className="text-royal-500" /> Ingredient Receipt
                </h3>
                <button onClick={addIngredient} className="text-royal-500 hover:text-royal-600">
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
                      className="flex-1 bg-white dark:bg-white/10 p-2.5 rounded-xl text-xs font-bold border border-gray-100 dark:border-white/10 outline-none focus:border-royal-300 dark:text-white"
                      placeholder="Ingredient"
                    />
                    <div className="relative w-20">
                      <input
                        type="number"
                        value={ing.grams === 0 ? '' : ing.grams}
                        onChange={(e) => handleIngredientChange(idx, 'grams', e.target.value)}
                        className="w-full bg-white dark:bg-white/10 p-2.5 pr-6 rounded-xl text-xs font-bold border border-gray-100 dark:border-white/10 outline-none text-right dark:text-white"
                      />
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-black text-gray-400">g</span>
                    </div>
                    <button onClick={() => removeIngredient(idx)} className="text-red-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              <Button
                variant="ghost"
                className="w-full mt-4 py-3 text-[10px] font-black uppercase tracking-widest text-royal-600 bg-royal-100/50 hover:bg-royal-100"
                onClick={handleRecalculate}
                isLoading={isRecalculating}
              >
                <RefreshCw size={14} className={`mr-2 ${isRecalculating ? 'animate-spin' : ''}`} />
                Recalculate Totals
              </Button>
            </div>

            <Button className="w-full py-5 text-lg font-black shadow-xl shadow-royal-200" onClick={handleSave} isLoading={isSaving} disabled={isSaving}>
              {editEntry ? 'Update Record' : 'Save & Track'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};