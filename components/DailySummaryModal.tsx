import React from 'react';
import { X, Calendar, ChefHat, Activity, TrendingUp } from 'lucide-react';
import { DailySummary } from '../types';

interface DailySummaryModalProps {
  summary: DailySummary;
  onClose: () => void;
}

export const DailySummaryModal: React.FC<DailySummaryModalProps> = ({ summary, onClose }) => {
  const formattedDate = new Date(summary.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center bg-black/40 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-md rounded-[40px] overflow-hidden shadow-2xl border border-white/50 animate-in slide-in-from-bottom duration-300">
        
        {/* Header */}
        <div className="relative bg-royal-50 p-8 pb-10">
           <div className="absolute top-6 right-6">
               <button 
                onClick={onClose}
                className="p-2 bg-white text-gray-900 rounded-full shadow-sm hover:bg-gray-100 transition-colors"
               >
                <X size={20} />
               </button>
           </div>
           
           <div className="flex items-center gap-2 text-royal-600 mb-3">
               <Calendar size={20} />
               <span className="text-xs font-bold uppercase tracking-widest">Daily Report</span>
           </div>
           <h2 className="text-3xl font-extrabold text-gray-900 leading-tight">{formattedDate}</h2>
        </div>

        {/* Content */}
        <div className="p-8 -mt-6 bg-white rounded-t-[32px] relative shadow-[-10px_-10px_30px_rgba(0,0,0,0.02)]">
            
            {/* Main Stats */}
            <div className="bg-white rounded-[32px] p-6 border border-gray-100 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.05)] mb-8 flex items-center justify-between">
                <div>
                     <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1 block">Total Consumed</span>
                     <div className="flex items-baseline gap-1">
                         <span className="text-5xl font-extrabold text-gray-900 tracking-tighter">{summary.totalCalories}</span>
                         <span className="text-gray-400 font-bold text-lg">kcal</span>
                     </div>
                </div>
                <div className="w-14 h-14 rounded-2xl bg-royal-50 flex items-center justify-center text-royal-600">
                    <Activity size={28} />
                </div>
            </div>

            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <ChefHat size={16} /> Macro Breakdown
            </h3>

            <div className="grid grid-cols-1 gap-4">
                 {/* Protein */}
                 <div className="bg-gray-50 p-5 rounded-[24px] border border-gray-100 flex items-center justify-between relative overflow-hidden group hover:bg-emerald-50 hover:border-emerald-100 transition-colors">
                     <div className="flex items-center gap-4 relative z-10">
                        <div className="w-1.5 h-10 bg-emerald-400 rounded-full"></div>
                        <div>
                            <span className="block text-2xl font-bold text-gray-900">{summary.totalProtein}g</span>
                            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Protein</span>
                        </div>
                     </div>
                 </div>

                 {/* Carbs */}
                 <div className="bg-gray-50 p-5 rounded-[24px] border border-gray-100 flex items-center justify-between relative overflow-hidden group hover:bg-blue-50 hover:border-blue-100 transition-colors">
                     <div className="flex items-center gap-4 relative z-10">
                        <div className="w-1.5 h-10 bg-blue-400 rounded-full"></div>
                        <div>
                            <span className="block text-2xl font-bold text-gray-900">{summary.totalCarbs}g</span>
                            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Carbs</span>
                        </div>
                     </div>
                 </div>

                 {/* Fat */}
                 <div className="bg-gray-50 p-5 rounded-[24px] border border-gray-100 flex items-center justify-between relative overflow-hidden group hover:bg-orange-50 hover:border-orange-100 transition-colors">
                     <div className="flex items-center gap-4 relative z-10">
                        <div className="w-1.5 h-10 bg-orange-400 rounded-full"></div>
                        <div>
                            <span className="block text-2xl font-bold text-gray-900">{summary.totalFat}g</span>
                            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Fat</span>
                        </div>
                     </div>
                 </div>
            </div>

            <div className="mt-8 pt-6 border-t border-gray-100 flex justify-between items-center text-xs font-bold text-gray-400 uppercase tracking-wider">
                <span>{summary.entries.length} meals tracked</span>
                <span className="flex items-center gap-1.5 text-royal-600">
                    <TrendingUp size={14} />
                    See History Tab
                </span>
            </div>

        </div>
      </div>
    </div>
  );
};