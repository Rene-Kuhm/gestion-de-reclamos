import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRequire } from 'module';
import { getRequiredEnv } from './_lib/env';
import { getSupabaseAdmin } from './_lib/supabase';

/**
 * Webhook endpoint for Supabase Database Change Notifications (CDC)
 * 
 * Handles INSERT/UPDATE events on the 'reclamos' table and sends
 * push notifications to relevant users (admins and technicians)
 * 
 * @see https://supabase.com/docs/guides/database/webhooks
 */

// Type definitions for Supabase CDC payload
interface ReclamoRecord {
  id: string;
  creado_por: string;
  tecnico_asignado: string | null;
  tipo_servicio: string;
  cliente_nombre: string;
  cliente_telefono: string;
  direccion: string;
  latitud: number | null;
  longitud: number | null;
  descripcion: string;
  estado: string;
  fecha_creacion: string;
  fecha_actualizacion: string;
}

interface SupabaseCDCRecord {
  schema: string;
  table: string;
  commit_timestamp: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  old: ReclamoRecord | null;
  new: ReclamoRecord | null;
}

// Service type mapping for human-readable display
const SERVICIO_LABELS: Record<string, string> = {
  fibra_optica: 'Fibra Óptica',
  adsl: 'ADSL',
  tv: 'Televisión',
  telefono: 'Teléfono'
};

// Status mapping for human-readable display
const ESTADO_LABELS: Record<string, string> = {
  pendiente: 'Pendiente',
  en_proceso: 'En Proceso',
  completado: 'Completado'
};

// Helper to load web-push dynamically
const loadWebPush = () => {
  try {
    const require = createRequire(import.meta.url);
    return require('web-push');
  } catch (e) {
    console.error('[Webhook] Failed to load web-push module:', e);
    throw e;
  }
};

/**
 * Validates the webhook request using a secret token
 * 
 * The secret is passed in the X-Webhook-Secret header and must match
 * the WEBHOOK_SECRET environment variable
 */
function validateWebhookRequest(req: VercelRequest): string | null {
  const webhookSecret = process.env.WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error('[Webhook] WEBHOOK_SECRET not configured');
    return 'Webhook secret not configured on server';
  }

  const providedSecret = req.headers['x-webhook-secret'];
  
  if (!providedSecret) {
    console.error('[Webhook] No secret provided in request');
    return 'Missing X-Webhook-Secret header';
  }

  if (providedSecret !== webhookSecret) {
    console.error('[Webhook] Invalid secret provided');
    return 'Invalid webhook secret';
  }

  return null;
}

/**
 * Sends push notifications to users with a specific role
 */
async function sendPushNotification(
  webpush: any,
  supabase: ReturnType<typeof getSupabaseAdmin>,
  targetRole: 'admin' | 'tecnico',
  title: string,
  body: string,
  url?: string
): Promise<{ sent: number; removed: number; errors: string[] }> {
  // Fetch users with the target role
  const { data: users, error: usersError } = await supabase
    .from('usuarios')
    .select('id')
    .eq('rol', targetRole);

  if (usersError) {
    console.error(`[Webhook] Error fetching ${targetRole} users:`, usersError);
    throw usersError;
  }

  if (!users || users.length === 0) {
    console.log(`[Webhook] No users found with role: ${targetRole}`);
    return { sent: 0, removed: 0, errors: [] };
  }

  const userIds = users.map(u => u.id);

  // Fetch push subscriptions for these users
  const { data: subs, error: subsError } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .in('user_id', userIds);

  if (subsError) {
    console.error('[Webhook] Error fetching subscriptions:', subsError);
    throw subsError;
  }

  if (!subs || subs.length === 0) {
    console.log(`[Webhook] No subscriptions found for ${targetRole} role`);
    return { sent: 0, removed: 0, errors: [] };
  }

  const notificationPayload = JSON.stringify({
    title,
    body,
    url: url || '/'
  });

  let sent = 0;
  let removed = 0;
  const errors: string[] = [];

  // Send notifications in parallel
  await Promise.all(
    subs.map(async (sub) => {
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
          console.error(`[Webhook] Error sending push to ${sub.id}:`, err.message);
          errors.push(err.message || 'Unknown error');
        }
      }
    })
  );

  return { sent, removed, errors };
}

/**
 * Handles INSERT events on the reclamos table
 */
async function handleInsert(
  webpush: any,
  supabase: ReturnType<typeof getSupabaseAdmin>,
  record: ReclamoRecord
): Promise<{ admin: any; tecnicos: any }> {
  const servicioLabel = SERVICIO_LABELS[record.tipo_servicio] || record.tipo_servicio;
  
  const title = '📋 Nuevo Reclamo';
  const body = `#${record.id.slice(0, 8)} - ${servicioLabel}\n📍 ${record.direccion}`;
  const url = `/reclamos/${record.id}`;

  console.log(`[Webhook] Sending notifications for new claim ${record.id}`);

  // Send to admins
  const adminResult = await sendPushNotification(
    webpush, supabase, 'admin', title, body, url
  );

  // Send to technicians
  const tecnicoResult = await sendPushNotification(
    webpush, supabase, 'tecnico', title, body, url
  );

  return { admin: adminResult, tecnicos: tecnicoResult };
}

/**
 * Handles UPDATE events on the reclamos table
 */
async function handleUpdate(
  webpush: any,
  supabase: ReturnType<typeof getSupabaseAdmin>,
  oldRecord: ReclamoRecord,
  newRecord: ReclamoRecord
): Promise<{ admin: any; tecnicos: any } | null> {
  // Only notify if status changed
  if (oldRecord.estado === newRecord.estado && 
      oldRecord.tecnico_asignado === newRecord.tecnico_asignado) {
    console.log(`[Webhook] No relevant changes in claim ${newRecord.id}, skipping notification`);
    return null;
  }

  const estadoLabel = ESTADO_LABELS[newRecord.estado] || newRecord.estado;
  const servicioLabel = SERVICIO_LABELS[newRecord.tipo_servicio] || newRecord.tipo_servicio;
  
  let title = '🔄 Reclamo Actualizado';
  let body = `#${newRecord.id.slice(0, 8)} - ${servicioLabel}`;
  const url = `/reclamos/${newRecord.id}`;

  // Add status change info
  if (oldRecord.estado !== newRecord.estado) {
    body += `\n📊 Estado: ${estadoLabel}`;
  }

  // Add assignment info
  if (newRecord.tecnico_asignado && oldRecord.tecnico_asignado !== newRecord.tecnico_asignado) {
    title = '🎯 Reclamo Asignado';
    body += '\n👨‍🔧 Se ha asignado un técnico';
  }

  console.log(`[Webhook] Sending update notification for claim ${newRecord.id}`);

  // Send to admins
  const adminResult = await sendPushNotification(
    webpush, supabase, 'admin', title, body, url
  );

  // If assigned to a technician, also notify technicians
  let tecnicoResult = null;
  if (newRecord.tecnico_asignado) {
    tecnicoResult = await sendPushNotification(
      webpush, supabase, 'tecnico', title, body, url
    );
  }

  return { admin: adminResult, tecnicos: tecnicoResult };
}

/**
 * Main webhook handler
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Webhook-Secret'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Health check endpoint
  if (req.method === 'GET') {
    res.status(200).json({
      ok: true,
      name: 'push-webhook',
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      time: new Date().toISOString(),
    });
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Validate webhook secret
    const validationError = validateWebhookRequest(req);
    if (validationError) {
      res.status(401).json({ error: validationError });
      return;
    }

    // Validate payload structure
    const payload = req.body as SupabaseCDCRecord;
    
    if (!payload?.table || !payload?.eventType) {
      console.error('[Webhook] Invalid payload structure:', payload);
      res.status(400).json({ error: 'Invalid payload structure' });
      return;
    }

    // Only handle reclamos table
    if (payload.table !== 'reclamos') {
      console.log(`[Webhook] Ignoring event for table: ${payload.table}`);
      res.status(200).json({ ok: true, message: `Ignoring non-reclamos table: ${payload.table}` });
      return;
    }

    console.log(`[Webhook] Processing ${payload.eventType} on reclamos table`);

    // Load web-push dynamically
    let webpush: any;
    try {
      webpush = loadWebPush();
    } catch (e: any) {
      res.status(500).json({ error: 'Server configuration error: Failed to load web-push module' });
      return;
    }

    // Initialize VAPID keys
    try {
      const vapidPublicKey = getRequiredEnv('VAPID_PUBLIC_KEY');
      const vapidPrivateKey = getRequiredEnv('VAPID_PRIVATE_KEY');
      const vapidSubject = getRequiredEnv('VAPID_SUBJECT');

      webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    } catch (err: any) {
      console.error('[Webhook] VAPID Configuration Error:', err);
      res.status(500).json({ error: `Server Configuration Error: ${err.message}` });
      return;
    }

    const supabase = getSupabaseAdmin();

    // Handle different event types
    let result: any = null;

    switch (payload.eventType) {
      case 'INSERT':
        if (!payload.new) {
          res.status(400).json({ error: 'Missing new record data for INSERT' });
          return;
        }
        result = await handleInsert(webpush, supabase, payload.new);
        break;

      case 'UPDATE':
        if (!payload.old || !payload.new) {
          res.status(400).json({ error: 'Missing record data for UPDATE' });
          return;
        }
        result = await handleUpdate(webpush, supabase, payload.old, payload.new);
        break;

      case 'DELETE':
        console.log(`[Webhook] DELETE event for claim ${payload.old?.id}, skipping notification`);
        // Optionally: notify about deleted claims
        break;

      default:
        console.log(`[Webhook] Unknown event type: ${payload.eventType}`);
    }

    res.status(200).json({
      ok: true,
      table: payload.table,
      eventType: payload.eventType,
      recordId: payload.new?.id || payload.old?.id,
      notifications: result
    });

  } catch (e: any) {
    console.error('[Webhook] Unhandled error:', e);
    res.status(500).json({ 
      error: e?.message || 'Server error',
      stack: process.env.NODE_ENV === 'development' ? e.stack : undefined
    });
  }
}
