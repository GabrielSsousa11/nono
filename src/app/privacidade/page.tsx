import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageShell } from "@/components/ui/page-shell";
import { PRIVACY_POLICY_VERSION } from "@/features/booking/schema";
import { loadSiteContent } from "@/lib/content/remote";

export const metadata: Metadata = {
  title: "Política de privacidade",
  description: "Como a clínica trata dados pessoais, conforme a LGPD.",
};

function Section({ id, title, children }: { id?: string; title: string; children: ReactNode }) {
  return (
    <section id={id} className="flex flex-col gap-4 border-t border-onyx/10 pt-10">
      <h2 className="font-display text-[1.9rem] leading-tight">{title}</h2>
      <div className="flex flex-col gap-4 text-onyx/85">{children}</div>
    </section>
  );
}

const PENDING = "a ser informado pela clínica";

/**
 * Política descreve SOMENTE o que a plataforma faz de fato nesta versão.
 * Deve ser revisada por profissional jurídico antes da publicação (ver docs/SECURITY_LGPD.md).
 */
export default async function PrivacyPage() {
  const { content } = await loadSiteContent();
  const { legal, contact } = content;

  return (
    <PageShell>
      <article className="mx-auto flex max-w-[46rem] flex-col gap-10">
        <header className="flex flex-col gap-5">
          <span className="gold-rule" aria-hidden />
          <h1 className="font-display text-[clamp(2.75rem,5vw,4.25rem)] leading-none tracking-[-0.02em]">
            Política de privacidade
          </h1>
          <p className="border-l-2 border-gold pl-4 text-sm text-mist">
            Versão preliminar ({PRIVACY_POLICY_VERSION}), sujeita a revisão jurídica antes da publicação definitiva.
          </p>
        </header>

        <Section title="Quem trata seus dados">
          <p>
            Controlador: {legal.companyName ?? content.clinicName}
            {legal.cnpj ? `, CNPJ ${legal.cnpj}` : ""}. Encarregado pelo tratamento de dados (DPO):{" "}
            {legal.dpoContact ?? PENDING}.
          </p>
        </Section>

        <Section title="Pedido de agendamento pelo site">
          <p>
            Coletamos nome, telefone, e-mail (opcional), motivo da consulta (opcional), período de preferência e
            mensagem (opcional), com a única finalidade de entrar em contato para agendar seu atendimento.
          </p>
          <p>
            Base legal: seu consentimento e procedimentos preliminares relacionados a contrato a pedido do titular
            (LGPD, art. 7º, I e V). Pedidos que não resultarem em agendamento são excluídos automaticamente após 12
            meses. Pedimos que você não envie informações de saúde por esse formulário.
          </p>
        </Section>

        <Section title="Área do paciente">
          <p>
            Pacientes cadastrados pela clínica acessam o portal com um link enviado ao e-mail cadastrado. Dados de saúde
            são dados pessoais sensíveis e são tratados para a tutela da saúde, por profissionais de saúde (LGPD, art.
            11, II, “f”), e para cumprimento de obrigações legais de guarda do prontuário.
          </p>
          <p>
            O acesso é restrito por função: recepção e setor financeiro não têm acesso irrestrito ao prontuário clínico.
            Acessos a informações clínicas são registrados em trilha de auditoria.
          </p>
        </Section>

        <Section title="Cookies e medições">
          <p>
            Este site não usa ferramentas de publicidade nem de analytics. Utilizamos apenas cookies estritamente
            necessários para manter sua sessão na área do paciente. As fontes tipográficas são servidas pelo próprio
            site, sem chamadas a serviços de terceiros durante a navegação.
          </p>
        </Section>

        <Section title="Armazenamento e segurança">
          <p>
            Os dados são armazenados em banco de dados com controle de acesso por linha (Row Level Security), conexões
            criptografadas e documentos em armazenamento privado, acessíveis apenas por links temporários. O aplicativo
            instalável não guarda prontuários ou fotografias clínicas no aparelho.
          </p>
          <p>Provedores de infraestrutura e a localização dos servidores: {PENDING}.</p>
        </Section>

        <Section id="direitos" title="Seus direitos">
          <p>
            Você pode solicitar confirmação de tratamento, acesso, correção, anonimização, portabilidade, informação
            sobre compartilhamentos, revogação do consentimento e eliminação de dados tratados com base no consentimento
            (LGPD, art. 18). Informações do prontuário odontológico têm prazo legal mínimo de guarda e não podem ser
            eliminadas antes dele.
          </p>
          <p>
            Para exercer seus direitos, entre em contato
            {contact.email ? (
              <>
                {" "}
                pelo e-mail{" "}
                <a href={`mailto:${contact.email}`} className="underline decoration-gold underline-offset-4">
                  {contact.email}
                </a>
              </>
            ) : (
              ` pelo canal ${PENDING}`
            )}
            . Responderemos no prazo legal.
          </p>
        </Section>
      </article>
    </PageShell>
  );
}
