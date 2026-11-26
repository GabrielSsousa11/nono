import type { Metadata } from "next";
import { Suspense } from "react";
import { NoPatientLinked, PortalHeading, PortalLoading } from "@/components/portal/portal-page";
import { ActionForm, TextArea } from "@/components/ui/action-form";
import { Empty } from "@/components/ui/empty";
import { answerSurvey } from "@/features/finance/actions";
import { requirePortal } from "@/lib/auth/guards";
import { fmtDateLong } from "@/lib/datetime";

export const metadata: Metadata = { title: "Avaliação" };

async function Content() {
  const portal = await requirePortal();
  if (!portal?.current) return <NoPatientLinked />;
  const { data } = await portal.supabase
    .from("satisfaction_surveys")
    .select("id, appointments(starts_at, services(name))")
    .eq("patient_id", portal.current.id)
    .is("answered_at", null)
    .order("sent_at", { ascending: false });
  const list = (data ?? []) as unknown as {
    id: string;
    appointments: { starts_at: string; services: { name: string } | null } | null;
  }[];
  if (list.length === 0) return <Empty>Nenhuma avaliação pendente. Obrigado!</Empty>;
  return (
    <div className="flex flex-col gap-12">
      {list.map((s) => (
        <ActionForm
          key={s.id}
          action={answerSurvey}
          hidden={{ id: s.id }}
          submitLabel="Enviar avaliação"
          className="max-w-2xl"
        >
          <p className="font-display text-2xl first-letter:uppercase">
            {s.appointments && fmtDateLong(s.appointments.starts_at)}
            {s.appointments?.services && `, ${s.appointments.services.name}`}
          </p>
          <fieldset>
            <legend className="mb-3 text-sm font-medium text-olive">
              De 0 a 10, quanto você recomendaria a clínica a alguém próximo?
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {Array.from({ length: 11 }, (_, n) => (
                <label key={n} className="cursor-pointer">
                  <input type="radio" name="score" value={n} required className="peer sr-only" />
                  <span className="grid size-10 place-items-center rounded-full border border-onyx/20 text-sm peer-checked:border-olive peer-checked:bg-olive peer-checked:text-ivory peer-focus-visible:outline-2 peer-focus-visible:outline-gold-ink">
                    {n}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <TextArea label="Comentário" name="comment" hint="Opcional. Não inclua informações de saúde." />
        </ActionForm>
      ))}
    </div>
  );
}

export default function SurveyPage() {
  return (
    <>
      <PortalHeading title="Sua avaliação" />
      <Suspense fallback={<PortalLoading />}>
        <Content />
      </Suspense>
    </>
  );
}
