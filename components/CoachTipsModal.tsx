import React, { useState } from 'react';
import { X, ChevronLeft, RefreshCw, Sparkles, TrendingUp, Utensils, Dumbbell, Target, Calendar } from 'lucide-react';
import { CoachReport } from '../types';

interface CoachTipsModalProps {
    report: CoachReport;
    reportType: 'daily' | 'weekly' | 'monthly';
    onClose: () => void;
    onRegenerate: () => void;
    isRegenerating?: boolean;
}

export const CoachTipsModal: React.FC<CoachTipsModalProps> = ({
    report,
    reportType,
    onClose,
    onRegenerate,
    isRegenerating = false
}) => {
    const formatDateRange = () => {
        const start = new Date(report.periodStart);
        const end = new Date(report.periodEnd);

        if (reportType === 'daily') {
            return start.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
        }

        if (reportType === 'weekly') {
            const startStr = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endStr = end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return `${startStr} - ${endStr}`;
        }

        return start.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    };

    const getReportTitle = () => {
        switch (reportType) {
            case 'daily': return 'Daily Review';
            case 'weekly': return 'Weekly Summary';
            case 'monthly': return 'Monthly Report';
        }
    };

    return (
        <div className="fixed inset-0 bg-[#F3F0E7][#0F111A] z-[100] animate-in slide-in-from-right duration-300 overflow-y-auto">
            <div className="min-h-screen pb-20">
                {/* Header */}
                <div className="sticky top-0 bg-[#F3F0E7]/80[#0F111A]/80 backdrop-blur-xl z-10 px-6 pt-10 pb-4 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                        <button
                            onClick={onClose}
                            className="flex items-center gap-2 text-gray-400 hover:text-primary-600 transition-colors"
                        >
                            <ChevronLeft size={20} />
                            <span className="text-sm font-bold uppercase tracking-widest">Back</span>
                        </button>
                        <button
                            onClick={onRegenerate}
                            disabled={isRegenerating}
                            className="flex items-center gap-2 text-xs font-bold text-[#3D745B] bg-primary-50 px-3 py-1.5 rounded-xl hover:bg-primary-100:bg-primary-900/30 transition-colors disabled:opacity-50"
                        >
                            <RefreshCw size={12} className={isRegenerating ? 'animate-spin' : ''} />
                            {isRegenerating ? 'Generating...' : 'Regenerate'}
                        </button>
                    </div>
                </div>

                <div className="px-6 pt-6">
                    {/* Title Section */}
                    <div className="mb-8">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles size={20} className="text-primary-600" />
                            <span className="text-[10px] font-bold text-primary-600 uppercase tracking-widest">
                                Coach Tips
                            </span>
                        </div>
                        <h1 className="text-2xl font-black text-gray-900 tracking-tight mb-1">
                            {getReportTitle()}
                        </h1>
                        <div className="flex items-center gap-2 text-gray-400">
                            <Calendar size={14} />
                            <span className="text-sm font-medium">{formatDateRange()}</span>
                        </div>
                    </div>

                    {/* Summary Card */}
                    <div className="bg-[#3D745B] rounded-4xl p-6 mb-6 shadow-lg shadow-primary-200/30">
                        <div className="flex items-start gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                                <TrendingUp size={20} className="text-white" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-white/80 mb-1">Summary</h3>
                                <p className="text-white text-sm leading-relaxed">{report.summary}</p>
                            </div>
                        </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="mb-6">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                            Period Metrics
                        </h3>
                        <div className="grid grid-cols-2 gap-3">
                            {/* Avg Calories */}
                            <div className="bg-[#FFF4E6] rounded-2xl p-4 border-2 border-orange-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-lg bg-orange-100 flex items-center justify-center">
                                        <Utensils size={12} className="text-orange-600" />
                                    </div>
                                    <span className="text-[9px] font-bold text-orange-800/60 uppercase">Avg Calories</span>
                                </div>
                                <span className="text-xl font-black text-orange-900">
                                    {report.metrics.avgCalories}
                                    <span className="text-xs font-bold text-orange-800/40 ml-1">kcal</span>
                                </span>
                            </div>

                            {/* Avg Protein */}
                            <div className="bg-[#F0F7F4] rounded-2xl p-4 border-2 border-emerald-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-lg bg-emerald-100 flex items-center justify-center">
                                        <span className="text-[10px] font-black text-emerald-600">P</span>
                                    </div>
                                    <span className="text-[9px] font-bold text-emerald-800/60 uppercase">Avg Protein</span>
                                </div>
                                <span className="text-xl font-black text-emerald-900">
                                    {report.metrics.avgProtein}
                                    <span className="text-xs font-bold text-emerald-800/40 ml-1">g</span>
                                </span>
                            </div>

                            {/* Workouts */}
                            <div className="bg-[#E7ECE9] rounded-2xl p-4 border-2 border-[#C1D6CB] shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-lg bg-primary-100 flex items-center justify-center">
                                        <Dumbbell size={12} className="text-[#3D745B]" />
                                    </div>
                                    <span className="text-[9px] font-bold text-[#3D745B]/60 uppercase">Workouts</span>
                                </div>
                                <span className="text-xl font-black text-[#3D745B]">
                                    {report.metrics.workoutsCompleted}
                                    <span className="text-xs font-bold text-[#3D745B]/40 ml-1">done</span>
                                </span>
                            </div>

                            {/* Goal Hit Rate */}
                            <div className="bg-[#EFF6FF] rounded-2xl p-4 border-2 border-blue-200 shadow-sm">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-6 h-6 rounded-lg bg-blue-100 flex items-center justify-center">
                                        <Target size={12} className="text-blue-600" />
                                    </div>
                                    <span className="text-[9px] font-bold text-blue-800/60 uppercase">Goal Rate</span>
                                </div>
                                <span className="text-xl font-black text-blue-900">
                                    {report.metrics.calorieGoalHitRate}
                                    <span className="text-xs font-bold text-blue-800/40 ml-1">%</span>
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Tips Section */}
                    <div className="mb-8">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3">
                            Improvement Tips
                        </h3>
                        <div className="space-y-3">
                            {report.tips.map((tip, index) => {
                                const styles = [
                                    'bg-[#F0F4F2] border-[#C2D1CC] text-emerald-900', // Sage
                                    'bg-[#F9F4F2] border-[#EAD0C8] text-orange-900',  // Clay
                                    'bg-[#F7F6F0] border-[#E8E1BC] text-[#4A483E]',  // Sand
                                    'bg-[#F0F4F9] border-[#C8D6E8] text-blue-900'    // Sky
                                ];
                                const styleClass = styles[index % styles.length];

                                return (
                                    <div
                                        key={index}
                                        className={`${styleClass}[#1A1C26] rounded-2xl p-4 border-2 flex items-start gap-3 shadow-sm`}
                                    >
                                        <div className="w-10 h-10 rounded-xl bg-white/50 backdrop-blur-sm flex items-center justify-center flex-shrink-0 text-xl shadow-sm">
                                            {tip.emoji}
                                        </div>
                                        <div className="flex-1">
                                            <h4 className="text-sm font-bold opacity-90 mb-0.5">
                                                {tip.title}
                                            </h4>
                                            <p className="text-xs opacity-70 leading-relaxed font-medium">
                                                {tip.description}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Weight at Report */}
                    {report.weightAtReport && (
                        <div className="text-center text-xs text-gray-400">
                            Weight at report: <span className="font-bold">{report.weightAtReport} kg</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
