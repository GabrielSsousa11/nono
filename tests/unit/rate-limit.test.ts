import { describe, expect, it } from "vitest";
import { createRateLimiter, hashIdentifier } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  it("bloqueia após o limite e libera depois da janela", () => {
    const check = createRateLimiter({ limit: 2, windowMs: 1000 });
    expect(check("a", 0).allowed).toBe(true);
    expect(check("a", 100).allowed).toBe(true);
    const blocked = check("a", 200);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBe(800);
    expect(check("b", 200).allowed).toBe(true);
    expect(check("a", 1001).allowed).toBe(true);
  });

  it("limita a quantidade de chaves em memória", () => {
    const check = createRateLimiter({ limit: 1, windowMs: 10_000, maxKeys: 2 });
    check("a", 0);
    check("b", 0);
    check("c", 0); // remove "a"
    expect(check("a", 1).allowed).toBe(true);
  });
});

describe("hashIdentifier", () => {
  it("é determinístico e não expõe o valor", async () => {
    const h = await hashIdentifier("203.0.113.7");
    expect(h).toBe(await hashIdentifier("203.0.113.7"));
    expect(h).not.toContain("203");
    expect(h).toMatch(/^[0-9a-f]{24}$/);
  });
});
