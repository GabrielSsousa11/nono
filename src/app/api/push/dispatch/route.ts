import { NextResponse, type NextRequest } from "next/server";
import * as webpush from "web-push";
import { createAnonServerClient } from "@/lib/supabase/anon";

/**
 * Disparador de Web Push. Chamado por agendador (pg_cron + pg_net no Supabase,
 * ou um cron gratuito externo) com `Authorization: Bearer <PUSH_DISPATCH_SECRET>`.
 * Autentica-se no banco pelo mesmo segredo (hash em clinic_settings) — sem service role.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.PUSH_DISPATCH_SECRET ?? "";
  const auth = request.headers.get("authorization") ?? "";
  if (secret.length < 32 || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "não autorizado" }, { status: 401 });
  }
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  const supabase = createAnonServerClient();
  if (!pub || !priv || !subject || !supabase) {
    return NextResponse.json({ error: "Web Push não configurado" }, { status: 503 });
  }
  webpush.setVapidDetails(subject, pub, priv);

  const { data, error } = await supabase.rpc("claim_push_batch", { p_secret: secret, p_limit: 200 });
  if (error) return NextResponse.json({ error: "falha ao reservar lote" }, { status: 500 });
  const rows = (data ?? []) as { endpoint: string; p256dh: string; auth: string; title: string; link: string | null }[];

  let sent = 0;
  let dropped = 0;
  await Promise.all(
    rows.map(async (r) => {
      try {
        await webpush.sendNotification(
          { endpoint: r.endpoint, keys: { p256dh: r.p256dh, auth: r.auth } },
          JSON.stringify({ title: r.title, link: r.link ?? "/portal" }),
          { TTL: 60 * 60 * 12 },
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabase.rpc("drop_push_subscription", { p_secret: secret, p_endpoint: r.endpoint });
          dropped++;
        }
      }
    }),
  );
  return NextResponse.json({ sent, dropped, total: rows.length });
}
