import { NextResponse } from "next/server";
import { homeFor, parseAccess } from "@/lib/auth/access";
import { siteUrl } from "@/lib/env";
import { createSessionClient } from "@/lib/supabase/server";

/** Encaminha após o login: equipe → CG Studio; pacientes e responsáveis → portal. */
export async function GET() {
  // URL pública configurada: request.url pode refletir o host interno do servidor.
  const to = (path: string) => NextResponse.redirect(new URL(path, siteUrl()));
  const supabase = await createSessionClient();
  if (!supabase) return to("/entrar");
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return to("/entrar");
  const { data } = await supabase.rpc("my_access");
  return to(homeFor(parseAccess(data)));
}
