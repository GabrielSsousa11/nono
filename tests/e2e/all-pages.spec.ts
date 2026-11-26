import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginAs } from "./session";

const STUDIO: [string, string][] = [
  ["/studio/agenda", "Agenda"],
  ["/studio/pacientes", "Pacientes"],
  ["/studio/pacientes/novo", "Novo paciente"],
  ["/studio/lista-de-espera", "Lista de espera"],
  ["/studio/servicos", "Serviços e horários"],
  ["/studio/indicadores", "Indicadores"],
  ["/studio/auditoria", "Auditoria"],
  ["/studio/checkin", "Check-in"],
];

const PORTAL: [string, string][] = [
  ["/portal", "Olá, Paciente"],
  ["/portal/agenda", "Consultas"],
  ["/portal/jornada", "CG Journey"],
  ["/portal/daily", "CG Daily"],
  ["/portal/sorriso", "CG Smile 3D"],
  ["/portal/evolucao", "CG Evolution"],
  ["/portal/cuidados", "CG Care"],
  ["/portal/mensagens", "Mensagens"],
  ["/portal/passaporte", "CG Passport"],
  ["/portal/financeiro", "Financeiro"],
  ["/portal/avaliacao", "Sua avaliação"],
];

test.describe("todas as páginas do Studio abrem (administradora com MFA)", () => {
  test.beforeEach(async ({ context, baseURL }) => loginAs(context, "admin", baseURL!));
  for (const [path, heading] of STUDIO) {
    test(path, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBeLessThan(400);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await expect(page.getByText(/Application error|Unhandled Runtime Error/)).toHaveCount(0);
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, "rolagem horizontal").toBeLessThanOrEqual(0);
    });
  }

  test("agenda sem violações de acessibilidade", async ({ page }) => {
    await page.goto("/studio/agenda");
    await expect(page.getByRole("heading", { level: 1, name: "Agenda" })).toBeVisible();
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });
});

test.describe("todas as páginas do portal abrem (paciente)", () => {
  test.beforeEach(async ({ context, baseURL }) => loginAs(context, "patient", baseURL!));
  for (const [path, heading] of PORTAL) {
    test(path, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBeLessThan(400);
      await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
      await page.waitForLoadState("networkidle");
      const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, "rolagem horizontal").toBeLessThanOrEqual(0);
    });
  }

  test("CG Daily sem violações de acessibilidade e com cronômetro", async ({ page }) => {
    await page.goto("/portal/daily");
    await expect(page.getByRole("button", { name: "Iniciar escovação" })).toBeVisible();
    await expect(page.getByText(/não é diagnóstico/)).toBeVisible();
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(r.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });

  test("CG Smile 3D tem alternativa 2D acessível por teclado", async ({ page }) => {
    await page.goto("/portal/sorriso");
    await page.waitForLoadState("networkidle");
    const to2d = page.getByRole("button", { name: "Ver em 2D" });
    if (await to2d.isVisible()) await to2d.click();
    await expect(page.getByRole("button", { name: "Ver em 3D" })).toBeVisible();
    const tooth = page.getByRole("button", { name: /^Dente 36,/ });
    await tooth.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("heading", { name: /Dente 36/ })).toBeVisible();
  });
});

test.describe("recepção digital (visitante)", () => {
  test("responde sem inventar dados e recusa assunto clínico", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Recepção digital" }).click();
    const dialog = page.getByRole("dialog", { name: "Recepção digital" });
    await dialog.getByLabel("Sua pergunta").fill("Qual o horário de funcionamento?");
    await dialog.getByRole("button", { name: "Enviar" }).click();
    await expect(dialog.getByText(/ainda não foi publicado/)).toBeVisible({ timeout: 20_000 });
    await dialog.getByLabel("Sua pergunta").fill("Estou com dor de dente, que remédio tomo?");
    await dialog.getByRole("button", { name: "Enviar" }).click();
    await expect(dialog.getByText(/Não posso avaliar sintomas/)).toBeVisible({ timeout: 20_000 });
  });
});
