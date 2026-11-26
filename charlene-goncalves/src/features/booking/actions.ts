"use server";

import { headers } from "next/headers";
import { createAnonServerClient } from "@/lib/supabase/anon";
import { createRateLimiter, hashIdentifier } from "@/lib/rate-limit";
import type { BookingActionState } from "./schema";
import { submitBookingRequest } from "./submit";

const limiter = createRateLimiter({ limit: 5, windowMs: 10 * 60 * 1000 });

export async function requestBooking(input: unknown): Promise<BookingActionState> {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
  const key = await hashIdentifier(ip);

  return submitBookingRequest(input, {
    client: createAnonServerClient(),
    locallyAllowed: limiter(key).allowed,
    log: (event, detail) => console.warn(`[cg] ${event}`, detail),
  });
}
