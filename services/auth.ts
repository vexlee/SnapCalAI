import { supabase, shouldUseCloud } from './supabase';

// Mock Auth Config
const MOCK_SESSION_KEY = 'snapcal_mock_session';
const MOCK_EVENT_KEY = 'snapcal_auth_change';

// Helper to simulate network delay for realism
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export interface User {
  id: string;
  email?: string;
}

export const signIn = async (email: string, pass: string) => {
  if (shouldUseCloud) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) throw new Error(error.message);
    return { user: { id: data.user?.id || '', email: data.user?.email } };
  } else {
    // --- Mock Auth Implementation ---
    await delay(600);
    const mockUser: User = {
      id: btoa(email.toLowerCase()), 
      email
    };
    localStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(mockUser));
    window.dispatchEvent(new Event(MOCK_EVENT_KEY));
    return { user: mockUser };
  }
};

export const signUp = async (email: string, pass: string) => {
  if (shouldUseCloud) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password: pass,
    });
    if (error) throw new Error(error.message);
    return { user: { id: data.user?.id || '', email: data.user?.email } };
  } else {
    return signIn(email, pass);
  }
};

export const signOut = async () => {
  if (shouldUseCloud) {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  } else {
    localStorage.removeItem(MOCK_SESSION_KEY);
    window.dispatchEvent(new Event(MOCK_EVENT_KEY));
  }
};

export const getCurrentUser = async (): Promise<User | null> => {
  if (shouldUseCloud) {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      return { id: data.user.id, email: data.user.email };
    }
    return null;
  } else {
    const stored = localStorage.getItem(MOCK_SESSION_KEY);
    return stored ? JSON.parse(stored) : null;
  }
};

// Abstracted listener for Auth State Changes
export const onAuthStateChange = (callback: (user: User | null) => void) => {
  if (shouldUseCloud) {
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        callback({ id: session.user.id, email: session.user.email });
      } else {
        callback(null);
      }
    });
    return () => data.subscription.unsubscribe();
  } else {
    // Listener for Mock events
    const handler = () => {
       const stored = localStorage.getItem(MOCK_SESSION_KEY);
       callback(stored ? JSON.parse(stored) : null);
    };
    
    window.addEventListener(MOCK_EVENT_KEY, handler);
    window.addEventListener('storage', handler);
    
    return () => {
      window.removeEventListener(MOCK_EVENT_KEY, handler);
      window.removeEventListener('storage', handler);
    };
  }
};