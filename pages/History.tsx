import React, { useEffect, useState } from 'react';
import { getDailySummaries, deleteEntry, getDailyGoal } from '../services/storage';
import { DailySummary, FoodEntry } from '../types';
import { Card } from '../components/ui/Card';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, ComposedChart, Area } from 'recharts';
import { MealDetailModal } from '../components/MealDetailModal';
import { DailySummaryModal } from '../components/DailySummaryModal';
import { AddFoodModal } from '../components/AddFoodModal';
import { Calendar as CalendarIcon, Filter, ChevronDown, ChevronRight } from 'lucide-react';

type ViewMode = 'week' | 'month';

export const History: React.FC = () => {
  const [history, setHistory] = useState<DailySummary[]>([]);
  const [dailyGoal, setDailyGoal] = useState(2000);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedEntry, setSelectedEntry] = useState<FoodEntry | null>(null);
  const [selectedDaySummary, setSelectedDaySummary] = useState<DailySummary | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<FoodEntry | null>(null);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  const isDarkMode = document.documentElement.classList.contains('dark');

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [historyData, goal] = await Promise.all([
        getDailySummaries(),
        getDailyGoal()
      ]);
      setHistory(historyData);
      setDailyGoal(goal);

      // Auto-expand today, collapse others
      const todayStr = new Date().toISOString().split('T')[0];
      const initialExpanded: Record<string, boolean> = {};
      historyData.forEach(day => {
        initialExpanded[day.date] = day.date === todayStr;
      });
      setExpandedDays(initialExpanded);
    } catch (error) {
      console.error("Failed to load history data", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('food-entry-updated', handleUpdate);
    return () => window.removeEventListener('food-entry-updated', handleUpdate);
  }, []);

  const toggleDay = (date: string) => {
    setExpandedDays(prev => ({
      ...prev,
      [date]: !prev[date]
    }));
  };

  const handleDeleteEntry = async (id: string) => {
    await deleteEntry(id);
    await loadData();
  };

  const handleEditEntry = (entry: FoodEntry) => {
    setSelectedEntry(null);
    setEntryToEdit(entry);
    setShowEditModal(true);
  };

  const limit = viewMode === 'week' ? 7 : 30;
  const chartData = [...history]
    .slice(0, limit)
    .reverse()
    .map(day => ({
      name: viewMode === 'week'
        ? new Date(day.date).toLocaleDateString('en-US', { weekday: 'short' })
        : new Date(day.date).toLocaleDateString('en-US', { day: 'numeric', month: 'short' }),
      calories: day.totalCalories,
      goal: dailyGoal,
      fullData: day
    }));

  return (
    <div className="flex-1 flex flex-col min-h-0 animate-in fade-in duration-500 overflow-hidden relative">
      <div className="flex-shrink-0 px-6 pt-10 space-y-8 pb-4">
        <header className="flex justify-between items-start">
          <div>
            <p className="text-gray-400 dark:text-gray-500 text-xs font-semibold uppercase tracking-widest mb-2">Performance</p>
            <h1 className="text-3xl font-extrabold text-gray-900 dark:text-gray-50 tracking-tight">Analytics</h1>
          </div>
          <div className="flex p-1 bg-white dark:bg-white/5 rounded-2xl border border-gray-100 dark:border-white/5 shadow-sm">
            <button
              onClick={() => setViewMode('week')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${viewMode === 'week' ? 'bg-royal-600 text-white' : 'text-gray-400 dark:text-gray-500'}`}
            >
              Week
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${viewMode === 'month' ? 'bg-royal-600 text-white' : 'text-gray-400 dark:text-gray-500'}`}
            >
              Month
            </button>
          </div>
        </header>

        {/* Chart */}
        <Card className="h-48 pt-8 pb-2 px-2">
          {isLoading ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-royal-600"></div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fontSize: 10, fill: isDarkMode ? '#64748b' : '#9ca3af', fontWeight: 600 }}
                  dy={10}
                  interval={viewMode === 'month' ? 4 : 0}
                />
                <Tooltip
                  cursor={{ fill: isDarkMode ? 'rgba(255,255,255,0.03)' : '#f3f4f6', radius: 8 }}
                  contentStyle={{
                    borderRadius: '16px',
                    border: 'none',
                    backgroundColor: isDarkMode ? '#1e293b' : '#1f2937',
                    color: '#fff',
                    boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'
                  }}
                />
                <ReferenceLine y={dailyGoal} stroke="#ef4444" strokeDasharray="3 3" label={{ position: 'right', value: 'Goal', fill: '#ef4444', fontSize: 10, fontWeight: 700 }} />
                <Bar
                  dataKey="calories"
                  radius={[8, 8, 8, 8]}
                  onClick={(data: any) => {
                    if (data && data.fullData) {
                      setSelectedDaySummary(data.fullData);
                    } else if (data && data.payload && data.payload.fullData) {
                      setSelectedDaySummary(data.payload.fullData);
                    }
                  }}
                  className="cursor-pointer"
                >
                  {chartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.calories > dailyGoal ? '#ef4444' : '#7c3aed'}
                      className="hover:opacity-80 transition-opacity cursor-pointer"
                    />
                  ))}
                </Bar>
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      {/* Detailed List Header */}
      <div className="flex-shrink-0 px-6 mb-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-lg font-bold text-gray-900 dark:text-gray-50">History Log</h2>
          <div className="flex items-center gap-1 text-[10px] font-bold text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-white/5 px-2 py-1 rounded-lg">
            <Filter size={10} />
            ALL TIME
          </div>
        </div>
      </div>

      {/* Detailed List Content - Scrollable Only */}
      <div className="flex-1 overflow-y-auto no-scrollbar px-6 pb-32">
        <div className="space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="h-24 bg-white dark:bg-[#1a1c26] rounded-[24px] animate-pulse shadow-sm border border-white/5 dark:border-white/5"></div>
              ))}
            </div>
          ) : (
            <>
              {history.map((day) => (
                <div key={day.date} className="animate-in slide-in-from-bottom-2 fade-in duration-500">
                  <div
                    className="flex justify-between items-center mb-3 px-2 cursor-pointer group"
                    onClick={() => toggleDay(day.date)}
                  >
                    <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 group-hover:text-royal-600 dark:group-hover:text-royal-400 transition-colors">
                      <CalendarIcon size={14} />
                      <span className="text-sm font-semibold">{new Date(day.date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</span>
                      {expandedDays[day.date] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-bold bg-white dark:bg-white/5 px-2 py-1 rounded-lg border transition-colors ${day.totalCalories > dailyGoal
                        ? 'text-red-600 border-red-100 dark:border-red-900/30'
                        : 'text-emerald-600 border-emerald-100 dark:border-emerald-900/30'
                        }`}>
                        {day.totalCalories} kcal
                      </span>
                    </div>
                  </div>

                  {expandedDays[day.date] && (
                    <div className="bg-white dark:bg-[#1a1c26] rounded-[24px] shadow-diffused dark:shadow-diffused-dark border border-gray-100 dark:border-white/5 overflow-hidden divide-y divide-gray-50 dark:divide-white/5 animate-in slide-in-from-top-2 duration-300">
                      {day.entries.map(entry => (
                        <div
                          key={entry.id}
                          onClick={() => setSelectedEntry(entry)}
                          className="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-white/5 transition-colors cursor-pointer active:scale-[0.99]"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-white/5 overflow-hidden shadow-sm">
                              {entry.imageUrl ? (
                                <img src={entry.imageUrl} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-white/10 text-gray-300 dark:text-gray-700">
                                  <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-700"></div>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm text-gray-900 dark:text-gray-50 font-bold">{entry.food_item}</span>
                              <span className="text-[10px] text-gray-400 dark:text-gray-500 font-medium">{entry.time}</span>
                            </div>
                          </div>
                          <span className="text-sm text-gray-700 dark:text-gray-400 font-bold">{entry.calories}</span>
                        </div>
                      ))}
                      {day.entries.length === 0 && (
                        <div className="p-4 text-center text-xs text-gray-400 italic">
                          No details available (Summarized)
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
              {history.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-400 dark:text-gray-500 text-sm">No history available yet.</p>
                </div>
              )}
            </>
          )}
        </div>

        {selectedEntry && (
          <MealDetailModal
            entry={selectedEntry}
            onClose={() => setSelectedEntry(null)}
            onDelete={handleDeleteEntry}
            onEdit={handleEditEntry}
          />
        )}

        {selectedDaySummary && (
          <DailySummaryModal
            summary={selectedDaySummary}
            onClose={() => setSelectedDaySummary(null)}
          />
        )}

        {showEditModal && (
          <AddFoodModal
            editEntry={entryToEdit}
            onClose={() => { setShowEditModal(false); setEntryToEdit(null); }}
            onSuccess={() => {
              setShowEditModal(false);
              setEntryToEdit(null);
              loadData();
            }}
          />
        )}
      </div>
    </div>
  );
};
