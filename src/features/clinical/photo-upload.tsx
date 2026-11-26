"use client";

import { LoaderCircle } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { buttonClass } from "@/components/ui/button";
import type { ActionState } from "@/lib/action-state";
import { uploadClinicalFile } from "./actions";

/** Reduz a imagem no navegador (máx. 2048 px, JPEG 0,85) antes de enviar. */
async function compress(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob>((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error("compress"))), "image/jpeg", 0.85),
  );
  return new File([blob], file.name.replace(/\.\w+$/, ".jpg"), { type: "image/jpeg" });
}

export function ClinicalUpload({
  patientId,
  target,
  children,
}: {
  patientId: string;
  target: "photo" | "document";
  children?: React.ReactNode;
}) {
  const [state, action, pending] = useActionState(uploadClinicalFile, { status: "idle" } as ActionState);
  const [preparing, setPreparing] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  return (
    <form
      ref={formRef}
      className="flex flex-col gap-5"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const file = fd.get("file");
        if (file instanceof File && file.size > 0) {
          setPreparing(true);
          try {
            fd.set("file", await compress(file));
          } finally {
            setPreparing(false);
          }
        }
        action(fd);
      }}
    >
      <input type="hidden" name="patientId" value={patientId} />
      <input type="hidden" name="target" value={target} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`file-${target}`} className="text-sm font-medium text-olive">
          {target === "photo" ? "Fotografia" : "Arquivo (PDF ou imagem)"}
        </label>
        <input
          id={`file-${target}`}
          name="file"
          type="file"
          required
          accept={
            target === "photo" ? "image/jpeg,image/png,image/webp" : "application/pdf,image/jpeg,image/png,image/webp"
          }
          className="text-sm file:mr-3 file:rounded-full file:border-0 file:bg-olive file:px-4 file:py-2 file:text-ivory"
        />
      </div>
      {children}
      <div className="flex flex-wrap items-center gap-4">
        <button type="submit" disabled={pending || preparing} className={buttonClass("solid", "min-h-11")}>
          {(pending || preparing) && <LoaderCircle aria-hidden className="size-4 animate-spin" />}
          {preparing ? "Preparando imagem" : pending ? "Enviando" : "Enviar"}
        </button>
        <span aria-live="polite" className="text-sm">
          {state.status === "success" && <span className="text-olive">{state.message}</span>}
          {state.status === "error" && (
            <span role="alert" className="font-medium text-danger">
              {state.message}
            </span>
          )}
        </span>
      </div>
    </form>
  );
}
