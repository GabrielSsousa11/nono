import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingRows, StudioPageHeader } from "@/components/studio/page-header";
import { InviteStaffForm, ResetMfaButton, RoleToggles } from "@/features/studio/team-forms";
import { can, isStaffRole, type StaffRole } from "@/lib/auth/access";
import { getSessionContext } from "@/lib/auth/session";

export const metadata: Metadata = { title: "Equipe e acessos" };

interface Member {
  id: string;
  name: string;
  email: string | null;
  roles: StaffRole[];
}

async function Team() {
  const { gate, access, supabase, user } = await getSessionContext();
  if (gate !== "ok") return null;
  if (!can(access, "users.manage")) {
    return <p className="text-mist">Somente administradores gerenciam a equipe.</p>;
  }
  const adminApiReady = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim());

  const { data, error } = await supabase!
    .from("user_roles")
    .select("user_id, role, profile:profiles!user_roles_user_id_fkey(full_name, email)")
    .in("role", ["admin", "dentist", "receptionist", "finance"]);

  if (error)
    return (
      <p role="alert" className="text-danger">
        Não foi possível carregar a equipe. Atualize a página.
      </p>
    );

  const members = new Map<string, Member>();
  for (const row of data ?? []) {
    const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
    const m: Member = members.get(row.user_id) ?? {
      id: row.user_id,
      name: profile?.full_name || "Sem nome",
      email: profile?.email ?? null,
      roles: [],
    };
    const role = String(row.role);
    if (isStaffRole(role)) m.roles.push(role);
    members.set(row.user_id, m);
  }
  const list = [...members.values()].sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

  return (
    <div className="flex flex-col gap-16">
      <section aria-labelledby="convidar-title" className="flex flex-col gap-6">
        <h2 id="convidar-title" className="font-display text-2xl">
          Convidar para a equipe
        </h2>
        <InviteStaffForm adminApiReady={adminApiReady} />
      </section>

      <section aria-labelledby="membros-title" className="flex flex-col gap-6">
        <h2 id="membros-title" className="font-display text-2xl">
          Membros ({list.length})
        </h2>
        <ul className="flex flex-col">
          {list.map((m) => (
            <li
              key={m.id}
              className="grid gap-4 border-t border-onyx/10 py-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]"
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  {m.name}
                  {m.id === user!.id && <span className="font-normal text-mist"> (você)</span>}
                </p>
                <p className="text-sm break-all text-mist">{m.email}</p>
              </div>
              <div className="flex flex-col gap-3">
                <RoleToggles userId={m.id} roles={m.roles} name={m.name} />
                {m.id !== user!.id && <ResetMfaButton userId={m.id} name={m.name} adminApiReady={adminApiReady} />}
              </div>
            </li>
          ))}
        </ul>
        <p className="text-xs text-mist">
          Recepção e financeiro não acessam prontuário. Toda alteração de função fica registrada na auditoria.
        </p>
      </section>
    </div>
  );
}

export default function TeamPage() {
  return (
    <>
      <StudioPageHeader
        title="Equipe e acessos"
        intro="Convide pessoas, defina funções e redefina a verificação em duas etapas."
      />
      <Suspense fallback={<LoadingRows />}>
        <Team />
      </Suspense>
    </>
  );
}
