"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useId, useRef, useState, type KeyboardEvent } from "react";
import type { Service, ToothRegion } from "@/lib/content";

const REGION_LABEL: Record<ToothRegion, string> = {
  enamel: "Esmalte",
  crown: "Coroa",
  gum: "Gengiva e tecidos de suporte",
  root: "Raiz",
  arch: "Arcada",
  whole: "Dente e boca como um todo",
};

/** Diagrama esquemático em corte: destaca a região envolvida no tratamento. */
function RegionDiagram({ region }: { region: ToothRegion }) {
  const on = (r: ToothRegion | ToothRegion[]) =>
    region === "whole" || (Array.isArray(r) ? r.includes(region) : r === region);
  const tone = (active: boolean) => (active ? "#414d40" : "#d5c6b2");
  return (
    <svg viewBox="0 0 220 300" className="h-full w-auto" aria-hidden focusable="false">
      {/* gengiva */}
      <path
        d="M10 150 C40 140 60 168 110 168 C160 168 180 140 210 150 L210 300 L10 300 Z"
        fill={on("gum") ? "#c9a89a" : "#e9e3d7"}
        opacity={on("gum") ? 0.85 : 1}
        className="transition-all duration-700"
      />
      {/* raízes */}
      <path
        d="M70 160 C68 200 72 250 84 284 C88 292 96 290 97 280 C100 250 102 220 110 200 C118 220 120 250 123 280 C124 290 132 292 136 284 C148 250 152 200 150 160 Z"
        fill="#f4efe6"
        stroke={tone(on("root"))}
        strokeWidth={on("root") ? 2.4 : 1}
        className="transition-all duration-700"
      />
      {/* coroa (dentina) */}
      <path
        d="M58 110 C50 70 64 36 86 36 C96 36 102 44 110 44 C118 44 124 36 134 36 C156 36 170 70 162 110 C158 132 154 150 150 162 L70 162 C66 150 62 132 58 110 Z"
        fill="#f4efe6"
        stroke={tone(on(["crown"]))}
        strokeWidth={on("crown") ? 2.4 : 1}
        className="transition-all duration-700"
      />
      {/* esmalte */}
      <path
        d="M58 110 C50 70 64 36 86 36 C96 36 102 44 110 44 C118 44 124 36 134 36 C156 36 170 70 162 110"
        fill="none"
        stroke={on("enamel") ? "#b29a70" : "#e9e3d7"}
        strokeWidth={on("enamel") ? 7 : 4}
        strokeLinecap="round"
        className="transition-all duration-700"
      />
      {/* polpa */}
      <path d="M96 92 C96 76 104 72 110 80 C116 72 124 76 124 92 L120 170 L100 170 Z" fill="#ead9cf" opacity="0.7" />
    </svg>
  );
}

export function Treatments({ services }: { services: Service[] }) {
  const [active, setActive] = useState(0);
  const reduce = useReducedMotion();
  const baseId = useId();
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = services[active];

  const onKeyDown = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const last = services.length - 1;
    const next =
      e.key === "ArrowDown" || e.key === "ArrowRight"
        ? index === last
          ? 0
          : index + 1
        : e.key === "ArrowUp" || e.key === "ArrowLeft"
          ? index === 0
            ? last
            : index - 1
          : e.key === "Home"
            ? 0
            : e.key === "End"
              ? last
              : null;
    if (next === null) return;
    e.preventDefault();
    setActive(next);
    tabs.current[next]?.focus();
  };

  return (
    <div className="grid gap-12 lg:grid-cols-12">
      <div
        role="tablist"
        aria-orientation="vertical"
        aria-label="Tratamentos"
        className="flex snap-x gap-2 overflow-x-auto pb-2 lg:col-span-4 lg:flex-col lg:gap-0 lg:overflow-visible lg:pb-0"
      >
        {services.map((s, i) => {
          const selected = i === active;
          return (
            <button
              key={s.slug}
              ref={(el) => {
                tabs.current[i] = el;
              }}
              id={`${baseId}-tab-${s.slug}`}
              role="tab"
              type="button"
              aria-selected={selected}
              aria-controls={`${baseId}-panel`}
              tabIndex={selected ? 0 : -1}
              onClick={() => setActive(i)}
              onKeyDown={(e) => onKeyDown(e, i)}
              className={`group relative shrink-0 snap-start text-left transition-colors duration-500 lg:border-t lg:border-onyx/10 lg:py-6 lg:last:border-b ${
                selected ? "text-onyx" : "text-mist hover:text-onyx"
              } rounded-full border border-onyx/15 px-5 py-2.5 lg:rounded-none lg:border-x-0 lg:border-b-0 lg:px-0 ${
                selected ? "max-lg:border-olive max-lg:bg-olive max-lg:text-ivory" : ""
              }`}
            >
              <span className="font-display text-base whitespace-nowrap lg:text-[1.9rem] lg:leading-tight lg:whitespace-normal">
                {s.name}
              </span>
              {selected && (
                <motion.span
                  layoutId={reduce ? undefined : `${baseId}-marker`}
                  className="absolute top-1/2 -left-6 hidden h-px w-4 bg-gold lg:block"
                  aria-hidden
                />
              )}
            </button>
          );
        })}
      </div>

      <div
        id={`${baseId}-panel`}
        role="tabpanel"
        aria-labelledby={`${baseId}-tab-${current.slug}`}
        tabIndex={0}
        className="grid gap-10 sm:grid-cols-[minmax(0,1fr)_11rem] lg:col-span-7 lg:col-start-6 xl:grid-cols-[minmax(0,1fr)_14rem]"
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={current.slug}
            initial={reduce ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-8"
          >
            <p className="font-display text-[clamp(1.6rem,2.6vw,2.25rem)] leading-tight text-onyx">{current.summary}</p>
            <p className="max-w-[38rem] text-onyx/80">{current.explanation}</p>
            {current.steps.length > 0 && (
              <ol className="grid gap-6 border-t border-onyx/10 pt-8 sm:grid-cols-3">
                {current.steps.map((step, i) => (
                  <li key={step.title} className="flex flex-col gap-2">
                    <span className="font-display text-xl text-gold-ink" aria-hidden>
                      {i + 1}
                    </span>
                    <span className="text-sm font-semibold text-onyx">{step.title}</span>
                    <span className="text-sm text-mist">{step.description}</span>
                  </li>
                ))}
              </ol>
            )}
          </motion.div>
        </AnimatePresence>
        <figure className="flex flex-col items-center gap-3 self-start sm:sticky sm:top-28">
          <div className="h-56 xl:h-64">
            <RegionDiagram region={current.region} />
          </div>
          <figcaption className="text-center text-xs text-mist">
            Região envolvida: {REGION_LABEL[current.region]}
            <span className="block">Ilustração esquemática</span>
          </figcaption>
        </figure>
      </div>
    </div>
  );
}
