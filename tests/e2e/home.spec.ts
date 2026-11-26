import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.describe("página inicial (conteúdo oficial)", () => {
  test("mostra o hero com a frase da marca e CTAs funcionais", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Charlene Gonçalves Odontologia/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Cuidar do seu sorriso é cuidar da sua história.");
    const cta = page.getByRole("link", { name: "Agendar avaliação" }).first();
    await expect(cta).toHaveAttribute("href", "#agendamento");
    await cta.click();
    await expect(page).toHaveURL(/#agendamento$/);
    await expect(page.getByRole("heading", { name: "Agende sua avaliação" })).toBeInViewport();
  });

  test("não publica seções sem dados verificados nem dados sintéticos", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#tratamentos")).toHaveCount(0);
    await expect(page.locator("#contato")).toHaveCount(0);
    await expect(page.locator("#espaco")).toHaveCount(0);
    await expect(page.locator("#profissional")).toHaveCount(0);
    await expect(page.getByText(/sintétic/i)).toHaveCount(0);
    await expect(page.getByText("Pendente de dados oficiais")).toHaveCount(0);
  });

  test("dados estruturados contêm apenas informações verificadas", async ({ page }) => {
    await page.goto("/");
    const raw = await page.locator('script[type="application/ld+json"]').textContent();
    const data = JSON.parse(raw ?? "{}");
    expect(data["@type"]).toBe("Dentist");
    expect(data.name).toBe("Charlene Gonçalves Odontologia");
    expect(data.telephone).toBeUndefined();
    expect(data.address).toBeUndefined();
  });

  test("portal apresenta os módulos com o status do registro", async ({ page }) => {
    await page.goto("/");
    const portal = page.locator("#portal");
    await expect(portal.getByRole("heading", { name: "CG Smile 3D" })).toBeVisible();
    await expect(portal.getByText("Disponível", { exact: true }).first()).toBeVisible();
  });

  test("envia cabeçalhos de segurança", async ({ request }) => {
    const res = await request.get("/");
    const h = res.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["x-powered-by"]).toBeUndefined();
  });

  test("sem violações de acessibilidade WCAG A/AA detectáveis", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });

  test("perguntas frequentes abrem e fecham", async ({ page }) => {
    await page.goto("/");
    const q = page.getByText("Como acesso a área do paciente?");
    await q.click();
    await expect(page.getByText(/link de entrada no e-mail/)).toBeVisible();
    await q.click();
    await expect(page.getByText(/link de entrada no e-mail/)).toBeHidden();
  });
});

test.describe("menu mobile", () => {
  test("abre como diálogo, navega e fecha", async ({ page, isMobile }) => {
    test.skip(!isMobile, "apenas mobile");
    await page.goto("/");
    await page.getByRole("button", { name: "Abrir menu" }).click();
    const dialog = page.getByRole("dialog", { name: "Menu" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("link", { name: "Jornada" }).click();
    await expect(dialog).toBeHidden();
    await expect(page).toHaveURL(/#jornada$/);
  });

  test("não tem rolagem horizontal", async ({ page, isMobile }) => {
    test.skip(!isMobile, "apenas mobile");
    await page.goto("/");
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});
