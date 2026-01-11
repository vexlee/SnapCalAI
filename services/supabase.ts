import { createClient } from '@supabase/supabase-js';

// ------------------------------------------------------------------
// CONFIGURATION: Supabase details
// ------------------------------------------------------------------
// Vite exposes env vars on import.meta.env
// We check for both process.env (legacy/test) and import.meta.env (Vite)
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";

// Check if valid keys are present (Must start with http for URL)
export const isSupabaseConfigured =
  !!SUPABASE_URL &&
  !!SUPABASE_KEY &&
  SUPABASE_URL.startsWith('http');

const LS_MODE_KEY = 'snapcal_mode_preference';

export const getAppMode = (): 'local' | 'cloud' => {
  if (!isSupabaseConfigured) return 'local';
  const stored = localStorage.getItem(LS_MODE_KEY);
  return (stored === 'local') ? 'local' : 'cloud';
};

export const setAppMode = (mode: 'local' | 'cloud') => {
  localStorage.setItem(LS_MODE_KEY, mode);
  window.location.reload();
};

export const shouldUseCloud = isSupabaseConfigured && getAppMode() === 'cloud';

if (!isSupabaseConfigured) {
  console.log("Supabase is not configured. Using Mock Auth & Local Storage.");
} else if (!shouldUseCloud) {
  console.log("Supabase configured but user prefers Local Storage.");
}

// Create client (use dummy values if not configured to prevent crash on import, 
// but isSupabaseConfigured prevents usage of the client)
export const supabase = createClient(
  isSupabaseConfigured ? SUPABASE_URL! : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? SUPABASE_KEY! : 'placeholder'
);