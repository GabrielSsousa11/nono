import type { Metadata } from "next";
import { Suspense } from "react";
import { LoadingRows, StudioPageHeader } from "@/components/studio/page-header";
import { ActionForm, Checkbox, Input } from "@/components/ui/action-form";
import { NotAllowed } from "@/components/ui/empty";
import { saveSettings } from "@/features/studio/settings-actions";
import { SETTINGS_SPEC } from "@/features/studio/settings-spec";
import { requireStaff } from "@/lib/auth/guards";

export const metadata: Metadata = { title: "Configurações" };

async function Content() {
  const ctx = await requireStaff("settings.manage");
  if (!ctx) return <NotAllowed />;
  const { data } = await ctx.supabase.from("clinic_settings").select("key, value");
  const values = Object.fromEntries(((data ?? []) as { key: string; value: unknown }[]).map((r) => [r.key, r.value]));
  return (
    <ActionForm action={saveSettings} submitLabel="Salvar configurações" className="max-w-2xl">
      <div className="flex flex-col gap-6">
        {SETTINGS_SPEC.map((s) =>
          s.type === "boolean" ? (
            <Checkbox key={s.key} label={s.label} name={s.key} defaultChecked={values[s.key] !== false} />
          ) : (
            <Input
              key={s.key}
              label={s.label}
              name={s.key}
              type="number"
              min={s.min}
              max={s.max}
              required
              defaultValue={String(values[s.key] ?? "")}
            />
          ),
        )}
      </div>
    </ActionForm>
  );
}

export default function SettingsPage() {
  return (
    <>
      <StudioPageHeader
        title="Configurações"
        intro="Regras da agenda e da lista de espera. Alterações ficam registradas na auditoria."
      />
      <Suspense fallback={<LoadingRows />}>
        <Content />
      </Suspense>
    </>
  );
}
