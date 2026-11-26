import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingRows, StudioPageHeader } from "@/components/studio/page-header";
import { ActionForm, Checkbox, Input, Select, TextArea } from "@/components/ui/action-form";
import { Badge, Empty, NotAllowed, Section } from "@/components/ui/empty";
import { saveProtocol } from "@/features/care/actions";
import { requireStaff } from "@/lib/auth/guards";
import { fmtDateTime } from "@/lib/datetime";

export const metadata: Metadata = { title: "Protocolos de cuidado" };
const KINDS = [
  { value: "post_op", label: "Pós-operatório" },
  { value: "orthodontic", label: "Manutenção ortodôntica" },
  { value: "appliance", label: "Cuidados com aparelho" },
  { value: "hygiene", label: "Higiene" },
  { value: "return", label: "Retorno" },
];

async function Content() {
  const ctx = await requireStaff("care.manage");
  if (!ctx) return <NotAllowed />;
  const isDentist = ctx.access.roles.includes("dentist");
  const { data } = await ctx.supabase
    .from("care_protocols")
    .select("id, kind, title, body, default_interval_days, approved_at, active, profiles:approved_by(full_name)")
    .order("title");
  const list = (data ?? []) as unknown as {
    id: string;
    kind: string;
    title: string;
    body: string;
    default_interval_days: number | null;
    approved_at: string | null;
    profiles: { full_name: string } | null;
  }[];
  const form = (p?: (typeof list)[number]) => (
    <ActionForm
      action={saveProtocol}
      hidden={{ id: p?.id ?? "" }}
      submitLabel={p ? "Salvar alterações" : "Criar protocolo"}
      resetOnSuccess={!p}
      className="max-w-3xl"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Select label="Tipo" name="kind" options={KINDS} defaultValue={p?.kind} />
        <Input
          label="Repetir a cada (dias)"
          name="interval"
          type="number"
          min={1}
          max={730}
          defaultValue={p?.default_interval_days ?? ""}
          hint="Opcional. Ex.: 30 para manutenção mensal."
        />
        <Input label="Título" name="title" required defaultValue={p?.title} className="sm:col-span-2" />
        <TextArea
          label="Orientação ao paciente"
          name="body"
          required
          rows={6}
          defaultValue={p?.body}
          className="sm:col-span-2"
        />
        {isDentist && <Checkbox label="Aprovo esta orientação como dentista responsável" name="approve" />}
      </div>
    </ActionForm>
  );
  return (
    <div className="flex flex-col gap-12">
      <p className="max-w-2xl text-sm text-mist">
        Somente protocolos aprovados por uma dentista podem ser enviados aos pacientes. Alterar o texto de um protocolo
        aprovado exige nova aprovação.
      </p>
      <Section title="Protocolos">
        {list.length === 0 && <Empty>Nenhum protocolo cadastrado.</Empty>}
        <ul className="flex flex-col">
          {list.map((p) => (
            <li key={p.id} className="flex flex-col gap-2 border-b border-onyx/10 py-5">
              <p className="flex flex-wrap items-center gap-2 font-semibold">
                {p.title} <Badge>{KINDS.find((k) => k.value === p.kind)?.label}</Badge>
                {p.approved_at ? (
                  <Badge tone="good">
                    Aprovado por {p.profiles?.full_name ?? "dentista"} em {fmtDateTime(p.approved_at)}
                  </Badge>
                ) : (
                  <Badge tone="warn">Aguardando aprovação</Badge>
                )}
              </p>
              <p className="max-w-3xl text-sm whitespace-pre-line text-onyx/85">{p.body}</p>
              <details>
                <summary className="cursor-pointer text-sm text-olive">Editar</summary>
                <div className="mt-4">{form(p)}</div>
              </details>
            </li>
          ))}
        </ul>
      </Section>
      <Section title="Novo protocolo">{form()}</Section>
    </div>
  );
}

export default function CareProtocolsPage() {
  return (
    <>
      <StudioPageHeader title="Protocolos de cuidado" />
      <Suspense fallback={<LoadingRows />}>
        <Content />
      </Suspense>
    </>
  );
}
