"use client";

import { useReducedMotion, useScroll, useTransform } from "motion/react";
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { ToothIllustration } from "./tooth-illustration";

const ToothScene = dynamic(() => import("./tooth-scene"), { ssr: false });

type Capability = "pending" | "static" | "low" | "high";

/** Decide se o aparelho comporta o modelo 3D — e com qual qualidade. */
function detectCapability(): Capability {
  if (typeof window === "undefined") return "static";
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return "static";
  try {
    const canvas = document.createElement("canvas");
    if (!canvas.getContext("webgl2")) return "static";
  } catch {
    return "static";
  }
  const cores = nav.hardwareConcurrency ?? 4;
  const memory = nav.deviceMemory ?? 4;
  if (cores < 4 || memory < 2) return "static";
  if (cores >= 6 && memory >= 4 && window.innerWidth >= 768) return "high";
  return "low";
}

export function HeroTooth() {
  const container = useRef<HTMLDivElement>(null);
  const reducedMotion = useReducedMotion() ?? false;
  const [capability, setCapability] = useState<Capability>("pending");
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(true);

  const { scrollY } = useScroll();
  const progress = useTransform(scrollY, (y) =>
    typeof window === "undefined" ? 0 : Math.min(1, Math.max(0, y / window.innerHeight)),
  );

  // Carregamento progressivo: o 3D só começa depois que a página principal está pronta,
  // para não competir com o texto do hero (LCP).
  useEffect(() => {
    const start = () => setCapability(detectCapability());
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
    if (w.requestIdleCallback) {
      const id = w.requestIdleCallback(start, { timeout: 1500 });
      return () => (window as Window & { cancelIdleCallback?: (id: number) => void }).cancelIdleCallback?.(id);
    }
    const t = window.setTimeout(start, 400);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "120px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const use3d = capability === "high" || capability === "low";

  return (
    <div
      ref={container}
      className="relative size-full"
      data-tooth-mode={capability}
      role="img"
      aria-label="Ilustração conceitual de um dente molar com acabamento em porcelana"
    >
      {/* Sombra de contato — barata, em CSS. */}
      <div
        aria-hidden
        className="absolute bottom-[9%] left-1/2 h-[7%] w-[46%] -translate-x-1/2 rounded-[50%] bg-onyx/25 blur-2xl"
      />
      <div
        aria-hidden
        className={`absolute inset-0 grid place-items-center transition-opacity duration-1000 ease-silk ${
          use3d && ready ? "opacity-0" : "opacity-100"
        }`}
      >
        <ToothIllustration className="h-[72%] w-auto" />
      </div>
      {use3d && (
        <div
          aria-hidden
          className={`absolute inset-0 transition-opacity duration-[1400ms] ease-silk ${ready ? "opacity-100" : "opacity-0"}`}
        >
          <ToothScene
            progress={progress}
            reducedMotion={reducedMotion}
            quality={capability === "high" ? "high" : "low"}
            active={visible}
            onReady={() => setReady(true)}
          />
        </div>
      )}
    </div>
  );
}
