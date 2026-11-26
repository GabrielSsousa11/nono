import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoadingRows, StudioPageHeader } from "@/components/studio/page-header";
import { ActionForm, TextArea } from "@/components/ui/action-form";
import { Badge, Empty, NotAllowed } from "@/components/ui/empty";
import { staffReply } from "@/features/care/actions";
import { requireStaff } from "@/lib/auth/guards";
import { fmtDateTime } from "@/lib/datetime";

export const metadata: Metadata = { title: "Mensagens" };

async function Content() {
  const ctx = await requireStaff("messages.manage");
  if (!ctx) return <NotAllowed />;
  const { data } = await ctx.supabase.from("patient_messages").select("id, patient_id, from_staff, body, created_at, read_at, patients(full_name, social_name)").order("created_at", { ascending: false }).limit(300);
  const rows = (data ?? []) as unknown as { id: string; patient_id: string; from_staff: boolean; body: string; created_at: string; read_at: string | null; patients: { full_name: string; social_name: string | null } | null }[];
  const threads = new Map<string, typeof rows>();
  for (const r of rows) threads.set(r.patient_id, [...(threads.get(r.patient_id) ?? []), r]);
  if (threads.size === 0) return <Empty>Nenhuma mensagem de pacientes.</Empty>;
  return (
    <ul className="flex flex-col gap-10">
      {[...threads.entries()].map(([pid, msgs]) => {
        const unread = msgs.filter((m) => !m.from_staff && !m.read_at).length;
        const name = msgs[0].patients?.social_name || msgs[0].patients?.full_name;
        return (
          <li key={pid} className="flex flex-col gap-4 border-t border-onyx/10 pt-6">
            <p className="flex items-center gap-2"><Link href={`/studio/pacientes/${pid}`} className="font-semibold hover:underline">{name}</Link>{unread > 0 && <Badge tone="warn">{unread} não lida{unread > 1 ? "s" : ""}</Badge>}</p>
            <ol className="flex max-w-2xl flex-col gap-2">
              {[...msgs].reverse().slice(-6).map((m) => (
                <li key={m.id} className={`max-w-[85%] rounded-2xl px-4 py-2 text-sm ${m.from_staff ? "self-end bg-olive text-ivory" : "self-start bg-stone"}`}>
                  <span className="sr-only">{m.from_staff ? "Clínica:" : "Paciente:"}</span>{m.body}
                  <span className={`block text-xs ${m.from_staff ? "text-champagne" : "text-mist"}`}>{fmtDateTime(m.created_at)}</span>
                </li>
              ))}
            </ol>
            <ActionForm action={staffReply} hidden={{ patientId: pid }} submitLabel="Responder" resetOnSuccess className="max-w-2xl">
              <TextArea label="Resposta" name="body" required hint="Não faça diagnósticos por mensagem; oriente o agendamento quando necessário." />
            </ActionForm>
          </li>
        );
      })}
    </ul>
  );
}

export default function StaffMessagesPage() {
  return (
    <>
      <StudioPageHeader title="Mensagens" />
      <Suspense fallback={<LoadingRows />}><Content /></Suspense>
    </>
  );
}
