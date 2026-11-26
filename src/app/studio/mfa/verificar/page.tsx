import type { Metadata } from "next";
import { Suspense } from "react";
import { PageShell } from "@/components/ui/page-shell";
import { signOut } from "@/features/auth/actions";
import { VerifyTotpForm } from "@/features/studio/mfa-forms";
import { MfaGate } from "../mfa-gate";

export const metadata: Metadata = { title: "Confirme sua identidade" };

export default function VerifyPage() {
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
      <div className="flex max-w-xl flex-col gap-10">
        <div className="flex flex-col gap-4">
          <span className="gold-rule" aria-hidden />
          <h1 className="font-display text-[clamp(2.25rem,4vw,3.5rem)] leading-none">Confirme sua identidade</h1>
          <p className="text-mist">Digite o código que aparece agora no seu aplicativo autenticador.</p>
        </div>
        <Suspense fallback={<p className="text-mist">Verificando sua sessão…</p>}>
          <MfaGate step="verify_mfa">
            <VerifyTotpForm />
          </MfaGate>
        </Suspense>
        <p className="text-xs text-mist">
          Perdeu o acesso ao autenticador? Peça a um administrador da clínica para redefinir sua verificação.
        </p>
      </div>
    </PageShell>
  );
}
