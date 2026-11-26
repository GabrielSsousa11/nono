import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingRows, StudioPageHeader } from "@/components/studio/page-header";
import { ActionForm, Input } from "@/components/ui/action-form";
import { NotAllowed } from "@/components/ui/empty";
import { performCheckin } from "@/features/care/actions";
import { requireStaff } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Check-in" };

async function Content({ searchParams }: { searchParams: Promise<{ codigo?: string }> }) {
  const ctx = await requireStaff("checkin.perform");
  if (!ctx) return <NotAllowed />;
  const { codigo = "" } = await searchParams;
  return (
    <ActionForm action={performCheckin} submitLabel="Registrar chegada" pendingLabel="Verificando" className="max-w-xl">
      <Input
        label="Código do QR Code"
        name="codigo"
        required
        defaultValue={/^[0-9a-f]{48}$/.test(codigo) ? codigo : ""}
        hint="Leia o QR Code do paciente com a câmera deste aparelho (abre esta página já preenchida) ou cole o link."
        autoComplete="off"
      />
    </ActionForm>
  );
}

export default function CheckinPage({ searchParams }: PageProps<"/studio/checkin">) {
  return (
    <>
      <StudioPageHeader
        title="Check-in"
        intro="Confirme a chegada pelo QR Code do CG Passport. O código vale 10 minutos e só pode ser usado uma vez."
      />
      <Suspense fallback={<LoadingRows />}>
        <Content searchParams={searchParams as Promise<{ codigo?: string }>} />
      </Suspense>
    </>
  );
}
