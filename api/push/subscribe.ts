import type { VercelRequest, VercelResponse } from '@vercel/node';
import { getUserIdFromRequest } from './_lib/auth';
import { getSupabaseAdmin } from './_lib/supabase';

type SubscriptionPayload = {
  userId: string;
  subscription: {
    endpoint: string;
    keys: {
      p256dh: string;
      auth: string;
    };
  };
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

    const body = req.body as SubscriptionPayload;
    if (!body?.userId || !body?.subscription?.endpoint || !body?.subscription?.keys?.p256dh || !body?.subscription?.keys?.auth) {
      res.status(400).json({ error: 'Invalid payload' });
      return;
    }

    if (body.userId !== callerUserId) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }

    const supabase = getSupabaseAdmin();
    const { error } = await supabase.from('push_subscriptions').upsert(
      {
        user_id: body.userId,
        endpoint: body.subscription.endpoint,
        p256dh: body.subscription.keys.p256dh,
        auth: body.subscription.keys.auth,
        user_agent: req.headers['user-agent'] || null,
      },
      { onConflict: 'endpoint' }
    );

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    res.status(200).json({ ok: true });
  } catch (e: any) {
    res.status(500).json({ error: e?.message || 'Server error' });
  }
}

