import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { loginAs } from "./session";

test.beforeEach(async ({ request }) => {
  await request.get("http://127.0.0.1:54399/__reset");
});

test.describe("CG Studio (sessão sintética de administradora com MFA)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ context, baseURL }) => {
    await loginAs(context, "admin", baseURL!);
  });

  test("após o login, a equipe é encaminhada ao Studio", async ({ page }) => {
    await page.goto("/continuar");
    await expect(page).toHaveURL(/\/studio$/);
    await expect(page.getByRole("heading", { level: 1, name: "Olá, Admin" })).toBeVisible();
    await expect(page.getByText("pedido novo aguardando contato")).toBeVisible();
  });

  test("trata um pedido de agendamento", async ({ page }) => {
    await page.goto("/studio/pedidos");
    await expect(page.getByText("Pessoa Sintética Um", { exact: true })).toBeVisible();
    await page.getByLabel("Situação do pedido de Pessoa Sintética Um").selectOption("contacted");
    await page.getByRole("button", { name: "Salvar" }).first().click();
    await expect(page.getByText("Salvo")).toBeVisible();
  });

  test("lista a equipe e informa quando convites não estão configurados", async ({ page }) => {
    await page.goto("/studio/equipe");
    await expect(page.getByText("Dentista Sintética")).toBeVisible();
    await expect(page.getByRole("button", { name: "Dentista: remover" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText(/SUPABASE_SERVICE_ROLE_KEY/)).toBeVisible();
  });

  test("telas de MFA redirecionam quem já verificou", async ({ page }) => {
    await page.goto("/studio/mfa/verificar");
    await expect(page).toHaveURL(/\/studio$/);
  });

  test("Studio sem violações de acessibilidade detectáveis", async ({ page }) => {
    await page.goto("/studio/pedidos");
    await expect(page.getByText("Pessoa Sintética Um", { exact: true })).toBeVisible();
    const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(", ")}`)).toEqual([]);
  });
});

test.describe("portal (sessão sintética de paciente)", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ context, baseURL }) => {
    await loginAs(context, "patient", baseURL!);
  });

  test("paciente não entra no Studio", async ({ page }) => {
    await page.goto("/studio");
    await expect(page).toHaveURL(/\/portal$/);
  });

  test("concede e revoga uma autorização", async ({ page }) => {
    await page.goto("/portal/privacidade");
    await expect(page.getByRole("heading", { name: "Paciente Sintético" })).toBeVisible();
    const toggle = page.getByRole("switch", { name: "Mensagem de aniversário" });
    await expect(toggle).toHaveAttribute("aria-checked", "false");
    await toggle.click();
    await expect(page.getByText("Autorizado", { exact: true })).toBeVisible();
    await expect(page.getByRole("switch", { name: "Mensagem de aniversário" })).toHaveAttribute("aria-checked", "true");
    await page.getByRole("switch", { name: "Mensagem de aniversário" }).click();
    await expect(page.getByText("Revogado", { exact: true })).toBeVisible();
  });
});
