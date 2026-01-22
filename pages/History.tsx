import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { getDailySummariesLite, getEntriesForDateLite, getEntryImage, deleteEntry, getDailyGoal } from '../services/storage';
import { DailySummary, FoodEntry } from '../types';
import { Card } from '../components/ui/Card';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine, ComposedChart, Area } from 'recharts';
import { MealDetailModal } from '../components/MealDetailModal';
import { DailySummaryModal } from '../components/DailySummaryModal';
import { AddFoodModal } from '../components/AddFoodModal';
import { Calendar as CalendarIcon, Filter, ChevronDown, ChevronRight, Loader2, Info, ChevronLeft } from 'lucide-react';
import { getCurrentDateString } from '../utils/midnight';

type ViewMode = 'day' | 'week' | 'month';

// Lightweight summary type (no entries)
interface DaySummaryLite {
  date: string;
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
}

export const History: React.FC = () => {
  const [summaries, setSummaries] = useState<DaySummaryLite[]>([]);
  const [dailyGoal, setDailyGoal] = useState(2000);
  const [isLoading, setIsLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>('day');
  const [selectedEntry, setSelectedEntry] = useState<FoodEntry | null>(null);
  const [selectedDaySummary, setSelectedDaySummary] = useState<DailySummary | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [entryToEdit, setEntryToEdit] = useState<FoodEntry | null>(null);

  // New Layout States
  const [selectedDate, setSelectedDate] = useState<string>(getCurrentDateString());
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().substring(0, 7)); // YYYY-MM
  const [selectedWeek, setSelectedWeek] = useState<string>(() => {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const currentWeekMon = new Date(today);
    currentWeekMon.setDate(today.getDate() + diffToMon);
    const year = currentWeekMon.getFullYear();
    const month = String(currentWeekMon.getMonth() + 1).padStart(2, '0');
    const day = String(currentWeekMon.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  });
  const [isFullLogView, setIsFullLogView] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Record<string, boolean>>({});

  // Lazy-loaded entries per date
  const [dayEntries, setDayEntries] = useState<Record<string, FoodEntry[]>>({});
  const [loadingDays, setLoadingDays] = useState<Record<string, boolean>>({});
  // Lazy-loaded images per entry
  const [entryImages, setEntryImages] = useState<Record<string, string | null>>({});

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isDarkMode = document.documentElement.classList.contains('dark');

  // Auto-scroll to current item (right end)
  const scrollToToday = useCallback(() => {
    if (scrollContainerRef.current) {
      const container = scrollContainerRef.current;
      container.scrollLeft = container.scrollWidth;
    }
  }, []);

  useEffect(() => {
    // Small timeout to ensure items are rendered
    const timer = setTimeout(scrollToToday, 100);
    return () => clearTimeout(timer);
  }, [viewMode, scrollToToday]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [summaryData, goal] = await Promise.all([
        getDailySummariesLite(),
        getDailyGoal()
      ]);
      setSummaries(summaryData);
      setDailyGoal(goal);

      // Pre-load current selected date's entries
      loadEntriesForDate(selectedDate);
    } catch (error) {
      console.error("Failed to load history data", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Lazy load entries for a specific date
  const loadEntriesForDate = useCallback(async (date: string) => {
    if (dayEntries[date]) return; // Already loaded

    setLoadingDays(prev => ({ ...prev, [date]: true }));
    try {
      const entries = await getEntriesForDateLite(date);
      setDayEntries(prev => ({ ...prev, [date]: entries }));
    } catch (error) {
      console.error(`Failed to load entries for ${date}`, error);
    } finally {
      setLoadingDays(prev => ({ ...prev, [date]: false }));
    }
  }, [dayEntries]);

  // Lazy load image for a specific entry
  const loadImageForEntry = useCallback(async (entryId: string) => {
    if (entryImages[entryId] !== undefined) return; // Already loaded or attempted

    setEntryImages(prev => ({ ...prev, [entryId]: null })); // Mark as loading
    try {
      const imageUrl = await getEntryImage(entryId);
      setEntryImages(prev => ({ ...prev, [entryId]: imageUrl }));
    } catch (error) {
      console.error(`Failed to load image for entry ${entryId}`, error);
    }
  }, [entryImages]);

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      setDayEntries({});
      setEntryImages({});
      loadData();
    };
    window.addEventListener('food-entry-updated', handleUpdate);
    return () => window.removeEventListener('food-entry-updated', handleUpdate);
  }, []);

  // Update entries when selectedDate changes
  useEffect(() => {
    if (selectedDate && (viewMode === 'day' || viewMode === 'week')) {
      loadEntriesForDate(selectedDate);
    }
  }, [selectedDate, loadEntriesForDate, viewMode]);

  const handleDeleteEntry = async (id: string) => {
    await deleteEntry(id);
    setDayEntries({});
    setEntryImages({});
    await loadData();
  };

  const handleEditEntry = (entry: FoodEntry) => {
    setSelectedEntry(null);
    setEntryToEdit(entry);
    setShowEditModal(true);
  };

  const getEntryWithImage = (entry: FoodEntry): FoodEntry => {
    if (entryImages[entry.id] === undefined) {
      loadImageForEntry(entry.id);
    }
    return { ...entry, imageUrl: entryImages[entry.id] || undefined };
  };

  // Weekly/Monthly Selector Logic
  const scrollItems = useMemo(() => {
    if (viewMode === 'day') {
      // Daily: Show all dates from 1st of current month to today
      const days = [];
      const today = new Date();
      const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

      // Generate dates from 1st to today
      for (let d = new Date(firstDayOfMonth); d <= today; d.setDate(d.getDate() + 1)) {
        // PERMANENT FIX: Use manual local date formatting. 
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const dateStr = `${year}-${month}-${day}`;
        days.push({
          id: dateStr,
          name: d.toLocaleDateString('en-US', { weekday: 'short' }),
          label: d.getDate().toString(),
          date: dateStr,
        });
      }
      return days;
    } else if (viewMode === 'week') {
      // Weekly: Show last 8 weeks (Mon-Sun ranges)
      const weeks = [];
      const today = new Date();
      // Find Monday of current week
      const dayOfWeek = today.getDay(); // 0 (Sun) - 6 (Sat)
      const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Mon is 1
      const currentWeekMon = new Date(today);
      currentWeekMon.setDate(today.getDate() + diffToMon);

      for (let i = 0; i < 8; i++) {
        const start = new Date(currentWeekMon);
        start.setDate(currentWeekMon.getDate() - (i * 7));
        const end = new Date(start);
        end.setDate(start.getDate() + 6);

        // Format label "Jan 19 - 25"
        const startLabel = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const endLabel = end.toLocaleDateString('en-US', { day: 'numeric' });

        // ID is start date YYYY-MM-DD
        const year = start.getFullYear();
        const month = String(start.getMonth() + 1).padStart(2, '0');
        const day = String(start.getDate()).padStart(2, '0');
        const id = `${year}-${month}-${day}`;

        weeks.push({
          id: id,
          name: 'Week',
          label: `${startLabel} - ${endLabel}`,
          date: id,
        });
      }
      return weeks.reverse(); // Show chronological
    } else {
      // Monthly: Only show months that have data
      const monthsWithData = new Set<string>();
      summaries.forEach(s => {
        const monthKey = s.date.substring(0, 7); // YYYY-MM
        monthsWithData.add(monthKey);
      });

      // Convert to array and sort
      const sortedMonths = Array.from(monthsWithData).sort();

      return sortedMonths.map(monthKey => {
        const [year, month] = monthKey.split('-');
        const d = new Date(parseInt(year), parseInt(month) - 1, 1);

        return {
          id: monthKey,
          name: d.toLocaleDateString('en-US', { year: '2-digit' }),
          label: d.toLocaleDateString('en-US', { month: 'short' }),
          date: monthKey,
        };
      });
    }
  }, [viewMode, summaries]);

  const activeSummary = useMemo(() => {
    if (viewMode === 'day') {
      return summaries.find(s => s.date === selectedDate) || {
        date: selectedDate,
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
      };
    } else if (viewMode === 'week') {
      // Aggregate for the selected week (Mon-Sun)
      if (!selectedWeek) return {
        date: '', totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0
      };

      const start = new Date(selectedWeek);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);

      const startStr = selectedWeek; // YYYY-MM-DD
      // Need end string? summaries store date as YYYY-MM-DD
      // Filter summaries where date is >= start and <= end
      // Simple string comparison works for ISO dates? Yes.

      // Calculate end date string for comparison
      const endYear = end.getFullYear();
      const endMonth = String(end.getMonth() + 1).padStart(2, '0');
      const endDay = String(end.getDate()).padStart(2, '0');
      const endStr = `${endYear}-${endMonth}-${endDay}`;

      const weekSummaries = summaries.filter(s => s.date >= startStr && s.date <= endStr);

      const totals = weekSummaries.reduce((acc, curr) => ({
        totalCalories: acc.totalCalories + curr.totalCalories,
        totalProtein: acc.totalProtein + curr.totalProtein,
        totalCarbs: acc.totalCarbs + curr.totalCarbs,
        totalFat: acc.totalFat + curr.totalFat,
      }), { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 });

      return {
        date: selectedWeek,
        ...totals,
      };
    } else {
      // Aggregate for the selected month
      const monthSummaries = summaries.filter(s => s.date.startsWith(selectedMonth));
      const totals = monthSummaries.reduce((acc, curr) => ({
        totalCalories: acc.totalCalories + curr.totalCalories,
        totalProtein: acc.totalProtein + curr.totalProtein,
        totalCarbs: acc.totalCarbs + curr.totalCarbs,
        totalFat: acc.totalFat + curr.totalFat,
      }), { totalCalories: 0, totalProtein: 0, totalCarbs: 0, totalFat: 0 });

      return {
        date: selectedMonth,
        ...totals,
      };
    }
  }, [summaries, selectedDate, selectedMonth, selectedWeek, viewMode]);

  const monthEntriesList = useMemo(() => {
    if (viewMode === 'day') return [];

    // Filter by date capability
    const isInRange = (dateStr: string) => {
      if (viewMode === 'month') return dateStr.startsWith(selectedMonth);
      if (viewMode === 'week' && selectedWeek) {
        try {
          const [year, month, day] = selectedWeek.split('-').map(Number);
          const start = new Date(year, month - 1, day);
          const end = new Date(start);
          end.setDate(start.getDate() + 6);

          // Simple string comparison for YYYY-MM-DD works if formatted correctly
          // But safer to compare timestamps or ensure formatting
          const d = new Date(dateStr);
          return d >= start && d <= end;
        } catch (e) { return false; }
      }
      return false;
    };

    const entries = Object.entries(dayEntries)
      .filter(([date]) => isInRange(date))
      .flatMap(([_, items]) => items)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    return entries;
  }, [dayEntries, selectedMonth, selectedWeek, viewMode]);

  // Group entries by date for toggle view (Weeks & Months)
  const monthEntriesGrouped = useMemo(() => {
    if (viewMode === 'day') return {};

    const isInRange = (dateStr: string) => {
      if (viewMode === 'month') return dateStr.startsWith(selectedMonth);
      if (viewMode === 'week' && selectedWeek) {
        try {
          const [year, month, day] = selectedWeek.split('-').map(Number);
          const start = new Date(year, month - 1, day);
          const end = new Date(start);
          end.setDate(start.getDate() + 6);
          const d = new Date(dateStr);
          return d >= start && d <= end;
        } catch (e) { return false; }
      }
      return false;
    };

    const grouped: Record<string, FoodEntry[]> = {};

    Object.entries(dayEntries)
      .filter(([date]) => isInRange(date))
      .forEach(([date, entries]) => {
        if (entries.length > 0) {
          grouped[date] = entries.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
        }
      });

    return grouped;
  }, [dayEntries, selectedMonth, selectedWeek, viewMode]);

  const toggleDayExpansion = (date: string) => {
    setExpandedDays(prev => ({ ...prev, [date]: !prev[date] }));
  };

  // Load all entries for the selected month if in month view
  useEffect(() => {
    if (viewMode === 'month') {
      const daysInMonth = summaries
        .filter(s => s.date.startsWith(selectedMonth))
        .map(s => s.date);

      daysInMonth.forEach(date => loadEntriesForDate(date));
    }
  }, [viewMode, selectedMonth, summaries, loadEntriesForDate]);

  if (isFullLogView) {
    return (
      <div className="flex-1 flex flex-col min-h-0 animate-in slide-in-from-right duration-500 bg-[#F8F9FE] dark:bg-[#0F111A]">
        <div className="px-6 pt-10 pb-32 overflow-y-auto no-scrollbar">
          <button
            onClick={() => setIsFullLogView(false)}
            className="flex items-center gap-2 text-gray-400 dark:text-gray-500 mb-6 hover:text-royal-600 transition-colors"
          >
            <ChevronLeft size={20} />
            <span className="text-sm font-bold uppercase tracking-widest">Back to Report</span>
          </button>

          <div className="flex items-center justify-between mb-8">
            <h1 className="text-2xl font-black text-gray-900 dark:text-gray-50 tracking-tight">History Log</h1>
            <div className="text-xs font-bold text-royal-600 dark:text-royal-400 bg-royal-50 dark:bg-royal-900/20 px-3 py-1.5 rounded-xl border border-royal-100 dark:border-royal-800/50">
              {viewMode === 'week'
                ? new Date(selectedDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
                : new Date(selectedMonth + '-01').toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
              }
            </div>
          </div>

          <div className="space-y-4">
            {viewMode === 'day' ? (
              loadingDays[selectedDate] ? (
                <div className="space-y-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <div key={i} className="h-20 bg-white dark:bg-[#1A1C26] rounded-[24px] animate-pulse border border-gray-100 dark:border-white/5"></div>
                  ))}
                </div>
              ) : (dayEntries[selectedDate] || []).length > 0 ? (
                (dayEntries[selectedDate] || []).map(entry => {
                  const entryWithImage = getEntryWithImage(entry);
                  return (
                    <div
                      key={entry.id}
                      onClick={() => setSelectedEntry(entryWithImage)}
                      className="bg-white dark:bg-[#1A1C26] p-4 flex justify-between items-center rounded-[24px] shadow-sm border border-gray-100 dark:border-white/5 hover:bg-gray-50 dark:hover:bg-white/5 transition-all cursor-pointer active:scale-[0.98]"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-white/5 overflow-hidden shadow-inner border border-gray-100 dark:border-white/5">
                          {entryWithImage.imageUrl ? (
                            <img src={entryWithImage.imageUrl} className="w-full h-full object-cover" />
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
                      <div className="flex flex-col items-end">
                        <span className="text-sm text-royal-600 dark:text-royal-400 font-black">{entry.calories}</span>
                        <span className="text-[8px] font-bold text-gray-400 uppercase">kcal</span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="bg-white dark:bg-[#1A1C26] rounded-[24px] p-12 text-center border border-dashed border-gray-200 dark:border-white/10">
                  <CalendarIcon size={32} className="mx-auto text-gray-200 dark:text-white/5 mb-4" />
                  <p className="text-gray-400 dark:text-gray-500 text-sm font-medium">No meals logged for this day.</p>
                </div>
              )
            ) : (
              Object.keys(monthEntriesGrouped).length > 0 ? (
                Object.entries(monthEntriesGrouped)
                  .sort(([dateA], [dateB]) => dateB.localeCompare(dateA)) // Sort by date descending
                  .map(([date, dayEntries]) => {
                    const isExpanded = expandedDays[date];
                    const dayTotal = dayEntries.reduce((sum, entry) => sum + entry.calories, 0);

                    return (
                      <div key={date} className="bg-white dark:bg-[#1A1C26] rounded-[24px] border border-gray-100 dark:border-white/5 overflow-hidden">
                        {/* Day Header - Clickable to expand/collapse */}
                        <button
                          onClick={() => toggleDayExpansion(date)}
                          className="w-full p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-white/5 transition-all"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}>
                              <ChevronRight size={16} className="text-gray-400" />
                            </div>
                            <div className="flex flex-col items-start">
                              <span className="text-sm font-bold text-gray-900 dark:text-gray-50">
                                {new Date(date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                              </span>
                              <span className="text-[9px] font-medium text-gray-400">
                                {dayEntries.length} meal{dayEntries.length !== 1 ? 's' : ''}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="text-sm text-royal-600 dark:text-royal-400 font-black">{dayTotal}</span>
                            <span className="text-[8px] font-bold text-gray-400 uppercase">kcal</span>
                          </div>
                        </button>

                        {/* Expandable Meal List */}
                        {isExpanded && (
                          <div className="border-t border-gray-100 dark:border-white/5">
                            {dayEntries.map(entry => {
                              const entryWithImage = getEntryWithImage(entry);
                              return (
                                <div
                                  key={entry.id}
                                  onClick={() => setSelectedEntry(entryWithImage)}
                                  className="p-4 flex justify-between items-center hover:bg-gray-50 dark:hover:bg-white/5 transition-all cursor-pointer border-b border-gray-50 dark:border-white/5 last:border-b-0"
                                >
                                  <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-2xl bg-gray-50 dark:bg-white/5 overflow-hidden shadow-inner border border-gray-100 dark:border-white/5">
                                      {entryWithImage.imageUrl ? (
                                        <img src={entryWithImage.imageUrl} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-gray-100 dark:bg-white/10 text-gray-300 dark:text-gray-700">
                                          <div className="w-2 h-2 rounded-full bg-gray-300 dark:bg-gray-700"></div>
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex flex-col">
                                      <span className="text-sm text-gray-900 dark:text-gray-50 font-bold leading-tight">{entry.food_item}</span>
                                      <span className="text-[9px] text-gray-400 dark:text-gray-500">{entry.time}</span>
                                    </div>
                                  </div>
                                  <div className="flex flex-col items-end">
                                    <span className="text-sm text-royal-600 dark:text-royal-400 font-black">{entry.calories}</span>
                                    <span className="text-[8px] font-bold text-gray-400 uppercase">kcal</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })
              ) : (
                <div className="bg-white dark:bg-[#1A1C26] rounded-[24px] p-12 text-center border border-dashed border-gray-200 dark:border-white/10">
                  <CalendarIcon size={32} className="mx-auto text-gray-200 dark:text-white/5 mb-4" />
                  <p className="text-gray-400 dark:text-gray-500 text-sm font-medium">No data for this {viewMode === 'month' ? 'month' : 'week'}.</p>
                </div>
              )
            )}
          </div>
        </div>

        {selectedEntry && (
          <MealDetailModal
            entry={selectedEntry}
            onClose={() => setSelectedEntry(null)}
            onDelete={handleDeleteEntry}
            onEdit={handleEditEntry}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 animate-in fade-in duration-500 overflow-y-auto no-scrollbar relative bg-[#F8F9FE] dark:bg-[#0F111A]">
      <div className="px-6 pt-10 pb-4">
        {/* Header with Switcher */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-black text-gray-900 dark:text-gray-50 tracking-tight">Report</h1>
          <div className="flex p-1 bg-white dark:bg-[#1A1C26] rounded-xl border border-gray-100 dark:border-white/5 shadow-sm">
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${viewMode === 'day' ? 'bg-royal-600 text-white shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-royal-500'}`}
            >
              Daily
            </button>
            <button
              onClick={() => setViewMode('week')}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${viewMode === 'week' ? 'bg-royal-600 text-white shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-royal-500'}`}
            >
              Weekly
            </button>
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1 rounded-lg text-[10px] font-bold transition-all ${viewMode === 'month' ? 'bg-royal-600 text-white shadow-sm' : 'text-gray-400 dark:text-gray-500 hover:text-royal-500'}`}
            >
              Monthly
            </button>
          </div>
        </div>

        {/* Scrollable Selector */}
        <div className="relative mb-8">
          <div
            ref={scrollContainerRef}
            className="flex gap-3 overflow-x-auto no-scrollbar pb-2 px-1 snap-x"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            {scrollItems.map((item) => {
              const isSelected = viewMode === 'day' ? item.id === selectedDate
                : viewMode === 'week' ? item.id === selectedWeek
                  : item.id === selectedMonth;

              const hasData = summaries.some(s => {
                if (viewMode === 'day') return s.date === item.id;
                if (viewMode === 'week') {
                  // Check if summary date falls in week range
                  const [year, month, day] = item.id.split('-').map(Number);
                  const start = new Date(year, month - 1, day);
                  const end = new Date(start);
                  end.setDate(start.getDate() + 6);
                  const sDate = new Date(s.date);
                  return sDate >= start && sDate <= end;
                }
                return s.date.startsWith(item.id);
              });

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (viewMode === 'day') setSelectedDate(item.id);
                    else if (viewMode === 'week') setSelectedWeek(item.id);
                    else setSelectedMonth(item.id);
                  }}
                  className={`flex-shrink-0 flex flex-col items-center justify-center ${viewMode === 'week' ? 'w-24' : 'w-12'} py-3 rounded-2xl transition-all duration-300 snap-center ${isSelected
                    ? 'bg-royal-600 text-white shadow-lg shadow-royal-200 dark:shadow-royal-900/40 transform scale-110'
                    : 'bg-white dark:bg-[#1A1C26] text-gray-400 dark:text-gray-500 border border-gray-100 dark:border-white/5'
                    }`}
                >
                  <span className={`text-[9px] font-bold uppercase mb-1 ${isSelected ? 'text-white/70' : 'text-gray-400'}`}>
                    {item.name}
                  </span>
                  <span className="text-sm font-extrabold">{item.label}</span>
                  {hasData && !isSelected && (
                    <div className="w-1 h-1 rounded-full bg-royal-400 mt-1"></div>
                  )}
                </button>
              );
            })}
          </div>
          {/* Fades for scrolling */}
          <div className="absolute top-0 left-0 bottom-2 w-8 bg-gradient-to-r from-[#F8F9FE] dark:from-[#0F111A] to-transparent pointer-events-none z-10"></div>
          <div className="absolute top-0 right-0 bottom-2 w-8 bg-gradient-to-l from-[#F8F9FE] dark:from-[#0F111A] to-transparent pointer-events-none z-10"></div>
        </div>

        {/* Total Macros Section - Redesigned Card (Refined) */}
        <div className="mb-8">
          <div className="bg-white dark:bg-[#1A1C26] rounded-[28px] p-6 shadow-sm border border-gray-100 dark:border-white/5 flex flex-col items-center">
            <span className="text-[9px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-1">
              {viewMode === 'day' ? 'Daily Total' : viewMode === 'week' ? 'Weekly Total' : 'Monthly Total'}
            </span>
            <div className="flex flex-col items-center mb-6">
              <span className="text-5xl font-black text-gray-900 dark:text-gray-50 tracking-tighter">
                {Math.round(activeSummary.totalCalories)}
              </span>
              <span className="text-[10px] font-black text-royal-600 dark:text-royal-400 uppercase tracking-widest mt-0.5">
                KCAL
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2.5 w-full">
              <div className="flex flex-col items-center py-2.5 bg-emerald-50/30 dark:bg-emerald-500/5 rounded-2xl border border-emerald-100/50 dark:border-emerald-500/10 transition-colors">
                <span className="text-[8px] font-bold text-emerald-600/60 dark:text-emerald-400/60 uppercase mb-0.5">Protein</span>
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">{Math.round(activeSummary.totalProtein)}g</span>
              </div>
              <div className="flex flex-col items-center py-2.5 bg-amber-50/30 dark:bg-amber-500/5 rounded-2xl border border-amber-100/50 dark:border-amber-500/10 transition-colors">
                <span className="text-[8px] font-bold text-amber-600/60 dark:text-amber-400/60 uppercase mb-0.5">Carbs</span>
                <span className="text-sm font-black text-amber-600 dark:text-amber-400">{Math.round(activeSummary.totalCarbs)}g</span>
              </div>
              <div className="flex flex-col items-center py-2.5 bg-rose-50/30 dark:bg-rose-500/5 rounded-2xl border border-rose-100/50 dark:border-rose-500/10 transition-colors">
                <span className="text-[8px] font-bold text-rose-600/60 dark:text-rose-400/60 uppercase mb-0.5">Fat</span>
                <span className="text-sm font-black text-rose-600 dark:text-rose-400">{Math.round(activeSummary.totalFat)}g</span>
              </div>
            </div>
          </div>
        </div>

        {/* Improved Grid with History Card */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <Card className="p-5 flex flex-col justify-between h-36 bg-gradient-to-br from-royal-500 to-royal-700 text-white border-none shadow-royal-200/50">
            <div>
              <p className="text-[10px] font-bold text-white/70 uppercase mb-1">{viewMode === 'day' ? 'Coach Tips' : 'Report'}</p>
              <h3 className="text-lg font-black leading-tight">
                {viewMode === 'day' ? 'Daily Review' : viewMode === 'week' ? 'Weekly Summary' : <>Your Health<br />Summary</>}
              </h3>
            </div>
            <div className="mt-2 py-2 bg-white/20 rounded-xl text-[10px] font-bold backdrop-blur-sm flex items-center justify-center gap-2">
              {viewMode === 'day' ? 'COMING SOON' : 'VIEW DETAILS'}
              <ChevronRight size={12} />
            </div>
          </Card>

          <div className="grid grid-rows-2 gap-4 h-36">
            <Card
              onClick={() => setIsFullLogView(true)}
              className="p-4 flex flex-col justify-center bg-white dark:bg-[#1A1C26] border-gray-100 dark:border-white/5 active:scale-95 transition-transform cursor-pointer"
            >
              <div className="flex justify-between items-center mb-1">
                <p className="text-[9px] font-bold text-gray-400 uppercase">History Log</p>
                <ChevronRight size={10} className="text-gray-300" />
              </div>
              <p className="text-xs font-black text-gray-900 dark:text-gray-50">
                {viewMode === 'day' ? (dayEntries[selectedDate] || []).length : monthEntriesList.length} Meals
              </p>
            </Card>

            <Card className="p-4 flex flex-col justify-center bg-white dark:bg-[#1A1C26] border-gray-100 dark:border-white/5">
              <div className="flex justify-between items-center mb-1">
                <p className="text-[9px] font-bold text-gray-400 uppercase">Goal Status</p>
                <Info size={10} className="text-gray-300" />
              </div>
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1 bg-gray-100 dark:bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-royal-500 rounded-full"
                    style={{ width: `${Math.min((activeSummary.totalCalories / (viewMode === 'day' ? dailyGoal : viewMode === 'week' ? dailyGoal * 7 : dailyGoal * 30)) * 100, 100)}%` }}
                  />
                </div>
                <span className="text-[10px] font-black text-gray-900 dark:text-gray-50">
                  {Math.round((activeSummary.totalCalories / (viewMode === 'day' ? dailyGoal : viewMode === 'week' ? dailyGoal * 7 : dailyGoal * 30)) * 100)}%
                </span>
              </div>
            </Card>
          </div>
        </div>

        {/* Visual Padding for fixed bottom nav */}
        <div className="h-24"></div>
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
            setDayEntries({});
            setEntryImages({});
            loadData();
          }}
          onOpenSharedMeal={() => {
            // No-op or redirect to SharedMeal handled elsewhere if needed
            setShowEditModal(false);
          }}
        />
      )}
    </div>
  );
};
