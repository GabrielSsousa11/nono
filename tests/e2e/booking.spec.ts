import { expect, test } from "@playwright/test";

test.describe("pedido de agendamento", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#agendamento");
  });

  test("valida os campos obrigatórios antes de enviar", async ({ page }) => {
    await page.getByRole("button", { name: "Enviar pedido de agendamento" }).click();
    await expect(page.getByText("Informe seu nome completo.")).toBeVisible();
    await expect(page.getByText(/Informe um telefone com DDD/)).toBeVisible();
    await expect(page.getByText(/É preciso concordar/)).toBeVisible();
  });

  test("aplica máscara de telefone e envia com sucesso", async ({ page }) => {
    await page.getByLabel("Nome completo").fill("Pessoa Teste");
    const phone = page.getByLabel("Telefone ou WhatsApp");
    await phone.pressSequentially("11912345678");
    await expect(phone).toHaveValue("(11) 91234-5678");
    await page.getByText("Tarde", { exact: true }).click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Enviar pedido de agendamento" }).click();
    await expect(page.getByRole("heading", { name: "Pedido recebido." })).toBeVisible();
    await expect(page.getByText(/ainda não é uma consulta marcada/)).toBeVisible();
  });

  test("explica o limite de pedidos por telefone", async ({ page }) => {
    await page.getByLabel("Nome completo").fill("Pessoa Teste");
    await page.getByLabel("Telefone ou WhatsApp").fill("(11) 99999-9999");
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Enviar pedido de agendamento" }).click();
    await expect(page.getByText(/Já recebemos pedidos recentes com este telefone/)).toBeVisible();
  });
});
