"use client";

import { useSearchParams } from "next/navigation";

export function LinkError() {
  const params = useSearchParams();
  if (params.get("erro") !== "link") return null;
  return (
    <p role="alert" className="mb-8 border-l-2 border-danger pl-4 text-sm text-danger">
      O link de acesso expirou ou já foi usado. Peça um novo link abaixo.
    </p>
  );
}
