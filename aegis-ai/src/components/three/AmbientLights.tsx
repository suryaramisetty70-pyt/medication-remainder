export function AmbientLights() {
  return (
    <>
      <ambientLight intensity={0.35} />
      <pointLight position={[0, 0, 0]} intensity={7} distance={12} color="#22d3ee" />
      <pointLight position={[6, 4, 6]} intensity={2.2} color="#2dd4bf" />
      <pointLight position={[-6, -3, 4]} intensity={1.2} color="#5eead4" />
    </>
  );
}
