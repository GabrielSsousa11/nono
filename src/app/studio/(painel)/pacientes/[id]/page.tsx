import { Suspense } from "react";
import { LoadingRows } from "@/components/studio/page-header";
import { ActionForm, Checkbox, Input, Select } from "@/components/ui/action-form";
import { Badge, Empty, NotAllowed, Section } from "@/components/ui/empty";
import { addGuardian, invitePortalAccess, recordConsent, revokeGuardian, setPatientArchived, updatePatient } from "@/features/studio/patient-actions";
import { PatientForm, type PatientFormValues } from "@/features/studio/patient-form";
import { CONSENT_KINDS, LEGAL_BASIS, RELATIONSHIPS, isMinor } from "@/features/studio/patient-schema";
import { appointmentStatusLabel } from "@/features/agenda/labels";
import { can } from "@/lib/auth/access";
import { requireStaff } from "@/lib/auth/guards";
import { fmtDateTime, fmtPlainDate } from "@/lib/datetime";

interface Guardian { id: string; guardian_name: string; guardian_email: string | null; relationship: string; legal_basis: string; can_view_clinical: boolean; can_schedule: boolean; guardian_profile_id: string | null; revoked_at: string | null; revoke_reason: string | null; valid_until: string | null }
interface Consent { id: string; kind: string; version: string; granted: boolean; method: string; recorded_at: string; revoked_at: string | null }
interface Appt { id: string; starts_at: string; status: string; services: { name: string } | null; professionals: { display_name: string } | null }

const label = (list: readonly { value: string; label: string }[], v: string) => list.find((x) => x.value === v)?.label ?? v;

async function Content({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStaff("patients.read");
  if (!ctx) return <NotAllowed />;
  const canWrite = can(ctx.access, "patients.write");
  const [p, pros, g, c, a] = await Promise.all([
    ctx.supabase.from("patients").select("id, full_name, social_name, birth_date, cpf, phone, email, responsible_professional_id, admin_notes, archived_at, profile_id").eq("id", id).maybeSingle(),
    ctx.supabase.from("professionals").select("id, display_name").eq("active", true),
    ctx.supabase.from("patient_guardians").select("id, guardian_name, guardian_email, relationship, legal_basis, can_view_clinical, can_schedule, guardian_profile_id, revoked_at, revoke_reason, valid_until").eq("patient_id", id).order("created_at"),
    can(ctx.access, "consents.read") ? ctx.supabase.from("consents").select("id, kind, version, granted, method, recorded_at, revoked_at").eq("patient_id", id).order("recorded_at", { ascending: false }) : Promise.resolve({ data: [] }),
    can(ctx.access, "agenda.read") ? ctx.supabase.from("appointments").select("id, starts_at, status, services(name), professionals(display_name)").eq("patient_id", id).order("starts_at", { ascending: false }).limit(50) : Promise.resolve({ data: [] }),
  ]);
  if (!p.data) return <Empty>Paciente não encontrado.</Empty>;
  const patient = p.data as PatientFormValues & { archived_at: string | null; profile_id: string | null; email: string | null };
  const guardians = (g.data ?? []) as Guardian[];
  const consents = (c.data ?? []) as Consent[];
  const appts = (a.data ?? []) as unknown as Appt[];
  const noShows = appts.filter((x) => x.status === "no_show").length;
  const minor = isMinor(patient.birth_date ?? null);

  return (
    <div className="flex flex-col gap-14">
      <Section title="Consultas" aside={noShows > 0 ? <Badge tone="bad">{noShows} {noShows === 1 ? "falta" : "faltas"}</Badge> : undefined}>
        {appts.length === 0 ? <Empty>Nenhuma consulta registrada.</Empty> : (
          <ul className="flex flex-col text-sm">
            {appts.map((x) => (
              <li key={x.id} className="flex flex-wrap justify-between gap-3 border-b border-onyx/10 py-3">
                <span>{fmtDateTime(x.starts_at)}, {x.services?.name}, {x.professionals?.display_name}</span>
                <Badge tone={x.status === "no_show" || x.status === "cancelled" ? "bad" : x.status === "completed" ? "good" : "neutral"}>{appointmentStatusLabel[x.status] ?? x.status}</Badge>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Cadastro">
        {canWrite ? (
          <PatientForm action={updatePatient} values={patient} professionals={(pros.data ?? []) as { id: string; display_name: string }[]} submitLabel="Salvar cadastro" />
        ) : (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-mist">Nascimento</dt><dd>{patient.birth_date ? fmtPlainDate(patient.birth_date) : "—"}</dd></div>
            <div><dt className="text-mist">Telefone</dt><dd>{patient.phone ?? "—"}</dd></div>
            <div><dt className="text-mist">E-mail</dt><dd>{patient.email ?? "—"}</dd></div>
          </dl>
        )}
        {canWrite && (
          <ActionForm
            action={setPatientArchived}
            hidden={{ id, archived: String(!patient.archived_at) }}
            variant="ghost"
            submitLabel={patient.archived_at ? "Reativar cadastro" : "Arquivar cadastro"}
            confirm={patient.archived_at ? undefined : "Arquivar este cadastro? O histórico continua guardado pelo prazo legal."}
          />
        )}
      </Section>

      <Section title="Acesso ao portal">
        {patient.profile_id ? (
          <p className="text-sm">O paciente já tem acesso ao portal.</p>
        ) : minor ? (
          <p className="text-sm text-mist">Paciente menor de idade: o acompanhamento pelo portal é feito pelos responsáveis abaixo.</p>
        ) : can(ctx.access, "patients.invite") ? (
          <ActionForm action={invitePortalAccess} hidden={{ patientId: id }} submitLabel="Enviar convite" pendingLabel="Enviando" className="max-w-xl">
            <Input label="E-mail para o convite" name="email" type="email" required defaultValue={patient.email ?? ""} />
          </ActionForm>
        ) : <Empty>Sem permissão para convidar.</Empty>}
      </Section>

      <Section title="Responsáveis legais e autorizados">
        {guardians.length === 0 ? <Empty>{minor ? "Paciente menor de idade sem responsável registrado." : "Nenhum responsável registrado."}</Empty> : (
          <ul className="flex flex-col">
            {guardians.map((gu) => (
              <li key={gu.id} className="flex flex-col gap-3 border-b border-onyx/10 py-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{gu.guardian_name}</span>
                  <span className="text-sm text-mist">{label(RELATIONSHIPS, gu.relationship)}, {label(LEGAL_BASIS, gu.legal_basis)}</span>
                  {gu.revoked_at ? <Badge tone="bad">Revogado</Badge> : <Badge tone="good">Ativo</Badge>}
                  {gu.can_view_clinical && <Badge>Vê dados clínicos</Badge>}
                  {gu.guardian_profile_id && <Badge>Portal ativo</Badge>}
                </div>
                {gu.revoked_at && <p className="text-xs text-mist">Revogado: {gu.revoke_reason}</p>}
                {!gu.revoked_at && (
                  <div className="flex flex-wrap gap-8">
                    {!gu.guardian_profile_id && can(ctx.access, "patients.invite") && (
                      <ActionForm action={invitePortalAccess} hidden={{ patientId: id, guardianLinkId: gu.id }} submitLabel="Convidar ao portal" variant="outline" className="max-w-sm">
                        <Input label="E-mail do responsável" name="email" type="email" required defaultValue={gu.guardian_email ?? ""} />
                      </ActionForm>
                    )}
                    {can(ctx.access, "guardians.manage") && (
                      <ActionForm action={revokeGuardian} hidden={{ id: gu.id, patientId: id }} submitLabel="Revogar acesso" variant="outline" className="max-w-sm" confirm="Revogar o acesso deste responsável?">
                        <Input label="Motivo da revogação" name="reason" required />
                      </ActionForm>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {can(ctx.access, "guardians.manage") && (
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-olive">Registrar responsável</summary>
            <ActionForm action={addGuardian} hidden={{ patientId: id }} submitLabel="Registrar responsável" resetOnSuccess className="mt-6 max-w-3xl">
              <div className="grid gap-5 sm:grid-cols-2">
                <Input label="Nome do responsável" name="guardianName" required />
                <Input label="E-mail" name="guardianEmail" type="email" />
                <Select label="Relação" name="relationship" options={[...RELATIONSHIPS]} />
                <Select label="Base legal" name="legalBasis" options={[...LEGAL_BASIS]} />
                <Input label="Documento comprobatório" name="evidenceNote" hint="Ex.: certidão de nascimento conferida em 26/11/2026." className="sm:col-span-2" />
                <Input label="Válido até" name="validUntil" type="date" hint="Opcional. Ex.: data em que o paciente completa 18 anos." />
                <div className="flex flex-col gap-3 pt-6">
                  <Checkbox label="Pode agendar e remarcar consultas" name="canSchedule" defaultChecked />
                  <Checkbox label="Pode ver informações clínicas liberadas" name="canViewClinical" />
                </div>
              </div>
            </ActionForm>
          </details>
        )}
      </Section>

      {can(ctx.access, "consents.read") && (
        <Section title="Consentimentos">
          {consents.length === 0 ? <Empty>Nenhum consentimento registrado.</Empty> : (
            <ul className="flex flex-col text-sm">
              {consents.map((co) => (
                <li key={co.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-onyx/10 py-3">
                  <span>{label(CONSENT_KINDS, co.kind)}, versão {co.version}, {co.method === "portal" ? "pelo portal" : co.method === "in_person" ? "presencial" : "documento assinado"}, {fmtDateTime(co.recorded_at)}</span>
                  {co.revoked_at ? <Badge>Revogado em {fmtDateTime(co.revoked_at)}</Badge> : co.granted ? <Badge tone="good">Concedido</Badge> : <Badge tone="bad">Negado</Badge>}
                </li>
              ))}
            </ul>
          )}
          {can(ctx.access, "consents.write") && (
            <ActionForm action={recordConsent} hidden={{ patientId: id }} submitLabel="Registrar consentimento" className="max-w-3xl">
              <div className="grid gap-5 sm:grid-cols-4">
                <Select label="Tipo" name="kind" options={[...CONSENT_KINDS]} className="sm:col-span-2" />
                <Input label="Versão do termo" name="version" required placeholder="termo-2026-11" />
                <Select label="Decisão" name="granted" options={[{ value: "true", label: "Concedido" }, { value: "false", label: "Negado" }]} />
                <Select label="Forma" name="method" options={[{ value: "signed_document", label: "Documento assinado" }, { value: "in_person", label: "Presencial" }]} className="sm:col-span-2" />
              </div>
            </ActionForm>
          )}
        </Section>
      )}
    </div>
  );
}

export default function PatientPage({ params }: PageProps<"/studio/pacientes/[id]">) {
  return (
    <Suspense fallback={<LoadingRows />}>
      <Content params={params} />
    </Suspense>
  );
}
