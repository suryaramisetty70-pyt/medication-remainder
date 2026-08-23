import { useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils, type Group, type Mesh, type MeshStandardMaterial } from "three";
import type { PointerRef } from "@/hooks/usePointer";

/** Two-beat cardiac envelope — organic, not a sine wave. */
function heartbeat(t: number) {
  const p = (t % 2.2) / 2.2;
  const beat = (c: number, w: number) => Math.exp(-Math.pow((p - c) / w, 2));
  return beat(0.12, 0.045) + 0.55 * beat(0.29, 0.06);
}

export function AegisCore({ pointer }: { pointer: MutableRefObject<PointerRef> }) {
  const group = useRef<Group>(null);
  const shell = useRef<Mesh>(null);
  const nucleus = useRef<Mesh>(null);

  useFrame(({ clock }, delta) => {
    const t = clock.elapsedTime;
    const pulse = heartbeat(t);

    if (group.current) {
      group.current.rotation.y += delta * 0.075;
      // very low-intensity cursor follow
      group.current.rotation.x = MathUtils.lerp(group.current.rotation.x, pointer.current.y * 0.14, 0.03);
      group.current.position.x = MathUtils.lerp(group.current.position.x, pointer.current.x * -0.5, 0.03);
      group.current.position.y = MathUtils.lerp(group.current.position.y, pointer.current.y * 0.32 + Math.sin(t * 0.4) * 0.08, 0.03);
    }

    if (shell.current) {
      const s = 1 + pulse * 0.035;
      shell.current.scale.setScalar(s);
      (shell.current.material as MeshStandardMaterial).opacity = 0.12 + pulse * 0.07;
    }

    if (nucleus.current) {
      nucleus.current.scale.setScalar(1 + pulse * 0.16);
      const mat = nucleus.current.material as MeshStandardMaterial;
      mat.emissiveIntensity = 1.5 + pulse * 2.6;
    }
  });

  return (
    <group ref={group} position={[2.1, 0.4, -1.2]}>
      {/* translucent outer shell */}
      <mesh ref={shell}>
        <sphereGeometry args={[2.05, 48, 48]} />
        <meshStandardMaterial
          color="#22d3ee" transparent opacity={0.13} roughness={0.15} metalness={0.5}
          emissive="#22d3ee" emissiveIntensity={0.3}
        />
      </mesh>

      {/* structural wireframe */}
      <mesh>
        <icosahedronGeometry args={[1.72, 1]} />
        <meshBasicMaterial color="#2dd4bf" wireframe transparent opacity={0.14} />
      </mesh>

      {/* concentric latitude rings */}
      {[1.28, 1.5, 1.72].map((r, i) => (
        <mesh key={r} rotation={[Math.PI / 2 + i * 0.22, i * 0.4, 0]}>
          <torusGeometry args={[r, 0.004, 8, 128]} />
          <meshBasicMaterial color="#5eead4" transparent opacity={0.4 - i * 0.08} />
        </mesh>
      ))}

      {/* glowing nucleus */}
      <mesh ref={nucleus}>
        <sphereGeometry args={[0.5, 32, 32]} />
        <meshStandardMaterial color="#e6feff" emissive="#22d3ee" emissiveIntensity={2} toneMapped={false} />
      </mesh>
    </group>
  );
}
