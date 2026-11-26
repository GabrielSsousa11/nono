import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingRows, StudioPageHeader } from "@/components/studio/page-header";
import { ActionForm, Checkbox, Input, Select, TextArea } from "@/components/ui/action-form";
import { Badge, NotAllowed, Section } from "@/components/ui/empty";
import { saveSection } from "@/features/studio/content-actions";
import { requireStaff } from "@/lib/auth/guards";
import { loadSiteContent } from "@/lib/content/remote";
import { fmtDateTime } from "@/lib/datetime";

export const metadata: Metadata = { title: "Conteúdo do site" };

const REGIONS = [
  { value: "whole", label: "Boca como um todo" },
  { value: "enamel", label: "Esmalte" },
  { value: "crown", label: "Coroa" },
  { value: "gum", label: "Gengiva" },
  { value: "root", label: "Raiz" },
  { value: "arch", label: "Arcada" },
];

function Publish() {
  return (
    <div className="flex flex-col gap-2 border-l-2 border-gold pl-4">
      <Checkbox label="Publicar no site agora" name="publish" />
      <Checkbox
        label="Confirmo que estas informações foram verificadas com a clínica e são verdadeiras"
        name="verified"
      />
    </div>
  );
}

async function Content() {
  const ctx = await requireStaff("content.manage");
  if (!ctx) return <NotAllowed />;
  const [{ content: c }, { data: history }] = await Promise.all([
    loadSiteContent(),
    ctx.supabase
      .from("website_content")
      .select("section, version, published, created_at, verified_at")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);
  const form = (section: string, children: React.ReactNode) => (
    <ActionForm action={saveSection} hidden={{ section }} submitLabel="Salvar" className="max-w-3xl">
      {children}
      <Publish />
    </ActionForm>
  );
  const hoursText = c.hours
    .map((h) => `${Math.min(...h.days)}${h.days.length > 1 ? `-${Math.max(...h.days)}` : ""} ${h.opens}-${h.closes}`)
    .join("\n");
  const services = [...c.services, null];

  return (
    <div className="flex flex-col gap-14">
      <p className="max-w-3xl text-sm text-mist">
        Cada alteração cria uma nova versão. Só versões publicadas e marcadas como verificadas aparecem no site; o
        restante fica como rascunho. Nada aparece no site sem verificação — nunca preencha com suposições.
      </p>
      <Section title="Profissional">
        {form(
          "professional",
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Nome" name="name" required defaultValue={c.professional.name} />
            <Input label="CRO (ex.: CRO-SP 00000)" name="cro" defaultValue={c.professional.cro ?? ""} />
            <Input
              label="Cargo / formação"
              name="role"
              defaultValue={c.professional.role ?? ""}
              className="sm:col-span-2"
            />
            <TextArea
              label="Biografia"
              name="bio"
              rows={6}
              defaultValue={c.professional.bio.join("\n\n")}
              hint="Separe parágrafos com uma linha em branco."
              className="sm:col-span-2"
            />
            <Input
              label="Especialidades"
              name="specialties"
              defaultValue={c.professional.specialties.join(", ")}
              hint="Separe por vírgulas."
              className="sm:col-span-2"
            />
          </div>,
        )}
      </Section>
      <Section title="Contato">
        {form(
          "contact",
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Telefone" name="phone" defaultValue={c.contact.phone ?? ""} />
            <Input label="WhatsApp" name="whatsapp" defaultValue={c.contact.whatsapp ?? ""} />
            <Input label="E-mail" name="email" type="email" defaultValue={c.contact.email ?? ""} />
            <Input label="Instagram" name="instagram" defaultValue={c.contact.instagram ?? ""} />
          </div>,
        )}
      </Section>
      <Section title="Endereço">
        {form(
          "address",
          <div className="grid gap-4 sm:grid-cols-3">
            <Input
              label="Rua e número"
              name="street"
              defaultValue={c.address?.street ?? ""}
              className="sm:col-span-3"
            />
            <Input label="Bairro" name="district" defaultValue={c.address?.district ?? ""} />
            <Input label="Cidade" name="city" defaultValue={c.address?.city ?? ""} />
            <Input label="UF" name="state" maxLength={2} defaultValue={c.address?.state ?? ""} />
            <Input label="CEP" name="postalCode" defaultValue={c.address?.postalCode ?? ""} />
            <Input
              label="Link do mapa (https)"
              name="mapsUrl"
              defaultValue={c.address?.mapsUrl ?? ""}
              className="sm:col-span-2"
            />
          </div>,
        )}
      </Section>
      <Section title="Horário de atendimento">
        {form(
          "hours",
          <TextArea
            label="Horários"
            name="hours"
            rows={4}
            defaultValue={hoursText}
            hint='Uma linha por faixa: "1-5 08:00-18:00" (segunda a sexta), "6 08:00-12:00" (sábado). 0 = domingo.'
          />,
        )}
      </Section>
      <Section title="Tratamentos exibidos no site">
        {form(
          "services",
          <div className="flex flex-col gap-10">
            {services.map((s, i) => (
              <fieldset key={i} className="grid gap-4 border-t border-onyx/10 pt-5 sm:grid-cols-2">
                <legend className="text-sm font-semibold text-olive">{s ? s.name : "Novo tratamento"}</legend>
                <Input
                  label="Nome"
                  name={`s${i}_name`}
                  defaultValue={s?.name ?? ""}
                  hint={s ? "Apague o nome para remover." : undefined}
                />
                <Select
                  label="Região ilustrada"
                  name={`s${i}_region`}
                  defaultValue={s?.region ?? "whole"}
                  options={REGIONS}
                />
                <Input
                  label="Resumo"
                  name={`s${i}_summary`}
                  defaultValue={s?.summary ?? ""}
                  className="sm:col-span-2"
                />
                <TextArea
                  label="Explicação educativa (revisada pela dentista)"
                  name={`s${i}_explanation`}
                  defaultValue={s?.explanation ?? ""}
                  className="sm:col-span-2"
                />
                <TextArea
                  label="Etapas"
                  name={`s${i}_steps`}
                  defaultValue={s?.steps.map((st) => `${st.title}: ${st.description}`).join("\n") ?? ""}
                  hint='Uma por linha: "Título: descrição".'
                  className="sm:col-span-2"
                />
              </fieldset>
            ))}
          </div>,
        )}
      </Section>
      <Section title="Perguntas frequentes da clínica">
        {form(
          "clinic_faq",
          <div className="flex flex-col gap-6">
            {[...c.clinicFaq, null, null].map((f, i) => (
              <div key={i} className="grid gap-3 border-t border-onyx/10 pt-4">
                <Input label="Pergunta" name={`q${i}`} defaultValue={f?.question ?? ""} />
                <TextArea label="Resposta" name={`a${i}`} defaultValue={f?.answer ?? ""} />
              </div>
            ))}
          </div>,
        )}
      </Section>
      <Section title="Dados legais (LGPD)">
        {form(
          "legal",
          <div className="grid gap-4 sm:grid-cols-2">
            <Input label="Razão social" name="companyName" defaultValue={c.legal.companyName ?? ""} />
            <Input label="CNPJ" name="cnpj" inputMode="numeric" defaultValue={c.legal.cnpj ?? ""} />
            <Input
              label="Contato do encarregado (DPO)"
              name="dpoContact"
              defaultValue={c.legal.dpoContact ?? ""}
              className="sm:col-span-2"
            />
          </div>,
        )}
      </Section>
      <Section title="Histórico de versões">
        <ul className="flex flex-col text-sm">
          {((history ?? []) as { section: string; version: number; published: boolean; created_at: string }[]).map(
            (h) => (
              <li key={`${h.section}-${h.version}`} className="flex justify-between gap-3 border-b border-onyx/10 py-2">
                <span>
                  {h.section}, versão {h.version}, {fmtDateTime(h.created_at)}
                </span>
                {h.published ? <Badge tone="good">Publicada</Badge> : <Badge>Rascunho</Badge>}
              </li>
            ),
          )}
        </ul>
      </Section>
    </div>
  );
}

export default function ContentPage() {
  return (
    <>
      <StudioPageHeader title="Conteúdo do site" />
      <Suspense fallback={<LoadingRows />}>
        <Content />
      </Suspense>
    </>
  );
}
