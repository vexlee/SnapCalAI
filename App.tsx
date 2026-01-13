import React, { useState, useEffect } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './pages/Dashboard';
import { CalCoach } from './pages/CalCoach';
import { History } from './pages/History';
import { Login } from './pages/Login';
import { Profile } from './pages/Profile';
import { Onboarding } from './pages/Onboarding';
import { AppView } from './types';
import { getCurrentUser, onAuthStateChange, User } from './services/auth';
import { performDataCleanup, hasCompletedOnboarding } from './services/storage';

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
    return <Onboarding user={user} onComplete={handleOnboardingComplete} />;
  }

  return (
    <Layout currentView={currentView} onNavigate={setCurrentView}>
      {currentView === AppView.DASHBOARD && <Dashboard />}
      {currentView === AppView.CAL_COACH && <CalCoach onNavigate={setCurrentView} />}
      {currentView === AppView.HISTORY && <History />}
      {currentView === AppView.PROFILE && <Profile />}
    </Layout>
  );
}

export default App;