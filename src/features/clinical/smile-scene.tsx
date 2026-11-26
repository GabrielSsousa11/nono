"use client";

import { OrbitControls, RoundedBox } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo, useState } from "react";
import { PERMANENT_LOWER, PERMANENT_UPPER, stateColor, toothFamily, type ToothState } from "./teeth";

const SIZE: Record<number, [number, number, number]> = {
  0: [0.42, 0.9, 0.32],
  1: [0.46, 1.0, 0.46],
  2: [0.5, 0.78, 0.55],
  3: [0.74, 0.72, 0.72],
};

/** Posições ao longo de uma arcada parabólica, proporcionais à largura de cada dente. */
function layout(teeth: number[], radius: number) {
  const widths = teeth.map((t) => SIZE[toothFamily(t)][0] + 0.06);
  const total = widths.reduce((a, b) => a + b, 0);
  let cum = 0;
  return teeth.map((t, i) => {
    const center = cum + widths[i] / 2;
    cum += widths[i];
    const s = (center - total / 2) / (total / 2);
    return { fdi: t, x: s * radius, z: -(1 - s * s) * radius * 0.95, rot: -Math.atan(1.9 * s) };
  });
}

function Tooth({
  fdi,
  position,
  rotation,
  upper,
  state,
  selected,
  onSelect,
}: {
  fdi: number;
  position: [number, number, number];
  rotation: number;
  upper: boolean;
  state: ToothState | undefined;
  selected: boolean;
  onSelect: (fdi: number) => void;
}) {
  const [hover, setHover] = useState(false);
  const [w, h, d] = SIZE[toothFamily(fdi)];
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox
        args={[w, h, d]}
        radius={Math.min(w, d) * 0.32}
        smoothness={3}
        position={[0, upper ? -h / 2 : h / 2, 0]}
        onClick={(e) => {
          e.stopPropagation();
          onSelect(fdi);
        }}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHover(true);
          document.body.style.cursor = "pointer";
        }}
        onPointerOut={() => {
          setHover(false);
          document.body.style.cursor = "";
        }}
      >
        <meshPhysicalMaterial
          color={stateColor[state ?? "none"]}
          roughness={0.35}
          clearcoat={0.8}
          emissive={selected ? "#b29a70" : hover ? "#d5c6b2" : "#000000"}
          emissiveIntensity={selected ? 0.55 : hover ? 0.25 : 0}
        />
      </RoundedBox>
    </group>
  );
}

export default function SmileScene({
  summary,
  selected,
  onSelect,
}: {
  summary: Record<number, ToothState>;
  selected: number | null;
  onSelect: (fdi: number) => void;
}) {
  const upper = useMemo(() => layout(PERMANENT_UPPER, 3.1), []);
  const lower = useMemo(() => layout(PERMANENT_LOWER, 2.85), []);
  return (
    <Canvas camera={{ position: [0, 3.2, 6.2], fov: 38 }} dpr={[1, 1.75]} aria-hidden>
      <hemisphereLight args={["#fffaf0", "#d5c6b2", 1]} />
      <directionalLight position={[3, 6, 4]} intensity={1.6} />
      <directionalLight position={[-4, 2, -3]} intensity={0.4} color="#b29a70" />
      <group position={[0, 0, 1.3]}>
        {upper.map((t) => (
          <Tooth key={t.fdi} fdi={t.fdi} position={[t.x, 0.08, t.z]} rotation={t.rot} upper state={summary[t.fdi]} selected={selected === t.fdi} onSelect={onSelect} />
        ))}
        {lower.map((t) => (
          <Tooth key={t.fdi} fdi={t.fdi} position={[t.x, -0.08, t.z]} rotation={t.rot} upper={false} state={summary[t.fdi]} selected={selected === t.fdi} onSelect={onSelect} />
        ))}
      </group>
      <OrbitControls enablePan={false} minDistance={4} maxDistance={11} maxPolarAngle={Math.PI * 0.62} />
    </Canvas>
  );
}
