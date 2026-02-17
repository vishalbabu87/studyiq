'use client';

import { useEffect } from 'react';

export function useDevServerHeartbeat() {
  useEffect(() => {
    let lastPing = 0;
    const throttleMs = 60_000 * 3;

    const ping = () => {
      const now = Date.now();
      if (now - lastPing < throttleMs) return;
      lastPing = now;

      // Keep dev session warm; ignore failures.
      fetch('/', { method: 'GET' }).catch(() => undefined);
    };

    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    for (const eventName of events) {
      window.addEventListener(eventName, ping, { passive: true });
    }

    return () => {
      for (const eventName of events) {
        window.removeEventListener(eventName, ping);
      }
    };
  }, []);
}
