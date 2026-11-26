import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Badge } from "@/components/ui/empty";
import { isMinor } from "@/features/studio/patient-schema";
import { can, type Permission } from "@/lib/auth/access";
import { requireStaff } from "@/lib/auth/guards";
import { PatientTabs } from "./tabs";

async function Header({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await requireStaff("patients.read");
  if (!ctx || !/^[0-9a-f-]{36}$/.test(id)) notFound();
  const { data } = await ctx.supabase
    .from("patients")
    .select("full_name, social_name, birth_date, archived_at, profile_id")
    .eq("id", id)
    .maybeSingle();
  if (!data) notFound();
  const p = data as {
    full_name: string;
    social_name: string | null;
    birth_date: string | null;
    archived_at: string | null;
    profile_id: string | null;
  };
  const tabs: [string, string, Permission][] = [
    ["", "Cadastro e consultas", "patients.read"],
    ["/clinico", "Prontuário, odontograma e jornada", "clinical.read"],
    ["/fotos", "Fotos e documentos", "clinical.read"],
    ["/cuidados", "Hábitos, cuidados e mensagens", "care.manage"],
    ["/financeiro", "Financeiro", "finance.read"],
  ];
  return (
    <header className="mb-10 flex flex-col gap-5">
      <Link href="/studio/pacientes" className="text-sm text-olive hover:underline">
        Pacientes
      </Link>
      <div className="flex flex-wrap items-end gap-3">
        <h1 className="font-display text-[clamp(2.25rem,4vw,3.25rem)] leading-none">{p.social_name || p.full_name}</h1>
        {isMinor(p.birth_date) && <Badge tone="warn">Menor de idade</Badge>}
        {p.archived_at && <Badge tone="bad">Arquivado</Badge>}
        {p.profile_id && <Badge tone="good">Portal ativo</Badge>}
      </div>
      <PatientTabs
        base={`/studio/pacientes/${id}`}
        tabs={tabs.filter(([, , perm]) => can(ctx.access, perm)).map(([h, l]) => [h, l])}
      />
    </header>
  );
}

export default function PatientLayout({ children, params }: LayoutProps<"/studio/pacientes/[id]">) {
  return (
    <>
      <Suspense fallback={<div className="mb-10 h-24 animate-pulse bg-stone/60" />}>
        <Header params={params} />
      </Suspense>
      {children}
    </>
  );
}
