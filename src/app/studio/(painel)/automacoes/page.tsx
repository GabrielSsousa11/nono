import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingRows, StudioPageHeader } from "@/components/studio/page-header";
import { ActionForm, Checkbox, Input } from "@/components/ui/action-form";
import { Badge, Empty, NotAllowed, Section } from "@/components/ui/empty";
import { runNow, updateRule } from "@/features/automations/actions";
import { registerDispatchSecret } from "@/features/automations/push-actions";
import { can } from "@/lib/auth/access";
import { requireStaff } from "@/lib/auth/guards";
import { fmtDateTime } from "@/lib/datetime";

export const metadata: Metadata = { title: "Automações" };

const NUMBER_FIELD: Record<string, [string, string]> = {
  "appointment.confirmation": ["hours_before", "Horas antes da consulta"],
  "appointment.reminder": ["hours_before", "Horas antes da consulta"],
  "satisfaction.survey": ["hours_after", "Horas após o atendimento"],
  "finance.reminder": ["days_before", "Dias antes do vencimento"],
};
const JOB_TONE = { done: "good", failed: "bad", pending: "warn", running: "warn", skipped: "neutral" } as const;

async function Content() {
  const ctx = await requireStaff("automations.manage");
  if (!ctx) return <NotAllowed />;
  const [rules, jobs, counts] = await Promise.all([
    ctx.supabase
      .from("automation_rules")
      .select("key, title, description, enabled, config, requires_consent")
      .order("title"),
    ctx.supabase
      .from("automation_jobs")
      .select("id, rule_key, status, attempts, run_at, finished_at, last_error")
      .order("created_at", { ascending: false })
      .limit(25),
    ctx.supabase.from("automation_jobs").select("status"),
  ]);
  const byStatus = ((counts.data ?? []) as { status: string }[]).reduce<Record<string, number>>(
    (acc, j) => ({ ...acc, [j.status]: (acc[j.status] ?? 0) + 1 }),
    {},
  );
  const pushReady = Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.PUSH_DISPATCH_SECRET,
  );
  return (
    <div className="flex flex-col gap-12">
      <p className="max-w-3xl text-sm text-mist">
        As automações rodam a cada 15 minutos no banco (pg_cron) e geram avisos internos no portal. A fila evita
        duplicidade, tenta de novo em caso de falha e registra cada execução. Notificações no celular (Web Push) são um
        canal extra e gratuito. WhatsApp e e-mail ficam preparados como módulos opcionais.
      </p>
      <Section title="Fila">
        <div className="flex flex-wrap items-center gap-3">
          {Object.entries(byStatus).map(([s, n]) => (
            <Badge key={s} tone={JOB_TONE[s as keyof typeof JOB_TONE] ?? "neutral"}>
              {s}: {n}
            </Badge>
          ))}
          {Object.keys(byStatus).length === 0 && <span className="text-sm text-mist">Nenhuma execução ainda.</span>}
        </div>
        <ActionForm action={runNow} submitLabel="Executar agora" pendingLabel="Executando" variant="outline" />
        {(jobs.data ?? []).length === 0 ? (
          <Empty>Sem execuções recentes.</Empty>
        ) : (
          <ul className="flex flex-col text-sm">
            {(
              (jobs.data ?? []) as {
                id: number;
                rule_key: string;
                status: string;
                attempts: number;
                run_at: string;
                finished_at: string | null;
                last_error: string | null;
              }[]
            ).map((j) => (
              <li key={j.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-onyx/10 py-2">
                <span>
                  {j.rule_key}{" "}
                  <span className="text-mist">
                    — previsto {fmtDateTime(j.run_at)}
                    {j.finished_at && `, concluído ${fmtDateTime(j.finished_at)}`}, tentativas {j.attempts}
                  </span>
                  {j.last_error && <span className="block text-xs text-danger">{j.last_error}</span>}
                </span>
                <Badge tone={JOB_TONE[j.status as keyof typeof JOB_TONE] ?? "neutral"}>{j.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <Section title="Regras">
        <ul className="flex flex-col">
          {(
            (rules.data ?? []) as {
              key: string;
              title: string;
              description: string;
              enabled: boolean;
              config: Record<string, number>;
              requires_consent: string | null;
            }[]
          ).map((r) => {
            const nf = NUMBER_FIELD[r.key];
            return (
              <li key={r.key} className="border-b border-onyx/10 py-5">
                <ActionForm
                  action={updateRule}
                  hidden={{ key: r.key, numberKey: nf?.[0] ?? "" }}
                  submitLabel="Salvar"
                  variant="outline"
                >
                  <p className="font-semibold">
                    {r.title} {r.requires_consent && <Badge>Exige autorização do paciente</Badge>}
                  </p>
                  <p className="text-sm text-mist">{r.description}</p>
                  <div className="flex flex-wrap items-end gap-6">
                    <Checkbox label="Ativa" name="enabled" defaultChecked={r.enabled} />
                    {nf && (
                      <Input
                        label={nf[1]}
                        name="number"
                        type="number"
                        min={0}
                        max={720}
                        defaultValue={String(r.config?.[nf[0]] ?? "")}
                        className="max-w-48"
                      />
                    )}
                  </div>
                </ActionForm>
              </li>
            );
          })}
        </ul>
      </Section>
      <Section title="Notificações no celular (Web Push)">
        {pushReady ? (
          <>
            <p className="text-sm">Chaves VAPID e segredo do disparador configurados no servidor.</p>
            {can(ctx.access, "settings.manage") && (
              <ActionForm
                action={registerDispatchSecret}
                submitLabel="Autorizar disparador no banco"
                variant="outline"
              />
            )}
          </>
        ) : (
          <Empty>
            Para ativar, gere chaves VAPID gratuitas (`npx web-push generate-vapid-keys`) e defina
            NEXT_PUBLIC_VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT e PUSH_DISPATCH_SECRET na hospedagem. Ver
            docs/DEPLOY.md.
          </Empty>
        )}
      </Section>
    </div>
  );
}

export default function AutomationsPage() {
  return (
    <>
      <StudioPageHeader title="Automações" />
      <Suspense fallback={<LoadingRows />}>
        <Content />
      </Suspense>
    </>
  );
}
