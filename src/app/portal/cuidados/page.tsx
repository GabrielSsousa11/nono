import type { Metadata } from "next";
import { Suspense } from "react";
import { NoPatientLinked, PortalHeading, PortalLoading } from "@/components/portal/portal-page";
import { ActionForm } from "@/components/ui/action-form";
import { Badge, Empty } from "@/components/ui/empty";
import { acknowledgeCare } from "@/features/care/actions";
import { requirePortal } from "@/lib/auth/guards";
import { fmtDateTime, fmtPlainDate } from "@/lib/datetime";

export const metadata: Metadata = { title: "Cuidados" };
const KIND: Record<string, string> = {
  post_op: "Pós-operatório",
  orthodontic: "Manutenção ortodôntica",
  appliance: "Cuidados com aparelho",
  hygiene: "Higiene",
  return: "Retorno",
};

async function Content() {
  const portal = await requirePortal();
  if (!portal?.current) return <NoPatientLinked />;
  const { data } = await portal.supabase
    .from("care_reminders")
    .select(
      "id, personal_note, interval_days, next_due_on, acknowledged_at, active, created_at, care_protocols(kind, title, body)",
    )
    .eq("patient_id", portal.current.id)
    .order("created_at", { ascending: false });
  const list = (data ?? []) as unknown as {
    id: string;
    personal_note: string | null;
    interval_days: number | null;
    next_due_on: string | null;
    acknowledged_at: string | null;
    active: boolean;
    created_at: string;
    care_protocols: { kind: string; title: string; body: string } | null;
  }[];
  if (list.length === 0)
    return <Empty>Quando a dentista enviar orientações de cuidado ou lembretes de retorno, eles aparecem aqui.</Empty>;
  return (
    <ul className="flex flex-col gap-10">
      {list.map((r) => (
        <li
          key={r.id}
          className={`flex flex-col gap-3 border-t pt-6 ${r.active ? "border-gold/60" : "border-onyx/10 opacity-70"}`}
        >
          <p className="flex flex-wrap items-center gap-2">
            <Badge>{KIND[r.care_protocols?.kind ?? ""] ?? "Cuidado"}</Badge>
            {!r.active && <Badge>Encerrado</Badge>}
          </p>
          <h2 className="font-display text-3xl">{r.care_protocols?.title}</h2>
          <p className="max-w-2xl whitespace-pre-line text-onyx/85">{r.care_protocols?.body}</p>
          {r.personal_note && (
            <p className="max-w-2xl border-l-2 border-gold pl-3 text-sm">
              <strong>Para você:</strong> {r.personal_note}
            </p>
          )}
          {r.next_due_on && r.active && (
            <p className="text-sm">
              Próximo lembrete: {fmtPlainDate(r.next_due_on)}
              {r.interval_days && `, a cada ${r.interval_days} dias`}
            </p>
          )}
          {r.acknowledged_at ? (
            <p className="text-xs text-mist">Leitura confirmada em {fmtDateTime(r.acknowledged_at)}.</p>
          ) : (
            <ActionForm action={acknowledgeCare} hidden={{ id: r.id }} submitLabel="Li e entendi" />
          )}
        </li>
      ))}
    </ul>
  );
}

export default function CarePage() {
  return (
    <>
      <PortalHeading
        title="CG Care"
        intro="Orientações aprovadas pela sua dentista e lembretes de manutenção e retorno."
      />
      <Suspense fallback={<PortalLoading />}>
        <Content />
      </Suspense>
    </>
  );
}
