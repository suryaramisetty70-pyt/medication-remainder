import { useMemo, useRef, type MutableRefObject } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils, type Points } from "three";
import type { PointerRef } from "@/hooks/usePointer";

export function MedicalParticles({ count = 280, pointer }: { count?: number; pointer: MutableRefObject<PointerRef> }) {
  const mesh = useRef<Points>(null);

  const [positions, offsets] = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const offs = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // dispersed volume biased slightly to the right to frame dashboard text
      const x = MathUtils.randFloatSpread(15) + 2.5;
      const y = MathUtils.randFloatSpread(12);
      const z = MathUtils.randFloatSpread(6) - 1;
      pos.set([x, y, z], i * 3);
      offs.set([Math.random() * 100, Math.random() * 100, Math.random() * 100], i * 3);
    }
    return [pos, offs];
  }, [count]);

  useFrame(({ clock }) => {
    if (!mesh.current) return;
    const t = clock.elapsedTime * 0.16;
    const array = mesh.current.geometry.attributes.position.array as Float32Array;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const ox = offsets[idx] ?? 0;
      const oy = offsets[idx + 1] ?? 0;
      const oz = offsets[idx + 2] ?? 0;
      
      const px = positions[idx] ?? 0;
      const py = positions[idx + 1] ?? 0;
      const pz = positions[idx + 2] ?? 0;

      // multi-octave floating animation
      array[idx] = px + Math.sin(t + ox) * 0.65;
      array[idx + 1] = py + Math.cos(t * 0.7 + oy) * 0.5;
      array[idx + 2] = pz + Math.sin(t * 1.2 + oz) * 0.38;
    }
    mesh.current.geometry.attributes.position.needsUpdate = true;

    // rotation linked to pointer
    mesh.current.rotation.y = MathUtils.lerp(mesh.current.rotation.y, pointer.current.x * 0.14, 0.02);
    mesh.current.rotation.x = MathUtils.lerp(mesh.current.rotation.x, pointer.current.y * 0.08, 0.02);
  });

  return (
    <points ref={mesh}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      {/* round particles that drop cleanly to alpha 0 */}
      <pointsMaterial
        color="#22d3ee" size={0.038} sizeAttenuation transparent opacity={0.65}
        depthWrite={false} blending={2}
      />
    </points>
  );
}
