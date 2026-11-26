import { expect, test } from "@playwright/test";

test("área do paciente envia link mágico sem revelar cadastro", async ({ page }) => {
  await page.goto("/entrar");
  await expect(page.getByRole("heading", { level: 1, name: "Área do paciente" })).toBeVisible();
  await page.getByLabel("E-mail cadastrado na clínica").fill("paciente@exemplo.com");
  await page.getByRole("button", { name: "Receber link de acesso" }).click();
  await expect(page.getByText("Verifique seu e-mail.")).toBeVisible();
  await expect(page.getByText(/Se este endereço estiver cadastrado/)).toBeVisible();
});

test("área do paciente valida e-mail", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByLabel("E-mail cadastrado na clínica").fill("invalido");
  await page.getByRole("button", { name: "Receber link de acesso" }).click();
  await expect(page.getByText("Informe um e-mail válido.")).toBeVisible();
});

test("link expirado mostra orientação", async ({ page }) => {
  await page.goto("/auth/confirm?token_hash=x&type=magiclink");
  await expect(page).toHaveURL(/\/entrar\?erro=link/);
  await expect(page.getByText(/expirou ou já foi usado/)).toBeVisible();
});

test("portal exige autenticação", async ({ page }) => {
  await page.goto("/portal");
  await expect(page).toHaveURL(/\/entrar$/);
});

test("redirecionamento após login aceita apenas caminhos internos", async ({ request }) => {
  const res = await request.get("/auth/confirm?next=//malicioso.example", { maxRedirects: 0 });
  expect(res.status()).toBe(307);
  expect(res.headers()["location"]).not.toContain("malicioso");
});

test("política de privacidade é acessível e marcada como preliminar", async ({ page }) => {
  await page.goto("/privacidade");
  await expect(page.getByRole("heading", { level: 1, name: "Política de privacidade" })).toBeVisible();
  await expect(page.getByText(/Versão preliminar/)).toBeVisible();
  await expect(page.locator("#direitos")).toBeVisible();
});

test("PWA: manifest, ícones, service worker e página offline", async ({ request, page }) => {
  const manifest = await (await request.get("/manifest.webmanifest")).json();
  expect(manifest.display).toBe("standalone");
  expect(manifest.lang).toBe("pt-BR");
  for (const icon of manifest.icons) expect((await request.get(icon.src)).status()).toBe(200);
  const sw = await request.get("/sw.js");
  expect(sw.headers()["cache-control"]).toContain("no-store");
  expect(await sw.text()).toContain('"/portal"');
  await page.goto("/offline");
  await expect(page.getByRole("heading", { name: "Você está sem conexão." })).toBeVisible();
});

test("robots e sitemap protegem áreas privadas", async ({ request }) => {
  const robots = await (await request.get("/robots.txt")).text();
  expect(robots).toContain("Disallow: /portal");
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).not.toContain("/portal");
});

test("página inexistente retorna 404 com caminho de volta", async ({ page }) => {
  const res = await page.goto("/nao-existe");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("link", { name: "Ir para a página inicial" })).toBeVisible();
});
