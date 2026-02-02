import React, { useState } from 'react';
import { X } from 'lucide-react';
import { Button } from './ui/Button';

interface EditGoalModalProps {
  currentGoal: number;
  onClose: () => void;
  onSave: (goal: number) => void;
}

export const EditGoalModal: React.FC<EditGoalModalProps> = ({ currentGoal, onClose, onSave }) => {
  const [goal, setGoal] = useState(currentGoal.toString());

  const handleSave = () => {
    const val = parseInt(goal, 10);
    if (!isNaN(val) && val > 0) {
      onSave(val);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xs rounded-[32px] p-6 shadow-2xl border border-white/50 animate-in zoom-in-95 duration-200">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-extrabold text-gray-900">Daily Calorie Goal</h2>
          <button onClick={onClose} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
            <X size={18} className="text-gray-600" />
          </button>
        </div>

        <div className="mb-8">
          <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 ml-1">Target Calories</label>
          <div className="relative">
            <input
              type="number"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              className="w-full p-5 bg-gray-50 border border-gray-100 rounded-[20px] focus:outline-none focus:ring-2 focus:ring-primary-200 focus:border-primary-400 transition-all font-extrabold text-3xl text-center text-gray-900"
              autoFocus
            />
            <span className="absolute right-6 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-bold">kcal</span>
          </div>
        </div>

        <Button className="w-full py-4 shadow-lg shadow-primary-200" onClick={handleSave}>
          Update Goal
        </Button>
      </div>
    </div>
  );
};