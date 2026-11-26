import type { Metadata } from "next";
import { Suspense } from "react";
import { NoPatientLinked, PortalHeading, PortalLoading } from "@/components/portal/portal-page";
import { ActionForm, TextArea } from "@/components/ui/action-form";
import { Empty } from "@/components/ui/empty";
import { sendMessage } from "@/features/portal/portal-actions";
import { requirePortal } from "@/lib/auth/guards";
import { fmtDateTime } from "@/lib/datetime";

export const metadata: Metadata = { title: "Mensagens" };

async function Content() {
  const portal = await requirePortal();
  if (!portal?.current) return <NoPatientLinked />;
  const pid = portal.current.id;
  const { data } = await portal.supabase.from("patient_messages").select("id, from_staff, body, created_at").eq("patient_id", pid).order("created_at");
  await portal.supabase.rpc("mark_messages_read", { p_patient: pid });
  const msgs = (data ?? []) as { id: string; from_staff: boolean; body: string; created_at: string }[];
  return (
    <div className="flex max-w-2xl flex-col gap-8">
      {msgs.length === 0 ? <Empty>Nenhuma mensagem ainda.</Empty> : (
        <ol className="flex flex-col gap-4" aria-label="Conversa com a clínica">
          {msgs.map((m) => (
            <li key={m.id} className={`flex max-w-[85%] flex-col gap-1 rounded-2xl px-4 py-3 ${m.from_staff ? "self-start bg-stone" : "self-end bg-olive text-ivory"}`}>
              <span className="sr-only">{m.from_staff ? "Clínica:" : "Você:"}</span>
              <p className="whitespace-pre-line">{m.body}</p>
              <span className={`text-xs ${m.from_staff ? "text-mist" : "text-champagne"}`}>{fmtDateTime(m.created_at)}</span>
            </li>
          ))}
        </ol>
      )}
      <ActionForm action={sendMessage} hidden={{ patientId: pid }} submitLabel="Enviar mensagem" pendingLabel="Enviando" resetOnSuccess>
        <TextArea label="Sua mensagem" name="body" required maxLength={2000} hint="Para dúvidas administrativas e sobre orientações. Em caso de dor intensa ou urgência, ligue para a clínica." />
      </ActionForm>
    </div>
  );
}

export default function MessagesPage() {
  return (
    <>
      <PortalHeading title="Mensagens" intro="Canal direto com a equipe da clínica." />
      <Suspense fallback={<PortalLoading />}><Content /></Suspense>
    </>
  );
}
