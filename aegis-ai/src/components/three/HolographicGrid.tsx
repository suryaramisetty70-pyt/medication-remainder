import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { type Mesh } from "three";

export function HolographicGrid() {
  const mesh = useRef<Mesh>(null);

  useFrame((_, delta) => {
    if (!mesh.current) return;
    mesh.current.rotation.y += delta * 0.009;
  });

  return (
    <mesh ref={mesh} position={[0, -4.8, 0]} rotation={[Math.PI / 2, 0, 0]}>
      <planeGeometry args={[28, 28, 30, 30]} />
      <meshBasicMaterial
        color="#22d3ee" wireframe transparent opacity={0.024} depthWrite={false}
      />
    </mesh>
  );
}
