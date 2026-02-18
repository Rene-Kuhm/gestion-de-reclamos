import { toast } from 'sonner';

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
  const existing = await navigator.serviceWorker.getRegistration();
  if (existing) return existing;
  return navigator.serviceWorker.register('/sw.js');
}

export async function enablePushForUser(params: { userId: string; accessToken: string }) {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    toast.error('Este dispositivo/navegador no soporta notificaciones push');
    return { ok: false } as const;
  }

  const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!vapidPublicKey) {
    toast.error('Falta configurar VITE_VAPID_PUBLIC_KEY');
    return { ok: false } as const;
  }

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') {
    toast.error('Permiso de notificaciones denegado');
    return { ok: false } as const;
  }

  const registration = await getOrRegisterServiceWorker();
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ||
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
    }));

  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${params.accessToken}`,
    },
    body: JSON.stringify({
      userId: params.userId,
      subscription: subscription.toJSON(),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    toast.error('No se pudo activar push');
    return { ok: false, error: text } as const;
  }

  localStorage.setItem('pushEnabled', 'true');
  toast.success('Notificaciones push activadas');
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
  await fetch('/api/push/notify', {
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
}

