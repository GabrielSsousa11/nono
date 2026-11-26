import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoadingRows, StudioPageHeader } from "@/components/studio/page-header";
import { Empty, NotAllowed } from "@/components/ui/empty";
import { requireStaff } from "@/lib/auth/guards";
import { fmtDateTime } from "@/lib/datetime";

export const metadata: Metadata = { title: "Auditoria" };

const ACTION: Record<string, string> = { insert: "criou", update: "alterou", delete: "removeu" };

async function Content({ searchParams }: { searchParams: Promise<{ tipo?: string; pagina?: string }> }) {
  const ctx = await requireStaff("audit.read");
  if (!ctx) return <NotAllowed />;
  const sp = await searchParams;
  const page = Math.max(0, Number(sp.pagina ?? 0) || 0);
  let q = ctx.supabase
    .from("audit_logs")
    .select("id, occurred_at, action, entity_type, entity_id, metadata, profiles:actor_id(full_name, email)")
    .order("id", { ascending: false })
    .range(page * 50, page * 50 + 49);
  if (sp.tipo && /^[a-z_.]+$/.test(sp.tipo)) q = q.eq("entity_type", sp.tipo);
  const { data } = await q;
  const rows = (data ?? []) as unknown as {
    id: number;
    occurred_at: string;
    action: string;
    entity_type: string;
    entity_id: string | null;
    metadata: { columns?: string[]; role?: string };
    profiles: { full_name: string; email: string | null } | null;
  }[];
  return (
    <div className="flex flex-col gap-6">
      <form className="flex items-end gap-3">
        <label className="flex flex-col gap-1 text-sm text-olive">
          Tipo de registro
          <select
            name="tipo"
            defaultValue={sp.tipo ?? ""}
            className="min-h-10 rounded-full border border-onyx/15 bg-transparent px-3 text-sm text-onyx"
          >
            <option value="">Todos</option>
            {[
              "patients",
              "appointments",
              "clinical_records",
              "tooth_records",
              "treatment_plans",
              "clinical_photos",
              "consents",
              "user_roles",
              "patient_guardians",
              "invoices",
              "clinic_settings",
              "auth.users",
              "booking_requests",
            ].map((t) => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </label>
        <button type="submit" className="min-h-10 rounded-full bg-olive px-4 text-sm text-ivory">
          Filtrar
        </button>
      </form>
      {rows.length === 0 ? (
        <Empty>Nenhum registro.</Empty>
      ) : (
        <ol className="flex flex-col text-sm">
          {rows.map((r) => (
            <li key={r.id} className="border-b border-onyx/10 py-2.5">
              <span className="text-mist">{fmtDateTime(r.occurred_at)}</span> ·{" "}
              <strong>{r.profiles?.full_name || r.profiles?.email || "Sistema"}</strong> {ACTION[r.action] ?? r.action}{" "}
              <code className="text-xs">{r.entity_type}</code>
              {r.entity_id && <code className="text-xs text-mist"> {r.entity_id.slice(0, 8)}</code>}
              {r.metadata?.columns && <span className="text-mist"> (campos: {r.metadata.columns.join(", ")})</span>}
              {r.metadata?.role && <span className="text-mist"> (função: {r.metadata.role})</span>}
            </li>
          ))}
        </ol>
      )}
      <nav className="flex gap-4 text-sm" aria-label="Paginação">
        {page > 0 && (
          <Link
            href={`/studio/auditoria?pagina=${page - 1}${sp.tipo ? `&tipo=${sp.tipo}` : ""}`}
            className="text-olive underline"
          >
            Mais recentes
          </Link>
        )}
        {rows.length === 50 && (
          <Link
            href={`/studio/auditoria?pagina=${page + 1}${sp.tipo ? `&tipo=${sp.tipo}` : ""}`}
            className="text-olive underline"
          >
            Mais antigos
          </Link>
        )}
      </nav>
    </div>
  );
}

export default function AuditPage({ searchParams }: PageProps<"/studio/auditoria">) {
  return (
    <>
      <StudioPageHeader
        title="Auditoria"
        intro="Quem criou ou alterou cada registro. Valores pessoais e clínicos não são copiados para a auditoria."
      />
      <Suspense fallback={<LoadingRows />}>
        <Content searchParams={searchParams as Promise<{ tipo?: string; pagina?: string }>} />
      </Suspense>
    </>
  );
}
