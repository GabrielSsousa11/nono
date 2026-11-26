import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoadingRows, StudioPageHeader } from "@/components/studio/page-header";
import { ActionForm, Input, Select } from "@/components/ui/action-form";
import { Badge, Empty, NotAllowed, Section } from "@/components/ui/empty";
import { acceptWaitlistOffer, joinWaitingList, leaveWaitingList } from "@/features/agenda/actions";
import { periodOptions, waitlistStatusLabel } from "@/features/agenda/labels";
import { PatientPicker } from "@/features/agenda/patient-picker";
import { requireStaff } from "@/lib/auth/guards";
import { fmtDateTime, fmtPlainDate } from "@/lib/datetime";

export const metadata: Metadata = { title: "Lista de espera" };

interface Entry {
  id: string; patient_id: string; status: string; preferred_period: string; earliest_date: string; latest_date: string | null; notes: string | null; offer_starts_at: string | null; offer_expires_at: string | null; created_at: string;
  patients: { full_name: string; social_name: string | null } | null; services: { name: string } | null; professionals: { display_name: string } | null;
}

async function Content() {
  const ctx = await requireStaff("waitlist.manage");
  if (!ctx) return <NotAllowed />;
  const [w, s, p, settings] = await Promise.all([
    ctx.supabase.from("waiting_list").select("id, patient_id, status, preferred_period, earliest_date, latest_date, notes, offer_starts_at, offer_expires_at, created_at, patients(full_name, social_name), services(name), professionals!waiting_list_professional_id_fkey(display_name)").in("status", ["waiting", "offered"]).order("priority", { ascending: false }).order("created_at"),
    ctx.supabase.from("services").select("id, name").eq("active", true).order("name"),
    ctx.supabase.from("professionals").select("id, display_name").eq("active", true).order("display_name"),
    ctx.supabase.from("clinic_settings").select("key, value").like("key", "waitlist.%"),
  ]);
  const entries = (w.data ?? []) as unknown as Entry[];
  const cfg = Object.fromEntries(((settings.data ?? []) as { key: string; value: unknown }[]).map((r) => [r.key, r.value]));
  const period = (v: string) => periodOptions.find((o) => o.value === v)?.label ?? v;

  return (
    <div className="flex flex-col gap-12">
      <p className="max-w-2xl text-sm text-mist">
        Quando uma consulta é cancelada ou remarcada, a vaga é oferecida {cfg["waitlist.auto_offer"] === false ? "manualmente" : "automaticamente"} às{" "}
        {String(cfg["waitlist.max_offers"] ?? 3)} primeiras pessoas compatíveis (serviço, profissional, período e datas). A oferta vale {String(cfg["waitlist.offer_hours"] ?? 12)} horas e o primeiro a aceitar fica com a vaga.{" "}
        <Link href="/studio/configuracoes" className="text-olive underline underline-offset-4">Ajustar regras</Link>
      </p>
      <Section title={`Aguardando (${entries.length})`}>
        {entries.length === 0 ? <Empty>Ninguém na lista de espera.</Empty> : (
          <ol className="flex flex-col">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-start justify-between gap-4 border-b border-onyx/10 py-4">
                <div className="flex flex-col gap-1">
                  <p><Link href={`/studio/pacientes/${e.patient_id}`} className="font-semibold hover:underline">{e.patients?.social_name || e.patients?.full_name}</Link> <Badge tone={e.status === "offered" ? "warn" : "neutral"}>{waitlistStatusLabel[e.status]}</Badge></p>
                  <p className="text-sm text-mist">{e.services?.name}{e.professionals ? `, com ${e.professionals.display_name}` : ""}, {period(e.preferred_period)}, a partir de {fmtPlainDate(e.earliest_date)}{e.latest_date ? ` até ${fmtPlainDate(e.latest_date)}` : ""}</p>
                  {e.offer_starts_at && <p className="text-sm">Vaga oferecida: {fmtDateTime(e.offer_starts_at)}, expira {fmtDateTime(e.offer_expires_at!)}</p>}
                  {e.notes && <p className="text-sm">{e.notes}</p>}
                </div>
                <div className="flex gap-4">
                  {e.status === "offered" && <ActionForm action={acceptWaitlistOffer} hidden={{ id: e.id }} variant="ghost" submitLabel="Confirmar vaga pelo paciente" />}
                  <ActionForm action={leaveWaitingList} hidden={{ id: e.id }} variant="ghost" submitLabel="Remover" />
                </div>
              </li>
            ))}
          </ol>
        )}
      </Section>
      <Section title="Incluir na lista">
        <ActionForm action={joinWaitingList} submitLabel="Incluir" resetOnSuccess className="max-w-3xl">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2"><PatientPicker /></div>
            <Select label="Serviço" name="serviceId" options={((s.data ?? []) as { id: string; name: string }[]).map((x) => ({ value: x.id, label: x.name }))} />
            <Select label="Profissional" name="professionalId" options={[{ value: "", label: "Qualquer profissional" }, ...((p.data ?? []) as { id: string; display_name: string }[]).map((x) => ({ value: x.id, label: x.display_name }))]} />
            <Select label="Período" name="period" options={periodOptions} />
            <Input label="Aceita até" name="latest" type="date" />
            <Input label="Observação" name="notes" className="sm:col-span-2" />
          </div>
        </ActionForm>
      </Section>
    </div>
  );
}

export default function WaitlistPage() {
  return (
    <>
      <StudioPageHeader title="Lista de espera" />
      <Suspense fallback={<LoadingRows />}>
        <Content />
      </Suspense>
    </>
  );
}
