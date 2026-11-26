import Link from "next/link";
import { Suspense } from "react";
import { LoadingRows, StudioPageHeader } from "@/components/studio/page-header";
import { can, roleLabel, isStaffRole, type Permission } from "@/lib/auth/access";
import { getSessionContext } from "@/lib/auth/session";

const PERMISSION_TEXT: Partial<Record<Permission, string>> = {
  "users.manage": "Gerenciar equipe e acessos",
  "patients.read": "Consultar cadastro de pacientes",
  "patients.write": "Cadastrar e editar pacientes",
  "clinical.read": "Consultar prontuário e informações clínicas",
  "clinical.write": "Registrar informações clínicas",
  "booking_requests.manage": "Tratar pedidos de agendamento do site",
  "finance.read": "Consultar financeiro",
  "finance.write": "Registrar movimentações financeiras",
  "audit.read": "Consultar a trilha de auditoria",
  "content.manage": "Editar o conteúdo do site",
};

async function Overview() {
  const { gate, access, supabase, user } = await getSessionContext();
  if (gate !== "ok") return null;
  const { data: profile } = await supabase!.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();

  let newRequests: number | null = null;
  if (can(access, "booking_requests.manage")) {
    const { count } = await supabase!
      .from("booking_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "new");
    newRequests = count ?? 0;
  }

  const firstName = profile?.full_name?.split(" ")[0];
  return (
    <>
      <StudioPageHeader
        title={firstName ? `Olá, ${firstName}` : "Visão geral"}
        intro={`Você entrou como ${access.roles
          .filter(isStaffRole)
          .map((r) => roleLabel[r])
          .join(" e ")}, com verificação em duas etapas.`}
      />
      <div className="grid gap-12 lg:grid-cols-2">
        {newRequests !== null && (
          <section aria-labelledby="pedidos-title" className="flex flex-col gap-3 border-t border-onyx/10 pt-6">
            <h2 id="pedidos-title" className="text-sm font-semibold text-olive">
              Pedidos de agendamento
            </h2>
            <p className="font-display text-5xl leading-none">{newRequests}</p>
            <p className="text-sm text-mist">
              {newRequests === 1 ? "pedido novo aguardando contato" : "pedidos novos aguardando contato"}
            </p>
            <Link
              href="/studio/pedidos"
              className="self-start text-sm text-olive underline decoration-gold underline-offset-4"
            >
              Ver pedidos
            </Link>
          </section>
        )}
        <section aria-labelledby="acessos-title" className="flex flex-col gap-3 border-t border-onyx/10 pt-6">
          <h2 id="acessos-title" className="text-sm font-semibold text-olive">
            O que você pode fazer
          </h2>
          <ul className="flex flex-col gap-1.5 text-sm">
            {access.permissions
              .filter((p) => PERMISSION_TEXT[p])
              .map((p) => (
                <li key={p}>{PERMISSION_TEXT[p]}</li>
              ))}
          </ul>
          <p className="text-xs text-mist">
            Agenda, cadastro de pacientes e prontuário entram nas próximas fases da plataforma.
          </p>
        </section>
      </div>
    </>
  );
}

export default function StudioHome() {
  return (
    <Suspense fallback={<LoadingRows />}>
      <Overview />
    </Suspense>
  );
}
