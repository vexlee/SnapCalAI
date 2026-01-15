import React, { useState } from 'react';
import { X, Trash2, Calendar, Clock, ChefHat, Sparkles, User, PenTool, Edit2, List, ImageOff } from 'lucide-react';
import { Button } from './ui/Button';
import { FoodEntry } from '../types';
import { saveEntry, clearEntryImage } from '../services/storage';

interface MealDetailModalProps {
  entry: FoodEntry;
  onClose: () => void;
  onDelete: (id: string) => Promise<void>;
  onEdit: (entry: FoodEntry) => void;
}

export const MealDetailModal: React.FC<MealDetailModalProps> = ({ entry, onClose, onDelete, onEdit }) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [isClearingImage, setIsClearingImage] = useState(false);

  const handleDelete = async () => {
    if (confirm("Permanently remove this record?")) {
      setIsDeleting(true);
      await onDelete(entry.id);
      onClose();
    }
  };

  const handleClearImage = async () => {
    if (confirm("Remove the photo to save storage space? Nutritional data will be kept.")) {
      setIsClearingImage(true);
      try {
        await clearEntryImage(entry.id);
        onClose();
        window.dispatchEvent(new CustomEvent('food-entry-updated'));
      } catch (err) {
        console.error("Failed to clear image", err);
        alert("Failed to clear image. Please try again.");
      } finally {
        setIsClearingImage(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 dark:bg-black/60 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-[#1a1c26] w-full max-w-md rounded-[40px] overflow-hidden shadow-2xl dark:shadow-black border border-white/50 dark:border-white/5 animate-in slide-in-from-bottom duration-300 max-h-[95vh] overflow-y-auto no-scrollbar">

        <div className="relative h-64 bg-gray-100 dark:bg-white/5">
          {entry.imageUrl ? (
            <>
              <img src={entry.imageUrl} className="w-full h-full object-cover" />
              <button
                onClick={handleClearImage}
                disabled={isClearingImage}
                className="absolute bottom-4 right-4 p-2.5 bg-white/20 hover:bg-white/40 text-white rounded-full backdrop-blur-md border border-white/20 transition-all flex items-center gap-2"
                title="Remove photo to save space"
              >
                {isClearingImage ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <ImageOff size={18} />}
                <span className="text-[10px] font-black uppercase tracking-widest">Clear Image</span>
              </button>
            </>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 dark:text-gray-700">
              <ChefHat size={48} className="mb-2 opacity-50" />
              <p className="text-[10px] font-black uppercase tracking-widest opacity-40">No Photo Attached</p>
            </div>
          )}
          <button onClick={onClose} className="absolute top-4 right-4 p-2 bg-white/80 dark:bg-black/40 text-gray-900 dark:text-white rounded-full backdrop-blur-md hover:bg-white dark:hover:bg-black/60 shadow-lg transition-colors z-10">
            <X size={20} />
          </button>
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 right-0 p-8 text-white pointer-events-none">
            <h2 className="text-3xl font-black leading-tight tracking-tight">{entry.food_item}</h2>
            <div className="flex items-center gap-4 text-xs text-white/70 font-bold mt-2">
              <div className="flex items-center gap-1.5"><Calendar size={14} /> {entry.date}</div>
              <div className="flex items-center gap-1.5"><Clock size={14} /> {entry.time}</div>
            </div>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-royal-50 dark:bg-royal-950/20 p-3 rounded-2xl flex flex-col items-center border border-royal-100/50">
              <span className="text-lg font-black text-royal-600">{entry.calories}</span>
              <span className="text-[8px] font-black uppercase text-royal-400">kcal</span>
            </div>
            <div className="bg-emerald-50 dark:bg-emerald-950/20 p-3 rounded-2xl flex flex-col items-center border border-emerald-100/50">
              <span className="text-lg font-black text-emerald-600">{entry.protein}g</span>
              <span className="text-[8px] font-black uppercase text-emerald-400">Prot</span>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950/20 p-3 rounded-2xl flex flex-col items-center border border-blue-100/50">
              <span className="text-lg font-black text-blue-600">{entry.carbs}g</span>
              <span className="text-[8px] font-black uppercase text-blue-400">Carb</span>
            </div>
            <div className="bg-orange-50 dark:bg-orange-950/20 p-3 rounded-2xl flex flex-col items-center border border-orange-100/50">
              <span className="text-lg font-black text-orange-600">{entry.fat}g</span>
              <span className="text-[8px] font-black uppercase text-orange-400">Fat</span>
            </div>
          </div>

          {entry.ingredients && entry.ingredients.length > 0 && (
            <div className="bg-gray-50 dark:bg-white/5 rounded-3xl p-6 border border-gray-100 dark:border-white/5">
              <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                <List size={14} /> Ingredient Receipt
              </h3>
              <div className="space-y-3">
                {entry.ingredients.map((ing, i) => (
                  <div key={i} className="flex justify-between items-center text-sm font-bold border-b border-gray-100 dark:border-white/5 pb-2 last:border-0 last:pb-0">
                    <span className="text-gray-700 dark:text-gray-300">{ing.name}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-gray-400">{ing.grams}g</span>
                      <span className="text-royal-500 text-xs w-12 text-right">{ing.calories}cal</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="ghost" className="flex-1 text-red-500 py-4 font-black" onClick={handleDelete} isLoading={isDeleting}>
              <Trash2 size={18} className="mr-2" /> Delete
            </Button>
            <Button className="flex-[2] py-4 font-black shadow-lg shadow-royal-200" onClick={() => onEdit(entry)}>
              <Edit2 size={18} className="mr-2" /> Edit Meal
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};