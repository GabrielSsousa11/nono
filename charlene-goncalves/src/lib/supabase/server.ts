import "server-only";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { isSupabaseConfigured, publicEnv } from "@/lib/env";

/**
 * Cliente Supabase com a sessão da pessoa (cookies httpOnly), sujeito a RLS.
 * Deve ser criado por requisição e usado somente dentro de <Suspense> (Cache Components).
 */
export async function createSessionClient(): Promise<SupabaseClient | null> {
  if (!isSupabaseConfigured()) return null;
  const cookieStore = await cookies();
  return createServerClient(publicEnv.NEXT_PUBLIC_SUPABASE_URL!, publicEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Chamado a partir de um Server Component: o proxy renova a sessão.
        }
      },
    },
  });
}
