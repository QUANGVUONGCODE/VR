import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface PlanetProps {
  data: {
    name: string;
    radius: number;
    distanceFromSun: number;
    orbitPeriod: number;
    rotationPeriod: number;
    color: string;
  };
  orbitCurrentRef: MutableRefObject<number>;
}

export const Planet = ({ data, orbitCurrentRef }: PlanetProps) => {
  const pivotRef = useRef<THREE.Group>(null);
  const planetRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const day = orbitCurrentRef.current;
    if (pivotRef.current) {
      pivotRef.current.rotation.y = (day / data.orbitPeriod) * Math.PI * 2;
    }
    if (planetRef.current) {
      planetRef.current.rotation.y = (day / data.rotationPeriod) * Math.PI * 2;
    }
  });

  return (
    <group ref={pivotRef}>
      <mesh ref={planetRef} position={[data.distanceFromSun, 0, 0]}>
        <sphereGeometry args={[data.radius, 64, 64]} />
        <meshStandardMaterial color={data.color} roughness={0.7} metalness={0.2} />
      </mesh>
    </group>
  );
};