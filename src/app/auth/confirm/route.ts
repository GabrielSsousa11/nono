import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { siteUrl } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";

const ALLOWED_TYPES: EmailOtpType[] = ["magiclink", "email", "invite", "recovery"];

/**
 * Confirma o link mágico (fluxo token_hash do Supabase SSR) e redireciona.
 * `next` aceita apenas caminhos internos, evitando redirecionamento aberto.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextParam = searchParams.get("next") ?? "/continuar";
  const next = nextParam.startsWith("/") && !nextParam.startsWith("//") ? nextParam : "/continuar";

  const failure = new URL("/entrar?erro=link", siteUrl());
  if (!tokenHash || !type || !ALLOWED_TYPES.includes(type)) return NextResponse.redirect(failure);

  const supabase = await createSessionClient();
  if (!supabase) return NextResponse.redirect(failure);

  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return NextResponse.redirect(failure);
  return NextResponse.redirect(new URL(next, siteUrl()));
}
