import { createClient } from '@supabase/supabase-js';

// Read from Vite environment variables or default to placeholders
export const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
export const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

// Initialize Anonymous / Guest Authentication session on first launch
export async function initializeGuestAuth(): Promise<{ token: string; email: string }> {
  // Check if an existing session token is stored
  const existingToken = localStorage.getItem('kanban_auth_token');
  const existingEmail = localStorage.getItem('kanban_user_email');

  if (existingToken && existingEmail) {
    return { token: existingToken, email: existingEmail };
  }

  // 1. If Supabase is connected, sign in anonymously
  if (isSupabaseConfigured && supabase) {
    try {
      const { data, error } = await supabase.auth.signInAnonymously();
      if (!error && data.session) {
        const token = data.session.access_token;
        const email = data.user?.email || `guest_${data.user?.id.substring(0, 8)}@kanban.guest`;
        localStorage.setItem('kanban_auth_token', token);
        localStorage.setItem('kanban_user_email', email);
        return { token, email };
      }
    } catch (err) {
      console.warn('Supabase anonymous sign-in failed, using guest fallback:', err);
    }
  }

  // 2. Local fallback guest session (unique UUID per guest launch)
  const guestUUID = crypto.randomUUID();
  const guestToken = `mock-user-${guestUUID}`;
  const guestEmail = `guest_${guestUUID.substring(0, 8)}@kanban.guest`;

  localStorage.setItem('kanban_auth_token', guestToken);
  localStorage.setItem('kanban_user_email', guestEmail);
  return { token: guestToken, email: guestEmail };
}
