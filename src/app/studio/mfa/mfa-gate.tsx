import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { gatePath, type StudioGate } from "@/lib/auth/access";
import { getSessionContext } from "@/lib/auth/session";

/** Garante que a pessoa está no passo de MFA correto; senão, encaminha. */
export async function MfaGate({
  step,
  children,
}: {
  step: Extract<StudioGate, "enroll_mfa" | "verify_mfa">;
  children: ReactNode;
}) {
  const { gate } = await getSessionContext();
  if (gate === "ok") redirect("/studio");
  if (gate !== step) redirect(gatePath[gate]);
  return <>{children}</>;
}
