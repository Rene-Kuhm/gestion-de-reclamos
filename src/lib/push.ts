import { toast } from 'sonner';
import { supabase } from './supabase';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function getOrRegisterServiceWorker(): Promise<ServiceWorkerRegistration> {
  const registration = await navigator.serviceWorker.register('/sw.js');
  await registration.update().catch(() => undefined);
  await navigator.serviceWorker.ready;
  return registration;
}

export async function enablePushForUser(params: { userId: string; accessToken: string; silent?: boolean }) {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    if (!params.silent) toast.error('Este dispositivo/navegador no soporta notificaciones push');
    return { ok: false } as const;
  }

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidPublicKey) {
    if (!params.silent) toast.error('Falta configurar VITE_VAPID_PUBLIC_KEY');
    return { ok: false } as const;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    if (!params.silent) toast.error('Permiso de notificaciones denegado');
    return { ok: false } as const;
  }

  let registration: ServiceWorkerRegistration;
  try {
    registration = await getOrRegisterServiceWorker();
  } catch (e: any) {
    if (!params.silent) toast.error(`No se pudo registrar el Service Worker: ${e?.message || 'error'}`);
    return { ok: false } as const;
  }

  let subscription: PushSubscription;
  try {
    const existing = await registration.pushManager.getSubscription();
    subscription =
      existing ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
      }));
  } catch (e: any) {
    if (!params.silent) toast.error(`No se pudo crear la suscripción push: ${e?.message || e?.name || 'error'}`);
    return { ok: false } as const;
  }

  const json = subscription.toJSON() as any;
  const { error } = await supabase.from('push_subscriptions').upsert(
    {
      user_id: params.userId,
      endpoint: json?.endpoint,
      p256dh: json?.keys?.p256dh,
      auth: json?.keys?.auth,
      user_agent: navigator.userAgent,
    },
    { onConflict: 'endpoint' }
  );

  if (error) {
    if (!params.silent) toast.error(`No se pudo activar push: ${error.message}`);
    return { ok: false, error: error.message } as const;
  }

  localStorage.setItem('pushEnabled', 'true');
  if (!params.silent) toast.success('Notificaciones push activadas');
  return { ok: true } as const;
}

export async function sendPush(params: {
  accessToken: string;
  targetUserId?: string;
  targetRole?: 'admin' | 'tecnico';
  title: string;
  body: string;
  url?: string;
}) {
  const res = await fetch('/api/push/notify', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({
      targetUserId: params.targetUserId,
      targetRole: params.targetRole,
      title: params.title,
      body: params.body,
      url: params.url,
    }),
  });

  const contentType = res.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await res.json().catch(() => null);
    return { ok: res.ok, data } as const;
  }

  const text = await res.text().catch(() => '');
  return { ok: res.ok, data: { error: text || `HTTP ${res.status}` } } as const;
}

