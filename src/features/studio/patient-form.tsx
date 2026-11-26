import { ActionForm, Input, Select, TextArea } from "@/components/ui/action-form";
import type { ActionState } from "@/lib/action-state";

export interface PatientFormValues {
  id?: string;
  full_name?: string;
  social_name?: string | null;
  birth_date?: string | null;
  cpf?: string | null;
  phone?: string | null;
  email?: string | null;
  responsible_professional_id?: string | null;
  admin_notes?: string | null;
}

export function PatientForm({
  action,
  values = {},
  professionals,
  submitLabel,
}: {
  action: (p: ActionState, fd: FormData) => Promise<ActionState>;
  values?: PatientFormValues;
  professionals: { id: string; display_name: string }[];
  submitLabel: string;
}) {
  return (
    <ActionForm
      action={action}
      submitLabel={submitLabel}
      hidden={values.id ? { id: values.id } : undefined}
      className="max-w-3xl"
    >
      <div className="grid gap-5 sm:grid-cols-2">
        <Input
          label="Nome completo"
          name="fullName"
          required
          defaultValue={values.full_name ?? ""}
          className="sm:col-span-2"
        />
        <Input
          label="Nome social"
          name="socialName"
          defaultValue={values.social_name ?? ""}
          hint="Como a pessoa prefere ser chamada."
        />
        <Input label="Data de nascimento" name="birthDate" type="date" defaultValue={values.birth_date ?? ""} />
        <Input label="CPF" name="cpf" inputMode="numeric" defaultValue={values.cpf ?? ""} />
        <Input label="Telefone" name="phone" type="tel" inputMode="tel" defaultValue={values.phone ?? ""} />
        <Input label="E-mail" name="email" type="email" defaultValue={values.email ?? ""} className="sm:col-span-2" />
        <Select
          label="Profissional responsável"
          name="responsibleProfessionalId"
          defaultValue={values.responsible_professional_id ?? ""}
          options={[
            { value: "", label: "Não definido" },
            ...professionals.map((p) => ({ value: p.id, label: p.display_name })),
          ]}
          className="sm:col-span-2"
        />
        <TextArea
          label="Observações administrativas"
          name="adminNotes"
          defaultValue={values.admin_notes ?? ""}
          hint="Não registre informações clínicas aqui — use o prontuário."
          className="sm:col-span-2"
        />
      </div>
    </ActionForm>
  );
}
