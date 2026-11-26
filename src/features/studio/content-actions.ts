"use server";

import { updateTag } from "next/cache";
import { fail, ok, type ActionState } from "@/lib/action-state";
import { requireStaff } from "@/lib/auth/guards";
import { SITE_CONTENT_TAG } from "@/lib/content/remote";
import { sectionSchemas, type SectionKey } from "@/lib/content/sections";

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);
const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
const orNull = (v: string) => (v ? v : null);

/** Converte o formulário de cada seção no payload do esquema. */
function payloadFor(section: SectionKey, fd: FormData): unknown {
  switch (section) {
    case "professional":
      return {
        name: str(fd, "name"),
        cro: orNull(str(fd, "cro")),
        role: orNull(str(fd, "role")),
        bio: str(fd, "bio")
          .split(/\n\s*\n/)
          .map((p) => p.trim())
          .filter(Boolean),
        specialties: str(fd, "specialties")
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      };
    case "contact":
      return {
        phone: orNull(str(fd, "phone")),
        whatsapp: orNull(str(fd, "whatsapp")),
        email: str(fd, "email"),
        instagram: orNull(str(fd, "instagram")),
      };
    case "address":
      return str(fd, "street")
        ? {
            street: str(fd, "street"),
            district: str(fd, "district"),
            city: str(fd, "city"),
            state: str(fd, "state").toUpperCase(),
            postalCode: str(fd, "postalCode"),
            mapsUrl: orNull(str(fd, "mapsUrl")),
          }
        : null;
    case "hours":
      // Linhas no formato "1-5 08:00-18:00" ou "6 08:00-12:00" (0 = domingo).
      return lines(fd.get("hours")).map((l) => {
        const m = l.match(/^(\d)(?:-(\d))?\s+(\d{2}:\d{2})-(\d{2}:\d{2})$/);
        if (!m) return { days: [], opens: "x", closes: "x" };
        const a = Number(m[1]);
        const b = m[2] ? Number(m[2]) : a;
        return { days: Array.from({ length: b - a + 1 }, (_, i) => a + i), opens: m[3], closes: m[4] };
      });
    case "services": {
      const out = [];
      for (let i = 0; i < 20; i++) {
        const name = str(fd, `s${i}_name`);
        if (!name) continue;
        out.push({
          slug: name
            .toLowerCase()
            .normalize("NFD")
            .replace(/[̀-ͯ]/g, "")
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, "")
            .slice(0, 60),
          name,
          summary: str(fd, `s${i}_summary`),
          explanation: str(fd, `s${i}_explanation`),
          steps: lines(fd.get(`s${i}_steps`)).map((l) => {
            const [title, ...rest] = l.split(":");
            return { title: title.trim(), description: rest.join(":").trim() || title.trim() };
          }),
          region: str(fd, `s${i}_region`) || "whole",
        });
      }
      return out;
    }
    case "clinic_faq": {
      const out = [];
      for (let i = 0; i < 30; i++) {
        const q = str(fd, `q${i}`);
        if (q) out.push({ question: q, answer: str(fd, `a${i}`) });
      }
      return out;
    }
    case "legal":
      return {
        companyName: orNull(str(fd, "companyName")),
        cnpj: str(fd, "cnpj").replace(/\D/g, "") || null,
        dpoContact: orNull(str(fd, "dpoContact")),
      };
  }
}

export async function saveSection(_p: ActionState, fd: FormData): Promise<ActionState> {
  const ctx = await requireStaff("content.manage");
  if (!ctx) return fail("Sem permissão.");
  const section = str(fd, "section") as SectionKey;
  if (!(section in sectionSchemas)) return fail("Seção inválida.");
  const parsed = sectionSchemas[section].safeParse(payloadFor(section, fd));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return fail(
      `Confira os campos${issue?.path.length ? ` (${issue.path.join(" › ")})` : ""}: ${issue?.message ?? "dados inválidos"}.`,
    );
  }
  const publish = fd.get("publish") === "on";
  if (publish && fd.get("verified") !== "on")
    return fail("Para publicar, confirme que as informações foram verificadas com a clínica.");
  const { data: last } = await ctx.supabase
    .from("website_content")
    .select("version")
    .eq("section", section)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  const now = new Date().toISOString();
  const { error } = await ctx.supabase.from("website_content").insert({
    section,
    payload: parsed.data,
    version: ((last as { version: number } | null)?.version ?? 0) + 1,
    published: publish,
    verified_at: publish ? now : null,
    verified_by: publish ? ctx.user.id : null,
  });
  if (error) return fail("Não foi possível salvar.");
  if (publish) updateTag(SITE_CONTENT_TAG);
  return ok(publish ? "Publicado no site." : "Rascunho salvo (não publicado).");
}
