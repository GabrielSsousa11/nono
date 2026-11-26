"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Environment, Lightformer } from "@react-three/drei";
import type { MotionValue } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { MarchingCubes } from "three/examples/jsm/objects/MarchingCubes.js";
import { sampleToothField } from "./tooth-sdf";

/** Gera a geometria uma vez e devolve uma BufferGeometry compacta (sem os buffers do MC). */
function buildToothGeometry(resolution: number): THREE.BufferGeometry {
  const mc = new MarchingCubes(resolution, new THREE.MeshBasicMaterial(), false, false, 120_000);
  mc.isolation = 0;
  mc.field.set(sampleToothField(resolution, 10));
  mc.update();

  const count = mc.count;
  const src = mc.geometry;
  const position = (src.getAttribute("position").array as Float32Array).slice(0, count * 3);
  const normal = (src.getAttribute("normal").array as Float32Array).slice(0, count * 3);
  for (let i = 0; i < normal.length; i += 3) {
    const l = Math.hypot(normal[i], normal[i + 1], normal[i + 2]) || 1;
    normal[i] /= l;
    normal[i + 1] /= l;
    normal[i + 2] /= l;
  }
  src.dispose();
  (mc.material as THREE.Material).dispose();

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normal, 3));
  geometry.computeBoundingSphere();
  return geometry;
}

interface ToothProps {
  progress: MotionValue<number>;
  reducedMotion: boolean;
  resolution: number;
}

function Tooth({ progress, reducedMotion, resolution }: ToothProps) {
  const group = useRef<THREE.Group>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const geometry = useMemo(() => buildToothGeometry(resolution), [resolution]);
  const { size } = useThree();

  useEffect(() => () => geometry.dispose(), [geometry]);

  useEffect(() => {
    if (reducedMotion) return;
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      pointer.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [reducedMotion]);

  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    const p = progress.get();
    const idle = reducedMotion ? 0 : state.clock.elapsedTime * 0.12;
    const targetY = -0.55 + idle + p * Math.PI * 0.85;
    const targetX = 0.42 + p * 0.3 + (reducedMotion ? 0 : pointer.current.y * 0.08);
    const targetZ = -0.06 + (reducedMotion ? 0 : -pointer.current.x * 0.06);
    const k = 1 - Math.exp(-delta * 3.2);
    g.rotation.y += (targetY - g.rotation.y) * k;
    g.rotation.x += (targetX - g.rotation.x) * k;
    g.rotation.z += (targetZ - g.rotation.z) * k;
    g.position.y = 0.02 + p * 0.25 + (reducedMotion ? 0 : Math.sin(state.clock.elapsedTime * 0.6) * 0.015);
  });

  const scale = size.width < 640 ? 1.3 : 1.5;

  return (
    <group ref={group} scale={scale}>
      <mesh geometry={geometry} castShadow>
        <meshPhysicalMaterial
          color="#fbf6ec"
          roughness={0.3}
          metalness={0}
          clearcoat={1}
          clearcoatRoughness={0.18}
          sheen={0.25}
          sheenColor="#d5c6b2"
          sheenRoughness={0.6}
          specularIntensity={0.6}
          ior={1.52}
        />
      </mesh>
    </group>
  );
}

interface ToothSceneProps {
  progress: MotionValue<number>;
  reducedMotion: boolean;
  quality: "high" | "low";
  active: boolean;
  onReady?: () => void;
}

export default function ToothScene({ progress, reducedMotion, quality, active, onReady }: ToothSceneProps) {
  return (
    <Canvas
      dpr={quality === "high" ? [1, 1.75] : [1, 1.25]}
      frameloop={active ? "always" : "never"}
      camera={{ position: [0, 0.1, 4.4], fov: 30 }}
      gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.NeutralToneMapping;
        gl.toneMappingExposure = 1.12;
        onReady?.();
      }}
      aria-hidden
    >
      <hemisphereLight args={["#fffaf0", "#d5c6b2", 0.9]} />
      <directionalLight position={[2.5, 5, 4]} intensity={1.9} color="#fff8ec" />
      <directionalLight position={[-4, 1, -2]} intensity={0.55} color="#b29a70" />
      <Tooth progress={progress} reducedMotion={reducedMotion} resolution={quality === "high" ? 84 : 56} />
      {/* Ambiente de estúdio gerado localmente (sem download de HDR externo). */}
      <Environment resolution={quality === "high" ? 256 : 64} frames={1}>
        <Lightformer form="rect" intensity={2.4} color="#fffaf0" position={[0, 3, 2]} scale={[6, 1.4, 1]} />
        <Lightformer
          form="rect"
          intensity={1.1}
          color="#d5c6b2"
          position={[-4, 0, 1]}
          rotation-y={Math.PI / 2}
          scale={[4, 2, 1]}
        />
        <Lightformer
          form="ring"
          intensity={0.9}
          color="#b29a70"
          position={[4, 1, -1]}
          rotation-y={-Math.PI / 2}
          scale={2.4}
        />
        <Lightformer
          form="rect"
          intensity={0.5}
          color="#efe6d6"
          position={[0, -3, 0]}
          rotation-x={Math.PI / 2}
          scale={[8, 8, 1]}
        />
      </Environment>
    </Canvas>
  );
}
