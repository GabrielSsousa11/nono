import { ArrowRight, LogOut } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageShell } from "@/components/ui/page-shell";
import { signOut } from "@/features/auth/actions";
import { platformModules, statusLabel } from "@/lib/modules";
import { getSessionContext } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Portal",
  robots: { index: false, follow: false },
};

async function PortalContent() {
  const { user } = await getSessionContext();
  if (!user) redirect("/entrar");

  return (
    <div className="flex flex-col gap-14">
      <div className="flex flex-col gap-4">
        <span className="gold-rule" aria-hidden />
        <h1 className="font-display text-[clamp(2.5rem,5vw,4rem)] leading-none">Seu portal</h1>
        <p className="text-mist">Conectado como {user.email}</p>
      </div>
      <Link
        href="/portal/privacidade"
        className="group flex max-w-xl items-center justify-between gap-6 border-y border-onyx/10 py-6"
      >
        <span>
          <span className="font-display block text-2xl">Meus dados e privacidade</span>
          <span className="text-sm text-mist">
            Cadastro, autorizações de contato e fotografias, responsáveis e direitos.
          </span>
        </span>
        <ArrowRight
          aria-hidden
          className="size-5 shrink-0 text-gold-ink transition-transform group-hover:translate-x-1"
        />
      </Link>
      <section aria-labelledby="modulos-title">
        <h2 id="modulos-title" className="mb-6 text-lg font-semibold">
          Módulos
        </h2>
        <ul className="grid gap-px bg-onyx/10 sm:grid-cols-2">
          {platformModules.map((m) => (
            <li key={m.id} className="flex flex-col gap-2 bg-ivory p-6">
              <div className="flex items-center justify-between gap-4">
                <h3 className="font-semibold">{m.name}</h3>
                <span className="rounded-full border border-onyx/15 px-3 py-0.5 text-xs text-mist">
                  {statusLabel[m.status]}
                </span>
              </div>
              <p className="text-sm text-mist">{m.description}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

export default function PortalPage() {
  return (
    <PageShell
      aside={
        <form action={signOut}>
          <button type="submit" className="inline-flex min-h-11 items-center gap-2 text-sm text-olive hover:underline">
            <LogOut aria-hidden className="size-4" /> Sair
          </button>
        </form>
      }
    >
      <Suspense fallback={<p className="text-mist">Carregando seu portal…</p>}>
        <PortalContent />
      </Suspense>
    </PageShell>
  );
}
