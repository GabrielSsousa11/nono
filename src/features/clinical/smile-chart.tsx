"use client";

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import { DECIDUOUS_LOWER, DECIDUOUS_UPPER, PERMANENT_LOWER, PERMANENT_UPPER, stateColor, stateLabel, toothName, type ToothState } from "./teeth";

const SmileScene = dynamic(() => import("./smile-scene"), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-mist">Carregando modelo 3D…</p>,
});

function supports3d(): boolean {
  try {
    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    if (nav.connection?.saveData) return false;
    if ((nav.hardwareConcurrency ?? 4) < 4) return false;
    return Boolean(document.createElement("canvas").getContext("webgl2"));
  } catch {
    return false;
  }
}
const subscribe = () => () => {};

/** Odontograma em 2D: alternativa acessível (teclado/leitor de tela) e para aparelhos modestos. */
function Odontogram2D({
  summary,
  selected,
  onSelect,
  dentition,
}: {
  summary: Record<number, ToothState>;
  selected: number | null;
  onSelect: (n: number) => void;
  dentition: string;
}) {
  const rows: number[][] =
    dentition === "deciduous" ? [DECIDUOUS_UPPER, DECIDUOUS_LOWER] : dentition === "mixed" ? [PERMANENT_UPPER, DECIDUOUS_UPPER, DECIDUOUS_LOWER, PERMANENT_LOWER] : [PERMANENT_UPPER, PERMANENT_LOWER];
  return (
    <div className="flex flex-col gap-3 overflow-x-auto py-2" role="group" aria-label="Odontograma em duas dimensões">
      {rows.map((row, i) => (
        <div key={i} className="mx-auto flex gap-1">
          {row.map((n, j) => {
            const st = summary[n];
            return (
              <button
                key={n}
                type="button"
                onClick={() => onSelect(n)}
                aria-pressed={selected === n}
                aria-label={`Dente ${n}, ${toothName(n)}${st ? `: ${stateLabel[st]}` : ""}`}
                className={`flex h-14 w-9 flex-col items-center justify-between rounded-md border py-1 text-[0.6875rem] ${j === row.length / 2 ? "ml-3" : ""} ${selected === n ? "border-gold-ink ring-2 ring-gold" : "border-onyx/20"}`}
                style={{ background: st ? stateColor[st] : stateColor.none, color: st === "completed" || st === "existing" ? "#f7f4ed" : "#202420" }}
              >
                <span aria-hidden>{n}</span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function SmileChart({
  summary,
  selected,
  onSelect,
  dentition = "permanent",
}: {
  summary: Record<number, ToothState>;
  selected: number | null;
  onSelect: (n: number) => void;
  dentition?: string;
}) {
  const capable = useSyncExternalStore(subscribe, supports3d, () => false);
  const [mode, setMode] = useState<"auto" | "2d" | "3d">("auto");
  const show3d = dentition === "permanent" && (mode === "3d" || (mode === "auto" && capable));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-mist">
          Representação esquemática da arcada — não é um exame nem a imagem real dos dentes.
          {show3d && " Arraste para girar, use a roda ou pinça para aproximar e toque em um dente."}
        </p>
        {dentition === "permanent" && (
          <button type="button" className="text-sm text-olive underline underline-offset-4" onClick={() => setMode(show3d ? "2d" : "3d")}>
            {show3d ? "Ver em 2D" : "Ver em 3D"}
          </button>
        )}
      </div>
      {show3d ? (
        <>
          <div className="h-[22rem] w-full rounded-lg bg-gradient-to-b from-porcelain to-stone sm:h-[28rem]">
            <SmileScene summary={summary} selected={selected} onSelect={onSelect} />
          </div>
          <details>
            <summary className="cursor-pointer text-sm text-olive">Selecionar dente pela lista (teclado e leitores de tela)</summary>
            <Odontogram2D summary={summary} selected={selected} onSelect={onSelect} dentition={dentition} />
          </details>
        </>
      ) : (
        <Odontogram2D summary={summary} selected={selected} onSelect={onSelect} dentition={dentition} />
      )}
      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs" aria-label="Legenda">
        {(Object.keys(stateLabel) as ToothState[]).map((s) => (
          <li key={s} className="flex items-center gap-2">
            <span aria-hidden className="size-3.5 rounded-sm border border-onyx/20" style={{ background: stateColor[s] }} />
            {stateLabel[s]}
          </li>
        ))}
        <li className="flex items-center gap-2"><span aria-hidden className="size-3.5 rounded-sm border border-onyx/20" style={{ background: stateColor.none }} />Sem registro</li>
      </ul>
    </div>
  );
}
