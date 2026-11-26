import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingRows, StudioPageHeader } from "@/components/studio/page-header";
import { NotAllowed } from "@/components/ui/empty";
import { createPatient } from "@/features/studio/patient-actions";
import { PatientForm } from "@/features/studio/patient-form";
import { requireStaff } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Novo paciente" };

async function Form() {
  const ctx = await requireStaff("patients.write");
  if (!ctx) return <NotAllowed />;
  const { data } = await ctx.supabase
    .from("professionals")
    .select("id, display_name")
    .eq("active", true)
    .order("display_name");
  return (
    <PatientForm
      action={createPatient}
      professionals={(data ?? []) as { id: string; display_name: string }[]}
      submitLabel="Cadastrar paciente"
    />
  );
}

export default function NewPatientPage() {
  return (
    <>
      <StudioPageHeader title="Novo paciente" />
      <Suspense fallback={<LoadingRows />}>
        <Form />
      </Suspense>
    </>
  );
}
