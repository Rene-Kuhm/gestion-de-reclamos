import type { VercelRequest, VercelResponse } from '@vercel/node';
import webpush from 'web-push';
import { getUserIdFromRequest } from './_lib/auth';
import { getRequiredEnv } from './_lib/env';
import { getSupabaseAdmin } from './_lib/supabase';

type NotifyPayload = {
  targetUserId?: string;
  targetRole?: 'admin' | 'tecnico';
  title: string;
  body: string;
  url?: string;
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const callerUserId = await getUserIdFromRequest(req);
    if (!callerUserId) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const payload = req.body as NotifyPayload;
    if (!payload?.title || !payload?.body || (!payload.targetUserId && !payload.targetRole)) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { data: callerProfile, error: callerErr } = await supabase
      .from('usuarios')
      .select('id, rol')
      .eq('id', callerUserId)
      .single();

    if (callerErr || !callerProfile) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    if (payload.targetRole === 'tecnico' && callerProfile.rol !== 'admin') {
      res.status(403).json({ error: 'Only admin can notify technicians' });
      return;
    }

    if (payload.targetRole === 'admin' && callerProfile.rol !== 'tecnico' && callerProfile.rol !== 'admin') {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    let targetUserIds: string[] = [];
    if (payload.targetUserId) {
      targetUserIds = [payload.targetUserId];
    } else if (payload.targetRole) {
      const { data: users, error } = await supabase
        .from('usuarios')
        .select('id')
        .eq('rol', payload.targetRole);
      if (error) {
        res.status(500).json({ error: error.message });
        return;
      }
      targetUserIds = (users || []).map((u: any) => u.id);
    }

    if (targetUserIds.length === 0) {
      res.status(200).json({ ok: true, sent: 0 });
      return;
    }

    const vapidPublicKey = getRequiredEnv('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = getRequiredEnv('VAPID_PRIVATE_KEY');
    const vapidSubject = getRequiredEnv('VAPID_SUBJECT');

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const { data: subs, error: subsError } = await supabase
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', targetUserIds);

    if (subsError) {
      res.status(500).json({ error: subsError.message });
      return;
    }

    const notificationPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/',
    });

    let sent = 0;
    let removed = 0;

    for (const sub of subs || []) {
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
          await supabase.from('push_subscriptions').delete().eq('id', sub.id);
          removed += 1;
        }
      }
    }

    res.status(200).json({ ok: true, sent, removed });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Server error' });
  }
}

