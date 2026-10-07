"use client";

import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { ContactShadows, OrbitControls, RoundedBox } from "@react-three/drei";

import { cargoBinFor, type PlacedBox } from "@/lib/cargo-packing";

export type CameraPreset = "iso" | "top" | "side" | "rear";

export type TruckSpec = {
  /** Cargo bed (outer) size in metres. */
  length: number;
  width: number;
  height: number;
  type: string;
  climate: string;
};

type TruckClass = "small" | "medium" | "large" | "trailer";

type Profile = {
  wheelRadius: number;
  wheelWidth: number;
  /** Height of the cargo floor above the ground. */
  floor: number;
  cabLength: number;
  cabHeight: number;
  hood: number;
  tandem: boolean;
  dual: boolean;
};

const PROFILES: Record<TruckClass, Profile> = {
  small: { wheelRadius: 0.33, wheelWidth: 0.2, floor: 0.82, cabLength: 1.15, cabHeight: 1.25, hood: 0.8, tandem: false, dual: false },
  medium: { wheelRadius: 0.4, wheelWidth: 0.22, floor: 1.0, cabLength: 1.5, cabHeight: 1.55, hood: 0, tandem: false, dual: true },
  large: { wheelRadius: 0.5, wheelWidth: 0.26, floor: 1.2, cabLength: 1.8, cabHeight: 1.8, hood: 0, tandem: false, dual: true },
  trailer: { wheelRadius: 0.52, wheelWidth: 0.28, floor: 1.3, cabLength: 2.0, cabHeight: 2.0, hood: 0, tandem: true, dual: true },
};

function classify(spec: TruckSpec): TruckClass {
  const label = spec.type.toLowerCase();
  if (label.includes("trailer") || label.includes("reefer") || spec.length >= 9) return "trailer";
  if (spec.length < 3) return "small";
  if (spec.length < 5) return "medium";
  return "large";
}

const CAB_COLOR = "#0d9488";
const GLASS = "#0b2538";

/** A box of a given size at a given position. */
function Part({
  p,
  s,
  c,
  metal = 0.15,
  rough = 0.55,
  emissive,
  glow = 0,
  rot,
  shadow = true,
}: {
  p: [number, number, number];
  s: [number, number, number];
  c: string;
  metal?: number;
  rough?: number;
  emissive?: string;
  glow?: number;
  rot?: [number, number, number];
  shadow?: boolean;
}) {
  return (
    <mesh position={p} rotation={rot} castShadow={shadow} receiveShadow>
      <boxGeometry args={s} />
      <meshStandardMaterial color={c} metalness={metal} roughness={rough} emissive={emissive ?? "#000000"} emissiveIntensity={glow} />
    </mesh>
  );
}

function Glass({ p, s, rot }: { p: [number, number, number]; s: [number, number, number]; rot?: [number, number, number] }) {
  return (
    <mesh position={p} rotation={rot}>
      <boxGeometry args={s} />
      <meshPhysicalMaterial color={GLASS} metalness={0.3} roughness={0.08} clearcoat={1} clearcoatRoughness={0.05} transparent opacity={0.88} />
    </mesh>
  );
}

/** Tire with grooved tread and rounded shoulders, a dished steel rim, hub and lug nuts. `side` is the outward (z) direction. */
function Wheel({ position, radius, width, side }: { position: [number, number, number]; radius: number; width: number; side: 1 | -1 }) {
  const tire = useMemo(() => {
    const r = radius;
    const t = width;
    const inner = r * 0.6;
    const profile = [
      [inner, -t / 2], [r * 0.93, -t / 2], [r * 0.985, -t * 0.44], [r, -t * 0.36],
      [r, -t * 0.24], [r * 0.972, -t * 0.2], [r * 0.972, -t * 0.12], [r, -t * 0.08],
      [r, t * 0.08], [r * 0.972, t * 0.12], [r * 0.972, t * 0.2], [r, t * 0.24],
      [r, t * 0.36], [r * 0.985, t * 0.44], [r * 0.93, t / 2], [inner, t / 2],
    ].map(([x, y]) => new THREE.Vector2(x, y));
    return new THREE.LatheGeometry(profile, 56);
  }, [radius, width]);

  useEffect(() => () => tire.dispose(), [tire]);

  const inner = radius * 0.6;
  const outerFace = (width / 2) * side;
  const lugs = Array.from({ length: 8 }, (_, i) => (i / 8) * Math.PI * 2);

  return (
    <group position={position} rotation={[Math.PI / 2, 0, 0]}>
      <mesh geometry={tire} castShadow receiveShadow>
        <meshStandardMaterial color="#17181b" roughness={0.92} metalness={0.05} />
      </mesh>
      <mesh>
        <cylinderGeometry args={[inner * 1.02, inner * 1.02, width * 0.82, 40]} />
        <meshStandardMaterial color="#cdd3dc" metalness={0.85} roughness={0.28} />
      </mesh>
      <mesh position={[0, outerFace * 0.9, 0]}>
        <cylinderGeometry args={[inner * 0.62, inner * 0.92, width * 0.12, 40]} />
        <meshStandardMaterial color="#a7afbb" metalness={0.8} roughness={0.35} />
      </mesh>
      <mesh position={[0, outerFace * 1.02, 0]}>
        <cylinderGeometry args={[radius * 0.17, radius * 0.17, width * 0.16, 24]} />
        <meshStandardMaterial color="#3a3f47" metalness={0.7} roughness={0.4} />
      </mesh>
      {lugs.map((angle, i) => (
        <mesh key={i} position={[Math.cos(angle) * radius * 0.3, outerFace * 1.08, Math.sin(angle) * radius * 0.3]}>
          <cylinderGeometry args={[radius * 0.034, radius * 0.034, width * 0.1, 6]} />
          <meshStandardMaterial color="#e5e7eb" metalness={0.9} roughness={0.25} />
        </mesh>
      ))}
    </group>
  );
}

/** Half-cylinder fender above a wheel (or a dual wheel set). */
function Fender({ position, radius, width }: { position: [number, number, number]; radius: number; width: number }) {
  return (
    <mesh position={position} rotation={[Math.PI / 2, 0, 0]} castShadow>
      <cylinderGeometry args={[radius * 1.14, radius * 1.14, width, 32, 1, true, Math.PI / 2, Math.PI]} />
      <meshStandardMaterial color="#1f2937" metalness={0.3} roughness={0.6} side={THREE.DoubleSide} />
    </mesh>
  );
}

function Truck({ spec }: { spec: TruckSpec }) {
  const cls = classify(spec);
  const prof = PROFILES[cls];
  const { length: L, width: W, height: H } = spec;
  const { wheelRadius: R, wheelWidth: T, floor } = prof;
  const hooded = cls === "small";

  const cabW = Math.min(W, 2.5) * 0.97;
  const cabBottom = floor - (hooded ? 0.1 : 0.22);
  const cabL = prof.cabLength;
  const gap = 0.12;
  const cabFrontCabin = -L / 2 - gap - cabL; // foremost face of the cabin
  const cabCx = cabFrontCabin + cabL / 2;
  const cabCy = cabBottom + prof.cabHeight / 2;
  const frontX = cabFrontCabin - prof.hood; // foremost point of the vehicle
  const noseH = hooded ? 0.62 : prof.cabHeight; // height of the nose face carrying lights and grille

  const frontAxleX = hooded ? frontX + 0.5 : cabCx - cabL * 0.05;
  const rearAxleX = L / 2 - (cls === "trailer" ? 0.8 : 0.95);
  const rearAxles = prof.tandem ? [rearAxleX, rearAxleX - 1.35] : [rearAxleX];
  const frontZ = cabW / 2 - T * 0.45;
  const dualGap = T * 1.06;
  const rearOuterZ = W / 2 - T * 0.58;
  const lowerNose = cabBottom + (hooded ? 0 : 0);

  const posts = Math.max(1, Math.floor(L / 1.4));
  const crossCount = Math.max(3, Math.floor(L / 1.2));
  const accent = CAB_COLOR;

  return (
    <group>
      {/* chassis rails + cross members */}
      {[1, -1].map((side) => (
        <Part key={`rail-${side}`} p={[(frontAxleX - 0.5 + L / 2 + 0.15) / 2, floor - 0.19, side * (W * 0.3)]} s={[L / 2 + 0.15 - (frontAxleX - 0.5), 0.16, 0.1]} c="#1f2937" metal={0.5} rough={0.5} />
      ))}
      {Array.from({ length: crossCount }, (_, i) => {
        const x = frontAxleX + ((L / 2 - frontAxleX) * (i + 0.5)) / crossCount;
        return <Part key={`cross-${i}`} p={[x, floor - 0.18, 0]} s={[0.07, 0.1, W * 0.6]} c="#1f2937" metal={0.5} />;
      })}
      {/* fuel tank */}
      {cls !== "small" && (
        <mesh position={[frontAxleX + 1.3, floor - 0.38, W * 0.33]} rotation={[0, 0, Math.PI / 2]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.95, 24]} />
          <meshStandardMaterial color="#9aa4b2" metalness={0.8} roughness={0.35} />
        </mesh>
      )}

      {/* ---------- cargo body ---------- */}
      <Part p={[0, floor - 0.05, 0]} s={[L, 0.1, W]} c="#475569" metal={0.3} />
      {[1, -1].map((side) => (
        <Part key={`skirt-${side}`} p={[0, floor + 0.12, side * (W / 2 - 0.025)]} s={[L, 0.24, 0.05]} c="#eef2f6" rough={0.4} />
      ))}
      <Part p={[-L / 2 + 0.025, floor + 0.12, 0]} s={[0.05, 0.24, W]} c="#eef2f6" rough={0.4} />
      <Part p={[L / 2 - 0.025, floor + 0.12, 0]} s={[0.05, 0.24, W]} c="#eef2f6" rough={0.4} />
      {[1, -1].map((side) => (
        <Part key={`stripe-${side}`} p={[0, floor + 0.2, side * (W / 2 - 0.001)]} s={[L, 0.03, 0.054]} c={accent} rough={0.5} shadow={false} />
      ))}
      {/* translucent walls so the load stays visible */}
      <group renderOrder={3}>
        {[1, -1].map((side) => (
          <mesh key={`wall-${side}`} position={[0, floor + 0.24 + (H - 0.24) / 2, side * (W / 2 - 0.02)]}>
            <boxGeometry args={[L, H - 0.24, 0.03]} />
            <meshPhysicalMaterial color="#dbeafe" transparent opacity={0.13} roughness={0.15} metalness={0.1} depthWrite={false} side={THREE.DoubleSide} />
          </mesh>
        ))}
        <mesh position={[-L / 2 + 0.02, floor + 0.24 + (H - 0.24) / 2, 0]}>
          <boxGeometry args={[0.03, H - 0.24, W]} />
          <meshPhysicalMaterial color="#dbeafe" transparent opacity={0.22} roughness={0.15} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[L / 2 - 0.02, floor + 0.24 + (H - 0.24) / 2, 0]}>
          <boxGeometry args={[0.03, H - 0.24, W]} />
          <meshPhysicalMaterial color="#dbeafe" transparent opacity={0.1} roughness={0.15} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, floor + H, 0]}>
          <boxGeometry args={[L, 0.03, W]} />
          <meshPhysicalMaterial color="#e0ecff" transparent opacity={0.1} roughness={0.2} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      </group>
      {/* body frame: corner posts, intermediate posts, top and bottom rails */}
      {[1, -1].flatMap((sx) => [1, -1].map((sz) => (
        <Part key={`post-${sx}${sz}`} p={[sx * (L / 2 - 0.03), floor + H / 2, sz * (W / 2 - 0.03)]} s={[0.07, H, 0.07]} c="#f1f5f9" metal={0.3} rough={0.4} />
      )))}
      {Array.from({ length: posts - 1 }, (_, i) => {
        const x = -L / 2 + ((i + 1) * L) / posts;
        return [1, -1].map((sz) => <Part key={`mid-${i}-${sz}`} p={[x, floor + H / 2, sz * (W / 2 - 0.02)]} s={[0.04, H, 0.04]} c="#e2e8f0" metal={0.3} shadow={false} />);
      })}
      {[1, -1].map((sz) => (
        <Part key={`top-${sz}`} p={[0, floor + H, sz * (W / 2 - 0.03)]} s={[L, 0.06, 0.07]} c="#f1f5f9" metal={0.3} rough={0.4} />
      ))}
      {[1, -1].map((sx) => (
        <Part key={`topx-${sx}`} p={[sx * (L / 2 - 0.03), floor + H, 0]} s={[0.07, 0.06, W]} c="#f1f5f9" metal={0.3} rough={0.4} />
      ))}
      {/* rear doors: seam, handles, hinges */}
      <Part p={[L / 2 + 0.005, floor + H / 2, 0]} s={[0.012, H - 0.1, 0.014]} c="#94a3b8" shadow={false} />
      {[-0.12, 0.12].map((z) => (
        <Part key={`handle-${z}`} p={[L / 2 + 0.03, floor + H * 0.4, z]} s={[0.025, 0.16, 0.022]} c="#e2e8f0" metal={0.8} rough={0.3} />
      ))}
      {/* rear bumper, tail lights, plate, mud flaps */}
      <Part p={[L / 2 + 0.1, floor - 0.3, 0]} s={[0.12, 0.16, W * 0.96]} c="#374151" metal={0.4} />
      {[1, -1].map((sz) => (
        <Part key={`tail-${sz}`} p={[L / 2 + 0.012, floor + 0.12, sz * (W / 2 - 0.2)]} s={[0.025, 0.14, 0.24]} c="#dc2626" emissive="#ef4444" glow={0.45} />
      ))}
      <Part p={[L / 2 + 0.16, floor - 0.28, 0]} s={[0.012, 0.13, 0.4]} c="#f8fafc" rough={0.4} shadow={false} />
      {[1, -1].map((sz) => (
        <Part key={`flap-${sz}`} p={[rearAxles[0] + R * 1.25, R * 0.9, sz * (rearOuterZ - (prof.dual ? dualGap / 2 : 0))]} s={[0.025, 0.4, 0.34]} c="#111827" rough={0.9} />
      ))}
      {/* roof air-conditioning unit on cold-chain bodies */}
      {spec.climate.toUpperCase().includes("AC") && !spec.climate.toUpperCase().startsWith("NON") && (
        <group position={[-L / 2 + 0.5, floor + H + 0.2, 0]}>
          <Part p={[0, 0, 0]} s={[0.7, 0.3, W * 0.6]} c="#e5e7eb" metal={0.3} />
          {[-0.2, 0, 0.2].map((x) => (
            <Part key={x} p={[x, 0.01, W * 0.3 + 0.003]} s={[0.1, 0.18, 0.012]} c="#6b7280" shadow={false} />
          ))}
          <Part p={[0.1, 0, W * 0.3 + 0.004]} s={[0.012, 0.012, 0.01]} c={accent} shadow={false} />
        </group>
      )}

      {/* ---------- cab ---------- */}
      <RoundedBox args={[cabL, prof.cabHeight, cabW]} radius={0.09} smoothness={4} position={[cabCx, cabCy, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={CAB_COLOR} metalness={0.35} roughness={0.32} />
      </RoundedBox>
      {hooded && (
        <RoundedBox args={[prof.hood + 0.05, noseH, cabW * 0.97]} radius={0.08} smoothness={4} position={[cabFrontCabin - prof.hood / 2 + 0.02, cabBottom + noseH / 2, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={CAB_COLOR} metalness={0.35} roughness={0.32} />
        </RoundedBox>
      )}
      {/* windshield, side windows */}
      <Glass
        p={[cabFrontCabin - 0.012, cabCy + prof.cabHeight * 0.2, 0]}
        s={[0.03, prof.cabHeight * (hooded ? 0.5 : 0.44), cabW * 0.88]}
        rot={[0, 0, hooded ? -0.5 : -0.1]}
      />
      {[1, -1].map((side) => (
        <group key={`door-${side}`}>
          <Glass p={[cabCx - cabL * 0.1, cabCy + prof.cabHeight * 0.2, side * (cabW / 2 + 0.004)]} s={[cabL * 0.46, prof.cabHeight * 0.32, 0.02]} />
          <Part p={[cabCx + cabL * 0.27, cabCy - prof.cabHeight * 0.05, side * (cabW / 2 + 0.003)]} s={[0.014, prof.cabHeight * 0.82, 0.01]} c="#0b4f4a" shadow={false} />
          <Part p={[cabCx - cabL * 0.38, cabCy - prof.cabHeight * 0.05, side * (cabW / 2 + 0.003)]} s={[0.014, prof.cabHeight * 0.82, 0.01]} c="#0b4f4a" shadow={false} />
          <Part p={[cabCx + cabL * 0.12, cabCy - prof.cabHeight * 0.06, side * (cabW / 2 + 0.018)]} s={[0.14, 0.025, 0.03]} c="#d1d5db" metal={0.8} rough={0.3} />
          <Part p={[cabCx - cabL * 0.12, cabBottom - 0.02, side * (cabW / 2 + 0.07)]} s={[0.4, 0.04, 0.2]} c="#374151" metal={0.5} />
          {/* mirror arm + mirror */}
          <Part p={[cabFrontCabin + 0.18, cabCy + prof.cabHeight * 0.28, side * (cabW / 2 + 0.1)]} s={[0.03, 0.03, 0.2]} c="#111827" />
          <Part p={[cabFrontCabin + 0.17, cabCy + prof.cabHeight * 0.26, side * (cabW / 2 + 0.2)]} s={[0.05, 0.3, 0.16]} c="#111827" metal={0.4} />
          <Part p={[cabFrontCabin + 0.142, cabCy + prof.cabHeight * 0.26, side * (cabW / 2 + 0.2)]} s={[0.006, 0.26, 0.13]} c="#9db4c8" metal={0.9} rough={0.1} shadow={false} />
        </group>
      ))}
      <Part p={[cabFrontCabin - 0.02, cabCy + prof.cabHeight / 2, 0]} s={[0.12, 0.04, cabW * 0.96]} c="#0b5e57" metal={0.3} />
      {/* nose: headlights, indicators, grille, bumper, plate */}
      {[1, -1].map((side) => (
        <group key={`nose-${side}`}>
          <Part p={[frontX - 0.012, lowerNose + noseH * (hooded ? 0.55 : 0.2), side * cabW * 0.34]} s={[0.04, 0.15, 0.3]} c="#fff7d6" emissive="#fde68a" glow={0.7} />
          <Part p={[frontX - 0.012, lowerNose + noseH * (hooded ? 0.55 : 0.2), side * cabW * 0.46]} s={[0.035, 0.1, 0.07]} c="#f59e0b" emissive="#f59e0b" glow={0.5} />
        </group>
      ))}
      <Part p={[frontX - 0.012, lowerNose + noseH * (hooded ? 0.5 : 0.19), 0]} s={[0.03, 0.34, cabW * 0.3]} c="#111827" metal={0.5} />
      {[-0.08, 0, 0.08].map((dy) => (
        <Part key={dy} p={[frontX - 0.03, lowerNose + noseH * (hooded ? 0.5 : 0.19) + dy, 0]} s={[0.012, 0.025, cabW * 0.27]} c="#9ca3af" metal={0.8} rough={0.3} shadow={false} />
      ))}
      <RoundedBox args={[0.2, 0.22, cabW * 1.01]} radius={0.05} smoothness={3} position={[frontX - 0.05, lowerNose + 0.1, 0]} castShadow>
        <meshStandardMaterial color="#374151" metalness={0.4} roughness={0.5} />
      </RoundedBox>
      <Part p={[frontX - 0.165, lowerNose + 0.1, 0]} s={[0.012, 0.13, 0.4]} c="#f8fafc" rough={0.4} shadow={false} />

      {/* ---------- wheels ---------- */}
      {[1, -1].map((side) => (
        <group key={`front-${side}`}>
          <Wheel position={[frontAxleX, R, side * frontZ]} radius={R} width={T} side={side as 1 | -1} />
          <Fender position={[frontAxleX, R * 1.02, side * frontZ]} radius={R} width={T * 1.2} />
        </group>
      ))}
      <Part p={[frontAxleX, R, 0]} s={[0.12, 0.12, frontZ * 2]} c="#111827" metal={0.5} />
      {rearAxles.map((ax, i) => (
        <group key={`rear-${i}`}>
          <Part p={[ax, R, 0]} s={[0.14, 0.14, rearOuterZ * 2]} c="#111827" metal={0.5} />
          {[1, -1].map((side) => (
            <group key={side}>
              <Wheel position={[ax, R, side * rearOuterZ]} radius={R} width={T} side={side as 1 | -1} />
              {prof.dual && <Wheel position={[ax, R, side * (rearOuterZ - dualGap)]} radius={R} width={T} side={side as 1 | -1} />}
              <Fender position={[ax, R * 1.02, side * (rearOuterZ - (prof.dual ? dualGap / 2 : 0))]} radius={R} width={prof.dual ? dualGap + T * 1.2 : T * 1.2} />
            </group>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Drawn size of a carton: a hair smaller than its packed slot so neighbouring cartons show a clear seam. */
function drawnSize(b: PlacedBox) {
  const inset = Math.min(0.006, Math.min(b.l, b.w, b.h) * 0.04);
  return { l: b.l - inset * 2, w: b.w - inset * 2, h: b.h - inset * 2 };
}

/** All cargo boxes as one instanced mesh (plus tape strips and edge lines), colour per product. */
function CargoBoxes({ boxes, bed, floor, highlightKey }: { boxes: PlacedBox[]; bed: TruckSpec; floor: number; highlightKey: string | null }) {
  const bin = cargoBinFor(bed);
  const mesh = useRef<THREE.InstancedMesh>(null);
  const tape = useRef<THREE.InstancedMesh>(null);

  const edges = useMemo(() => {
    const unit = new THREE.EdgesGeometry(new THREE.BoxGeometry(1, 1, 1));
    const src = unit.getAttribute("position");
    const out = new Float32Array(boxes.length * src.count * 3);
    boxes.forEach((b, i) => {
      const d = drawnSize(b);
      const cx = -bin.length / 2 + b.x + b.l / 2;
      const cy = floor + 0.003 + b.z + b.h / 2;
      const cz = -bin.width / 2 + b.y + b.w / 2;
      for (let v = 0; v < src.count; v += 1) {
        const o = (i * src.count + v) * 3;
        out[o] = cx + src.getX(v) * d.l;
        out[o + 1] = cy + src.getY(v) * d.h;
        out[o + 2] = cz + src.getZ(v) * d.w;
      }
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(out, 3));
    unit.dispose();
    return geometry;
  }, [boxes, bin.length, bin.width, floor]);

  useEffect(() => () => edges.dispose(), [edges]);

  useLayoutEffect(() => {
    const m = mesh.current;
    const t = tape.current;
    if (!m || !t) return;

    const matrix = new THREE.Matrix4();
    const color = new THREE.Color();
    const dim = new THREE.Color("#d3dbe6");

    boxes.forEach((b, i) => {
      const d = drawnSize(b);
      const cx = -bin.length / 2 + b.x + b.l / 2;
      const cy = floor + 0.003 + b.z + b.h / 2;
      const cz = -bin.width / 2 + b.y + b.w / 2;
      matrix.compose(new THREE.Vector3(cx, cy, cz), new THREE.Quaternion(), new THREE.Vector3(d.l, d.h, d.w));
      m.setMatrixAt(i, matrix);

      color.set(b.color);
      if (highlightKey && b.productKey !== highlightKey) color.lerp(dim, 0.6); // others stay recognisable, just paler
      m.setColorAt(i, color);

      // packing tape along the longer top edge of the carton, in the middle of the top face (turns with the carton)
      const alongX = d.l >= d.w;
      const tapeWidth = Math.min(0.05, Math.min(d.l, d.w) * 0.16);
      matrix.compose(
        new THREE.Vector3(cx, cy + d.h / 2 + 0.0015, cz),
        new THREE.Quaternion(),
        new THREE.Vector3(alongX ? d.l * 0.97 : tapeWidth, 0.003, alongX ? tapeWidth : d.w * 0.97),
      );
      t.setMatrixAt(i, matrix);
    });

    m.count = boxes.length;
    t.count = boxes.length;
    m.instanceMatrix.needsUpdate = true;
    t.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  }, [boxes, bin.length, bin.width, floor, highlightKey]);

  if (boxes.length === 0) return null;

  return (
    <group renderOrder={1}>
      <instancedMesh key={`m-${boxes.length}`} ref={mesh} args={[undefined, undefined, boxes.length]} castShadow receiveShadow frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial roughness={0.78} metalness={0.02} />
      </instancedMesh>
      <instancedMesh key={`t-${boxes.length}`} ref={tape} args={[undefined, undefined, boxes.length]} frustumCulled={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#d9c9a3" roughness={0.6} />
      </instancedMesh>
      <lineSegments geometry={edges} frustumCulled={false}>
        <lineBasicMaterial color="#0f172a" transparent opacity={0.9} />
      </lineSegments>
    </group>
  );
}

function CameraRig({ overall, width, height, zoom, preset }: { overall: number; width: number; height: number; zoom: number; preset: CameraPreset }) {
  const camera = useThree((state) => state.camera) as THREE.PerspectiveCamera;
  const controls = useThree((state) => state.controls) as { target: THREE.Vector3; update: () => void } | null;
  const size = useThree((state) => state.size);

  useEffect(() => {
    // distance at which the vehicle fits the canvas (with margin) for the chosen view; zoom 1.2 is the default
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    const aspect = size.width / Math.max(size.height, 1);
    const fit = (halfW: number, halfH: number) => Math.max(halfW / (tan * aspect), halfH / tan);
    const margin = 1.2;
    const halfLen = (overall / 2) * margin;
    const halfH = (height / 2) * margin;
    const targetY = height * 0.42;

    let distance: number;
    if (preset === "top") distance = fit(halfLen, (width / 2) * margin);
    else if (preset === "rear") distance = fit((width / 2) * margin, halfH);
    else if (preset === "side") distance = fit(halfLen, halfH);
    else distance = fit(halfLen * 0.95, halfH * 1.25) * 1.12;
    distance = THREE.MathUtils.clamp((distance * 1.2) / zoom, 4, 65);

    if (preset === "top") camera.position.set(0, distance, 0.01);
    else if (preset === "rear") camera.position.set(distance, targetY + distance * 0.12, 0);
    else if (preset === "side") camera.position.set(0, targetY + distance * 0.12, distance);
    else camera.position.set(-distance * 0.62, targetY + distance * 0.42, distance * 0.78);

    camera.lookAt(0, targetY, 0);
    if (controls) {
      controls.target.set(0, targetY, 0);
      controls.update();
    }
    camera.updateProjectionMatrix();
  }, [camera, controls, overall, width, height, zoom, preset, size.width, size.height]);

  return null;
}

const finite = (value: number, fallback: number, min: number, max: number) =>
  Number.isFinite(value) && value > 0 ? Math.min(Math.max(value, min), max) : fallback;

export function TruckScene({
  spec: rawSpec,
  boxes: rawBoxes,
  zoom,
  preset,
  highlightKey,
}: {
  spec: TruckSpec;
  boxes: PlacedBox[];
  zoom: number;
  preset: CameraPreset;
  highlightKey: string | null;
}) {
  // Guard the 3D geometry against bad master data: a NaN size would break bounding spheres and culling.
  const spec = useMemo<TruckSpec>(
    () => ({
      length: finite(rawSpec.length, 6, 1, 20),
      width: finite(rawSpec.width, 2.4, 0.8, 3),
      height: finite(rawSpec.height, 2.5, 0.8, 4),
      type: rawSpec.type ?? "",
      climate: rawSpec.climate ?? "",
    }),
    [rawSpec.length, rawSpec.width, rawSpec.height, rawSpec.type, rawSpec.climate],
  );
  const boxes = useMemo(
    () => rawBoxes.filter((b) => [b.x, b.y, b.z, b.l, b.w, b.h].every(Number.isFinite) && b.l > 0 && b.w > 0 && b.h > 0),
    [rawBoxes],
  );
  const cls = classify(spec);
  const prof = PROFILES[cls];
  const nose = prof.cabLength + prof.hood + 0.45;
  const overall = spec.length + nose;
  // centre the whole vehicle (cab + body) on the origin
  const shift = (nose - 0.2) / 2;

  return (
    <>
      <color attach="background" args={["#eaf1fb"]} />
      <fog attach="fog" args={["#eaf1fb", 40, 120]} />
      <hemisphereLight args={["#ffffff", "#c7d2e0", 0.75]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[10, 16, 9]}
        intensity={1.6}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-8, 7, -10]} intensity={0.5} color="#dbeafe" />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.002, 0]} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial color="#dde6f1" roughness={1} />
      </mesh>
      <gridHelper args={[80, 80, "#b8c5d6", "#cfd9e6"]} position={[0, 0.001, 0]} />

      <group position={[shift, 0, 0]}>
        <Truck spec={spec} />
        <CargoBoxes boxes={boxes} bed={spec} floor={prof.floor} highlightKey={highlightKey} />
      </group>

      <ContactShadows position={[0, 0.003, 0]} opacity={0.4} scale={Math.max(30, overall * 2)} blur={2.6} far={6} color="#475569" />
      <OrbitControls makeDefault enablePan enableRotate enableZoom minDistance={3} maxDistance={70} maxPolarAngle={Math.PI / 2.04} />
      <CameraRig overall={overall} width={spec.width} height={spec.height + prof.floor} zoom={zoom} preset={preset} />
    </>
  );
}
