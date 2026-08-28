import { createClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';

if (!config.supabase.url || !config.supabase.serviceRoleKey) {
  console.warn('Supabase URL or service role key is missing. SupabaseAdmin will not work properly.');
}

export const supabaseAdmin = createClient(
  config.supabase.url || 'https://placeholder.supabase.co',
  config.supabase.serviceRoleKey || 'placeholder-key',
  { auth: { autoRefreshToken: false, persistSession: false } }
);

export function createSupabaseClient(accessToken?: string) {
  const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined;
  return createClient(
    config.supabase.url || 'https://placeholder.supabase.co',
    config.supabase.anonKey || 'placeholder-key',
    {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { headers }
    }
  );
}
