import React from 'react';
import { AppView } from '../types';
import { Home, BarChart2, User, Sparkles, Dumbbell } from 'lucide-react';
import { clsx } from 'clsx';

interface LayoutProps {
  children: React.ReactNode;
  currentView: AppView;
  onNavigate: (view: AppView) => void;
}

export const Layout: React.FC<LayoutProps> = ({ children, currentView, onNavigate }) => {
  return (
    <div className="h-[100dvh] bg-surface dark:bg-surface-dark flex flex-col max-w-md mx-auto relative shadow-2xl shadow-gray-200 dark:shadow-black/50 overflow-hidden border-x border-gray-100/50 dark:border-white/5 transition-colors duration-300">

      {/* Content Area */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {children}
      </main>

      {/* Bottom Blur Guard - Prevents content from peeking below the pill and makes it unclickable */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-white/60 dark:bg-[#0f111a]/60 backdrop-blur-md pointer-events-auto z-40" />

      {/* Bottom Navigation */}
      <div className="absolute bottom-8 left-6 right-6 z-50">
        <nav className="bg-white/80 dark:bg-[#1a1c26]/80 backdrop-blur-xl rounded-[32px] p-2 shadow-diffused-lg dark:shadow-diffused-dark border border-white dark:border-white/5 flex justify-between items-center">
          <button
            onClick={() => onNavigate(AppView.DASHBOARD)}
            className={clsx(
              "flex items-center justify-center gap-2 py-3 rounded-[24px] transition-all duration-500",
              currentView === AppView.DASHBOARD
                ? "flex-[1.6] bg-royal-600 text-white shadow-lg shadow-royal-200 dark:shadow-royal-900/40 px-4"
                : "flex-1 text-gray-400 dark:text-gray-500 hover:text-royal-500 dark:hover:text-royal-400 hover:bg-royal-50/50 dark:hover:bg-white/5"
            )}
          >
            <Home size={22} strokeWidth={currentView === AppView.DASHBOARD ? 2.5 : 2} />
            {currentView === AppView.DASHBOARD && <span className="text-sm font-semibold animate-in fade-in slide-in-from-left-2 duration-300">Today</span>}
          </button>

          <button
            onClick={() => onNavigate(AppView.CAL_COACH)}
            className={clsx(
              "flex items-center justify-center gap-2 py-3 rounded-[24px] transition-all duration-500",
              currentView === AppView.CAL_COACH
                ? "flex-[1.6] bg-royal-600 text-white shadow-lg shadow-royal-200 dark:shadow-royal-900/40 px-4"
                : "flex-1 text-gray-400 dark:text-gray-500 hover:text-royal-500 dark:hover:text-royal-400 hover:bg-royal-50/50 dark:hover:bg-white/5"
            )}
          >
            <Sparkles size={22} strokeWidth={currentView === AppView.CAL_COACH ? 2.5 : 2} />
            {currentView === AppView.CAL_COACH && <span className="text-sm font-semibold animate-in fade-in slide-in-from-left-2 duration-300">Coach</span>}
          </button>

          <button
            onClick={() => onNavigate(AppView.WORKOUT_PLAN)}
            className={clsx(
              "flex items-center justify-center gap-2 py-3 rounded-[24px] transition-all duration-500",
              currentView === AppView.WORKOUT_PLAN
                ? "flex-[2] bg-royal-600 text-white shadow-lg shadow-royal-200 dark:shadow-royal-900/40 px-4"
                : "flex-1 text-gray-400 dark:text-gray-500 hover:text-royal-500 dark:hover:text-royal-400 hover:bg-royal-50/50 dark:hover:bg-white/5"
            )}
          >
            <Dumbbell size={22} strokeWidth={currentView === AppView.WORKOUT_PLAN ? 2.5 : 2} />
            {currentView === AppView.WORKOUT_PLAN && <span className="text-sm font-semibold animate-in fade-in slide-in-from-left-2 duration-300">Workout</span>}
          </button>

          <button
            onClick={() => onNavigate(AppView.HISTORY)}
            className={clsx(
              "flex items-center justify-center gap-2 py-3 rounded-[24px] transition-all duration-500",
              currentView === AppView.HISTORY
                ? "flex-[1.6] bg-royal-600 text-white shadow-lg shadow-royal-200 dark:shadow-royal-900/40 px-4"
                : "flex-1 text-gray-400 dark:text-gray-500 hover:text-royal-500 dark:hover:text-royal-400 hover:bg-royal-50/50 dark:hover:bg-white/5"
            )}
          >
            <BarChart2 size={22} strokeWidth={currentView === AppView.HISTORY ? 2.5 : 2} />
            {currentView === AppView.HISTORY && <span className="text-sm font-semibold animate-in fade-in slide-in-from-right-2 duration-300">Report</span>}
          </button>

          <button
            onClick={() => onNavigate(AppView.PROFILE)}
            className={clsx(
              "flex items-center justify-center gap-2 py-3 rounded-[24px] transition-all duration-500",
              currentView === AppView.PROFILE
                ? "flex-[1.6] bg-royal-600 text-white shadow-lg shadow-royal-200 dark:shadow-royal-900/40 px-4"
                : "flex-1 text-gray-400 dark:text-gray-500 hover:text-royal-500 dark:hover:text-royal-400 hover:bg-royal-50/50 dark:hover:bg-white/5"
            )}
          >
            <User size={22} strokeWidth={currentView === AppView.PROFILE ? 2.5 : 2} />
            {currentView === AppView.PROFILE && <span className="text-sm font-semibold animate-in fade-in slide-in-from-right-2 duration-300">Profile</span>}
          </button>
        </nav>
      </div>
    </div>
  );
};