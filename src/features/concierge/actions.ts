"use server";

import { z } from "zod";
import { requirePortal } from "@/lib/auth/guards";
import { getSessionContext } from "@/lib/auth/session";
import { loadSiteContent } from "@/lib/content/remote";
import { formatHours } from "@/lib/content/format";
import { addDays, fmtDateLong, fmtTime, localDate } from "@/lib/datetime";
import { headers } from "next/headers";
import { createRateLimiter, hashIdentifier } from "@/lib/rate-limit";
import { answer, type ConciergeContext, type ConciergeReply } from "./engine";

const limiter = createRateLimiter({ limit: 30, windowMs: 5 * 60 * 1000 });

async function buildContext(): Promise<ConciergeContext> {
  const { content } = await loadSiteContent();
  const a = content.address;
  const ctx: ConciergeContext = {
    clinicName: content.clinicName,
    authenticated: false,
    hours: content.hours.map(formatHours),
    address: a ? `${a.street}, ${a.district}, ${a.city} – ${a.state}` : null,
    phone: content.contact.phone,
    whatsapp: content.contact.whatsapp,
    email: content.contact.email,
    services: content.services.map((s) => ({ name: s.name, summary: s.summary })),
    faq: content.clinicFaq,
  };
  const session = await getSessionContext();
  if (!session.user || !session.supabase) return ctx;
  ctx.authenticated = true;
  const portal = await requirePortal();
  if (!portal?.current) return ctx;
  const pid = portal.current.id;
  const [{ data: next }, { data: svc }] = await Promise.all([
    portal.supabase
      .from("appointments")
      .select("starts_at, services(name), professionals(display_name)")
      .eq("patient_id", pid)
      .in("status", ["scheduled", "confirmed"])
      .gte("starts_at", new Date().toISOString())
      .order("starts_at")
      .limit(1)
      .maybeSingle(),
    portal.supabase
      .from("services")
      .select("id, name, description, professional_services(professional_id)")
      .eq("active", true)
      .eq("self_booking", true)
      .limit(3),
  ]);
  const n = next as unknown as {
    starts_at: string;
    services: { name: string } | null;
    professionals: { display_name: string } | null;
  } | null;
  ctx.nextAppointment = n
    ? {
        when: `${fmtDateLong(n.starts_at)}, ${fmtTime(n.starts_at)}`,
        service: n.services?.name ?? "",
        professional: n.professionals?.display_name ?? "",
      }
    : null;
  const services = (svc ?? []) as unknown as {
    id: string;
    name: string;
    professional_services: { professional_id: string }[];
  }[];
  if (services.length && !ctx.services.length) ctx.services = services.map((s) => ({ name: s.name }));
  const slots: { service: string; when: string }[] = [];
  const today = localDate(new Date());
  for (const s of services) {
    const pro = s.professional_services[0]?.professional_id;
    if (!pro) continue;
    for (let d = 0; d < 7 && slots.length < 4; d++) {
      const { data } = await portal.supabase.rpc("available_slots", {
        p_professional: pro,
        p_service: s.id,
        p_day: addDays(today, d),
      });
      const first = ((data ?? []) as { starts_at: string }[])[0];
      if (first) slots.push({ service: s.name, when: `${fmtDateLong(first.starts_at)}, ${fmtTime(first.starts_at)}` });
    }
  }
  ctx.openSlots = slots;
  return ctx;
}

export async function askConcierge(question: string): Promise<ConciergeReply> {
  const q = z.string().trim().min(1).max(500).safeParse(question);
  if (!q.success) return { intent: "empty", text: "Escreva sua dúvida em até 500 caracteres.", actions: [] };
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!limiter(await hashIdentifier(`concierge|${ip}`)).allowed)
    return { intent: "rate_limited", text: "Muitas perguntas em sequência. Aguarde um instante.", actions: [] };
  return answer(q.data, await buildContext());
}

/** Encaminha a pergunta à equipe (somente com login) como mensagem do portal. */
export async function conciergeHandoff(question: string): Promise<{ ok: boolean; message: string }> {
  const q = z.string().trim().min(2).max(500).safeParse(question);
  if (!q.success) return { ok: false, message: "Pergunta inválida." };
  const portal = await requirePortal();
  if (!portal?.current) return { ok: false, message: "Entre na área do paciente para enviar à equipe." };
  const { error } = await portal.supabase.rpc("send_patient_message", {
    p_patient: portal.current.id,
    p_body: q.data,
    p_topic: "recepção digital",
  });
  return error
    ? { ok: false, message: "Não foi possível encaminhar agora." }
    : { ok: true, message: "Pergunta enviada à equipe. A resposta chega em Mensagens." };
}
