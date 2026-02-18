import { createClient } from '@supabase/supabase-js';

// Get environment variables - check both with and without VITE_ prefix
function getEnvVar(name: string): string {
  const value = process.env[name] || process.env[`VITE_${name}`];
  if (!value) {
    throw new Error(`Missing env var: ${name} (checked with and without VITE_ prefix)`);
  }
  return value.trim();
}

export function getSupabaseAdmin() {
  const url = getEnvVar('SUPABASE_URL');
  const serviceRoleKey = getEnvVar('SUPABASE_SERVICE_ROLE_KEY');
  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function getSupabaseAnon() {
  const url = getEnvVar('SUPABASE_URL');
  const anonKey = getEnvVar('SUPABASE_ANON_KEY');
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

