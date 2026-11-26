/**
 * Limitador de taxa em memória (janela deslizante simples).
 *
 * É uma camada de MELHOR ESFORÇO por instância do servidor. A proteção
 * autoritativa fica no banco (ex.: `public.request_booking` limita por telefone
 * e globalmente), que vale para todas as instâncias. Ver docs/DECISIONS.md (ADR-006).
 */
export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

export function createRateLimiter(options: { limit: number; windowMs: number; maxKeys?: number }) {
  const hits = new Map<string, number[]>();
  const maxKeys = options.maxKeys ?? 10_000;

  return function check(key: string, now: number = Date.now()): RateLimitResult {
    const windowStart = now - options.windowMs;
    const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);

    if (recent.length >= options.limit) {
      hits.set(key, recent);
      return { allowed: false, remaining: 0, retryAfterMs: recent[0] + options.windowMs - now };
    }

    recent.push(now);
    hits.delete(key);
    hits.set(key, recent);
    if (hits.size > maxKeys) {
      // Remove a chave menos recente (Map preserva ordem de inserção).
      const oldest = hits.keys().next().value;
      if (oldest !== undefined) hits.delete(oldest);
    }
    return { allowed: true, remaining: options.limit - recent.length, retryAfterMs: 0 };
  };
}

/** Hash não reversível de um identificador (ex.: IP) para não manter o valor bruto em memória/log. */
export async function hashIdentifier(value: string): Promise<string> {
  const data = new TextEncoder().encode(`cg:${value}`);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest).slice(0, 12), (b) => b.toString(16).padStart(2, "0")).join("");
}
