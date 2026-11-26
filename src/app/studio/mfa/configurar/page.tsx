import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/ui/page-shell";
import { signOut } from "@/features/auth/actions";
import { EnrollTotp } from "@/features/studio/mfa-forms";
import { MfaGate } from "../mfa-gate";

export const metadata: Metadata = { title: "Verificação em duas etapas" };

export default function EnrollPage() {
  return (
    <PageShell
      aside={
        <form action={signOut}>
          <button type="submit" className="min-h-11 text-sm text-olive hover:underline">
            Sair
          </button>
        </form>
      }
    >
      <div className="flex max-w-3xl flex-col gap-10">
        <div className="flex flex-col gap-4">
          <span className="gold-rule" aria-hidden />
          <h1 className="font-display text-[clamp(2.25rem,4vw,3.5rem)] leading-none">Proteja seu acesso</h1>
          <p className="max-w-xl text-mist">
            O CG Studio dá acesso a dados de pacientes. Por isso, toda a equipe usa verificação em duas etapas: além do
            link enviado por e-mail, um código temporário gerado no seu celular.
          </p>
        </div>
        <Suspense fallback={<p className="text-mist">Verificando sua sessão…</p>}>
          <MfaGate step="enroll_mfa">
            <EnrollTotp />
          </MfaGate>
        </Suspense>
      </div>
    </PageShell>
  );
}
