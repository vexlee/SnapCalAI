import React, { useState, useEffect, useRef } from 'react';
import { X, Users, Camera, Sparkles, ChefHat, AlertCircle, Check, Loader, Calendar, Clock, TrendingUp, CheckCircle, ChevronDown, Percent } from 'lucide-react';
import { getCurrentDateString } from '../utils/midnight';
import { Button } from './ui/Button';
import { analyzeSharedMeal } from '../services/sharedMeal';
import { DetectedDish, FoodEntry } from '../types';
import { saveEntry } from '../services/storage';
import { v4 as uuidv4 } from 'uuid';
import { ScanningAnimation } from './ScanningAnimation';

interface SharedMealModalProps {
    onClose: () => void;
    onSuccess: () => void;
    initialImage?: string | null;
}

/**
 * Resizes images for optimal storage (reused from AddFoodModal)
 */
const resizeImage = (file: File, maxWidth: number = 600, targetSizeKB: number = 150): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target?.result as string;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > maxWidth) {
                    height = (maxWidth / width) * height;
                    width = maxWidth;
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);

                let quality = 0.5;
                let result = canvas.toDataURL('image/jpeg', quality);

                const targetSizeBytes = targetSizeKB * 1024;
                const base64Length = result.split(',')[1].length;
                const sizeBytes = (base64Length * 3) / 4;

                if (sizeBytes > targetSizeBytes) {
                    quality = 0.35;
                    result = canvas.toDataURL('image/jpeg', quality);

                    const newBase64Length = result.split(',')[1].length;
                    const newSizeBytes = (newBase64Length * 3) / 4;

                    if (newSizeBytes > targetSizeBytes) {
                        quality = 0.25;
                        result = canvas.toDataURL('image/jpeg', quality);
                    }
                }

                resolve(result);
            };
            img.onerror = (err) => reject(err);
        };
        reader.onerror = (err) => reject(err);
    });
};

type Step = 'upload' | 'analyzing' | 'selection' | 'confirmation';

export const SharedMealModal: React.FC<SharedMealModalProps> = ({ onClose, onSuccess, initialImage }) => {
    const [step, setStep] = useState<Step>(initialImage ? 'analyzing' : 'upload');
    const [preview, setPreview] = useState<string | null>(initialImage || null);
    const [detectedDishes, setDetectedDishes] = useState<DetectedDish[]>([]);
    const [selectedPortions, setSelectedPortions] = useState<Map<number, number>>(new Map());
    const [activeDish, setActiveDish] = useState<number | null>(null);
    const [tempPercentage, setTempPercentage] = useState(50);
    const [error, setError] = useState<string | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageRef = useRef<HTMLImageElement>(null);
    const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const selectedFile = e.target.files[0];
            try {
                const resizedBase64 = await resizeImage(selectedFile, 600, 150);
                setPreview(resizedBase64);
                setError(null);
            } catch (err) {
                setError("Failed to process image.");
            }
        }
    };

    // Auto-analyze if initial image is provided
    useEffect(() => {
        if (initialImage && step === 'analyzing') {
            const analyze = async () => {
                try {
                    const base64Data = initialImage.split(',')[1];
                    const result = await analyzeSharedMeal(base64Data);
                    setDetectedDishes(result.dishes);
                    setStep('selection');
                } catch (err: any) {
                    setError(err.message);
                    setStep('upload');
                }
            };
            analyze();
        }
    }, [initialImage]);

    const handleAnalyze = async () => {
        if (!preview) return;
        setStep('analyzing');
        setError(null);

        try {
            const base64Data = preview.split(',')[1];
            const result = await analyzeSharedMeal(base64Data);
            setDetectedDishes(result.dishes);
            setStep('selection');
        } catch (err: any) {
            setError(err.message);
            setStep('upload');
        }
    };

    // Update image dimensions when image loads
    useEffect(() => {
        if (imageRef.current && step === 'selection') {
            const updateDimensions = () => {
                if (imageRef.current) {
                    setImageDimensions({
                        width: imageRef.current.offsetWidth,
                        height: imageRef.current.offsetHeight
                    });
                }
            };
            updateDimensions();
            window.addEventListener('resize', updateDimensions);
            return () => window.removeEventListener('resize', updateDimensions);
        }
    }, [step]);

    /**
     * Maps normalized coordinates (0-1000) to actual pixel positions
     * Handles image fitting with letterboxing/pillarboxing
     */
    const calculateAnchorPosition = (box: [number, number, number, number]) => {
        if (!imageRef.current) return { x: 0, y: 0 };

        const img = imageRef.current;
        const displayWidth = img.offsetWidth;
        const displayHeight = img.offsetHeight;
        const naturalWidth = img.naturalWidth;
        const naturalHeight = img.naturalHeight;

        // Calculate center of bounding box (normalized 0-1000)
        const centerX = (box[1] + box[3]) / 2;
        const centerY = (box[0] + box[2]) / 2;

        // Convert to 0-1 scale
        const normX = centerX / 1000;
        const normY = centerY / 1000;

        // Account for object-fit: contain
        const naturalAspect = naturalWidth / naturalHeight;
        const displayAspect = displayWidth / displayHeight;

        let actualWidth = displayWidth;
        let actualHeight = displayHeight;
        let offsetX = 0;
        let offsetY = 0;

        if (naturalAspect > displayAspect) {
            // Letterboxing (black bars top/bottom)
            actualHeight = displayWidth / naturalAspect;
            offsetY = (displayHeight - actualHeight) / 2;
        } else {
            // Pillarboxing (black bars left/right)
            actualWidth = displayHeight * naturalAspect;
            offsetX = (displayWidth - actualWidth) / 2;
        }

        return {
            x: normX * actualWidth + offsetX,
            y: normY * actualHeight + offsetY
        };
    };

    const handleDishClick = (index: number) => {
        setActiveDish(index);
        setTempPercentage(selectedPortions.get(index) || 50);
    };

    const handlePercentageConfirm = () => {
        if (activeDish !== null) {
            const newSelections = new Map(selectedPortions);
            if (tempPercentage > 0) {
                newSelections.set(activeDish, tempPercentage);
            } else {
                newSelections.delete(activeDish);
            }
            setSelectedPortions(newSelections);
            setActiveDish(null);
        }
    };

    const calculateTotalCalories = () => {
        let total = 0;
        selectedPortions.forEach((percentage, dishIndex) => {
            const dish = detectedDishes[dishIndex];
            total += Math.round((dish.estimated_total_calories * percentage) / 100);
        });
        return total;
    };

    const handleSave = async () => {
        if (selectedPortions.size === 0) {
            setError("Please select at least one dish portion.");
            return;
        }

        setIsSaving(true);
        setError(null);

        try {
            const now = new Date();
            const timestamp = now.toISOString();
            const date = getCurrentDateString();
            const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

            for (const [dishIndex, percentage] of Array.from(selectedPortions.entries())) {
                const dish = detectedDishes[dishIndex];
                const calories = Math.round((dish.estimated_total_calories * percentage) / 100);

                const entry: FoodEntry = {
                    id: uuidv4(),
                    timestamp,
                    date,
                    time,
                    food_item: `${dish.dish_name} (Shared Meal - ${percentage}%)`,
                    calories,
                    protein: 0,
                    carbs: 0,
                    fat: 0,
                    confidence: dish.confidence_score,
                    imageUrl: preview || undefined,
                    isManual: false
                };

                await saveEntry(entry);
            }

            onSuccess();
        } catch (err: any) {
            console.error("Save failed:", err);
            setError(err.message || "Failed to save entries.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-[#1a1c26] w-full max-w-md rounded-[40px] p-6 shadow-2xl border border-white/50 dark:border-white/5 animate-in slide-in-from-bottom duration-300 max-h-[95vh] overflow-y-auto no-scrollbar">

                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-2xl font-black text-gray-900 dark:text-gray-50 tracking-tight">
                        {step === 'upload' ? 'Shared Meal' : step === 'analyzing' ? 'Analyzing...' : step === 'selection' ? 'Select Portions' : 'Confirm'}
                    </h2>
                    <button onClick={onClose} className="p-2 bg-gray-100 dark:bg-white/5 rounded-full hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                        <X size={20} className="text-gray-600 dark:text-gray-400" />
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-4 rounded-3xl flex items-start gap-3 bg-red-50 dark:bg-red-950/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 animate-in shake-1 duration-300">
                        <AlertCircle className="shrink-0 mt-0.5" size={18} />
                        <p className="text-xs font-semibold leading-relaxed">{error}</p>
                    </div>
                )}

                {step === 'upload' && (
                    <div className="space-y-6">
                        <div className="bg-royal-50 dark:bg-royal-950/40 p-5 rounded-[32px] border border-royal-100 dark:border-royal-900/30">
                            <p className="text-xs font-bold text-royal-600 dark:text-royal-400 mb-2">📸 Shared Meal Mode</p>
                            <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
                                Take a photo of a table with multiple dishes. The AI will identify each dish and let you specify what percentage you ate.
                            </p>
                        </div>

                        {!preview ? (
                            <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-200 dark:border-white/10 rounded-[32px] h-64 flex flex-col items-center justify-center cursor-pointer hover:border-royal-400 hover:bg-royal-50 dark:hover:bg-white/5 transition-all group">
                                <Camera size={48} className="text-gray-300 group-hover:text-royal-600 mb-4 transition-colors" />
                                <p className="text-gray-900 dark:text-gray-50 font-bold">Snap or Upload Photo</p>
                                <p className="text-gray-400 text-xs mt-1 italic">Capture the whole table</p>
                            </div>
                        ) : (
                            <div className="rounded-[32px] overflow-hidden h-64 relative mb-6 shadow-xl border border-white/10">
                                <img src={preview} className="w-full h-full object-cover" alt="preview" />
                                <button onClick={() => setPreview(null)} className="absolute top-4 right-4 bg-black/40 text-white p-2 rounded-full backdrop-blur-md">
                                    <X size={20} />
                                </button>
                            </div>
                        )}

                        <input type="file" ref={fileInputRef} accept="image/*" onChange={handleFileChange} className="hidden" />
                        <Button className="w-full py-5 text-lg font-black" disabled={!preview} onClick={handleAnalyze}>
                            Detect Dishes
                        </Button>
                    </div>
                )}

                {step === 'analyzing' && (
                    <ScanningAnimation
                        isActive={true}
                        message="Analyzing Shared Meal..."
                    />
                )}

                {step === 'selection' && preview && (
                    <div className="space-y-6">
                        <div className="relative rounded-[32px] overflow-hidden border border-white/10 shadow-xl">
                            <img
                                ref={imageRef}
                                src={preview}
                                className="w-full h-auto object-contain max-h-[400px]"
                                alt="Shared meal"
                                onLoad={() => {
                                    if (imageRef.current) {
                                        setImageDimensions({
                                            width: imageRef.current.offsetWidth,
                                            height: imageRef.current.offsetHeight
                                        });
                                    }
                                }}
                            />

                            {/* Anchor points overlay */}
                            {detectedDishes.map((dish, index) => {
                                const pos = calculateAnchorPosition(dish.bounding_box);
                                const isSelected = selectedPortions.has(index);

                                return (
                                    <button
                                        key={index}
                                        onClick={() => handleDishClick(index)}
                                        className={`absolute w-10 h-10 rounded-full flex items-center justify-center transition-all transform -translate-x-1/2 -translate-y-1/2 ${isSelected
                                            ? 'bg-emerald-500 shadow-lg shadow-emerald-500/50 scale-110'
                                            : 'bg-royal-600 shadow-lg shadow-royal-600/50 hover:scale-110'
                                            }`}
                                        style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
                                    >
                                        {isSelected ? (
                                            <CheckCircle size={20} className="text-white" />
                                        ) : (
                                            <span className="text-white text-xs font-black">{index + 1}</span>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="bg-gray-50 dark:bg-white/5 rounded-[32px] p-5 border border-gray-100 dark:border-white/5">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Detected Dishes ({detectedDishes.length})</p>
                            <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar">
                                {detectedDishes.map((dish, index) => (
                                    <button
                                        key={index}
                                        onClick={() => handleDishClick(index)}
                                        className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${selectedPortions.has(index)
                                            ? 'bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/30'
                                            : 'bg-white dark:bg-white/5 border border-gray-100 dark:border-white/10 hover:border-royal-300'
                                            }`}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className="w-6 h-6 rounded-full bg-royal-600 text-white text-xs font-black flex items-center justify-center">
                                                {index + 1}
                                            </span>
                                            <span className="text-sm font-bold text-gray-900 dark:text-gray-50 truncate">{dish.dish_name}</span>
                                        </div>
                                        {selectedPortions.has(index) && (
                                            <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                                                {selectedPortions.get(index)}%
                                            </span>
                                        )}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {selectedPortions.size > 0 && (
                            <Button className="w-full py-5 text-lg font-black" onClick={() => setStep('confirmation')}>
                                Review Selection ({selectedPortions.size} {selectedPortions.size === 1 ? 'dish' : 'dishes'})
                            </Button>
                        )}
                    </div>
                )}

                {step === 'confirmation' && (
                    <div className="space-y-6">
                        <div className="bg-royal-600 rounded-[32px] p-6 text-white shadow-xl">
                            <p className="text-royal-100 text-[10px] font-black uppercase tracking-widest mb-1">Total Calories</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-5xl font-black tracking-tighter">{calculateTotalCalories()}</span>
                                <span className="text-xl font-bold opacity-70">kcal</span>
                            </div>
                            <p className="text-xs text-white/70 mt-2">From {selectedPortions.size} portion{selectedPortions.size !== 1 ? 's' : ''}</p>
                        </div>

                        <div className="space-y-3">
                            {Array.from(selectedPortions.entries()).map(([dishIndex, percentage]) => {
                                const dish = detectedDishes[dishIndex];
                                const calories = Math.round((dish.estimated_total_calories * percentage) / 100);

                                return (
                                    <div key={dishIndex} className="bg-gray-50 dark:bg-white/5 rounded-2xl p-4 border border-gray-100 dark:border-white/5">
                                        <div className="flex justify-between items-start mb-2">
                                            <h3 className="font-bold text-gray-900 dark:text-gray-50 text-sm">{dish.dish_name}</h3>
                                            <span className="text-xs font-black text-royal-600 dark:text-royal-400">{percentage}%</span>
                                        </div>
                                        <div className="flex justify-between items-center">
                                            <span className="text-xs text-gray-400">Portion of {dish.estimated_total_calories} kcal</span>
                                            <span className="font-extrabold text-gray-900 dark:text-gray-50">{calories} kcal</span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        <div className="flex gap-3">
                            <Button variant="ghost" className="flex-1 py-4" onClick={() => setStep('selection')}>
                                Edit
                            </Button>
                            <Button className="flex-1 py-4 text-lg font-black" onClick={handleSave} isLoading={isSaving} disabled={isSaving}>
                                Save All
                            </Button>
                        </div>
                    </div>
                )}

                {/* Bottom sheet for percentage selection */}
                {activeDish !== null && step === 'selection' && (
                    <div className="fixed inset-x-0 bottom-0 z-[110] bg-white dark:bg-[#1a1c26] rounded-t-[40px] p-6 shadow-2xl border-t border-white/50 dark:border-white/5 animate-in slide-in-from-bottom duration-300">
                        <div className="max-w-md mx-auto">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-black text-gray-900 dark:text-gray-50">{detectedDishes[activeDish].dish_name}</h3>
                                <button onClick={() => setActiveDish(null)} className="p-2 bg-gray-100 dark:bg-white/5 rounded-full">
                                    <ChevronDown size={20} className="text-gray-600 dark:text-gray-400" />
                                </button>
                            </div>

                            <div className="bg-royal-50 dark:bg-royal-950/40 rounded-2xl p-4 mb-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-bold text-royal-600 dark:text-royal-400 uppercase flex items-center gap-1">
                                        <Percent size={14} /> Your Portion
                                    </span>
                                    <span className="text-2xl font-black text-royal-600 dark:text-royal-400">{tempPercentage}%</span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    step="5"
                                    value={tempPercentage}
                                    onChange={(e) => setTempPercentage(Number(e.target.value))}
                                    className="w-full h-2 bg-royal-200 dark:bg-royal-900/30 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:bg-royal-600 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
                                />
                            </div>

                            <div className="bg-gray-50 dark:bg-white/5 rounded-2xl p-4 mb-4">
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-gray-400">Your Calories</span>
                                    <span className="text-xl font-black text-gray-900 dark:text-gray-50">
                                        {Math.round((detectedDishes[activeDish].estimated_total_calories * tempPercentage) / 100)} kcal
                                    </span>
                                </div>
                                <div className="text-[10px] text-gray-400 mt-1">
                                    Total dish: {detectedDishes[activeDish].estimated_total_calories} kcal
                                </div>
                            </div>

                            <Button className="w-full py-4 text-lg font-black" onClick={handlePercentageConfirm}>
                                Confirm Selection
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
