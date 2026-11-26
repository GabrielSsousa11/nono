import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { StudioNav, type StudioNavItem } from "@/components/studio/studio-nav";
import { signOut } from "@/features/auth/actions";
import { can, gatePath, roleLabel, isStaffRole, type Permission } from "@/lib/auth/access";
import { getSessionContext } from "@/lib/auth/session";

async function GatedShell({ children }: { children: React.ReactNode }) {
  const { gate, access, user } = await getSessionContext();
  if (gate !== "ok") redirect(gatePath[gate]);

  const nav: [StudioNavItem, Permission | null][] = [
    [{ href: "/studio", label: "Visão geral", icon: "overview" }, null],
    [{ href: "/studio/agenda", label: "Agenda", icon: "agenda" }, "agenda.read"],
    [{ href: "/studio/pacientes", label: "Pacientes", icon: "patients" }, "patients.read"],
    [{ href: "/studio/pedidos", label: "Pedidos do site", icon: "requests" }, "booking_requests.manage"],
    [{ href: "/studio/lista-de-espera", label: "Lista de espera", icon: "waitlist" }, "waitlist.manage"],
    [{ href: "/studio/checkin", label: "Check-in", icon: "checkin" }, "checkin.perform"],
    [{ href: "/studio/mensagens", label: "Mensagens", icon: "messages" }, "messages.manage"],
    [{ href: "/studio/cuidados", label: "Protocolos de cuidado", icon: "care" }, "care.manage"],
    [{ href: "/studio/financeiro", label: "Financeiro", icon: "finance" }, "finance.read"],
    [{ href: "/studio/indicadores", label: "Indicadores", icon: "reports" }, "reports.read"],
    [{ href: "/studio/servicos", label: "Serviços e horários", icon: "services" }, "services.manage"],
    [{ href: "/studio/automacoes", label: "Automações", icon: "automations" }, "automations.manage"],
    [{ href: "/studio/conteudo", label: "Conteúdo do site", icon: "content" }, "content.manage"],
    [{ href: "/studio/equipe", label: "Equipe e acessos", icon: "team" }, "users.manage"],
    [{ href: "/studio/configuracoes", label: "Configurações", icon: "settings" }, "settings.manage"],
    [{ href: "/studio/auditoria", label: "Auditoria", icon: "audit" }, "audit.read"],
  ];
  const items = nav.filter(([, p]) => !p || can(access, p)).map(([i]) => i);

  const footer = (
    <div className="flex flex-col gap-3 border-t border-ivory/15 px-3 pt-4 text-xs text-champagne">
      <p className="break-all">{user?.email}</p>
      <p>
        {access.roles
          .filter(isStaffRole)
          .map((r) => roleLabel[r])
          .join(", ")}
      </p>
      <form action={signOut}>
        <button type="submit" className="inline-flex min-h-11 items-center gap-2 text-ivory hover:underline">
          <LogOut aria-hidden className="size-4" /> Sair
        </button>
      </form>
    </div>
  );

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <StudioNav items={items} footer={footer} />
      <main id="conteudo" className="paper min-w-0 flex-1 px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
        {children}
      </main>
    </div>
  );
}

export default function StudioPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<p className="p-10 text-mist">Abrindo o CG Studio…</p>}>
      <GatedShell>{children}</GatedShell>
    </Suspense>
  );
}
