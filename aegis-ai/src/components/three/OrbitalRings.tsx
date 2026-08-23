import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils, type Group } from "three";
import type { PointerRef } from "@/hooks/usePointer";

const RINGS = [
  { radius: 2.6, tilt: [1.5, 0.1, 0.2], speed: 0.09, nodes: 6, color: "#22d3ee", opacity: 0.4 },
  { radius: 3.15, tilt: [1.1, 0.5, -0.3], speed: -0.06, nodes: 4, color: "#2dd4bf", opacity: 0.3 },
  { radius: 3.8, tilt: [1.8, -0.35, 0.5], speed: 0.045, nodes: 8, color: "#5eead4", opacity: 0.22 },
] as const;

function Ring({ config, pointer }: { config: (typeof RINGS)[number]; pointer: MutableRefObject<PointerRef> }) {
  const group = useRef<Group>(null);

  const nodes = useMemo(
    () => Array.from({ length: config.nodes }, (_, i) => {
      const a = (i / config.nodes) * Math.PI * 2;
      return [Math.cos(a) * config.radius, 0, Math.sin(a) * config.radius] as [number, number, number];
    }),
    [config],
  );

  useFrame((_, delta) => {
    if (!group.current) return;
    group.current.rotation.z += delta * config.speed;
    group.current.rotation.x = MathUtils.lerp(group.current.rotation.x, config.tilt[0] + pointer.current.y * 0.05, 0.02);
  });

  return (
    <group ref={group} rotation={config.tilt as unknown as [number, number, number]}>
      <mesh>
        <torusGeometry args={[config.radius, 0.0035, 6, 220]} />
        <meshBasicMaterial color={config.color} transparent opacity={config.opacity} />
      </mesh>
      {nodes.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.026, 10, 10]} />
          <meshBasicMaterial color={config.color} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

export function OrbitalRings({ pointer }: { pointer: MutableRefObject<PointerRef> }) {
  return (
    <group position={[2.1, 0.4, -1.2]}>
      {RINGS.map((c) => <Ring key={c.radius} config={c} pointer={pointer} />)}
    </group>
  );
}
