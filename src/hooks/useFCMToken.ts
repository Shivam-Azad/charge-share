'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@/utils/supabase/client';

declare global {
  interface Window {
    firebase?: any;
  }
}

type FCMStatus = 'idle' | 'unsupported' | 'blocked' | 'ready' | 'error';

const FIREBASE_APP_SCRIPT = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
const FIREBASE_MESSAGING_SCRIPT = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-messaging-compat.js';

function loadScript(src: string) {
  return new Promise<void>((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.appendChild(script);
  });
}

export function useFCMToken(userId: string | null) {
  const [status, setStatus] = useState<FCMStatus>('idle');
  const [token, setToken] = useState<string | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (!userId || initialized.current) return;
    initialized.current = true;

    const register = async () => {
      try {
        if (!('serviceWorker' in navigator) || !('Notification' in window)) {
          setStatus('unsupported');
          return;
        }

        const configRes = await fetch('/api/firebase-config');
        const config = await configRes.json();

        const vapidKey = String(config.vapidKey ?? '').trim();

        if (!config.apiKey || !config.messagingSenderId || !config.appId || !config.projectId || !vapidKey) {
          console.warn('[useFCMToken] Missing Firebase web config or VAPID key.');
          setStatus('idle');
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          setStatus('blocked');
          return;
        }

        const serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
        await loadScript(FIREBASE_APP_SCRIPT);
        await loadScript(FIREBASE_MESSAGING_SCRIPT);

        const firebase = window.firebase;
        if (!firebase?.apps?.length) {
          firebase.initializeApp({
            apiKey: config.apiKey,
            messagingSenderId: config.messagingSenderId,
            appId: config.appId,
            projectId: config.projectId,
          });
        }

        const messaging = firebase.messaging();
        const nextToken = await messaging.getToken({
          vapidKey,
          serviceWorkerRegistration,
        });

        if (!nextToken) {
          setStatus('error');
          return;
        }

        const supabase = createClient();
        await supabase
          .from('profiles')
          .update({ fcm_token: nextToken, updated_at: new Date().toISOString() })
          .eq('id', userId);

        setToken(nextToken);
        setStatus('ready');
      } catch (error) {
        console.error('[useFCMToken]', error);
        setStatus('error');
      }
    };

    register();
  }, [userId]);

  return { status, token };
}
