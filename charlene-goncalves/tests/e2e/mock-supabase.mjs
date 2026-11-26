// Servidor HTTP mínimo que imita os endpoints do Supabase usados nos testes E2E.
// SOMENTE TESTES. Não representa o comportamento completo do Supabase.
import { createServer } from "node:http";

const port = Number(process.env.MOCK_SUPABASE_PORT ?? 54399);

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const json = (status, data) => {
      res.writeHead(status, { "content-type": "application/json" });
      res.end(JSON.stringify(data));
    };
    if (req.method === "POST" && req.url?.startsWith("/rest/v1/rpc/request_booking")) {
      const payload = JSON.parse(body || "{}");
      if (String(payload.p_phone).includes("99999-9999")) {
        return json(400, { code: "P0001", message: "rate_limited", hint: "phone", details: null });
      }
      return json(200, "00000000-0000-4000-8000-000000000001");
    }
    if (req.method === "POST" && req.url?.startsWith("/auth/v1/otp")) return json(200, {});
    if (req.url?.startsWith("/auth/v1/user")) return json(401, { code: 401, msg: "invalid JWT" });
    if (req.url === "/health") return json(200, { ok: true });
    json(404, { message: "not mocked" });
  });
}).listen(port, "127.0.0.1", () => console.log(`mock supabase on ${port}`));
