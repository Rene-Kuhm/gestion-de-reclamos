import { createClient } from '@supabase/supabase-js';
import { getRequiredEnv } from './env';

export function getSupabaseAdmin() {
  const url = getRequiredEnv('SUPABASE_URL');
  const serviceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getSupabaseAnon() {
  const url = getRequiredEnv('SUPABASE_URL');
  const anonKey = getRequiredEnv('SUPABASE_ANON_KEY');
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

