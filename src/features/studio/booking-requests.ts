"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { can } from "@/lib/auth/access";
import { getSessionContext } from "@/lib/auth/session";
import { BOOKING_STATUSES } from "./booking-status";

const schema = z.object({ id: z.uuid(), status: z.enum(BOOKING_STATUSES) });

export type StatusUpdateState = { status: "idle" } | { status: "error"; message: string } | { status: "saved" };

export async function updateBookingRequestStatus(
  _prev: StatusUpdateState,
  formData: FormData,
): Promise<StatusUpdateState> {
  const ctx = await getSessionContext();
  if (!ctx.supabase || ctx.gate !== "ok" || !can(ctx.access, "booking_requests.manage")) {
    return { status: "error", message: "Sem permissão para tratar pedidos." };
  }
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { status: "error", message: "Status inválido." };
  const { error, count } = await ctx.supabase
    .from("booking_requests")
    .update(
      {
        status: parsed.data.status,
        handled_at: parsed.data.status === "new" ? null : new Date().toISOString(),
        handled_by: parsed.data.status === "new" ? null : ctx.user!.id,
      },
      { count: "exact" },
    )
    .eq("id", parsed.data.id);
  if (error || count === 0) return { status: "error", message: "Não foi possível salvar. Atualize a página." };
  revalidatePath("/studio/pedidos");
  return { status: "saved" };
}
