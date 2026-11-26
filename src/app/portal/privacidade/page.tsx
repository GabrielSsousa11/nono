import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageShell } from "@/components/ui/page-shell";
import { ConsentToggle } from "@/features/portal/consent-toggle";
import { consentText, currentConsents, SELF_SERVICE_CONSENTS, type ConsentRow } from "@/features/portal/consents";
import { getSessionContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Meus dados e privacidade", robots: { index: false } };

const dateFmt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "long", timeZone: "America/Sao_Paulo" });

async function PrivacyContent() {
  const { supabase, user } = await getSessionContext();
  if (!supabase || !user) redirect("/entrar");

  const { data: patients, error } = await supabase
    .from("patients")
    .select("id, full_name, social_name, birth_date, profile_id")
    .is("archived_at", null)
    .order("full_name");
  if (error)
    return (
      <p role="alert" className="text-danger">
        Não foi possível carregar seus dados. Atualize a página.
      </p>
    );
  if (!patients?.length) {
    return (
      <p className="max-w-xl text-mist">
        Sua conta ainda não está vinculada a um cadastro de paciente. A clínica faz esse vínculo após o atendimento; se
        você já é paciente, fale com a recepção.
      </p>
    );
  }

  const ids = patients.map((p) => p.id);
  const [{ data: consents }, { data: guardians }] = await Promise.all([
    supabase.from("consents").select("patient_id, kind, granted, revoked_at, recorded_at").in("patient_id", ids),
    supabase
      .from("patient_guardians")
      .select("patient_id, guardian_name, relationship, revoked_at")
      .in("patient_id", ids)
      .is("revoked_at", null),
  ]);

  return (
    <div className="flex flex-col gap-16">
      {patients.map((p) => {
        const isSelf = p.profile_id === user.id;
        const state = currentConsents(
          ((consents ?? []) as (ConsentRow & { patient_id: string })[]).filter((c) => c.patient_id === p.id),
        );
        const myGuardians = (guardians ?? []).filter((g) => g.patient_id === p.id);
        return (
          <section key={p.id} aria-labelledby={`p-${p.id}`} className="flex flex-col gap-8">
            <div className="flex flex-col gap-1">
              <h2 id={`p-${p.id}`} className="font-display text-3xl">
                {p.social_name || p.full_name}
              </h2>
              <p className="text-sm text-mist">
                {isSelf ? "Seu cadastro" : "Dependente sob sua responsabilidade"}
                {p.birth_date && ` · nascimento em ${dateFmt.format(new Date(`${p.birth_date}T12:00:00`))}`}
              </p>
            </div>

            <div>
              <h3 className="mb-2 text-sm font-semibold text-olive">Autorizações</h3>
              <ul>
                {SELF_SERVICE_CONSENTS.map((kind) => (
                  <li key={kind} className="flex items-start justify-between gap-6 border-t border-onyx/10 py-5">
                    <div className="max-w-xl">
                      <p className="font-medium">{consentText[kind].title}</p>
                      <p className="text-sm text-mist">{consentText[kind].description}</p>
                      {state[kind].since && (
                        <p className="mt-1 text-xs text-mist">
                          Autorizado em {dateFmt.format(new Date(state[kind].since!))}
                        </p>
                      )}
                    </div>
                    <ConsentToggle
                      patientId={p.id}
                      kind={kind}
                      active={state[kind].active}
                      title={consentText[kind].title}
                    />
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-mist">
                Consentimento para tratamento e uso de imagem em divulgação exigem registro presencial com a dentista.
              </p>
            </div>

            {myGuardians.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-olive">Responsáveis com acesso</h3>
                <ul className="text-sm">
                  {myGuardians.map((g, i) => (
                    <li key={i} className="border-t border-onyx/10 py-3">
                      {g.guardian_name}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        );
      })}

      <section aria-labelledby="direitos-title" className="flex max-w-2xl flex-col gap-3 border-t border-gold/60 pt-8">
        <h2 id="direitos-title" className="font-display text-2xl">
          Seus direitos
        </h2>
        <p className="text-sm text-onyx/85">
          Você pode pedir acesso, correção, portabilidade ou eliminação de dados, conforme a LGPD. Informações do
          prontuário têm prazo legal mínimo de guarda.{" "}
          <Link href="/privacidade#direitos" className="underline decoration-gold underline-offset-4">
            Saiba como solicitar
          </Link>
          .
        </p>
      </section>
    </div>
  );
}

export default function PortalPrivacyPage() {
  return (
    <PageShell
      aside={
        <Link href="/portal" className="min-h-11 content-center text-sm text-olive hover:underline">
          Voltar ao portal
        </Link>
      }
    >
      <div className="flex flex-col gap-12">
        <div className="flex flex-col gap-4">
          <span className="gold-rule" aria-hidden />
          <h1 className="font-display text-[clamp(2.5rem,5vw,4rem)] leading-none">Meus dados e privacidade</h1>
        </div>
        <Suspense fallback={<p className="text-mist">Carregando…</p>}>
          <PrivacyContent />
        </Suspense>
      </div>
    </PageShell>
  );
}
