import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { LoadingRows, StudioPageHeader } from "@/components/studio/page-header";
import { buttonClass } from "@/components/ui/button";
import { Badge, Empty, NotAllowed } from "@/components/ui/empty";
import { maskPhone } from "@/features/booking/schema";
import { isMinor } from "@/features/studio/patient-schema";
import { can } from "@/lib/auth/access";
import { requireStaff } from "@/lib/auth/guards";
import { fmtPlainDate } from "@/lib/datetime";

export const metadata: Metadata = { title: "Pacientes" };

interface Row { id: string; full_name: string; social_name: string | null; birth_date: string | null; phone: string | null; profile_id: string | null; archived_at: string | null }

async function List({ searchParams }: { searchParams: Promise<{ q?: string; arquivados?: string }> }) {
  const ctx = await requireStaff("patients.read");
  if (!ctx) return <NotAllowed />;
  const { q = "", arquivados } = await searchParams;
  let query = ctx.supabase.from("patients").select("id, full_name, social_name, birth_date, phone, profile_id, archived_at").order("full_name").limit(100);
  query = arquivados ? query.not("archived_at", "is", null) : query.is("archived_at", null);
  const term = q.trim().slice(0, 60);
  if (term) {
    const digits = term.replace(/\D/g, "");
    query = digits.length >= 4 ? query.or(`phone.ilike.%${digits}%,cpf.eq.${digits}`) : query.ilike("full_name", `%${term.replace(/[%_,()]/g, "")}%`);
  }
  const { data, error } = await query;
  if (error) return <p role="alert" className="text-danger">Não foi possível carregar os pacientes.</p>;
  const rows = (data ?? []) as Row[];

  return (
    <div className="flex flex-col gap-8">
      <form className="flex flex-wrap items-end gap-4" role="search">
        <div className="flex min-w-64 flex-1 flex-col gap-1.5">
          <label htmlFor="q" className="text-sm font-medium text-olive">Buscar por nome, telefone ou CPF</label>
          <input id="q" name="q" defaultValue={term} className="border-0 border-b border-onyx/25 bg-transparent py-2.5 focus:border-olive focus:ring-0 focus:outline-none" />
        </div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="arquivados" value="1" defaultChecked={Boolean(arquivados)} className="accent-olive" /> Arquivados</label>
        <button type="submit" className={buttonClass("outline", "min-h-11")}>Buscar</button>
        {can(ctx.access, "patients.write") && <Link href="/studio/pacientes/novo" className={buttonClass("solid", "min-h-11")}>Novo paciente</Link>}
      </form>
      {rows.length === 0 ? (
        <Empty>{term ? "Nenhum paciente encontrado para esta busca." : "Nenhum paciente cadastrado ainda."}</Empty>
      ) : (
        <ul className="flex flex-col">
          {rows.map((p) => (
            <li key={p.id} className="border-b border-onyx/10">
              <Link href={`/studio/pacientes/${p.id}`} className="flex flex-wrap items-center justify-between gap-3 py-4 hover:bg-stone/40">
                <span>
                  <span className="font-semibold">{p.social_name || p.full_name}</span>
                  {p.social_name && <span className="text-sm text-mist"> ({p.full_name})</span>}
                  <span className="block text-sm text-mist">
                    {p.birth_date ? fmtPlainDate(p.birth_date) : "Nascimento não informado"}
                    {p.phone && ` · ${maskPhone(p.phone.replace(/^55/, ""))}`}
                  </span>
                </span>
                <span className="flex gap-2">
                  {isMinor(p.birth_date) && <Badge tone="warn">Menor de idade</Badge>}
                  {p.profile_id && <Badge tone="good">Portal ativo</Badge>}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function PatientsPage({ searchParams }: PageProps<"/studio/pacientes">) {
  return (
    <>
      <StudioPageHeader title="Pacientes" intro="Cadastro administrativo. Informações clínicas ficam no prontuário, visível apenas para a equipe clínica." />
      <Suspense fallback={<LoadingRows />}>
        <List searchParams={searchParams as Promise<{ q?: string; arquivados?: string }>} />
      </Suspense>
    </>
  );
}
