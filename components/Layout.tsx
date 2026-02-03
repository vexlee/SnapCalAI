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
    <div className="h-[100dvh] bg-gradient-to-br from-[#F9F7F2] to-[#F3F0E7] flex flex-col max-w-md mx-auto relative shadow-2xl shadow-gray-200 overflow-hidden border-x border-primary-100/50 transition-colors duration-300">

      {/* Content Area */}
      <main className="flex-1 flex flex-col min-h-0 overflow-hidden">
        {children}
      </main>

      {/* Bottom Blur Guard - Prevents content from peeking below the pill and makes it unclickable */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background via-background/90 to-transparent pointer-events-none z-40" />

      {/* Bottom Navigation */}
      <div className="absolute bottom-6 left-5 right-5 z-50">
        <nav className="bg-[#3D745B] rounded-full p-2 shadow-soft-lg border border-white/10 flex justify-between items-center">
          <button
            onClick={() => onNavigate(AppView.DASHBOARD)}
            className={clsx(
              "flex items-center justify-center gap-2 py-3 rounded-full transition-all duration-500",
              currentView === AppView.DASHBOARD
                ? "flex-[1.6] bg-white text-[#3D745B] shadow-lg px-4"
                : "flex-1 text-white/70 hover:text-white hover:bg-white/10"
            )}
          >
            <Home size={22} strokeWidth={currentView === AppView.DASHBOARD ? 2.5 : 2} />
            {currentView === AppView.DASHBOARD && <span className="text-sm font-semibold animate-in fade-in slide-in-from-left-2 duration-300">Today</span>}
          </button>

          <button
            onClick={() => onNavigate(AppView.CAL_COACH)}
            className={clsx(
              "flex items-center justify-center gap-2 py-3 rounded-full transition-all duration-500",
              currentView === AppView.CAL_COACH
                ? "flex-[1.6] bg-white text-[#3D745B] shadow-lg px-4"
                : "flex-1 text-white/70 hover:text-white hover:bg-white/10"
            )}
          >
            <Sparkles size={22} strokeWidth={currentView === AppView.CAL_COACH ? 2.5 : 2} />
            {currentView === AppView.CAL_COACH && <span className="text-sm font-semibold animate-in fade-in slide-in-from-left-2 duration-300">Coach</span>}
          </button>

          <button
            onClick={() => onNavigate(AppView.WORKOUT_PLAN)}
            className={clsx(
              "flex items-center justify-center gap-2 py-3 rounded-full transition-all duration-500",
              currentView === AppView.WORKOUT_PLAN
                ? "flex-[2] bg-white text-[#3D745B] shadow-lg px-4"
                : "flex-1 text-white/70 hover:text-white hover:bg-white/10"
            )}
          >
            <Dumbbell size={22} strokeWidth={currentView === AppView.WORKOUT_PLAN ? 2.5 : 2} />
            {currentView === AppView.WORKOUT_PLAN && <span className="text-sm font-semibold animate-in fade-in slide-in-from-left-2 duration-300">Workout</span>}
          </button>

          <button
            onClick={() => onNavigate(AppView.HISTORY)}
            className={clsx(
              "flex items-center justify-center gap-2 py-3 rounded-full transition-all duration-500",
              currentView === AppView.HISTORY
                ? "flex-[1.6] bg-white text-[#3D745B] shadow-lg px-4"
                : "flex-1 text-white/70 hover:text-white hover:bg-white/10"
            )}
          >
            <BarChart2 size={22} strokeWidth={currentView === AppView.HISTORY ? 2.5 : 2} />
            {currentView === AppView.HISTORY && <span className="text-sm font-semibold animate-in fade-in slide-in-from-right-2 duration-300">Report</span>}
          </button>

          <button
            onClick={() => onNavigate(AppView.PROFILE)}
            className={clsx(
              "flex items-center justify-center gap-2 py-3 rounded-full transition-all duration-500",
              currentView === AppView.PROFILE
                ? "flex-[1.6] bg-white text-[#3D745B] shadow-lg px-4"
                : "flex-1 text-white/70 hover:text-white hover:bg-white/10"
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