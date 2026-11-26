import { Bell, LogOut } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PortalNav } from "@/components/portal/portal-nav";
import { ConciergeWidget } from "@/features/concierge/concierge-widget";
import { Monogram } from "@/components/ui/monogram";
import { signOut } from "@/features/auth/actions";
import { switchPatient } from "@/features/portal/portal-actions";
import { requirePortal } from "@/lib/auth/guards";

const NAV = [
  { href: "/portal", label: "Início" },
  { href: "/portal/agenda", label: "Consultas" },
  { href: "/portal/jornada", label: "Jornada" },
  { href: "/portal/daily", label: "CG Daily" },
  { href: "/portal/sorriso", label: "Sorriso 3D" },
  { href: "/portal/evolucao", label: "Evolução" },
  { href: "/portal/cuidados", label: "Cuidados" },
  { href: "/portal/mensagens", label: "Mensagens" },
  { href: "/portal/passaporte", label: "Passaporte" },
  { href: "/portal/financeiro", label: "Financeiro" },
  { href: "/portal/privacidade", label: "Meus dados" },
];

async function Bar() {
  const portal = await requirePortal();
  if (!portal) redirect("/entrar");
  const { count } = await portal.supabase.from("notifications").select("id", { count: "exact", head: true }).is("read_at", null);
  return (
    <div className="flex flex-wrap items-center gap-3">
      {portal.patients.length > 1 && (
        <form action={switchPatient} className="flex items-center gap-2">
          <label htmlFor="patient-switch" className="sr-only">Ver dados de</label>
          <select id="patient-switch" name="patientId" defaultValue={portal.current?.id} className="min-h-10 max-w-44 rounded-full border border-onyx/15 bg-transparent px-3 text-sm">
            {portal.patients.map((p) => <option key={p.id} value={p.id}>{p.isSelf ? `${p.name} (você)` : p.name}</option>)}
          </select>
          <button type="submit" className="min-h-10 rounded-full border border-onyx/15 px-3 text-sm">Ver</button>
        </form>
      )}
      <Link href="/portal#avisos" className="relative grid size-10 place-items-center rounded-full border border-onyx/15" aria-label={count ? `${count} avisos não lidos` : "Avisos"}>
        <Bell aria-hidden className="size-4" />
        {Boolean(count) && <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-olive px-1 text-[0.6875rem] text-ivory">{count}</span>}
      </Link>
      <form action={signOut}>
        <button type="submit" className="grid size-10 place-items-center rounded-full border border-onyx/15" aria-label="Sair">
          <LogOut aria-hidden className="size-4" />
        </button>
      </form>
    </div>
  );
}

export default function PortalLayout({ children }: LayoutProps<"/portal">) {
  return (
    <div className="paper flex min-h-dvh flex-col">
      <header className="mx-auto flex w-full max-w-[72rem] flex-col gap-4 px-5 pt-5 sm:px-8">
        <div className="flex items-center justify-between gap-4">
          <Link href="/portal" className="flex items-center gap-3 text-onyx">
            <Monogram className="size-9" />
            <span className="font-display hidden text-xl xs:inline">Charlene Gonçalves</span>
          </Link>
          <Suspense fallback={<div className="h-10 w-24" />}>
            <Bar />
          </Suspense>
        </div>
        <PortalNav items={NAV} />
      </header>
      <main id="conteudo" className="mx-auto w-full max-w-[72rem] flex-1 px-5 pt-10 pb-24 sm:px-8">
        {children}
      </main>
      <ConciergeWidget />
    </div>
  );
}
