"use client";

import { useEffect } from "react";

/** Registra o service worker apenas em produção (evita cache confuso no desenvolvimento). */
export function ServiceWorkerRegistration() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Falha de registro não impede o uso do site.
    });
  }, []);
  return null;
}
