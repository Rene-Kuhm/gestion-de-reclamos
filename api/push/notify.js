module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  const json = (code, body) => {
    res.statusCode = code;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(body));
  };

  const getRequiredEnv = (name) => {
    const value = process.env[name];
    if (!value) throw new Error(`Missing env var: ${name}`);
    return value;
  };

  try {
    const { createClient } = require('@supabase/supabase-js');
    const webpush = require('web-push');

    const supabaseUrl = getRequiredEnv('SUPABASE_URL');
    const supabaseAnonKey = getRequiredEnv('SUPABASE_ANON_KEY');
    const supabaseServiceRoleKey = getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY');

    const authHeader = req.headers?.authorization;
    const tokenMatch = authHeader && authHeader.match(/^Bearer\s+(.+)$/i);
    const accessToken = tokenMatch ? tokenMatch[1] : null;
    if (!accessToken) {
      json(401, { error: 'Unauthorized' });
      return;
    }

    const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: userData, error: userErr } = await supabaseAnon.auth.getUser(accessToken);
    if (userErr || !userData?.user?.id) {
      json(401, { error: 'Unauthorized' });
      return;
    }

    const callerUserId = userData.user.id;

    const payload = req.body || {};
    if (!payload.title || !payload.body || (!payload.targetUserId && !payload.targetRole)) {
      json(400, { error: 'Invalid payload' });
      return;
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: callerProfile, error: callerErr } = await supabaseAdmin
      .from('usuarios')
      .select('id, rol')
      .eq('id', callerUserId)
      .single();

    if (callerErr || !callerProfile) {
      json(403, { error: 'Forbidden' });
      return;
    }

    if (payload.targetRole === 'tecnico' && callerProfile.rol !== 'admin') {
      json(403, { error: 'Only admin can notify technicians' });
      return;
    }

    if (payload.targetRole === 'admin' && callerProfile.rol !== 'tecnico' && callerProfile.rol !== 'admin') {
      json(403, { error: 'Forbidden' });
      return;
    }

    if (payload.targetUserId && callerProfile.rol !== 'admin' && payload.targetUserId !== callerUserId) {
      json(403, { error: 'Forbidden' });
      return;
    }

    let targetUserIds = [];
    if (payload.targetUserId) {
      targetUserIds = [payload.targetUserId];
    } else if (payload.targetRole) {
      const { data: users, error } = await supabaseAdmin.from('usuarios').select('id').eq('rol', payload.targetRole);
      if (error) {
        json(500, { error: error.message });
        return;
      }
      targetUserIds = (users || []).map((u) => u.id);
    }

    if (!targetUserIds.length) {
      json(200, { ok: true, sent: 0, removed: 0 });
      return;
    }

    const vapidPublicKey = getRequiredEnv('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = getRequiredEnv('VAPID_PRIVATE_KEY');
    const vapidSubject = getRequiredEnv('VAPID_SUBJECT');

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const { data: subs, error: subsError } = await supabaseAdmin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', targetUserIds);

    if (subsError) {
      json(500, { error: subsError.message });
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
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          notificationPayload
        );
        sent += 1;
      } catch (err) {
        const statusCode = err && err.statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await supabaseAdmin.from('push_subscriptions').delete().eq('id', sub.id);
          removed += 1;
        }
      }
    }

    json(200, { ok: true, sent, removed });
  } catch (e) {
    json(500, { error: (e && e.message) || 'Server error' });
  }
};

