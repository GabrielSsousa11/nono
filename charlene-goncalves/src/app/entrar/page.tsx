import type { Metadata } from "next";
import { Suspense } from "react";
import { LinkError } from "./link-error";
import { MagicLinkForm } from "@/features/auth/magic-link-form";
import { PageShell } from "@/components/ui/page-shell";
import { isSupabaseConfigured } from "@/lib/env";

export const metadata: Metadata = {
  title: "Área do paciente",
  description: "Acesso privado para pacientes da clínica.",
  robots: { index: false, follow: false },
};

export default function LoginPage() {
  const available = isSupabaseConfigured();
  return (
    <PageShell>
      <div className="grid gap-16 lg:grid-cols-12 lg:pt-10">
        <div className="flex flex-col gap-6 lg:col-span-5">
          <span className="gold-rule" aria-hidden />
          <h1 className="font-display text-[clamp(2.75rem,5vw,4.5rem)] leading-none tracking-[-0.02em]">
            Área do paciente
          </h1>
          <p className="max-w-md text-mist">
            Entre com o e-mail cadastrado na clínica. Enviamos um link de acesso seguro, sem senha para lembrar.
          </p>
        </div>
        <div className="lg:col-span-5 lg:col-start-7">
          <Suspense fallback={null}>
            <LinkError />
          </Suspense>
          {available ? (
            <MagicLinkForm />
          ) : (
            <div role="status" className="flex flex-col gap-3 border-t border-gold/60 pt-8">
              <p className="font-display text-2xl">A área do paciente está em implantação.</p>
              <p className="text-mist">
                O acesso será liberado pela clínica assim que o portal estiver ativo. Nenhum dado é coletado nesta
                página enquanto isso.
              </p>
            </div>
          )}
          <p className="mt-10 text-xs text-mist">
            Ainda não é paciente? O acesso é criado pela clínica após a primeira consulta.
          </p>
        </div>
      </div>
    </PageShell>
  );
}
