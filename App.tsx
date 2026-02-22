import React, { useState, useEffect, lazy, Suspense } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { AppView } from './types';
import { getCurrentUser, onAuthStateChange, User } from './services/auth';
import { performDataCleanup, hasCompletedOnboarding } from './services/storage';
import { scheduleAtMidnight, hasDateChanged } from './utils/midnight';
import { cache } from './utils/cache';

// Lazy load pages for code-splitting
const Dashboard = lazy(() => import('./pages/Dashboard').then(m => ({ default: m.Dashboard })));
const CalCoach = lazy(() => import('./pages/CalCoach').then(m => ({ default: m.CalCoach })));
const WorkoutPlan = lazy(() => import('./pages/WorkoutPlan').then(m => ({ default: m.WorkoutPlan })));
const History = lazy(() => import('./pages/History').then(m => ({ default: m.History })));
const Profile = lazy(() => import('./pages/Profile').then(m => ({ default: m.Profile })));
const Onboarding = lazy(() => import('./pages/Onboarding').then(m => ({ default: m.Onboarding })));

const LoadingSpinner = () => (
  <div className="min-h-screen bg-surface flex items-center justify-center">
    <div className="w-8 h-8 border-2 border-primary-200 border-t-primary-600 rounded-full animate-spin"></div>
  </div>
);

function App() {
  const [currentView, setCurrentView] = useState<AppView>(AppView.DASHBOARD);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [checkingOnboarding, setCheckingOnboarding] = useState(true);

  useEffect(() => {
    // Initial check
    getCurrentUser().then((u) => {
      setUser(u);
      setLoading(false);

      // Perform rolling cleanup when a user is found
      if (u) {
        performDataCleanup().catch(err => console.error("Cleanup failed:", err));
      }
    });

    // Subscribe to changes (works for both Supabase and Mock)
    const unsubscribe = onAuthStateChange((u) => {
      setUser(u);
      setLoading(false);

      if (u) {
        performDataCleanup().catch(err => console.error("Cleanup failed:", err));
      }
    });

    return () => unsubscribe();
  }, []);

  // Setup midnight refresh timer
  useEffect(() => {
    // IMMEDIATE CHECK: Clear cache if we're in a new day
    if (hasDateChanged()) {
      console.log('🌅 New day detected on app load! Clearing stale caches...');
      cache.clearDateSensitiveCaches();
      // Broadcast refresh event to all components
      window.dispatchEvent(new CustomEvent('midnight-refresh'));
    }

    // SCHEDULED CHECK: Set up timer for next midnight
    const cancelMidnightTimer = scheduleAtMidnight(() => {
      console.log('🌙 Midnight! Clearing caches and broadcasting refresh event...');

      // Clear all date-sensitive caches
      cache.clearDateSensitiveCaches();

      // Broadcast event to all components to refresh their data
      window.dispatchEvent(new CustomEvent('midnight-refresh'));
    });

    return () => {
      cancelMidnightTimer();
    };
  }, []);

  // Check onboarding status when user changes
  useEffect(() => {
    const checkOnboarding = async () => {
      if (user) {
        setCheckingOnboarding(true);
        const completed = await hasCompletedOnboarding(user);
        setShowOnboarding(!completed);
        setCheckingOnboarding(false);
      } else {
        setShowOnboarding(false);
        setCheckingOnboarding(false);
      }
    };

    checkOnboarding();
  }, [user]);

  const handleOnboardingComplete = () => {
    setShowOnboarding(false);
    setCurrentView(AppView.DASHBOARD);
  };

  if (loading || checkingOnboarding) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin"></div>
      </div>
    );
  }

  // If no user (Mock or Real), show Login
  if (!user) {
    return <Login />;
  }

  // If user hasn't completed onboarding, show onboarding
  if (showOnboarding) {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <Onboarding user={user} onComplete={handleOnboardingComplete} />
      </Suspense>
    );
  }

  return (
    <Layout currentView={currentView} onNavigate={setCurrentView}>
      <Suspense fallback={<LoadingSpinner />}>
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="h-full w-full"
          >
            {currentView === AppView.DASHBOARD && <Dashboard />}
            {currentView === AppView.CAL_COACH && <CalCoach onNavigate={setCurrentView} />}
            {currentView === AppView.WORKOUT_PLAN && <WorkoutPlan onNavigate={setCurrentView} />}
            {currentView === AppView.HISTORY && <History />}
            {currentView === AppView.PROFILE && <Profile />}
          </motion.div>
        </AnimatePresence>
      </Suspense>
    </Layout>
  );
}

export default App;