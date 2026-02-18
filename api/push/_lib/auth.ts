import type { VercelRequest } from '@vercel/node';
import { getSupabaseAnon } from './supabase';

export async function getUserIdFromRequest(req: VercelRequest): Promise<string | null> {
  const header = req.headers.authorization;
  if (!header) return null;

  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;

  const token = match[1];
  const supabase = getSupabaseAnon();
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user.id;
}

