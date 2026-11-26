// Servidor HTTP mínimo que imita os endpoints do Supabase usados nos testes E2E.
// SOMENTE TESTES — dados sintéticos em memória. Não representa o comportamento
// completo do Supabase, e a autorização real (RLS) é testada em supabase/tests.
import { createServer } from "node:http";

const port = Number(process.env.MOCK_SUPABASE_PORT ?? 54399);

const USERS = {
  admin: { id: "00000000-0000-4000-8000-00000000000a", email: "admin@teste.invalid", staff: true },
  patient: { id: "00000000-0000-4000-8000-000000000001", email: "paciente@teste.invalid", staff: false },
};
const ACCESS = {
  admin: {
    roles: ["admin"],
    permissions: [
      "users.manage",
      "patients.read",
      "patients.write",
      "booking_requests.manage",
      "clinical.read",
      "audit.read",
    ],
    is_staff: true,
    mfa_verified: true,
  },
  patient: { roles: ["patient"], permissions: [], is_staff: false, mfa_verified: false },
};

let bookingRequests = [];
let consents = [];
function reset() {
  bookingRequests = [
    {
      id: "30000000-0000-4000-8000-000000000001",
      created_at: "2026-11-20T13:00:00Z",
      full_name: "Pessoa Sintética Um",
      phone_digits: "11900000001",
      email: null,
      service_interest: null,
      preferred_period: "morning",
      message: "Mensagem sintética.",
      status: "new",
    },
    {
      id: "30000000-0000-4000-8000-000000000002",
      created_at: "2026-11-19T10:00:00Z",
      full_name: "Pessoa Sintética Dois",
      phone_digits: "11900000002",
      email: "dois@teste.invalid",
      service_interest: "Avaliação",
      preferred_period: "any",
      message: null,
      status: "contacted",
    },
  ];
  consents = [];
}
reset();

function roleFromAuth(req) {
  const token = (req.headers.authorization ?? "").replace(/^Bearer /, "");
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
    return USERS[payload.e2e_role] ? payload.e2e_role : null;
  } catch {
    return null;
  }
}

createServer((req, res) => {
  let body = "";
  req.on("data", (c) => (body += c));
  req.on("end", () => {
    const url = new URL(req.url ?? "/", "http://mock");
    const json = (status, data, headers = {}) => {
      res.writeHead(status, { "content-type": "application/json", ...headers });
      res.end(data === undefined ? "" : JSON.stringify(data));
    };
    const role = roleFromAuth(req);
    const wantsObject = (req.headers.accept ?? "").includes("vnd.pgrst.object");

    if (url.pathname === "/health") return json(200, { ok: true });
    if (url.pathname === "/__reset") {
      reset();
      return json(200, { ok: true });
    }

    // ---- Auth ----
    if (req.method === "POST" && url.pathname === "/auth/v1/otp") return json(200, {});
    if (url.pathname === "/auth/v1/user") {
      if (!role) return json(401, { code: 401, msg: "invalid JWT" });
      const u = USERS[role];
      const now = "2026-11-01T00:00:00Z";
      return json(200, {
        id: u.id,
        aud: "authenticated",
        role: "authenticated",
        email: u.email,
        app_metadata: {},
        user_metadata: {},
        created_at: now,
        factors: u.staff
          ? [
              {
                id: "40000000-0000-4000-8000-000000000001",
                factor_type: "totp",
                status: "verified",
                friendly_name: "e2e",
                created_at: now,
                updated_at: now,
              },
            ]
          : [],
      });
    }
    if (req.method === "POST" && url.pathname === "/auth/v1/logout") return json(204);

    // ---- Público ----
    if (req.method === "POST" && url.pathname === "/rest/v1/rpc/request_booking") {
      const payload = JSON.parse(body || "{}");
      if (String(payload.p_phone).includes("99999-9999")) {
        return json(400, { code: "P0001", message: "rate_limited", hint: "phone", details: null });
      }
      return json(200, "00000000-0000-0000-0000-000000000001");
    }

    if (!role) return json(401, { message: "JWT required" });

    // ---- RPCs autenticadas ----
    if (req.method === "POST" && url.pathname === "/rest/v1/rpc/my_access") return json(200, ACCESS[role]);
    if (req.method === "POST" && url.pathname === "/rest/v1/rpc/set_my_consent") {
      const p = JSON.parse(body || "{}");
      consents = consents.filter((c) => c.kind !== p.p_kind);
      if (p.p_granted) {
        consents.push({
          patient_id: p.p_patient,
          kind: p.p_kind,
          granted: true,
          revoked_at: null,
          recorded_at: "2026-11-26T12:00:00Z",
        });
      }
      return json(200, null);
    }

    // ---- Tabelas ----
    if (url.pathname === "/rest/v1/profiles") {
      const row = { full_name: role === "admin" ? "Admin Sintética" : "Paciente Sintético", id: USERS[role].id };
      return json(200, wantsObject ? row : [row]);
    }
    if (url.pathname === "/rest/v1/booking_requests") {
      if (role !== "admin") return json(200, []);
      if (req.method === "HEAD") {
        const n = bookingRequests.filter((r) => r.status === "new").length;
        res.writeHead(200, { "content-range": `0-${Math.max(0, n - 1)}/${n}` });
        return res.end();
      }
      if (req.method === "PATCH") {
        const id = (url.searchParams.get("id") ?? "").replace(/^eq\./, "");
        const patch = JSON.parse(body || "{}");
        const row = bookingRequests.find((r) => r.id === id);
        if (row) Object.assign(row, patch);
        res.writeHead(204, { "content-range": `*/${row ? 1 : 0}` });
        return res.end();
      }
      return json(200, bookingRequests);
    }
    if (url.pathname === "/rest/v1/user_roles") {
      if (role !== "admin") return json(200, []);
      return json(200, [
        { user_id: USERS.admin.id, role: "admin", profile: { full_name: "Admin Sintética", email: USERS.admin.email } },
        {
          user_id: "00000000-0000-4000-8000-00000000000d",
          role: "dentist",
          profile: { full_name: "Dentista Sintética", email: "dentista@teste.invalid" },
        },
      ]);
    }
    if (url.pathname === "/rest/v1/patients") {
      if (role !== "patient") return json(200, []);
      return json(200, [
        {
          id: "10000000-0000-4000-8000-000000000001",
          full_name: "Paciente Sintético",
          social_name: null,
          birth_date: "1990-05-10",
          profile_id: USERS.patient.id,
        },
      ]);
    }
    if (url.pathname === "/rest/v1/consents") return json(200, role === "patient" ? consents : []);
    if (url.pathname === "/rest/v1/patient_guardians") return json(200, []);

    json(404, { message: `not mocked: ${req.method} ${url.pathname}` });
  });
}).listen(port, "127.0.0.1", () => console.log(`mock supabase on ${port}`));
