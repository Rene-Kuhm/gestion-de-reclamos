/// <reference lib="webworker" />

import { precacheAndRoute } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

declare let self: ServiceWorkerGlobalScope;

clientsClaim();
self.skipWaiting();

precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener('push', (event) => {
  const data = (() => {
    try {
      return event.data?.json() as any;
    } catch {
      return { title: 'Cospec', body: event.data?.text() || 'Nueva notificación' };
    }
  })();

  const title = data?.title || 'Cospec';
  const options: NotificationOptions = {
    body: data?.body,
    icon: '/pwa-192x192.svg',
    badge: '/pwa-192x192.svg',
    data: {
      url: data?.url || '/',
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data as any)?.url || '/';

  event.waitUntil(
    (async () => {
      const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = allClients.find((c) => 'focus' in c) as WindowClient | undefined;

      if (client) {
        await client.focus();
        client.navigate(url);
        return;
      }

      await self.clients.openWindow(url);
    })()
  );
});

