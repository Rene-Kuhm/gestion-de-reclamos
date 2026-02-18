import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRequire } from 'module';
import { getUserIdFromRequest } from './_lib/auth';
import { getRequiredEnv } from './_lib/env';
import { getSupabaseAdmin } from './_lib/supabase';

// Helper to load web-push dynamically to prevent startup crashes
const loadWebPush = () => {
  try {
    const require = createRequire(import.meta.url);
    return require('web-push');
  } catch (e) {
    console.error('Failed to load web-push module:', e);
    throw e;
  }
};

type NotifyPayload = {
  targetUserId?: string;
  targetRole?: 'admin' | 'tecnico';
  title: string;
  body: string;
  url?: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Add CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method === 'GET') {
    res.status(200).json({
      ok: true,
      name: 'push-notify',
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      time: new Date().toISOString(),
      node_version: process.version,
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Dynamically load web-push inside the handler to catch module loading errors
    let webpush: any;
    try {
      webpush = loadWebPush();
    } catch (e: any) {
      console.error('Failed to load web-push:', e);
      res.status(500).json({ error: 'Server configuration error: Failed to load web-push module', details: e.message });
      return;
    }

    // Initialize Supabase Admin
    let supabase: any;
    try {
      supabase = getSupabaseAdmin();
    } catch (e: any) {
      console.error('Failed to initialize Supabase:', e);
      res.status(500).json({ error: 'Server configuration error', details: e.message });
      return;
    }

    const callerUserId = await getUserIdFromRequest(req);
    if (!callerUserId) {
      console.error('Unauthorized access attempt');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const payload = req.body as NotifyPayload;
    if (!payload?.title || !payload?.body || (!payload.targetUserId && !payload.targetRole)) {
      console.error('Invalid payload', payload);
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    // Initialize Supabase (already initialized above)
    
    // Check permissions
    const { data: callerProfile, error: callerErr } = await supabase
      .from('usuarios')
      .select('id, rol')
      .eq('id', callerUserId)
      .single();

    if (callerErr || !callerProfile) {
      console.error('Caller profile error', callerErr);
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Role-based access control
    if (payload.targetRole === 'tecnico' && callerProfile.rol !== 'admin') {
      res.status(403).json({ error: 'Only admin can notify technicians' });
      return;
    }

    if (payload.targetRole === 'admin' && callerProfile.rol !== 'tecnico' && callerProfile.rol !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (payload.targetUserId && callerProfile.rol !== 'admin' && payload.targetUserId !== callerUserId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    // Resolve target users
    let targetUserIds: string[] = [];
    if (payload.targetUserId) {
      targetUserIds = [payload.targetUserId];
    } else if (payload.targetRole) {
      const { data: users, error } = await supabase.from('usuarios').select('id').eq('rol', payload.targetRole);
      if (error) {
        console.error('Error fetching target users', error);
        res.status(500).json({ error: error.message });
        return;
      }
      targetUserIds = (users || []).map((u: any) => u.id);
    }

    if (targetUserIds.length === 0) {
      res.status(200).json({ ok: true, sent: 0, removed: 0, message: 'No target users found' });
      return;
    }

    // Setup Web Push
    try {
      const vapidPublicKey = getRequiredEnv('VAPID_PUBLIC_KEY');
      const vapidPrivateKey = getRequiredEnv('VAPID_PRIVATE_KEY');
      const vapidSubject = getRequiredEnv('VAPID_SUBJECT');

      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    } catch (err: any) {
      console.error('VAPID Configuration Error:', err);
      res.status(500).json({ error: `Server Configuration Error: ${err.message}` });
      return;
    }

    // Fetch subscriptions
    const { data: subs, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', targetUserIds);

    if (subsError) {
      console.error('Error fetching subscriptions', subsError);
      res.status(500).json({ error: subsError.message });
      return;
    }

    if (!subs || subs.length === 0) {
      res.status(200).json({ ok: true, sent: 0, removed: 0, message: 'No subscriptions found for target users' });
      return;
    }

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/',
    });

    let sent = 0;
    let removed = 0;
    const errors: any[] = [];

    // Send notifications in parallel
    await Promise.all(subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          notificationPayload
        );
        sent += 1;
      } catch (err: any) {
        const statusCode = err?.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          // Subscription is dead, remove it
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          removed += 1;
        } else {
          console.error(`Error sending push to ${sub.id}:`, err);
          errors.push({ id: sub.id, error: err.message || 'Unknown error' });
        }
      }
    }));

    res.status(200).json({ ok: true, sent, removed, errors: errors.length > 0 ? errors : undefined });
  } catch (e: any) {
    console.error('Unhandled error in handler:', e);
    res.status(500).json({ error: e?.message || 'Server error', stack: process.env.NODE_ENV === 'development' ? e.stack : undefined });
  }
}
