"use client";

/* eslint-disable @next/next/no-img-element -- URLs assinadas temporárias do Storage privado, não otimizáveis pelo next/image */
import { useId, useState } from "react";
import { fmtPlainDate } from "@/lib/datetime";

export interface PhotoItem {
  id: string;
  url: string | null;
  taken_on: string;
  view_label: string | null;
  professional_notes: string | null;
}

/** CG Evolution: galeria cronológica + comparação antes/depois com controle deslizante. */
export function EvolutionViewer({ photos }: { photos: PhotoItem[] }) {
  const usable = photos.filter((p) => p.url);
  const [a, setA] = useState(usable[0]?.id ?? "");
  const [b, setB] = useState(usable[usable.length - 1]?.id ?? "");
  const [pos, setPos] = useState(50);
  const id = useId();
  const before = usable.find((p) => p.id === a);
  const after = usable.find((p) => p.id === b);
  const label = (p: PhotoItem) => `${fmtPlainDate(p.taken_on)}${p.view_label ? `, ${p.view_label}` : ""}`;

  if (usable.length === 0) return <p className="text-sm text-mist">Nenhuma fotografia disponível.</p>;
  return (
    <div className="flex flex-col gap-8">
      {usable.length >= 2 && before && after && (
        <div className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["Antes", a, setA],
              ["Depois", b, setB],
            ].map(([title, value, set]) => (
              <div key={title as string} className="flex flex-col gap-1.5">
                <label htmlFor={`${id}-${title}`} className="text-sm font-medium text-olive">
                  {title as string}
                </label>
                <select
                  id={`${id}-${title}`}
                  value={value as string}
                  onChange={(e) => (set as (v: string) => void)(e.target.value)}
                  className="border-0 border-b border-onyx/25 bg-transparent py-2 focus:ring-0"
                >
                  {usable.map((p) => (
                    <option key={p.id} value={p.id}>
                      {label(p)}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
          <figure className="relative aspect-[4/3] w-full max-w-3xl overflow-hidden rounded-lg bg-stone select-none">
            <img
              src={after.url!}
              alt={`Depois: ${label(after)}`}
              className="absolute inset-0 size-full object-contain"
            />
            <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}>
              <img
                src={before.url!}
                alt={`Antes: ${label(before)}`}
                className="absolute inset-0 size-full object-contain"
              />
            </div>
            <div aria-hidden className="absolute inset-y-0 w-0.5 bg-ivory shadow" style={{ left: `${pos}%` }} />
            <figcaption className="absolute bottom-2 left-2 rounded bg-onyx/70 px-2 py-1 text-xs text-ivory">
              {label(before)} × {label(after)}
            </figcaption>
          </figure>
          <label className="flex max-w-3xl flex-col gap-1.5 text-sm text-olive">
            Comparar (arraste)
            <input
              type="range"
              min={0}
              max={100}
              value={pos}
              onChange={(e) => setPos(Number(e.target.value))}
              className="accent-olive"
              aria-valuetext={`${pos}% antes`}
            />
          </label>
        </div>
      )}
      <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {usable.map((p) => (
          <li key={p.id} className="flex flex-col gap-2">
            <img
              src={p.url!}
              alt={`Fotografia clínica de ${label(p)}`}
              loading="lazy"
              className="aspect-[4/3] w-full rounded object-cover"
            />
            <p className="text-sm font-semibold">{label(p)}</p>
            {p.professional_notes && <p className="text-sm text-mist">{p.professional_notes}</p>}
          </li>
        ))}
      </ol>
    </div>
  );
}
