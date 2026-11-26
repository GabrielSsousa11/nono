import { LogOut } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { PageShell } from "@/components/ui/page-shell";
import { signOut } from "@/features/auth/actions";
import { platformModules, statusLabel } from "@/lib/modules";
import { createSessionClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Portal",
  robots: { index: false, follow: false },
};

async function PortalContent() {
  const supabase = await createSessionClient();
  if (!supabase) redirect("/entrar");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/entrar");

  return (
    <div className="flex flex-col gap-14">
      <div className="flex flex-col gap-4">
        <span className="gold-rule" aria-hidden />
        <h1 className="font-display text-[clamp(2.5rem,5vw,4rem)] leading-none">Seu portal</h1>
        <p className="text-mist">Conectado como {user.email}</p>
      </div>
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
