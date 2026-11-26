import type { BrowserContext } from "@playwright/test";

/**
 * Cria um cookie de sessão do Supabase SSR com um JWT FALSO (não assinado),
 * aceito apenas pelo mock de testes (tests/e2e/mock-supabase.mjs).
 */
export async function loginAs(context: BrowserContext, role: "admin" | "patient", baseURL: string) {
  const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const sub = role === "admin" ? "00000000-0000-4000-8000-00000000000a" : "00000000-0000-4000-8000-000000000001";
  const accessToken = [
    b64({ alg: "HS256", typ: "JWT" }),
    b64({
      sub,
      exp,
      aud: "authenticated",
      role: "authenticated",
      aal: role === "admin" ? "aal2" : "aal1",
      amr: [],
      e2e_role: role,
    }),
    "c2lnbmF0dXJl",
  ].join(".");
  const session = {
    access_token: accessToken,
    refresh_token: "e2e-refresh",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: exp,
    user: {
      id: sub,
      aud: "authenticated",
      role: "authenticated",
      email: `${role}@teste.invalid`,
      app_metadata: {},
      user_metadata: {},
      created_at: "2026-11-01T00:00:00Z",
    },
  };
  await context.addCookies([
    { name: "sb-127-auth-token", value: `base64-${b64(session)}`, url: baseURL, httpOnly: true, sameSite: "Lax" },
  ]);
}
