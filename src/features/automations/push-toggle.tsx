"use client";

import { BellRing } from "lucide-react";
import { useState, useSyncExternalStore, useTransition } from "react";
import { removePushSubscription, savePushSubscription } from "./push-actions";

const PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function toUint8(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}
const supported = () =>
  typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const noop = () => () => {};

/** Ativação opcional de avisos no celular (Web Push). Nenhum conteúdo clínico é enviado. */
export function PushToggle() {
  const isSupported = useSyncExternalStore(noop, supported, () => false);
  const [status, setStatus] = useState<"idle" | "on" | "off" | "denied" | "error">("idle");
  const [pending, start] = useTransition();
  if (!PUBLIC_KEY || !isSupported) return null;

  const enable = () =>
    start(async () => {
      try {
        const permission = await Notification.requestPermission();
        if (permission !== "granted") return setStatus("denied");
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: toUint8(PUBLIC_KEY),
        });
        const r = await savePushSubscription(sub.toJSON());
        setStatus(r.ok ? "on" : "error");
      } catch {
        setStatus("error");
      }
    });
  const disable = () =>
    start(async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await removePushSubscription(sub.endpoint);
        await sub.unsubscribe();
      }
      setStatus("off");
    });

  return (
    <div className="flex flex-col items-start gap-2 text-sm">
      {status === "on" ? (
        <button type="button" onClick={disable} disabled={pending} className="text-olive underline underline-offset-4">
          Desativar avisos neste aparelho
        </button>
      ) : (
        <button
          type="button"
          onClick={enable}
          disabled={pending}
          className="inline-flex items-center gap-2 text-olive underline underline-offset-4"
        >
          <BellRing aria-hidden className="size-4" /> Receber avisos neste aparelho
        </button>
      )}
      <span aria-live="polite" className="text-xs text-mist">
        {status === "on" && "Avisos ativados. Mostramos apenas títulos, sem informações de saúde."}
        {status === "denied" && "Permissão negada no navegador. Ative nas configurações do site."}
        {status === "error" && "Não foi possível ativar neste aparelho."}
      </span>
    </div>
  );
}
