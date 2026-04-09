import { useRef, type MutableRefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sphere, useTexture } from '@react-three/drei';
import * as THREE from 'three';

const DEG2RAD = Math.PI / 180;
const EARTH_TILT_RAD = 23.44 * DEG2RAD;
const MOON_ORBIT_TILT_RAD = 5.14 * DEG2RAD;

export default function SolarSystem({ 
  orbitCurrentRef,
  sunIntensity = 3000,
  showAtmosphere = true
}: { 
  orbitCurrentRef: MutableRefObject<number>,
  sunIntensity?: number,
  showAtmosphere?: boolean
}) {
  const earthGroupRef = useRef<THREE.Group>(null);
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);
  const moonRef = useRef<THREE.Mesh>(null);
  const moonOrbitGroupRef = useRef<THREE.Group>(null);
  const moonOrbitRef = useRef<THREE.Group>(null);
  const sunRef = useRef<THREE.Mesh>(null);

  // Textures
  const [
    colorMap, 
    normalMap, 
    specularMap, 
    cloudsMap, 
    nightMap,
    moonMap,
    sunMap
  ] = useTexture([
    '/earth_8k_color.png',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_normal_2048.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_specular_2048.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/earth_clouds_1024.png',
    '/earth_night_4k.jpg',
    'https://raw.githubusercontent.com/mrdoob/three.js/master/examples/textures/planets/moon_1024.jpg',
    '/sun_texture.jpg',
  ]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const day = orbitCurrentRef.current;

    // Earth Orbit Position
    if (earthGroupRef.current) {
      const angle = (day / 365.256) * Math.PI * 2;
      const orbitRadius = 12;
      earthGroupRef.current.position.x = Math.cos(angle) * orbitRadius;
      earthGroupRef.current.position.z = Math.sin(angle) * orbitRadius;
    }

    // Earth Rotation (Self-rotation with tilt)
    if (earthGroupRef.current) {
      earthGroupRef.current.rotation.z = EARTH_TILT_RAD;
    }

    const earthSelfRotationAngle = (day / 0.997269) * Math.PI * 2;

    if (earthRef.current) {
      earthRef.current.rotation.y = earthSelfRotationAngle;
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y = earthSelfRotationAngle * 1.03;
    }

    // Moon Orbit & Rotation
    const moonOrbitAngle = (day / 27.322) * Math.PI * 2;

    if (moonOrbitGroupRef.current) {
      moonOrbitGroupRef.current.rotation.z = MOON_ORBIT_TILT_RAD;
    }

    if (moonOrbitRef.current) {
      moonOrbitRef.current.rotation.y = moonOrbitAngle;
    }

    if (moonRef.current) {
      // Khóa thủy triều (Tidal Locking): Quỹ đạo đã xoay mặt trăng theo trục Y rồi, 
      // nên local rotation của mặt trăng phải giữ nguyên (hoặc xoay 1 góc cố định) để luôn hướng 1 mặt về Trái Đất.
      // Góc Math.PI / 2 dùng để căn đúng mặt nhìn thấy quen thuộc của Mặt Trăng hướng về Trái Đất.
      moonRef.current.rotation.y = Math.PI / 2;
    }

    // Sun subtle pulse
    if (sunRef.current) {
      sunRef.current.scale.setScalar(1 + Math.sin(time * 0.5) * 0.02);
    }
  });

  return (
    <group>
      {/* SUN - Center of the system */}
      <group position={[0, 0, 0]}>
        <Sphere ref={sunRef} args={[2, 64, 64]}>
          <meshStandardMaterial
            map={sunMap}
            emissiveMap={sunMap}
            emissive="#ffffff"
            emissiveIntensity={2 * (sunIntensity / 3000)}
            roughness={1}
            metalness={0}
          />
        </Sphere>
        <pointLight intensity={sunIntensity} distance={100} decay={2} color="#fff5e6" castShadow />
        
        {/* Sun Glow Effect */}
        <Sphere args={[2.5, 32, 32]}>
          <meshBasicMaterial color="#ffaa00" transparent opacity={0.1 * (sunIntensity / 3000)} side={THREE.BackSide} />
        </Sphere>
        <Sphere args={[3.0, 32, 32]}>
          <meshBasicMaterial color="#ff6600" transparent opacity={0.05 * (sunIntensity / 3000)} side={THREE.BackSide} />
        </Sphere>
      </group>

      {/* EARTH GROUP - This group moves along the orbit */}
      <group ref={earthGroupRef}>
        {/* Earth Surface */}
        <Sphere ref={earthRef} args={[1, 64, 64]} castShadow receiveShadow>
          <meshStandardMaterial
            map={colorMap}
            normalMap={normalMap}
            roughnessMap={specularMap}
            emissiveMap={nightMap}
            emissive="#ffffff"
            emissiveIntensity={2.0}
            metalness={0.1}
            roughness={0.7}
            onBeforeCompile={(shader) => {
              shader.vertexShader = shader.vertexShader.replace(
                '#include <common>',
                `#include <common>\nvarying vec3 vSunDirViewSpace;`
              );
              shader.vertexShader = shader.vertexShader.replace(
                '#include <worldpos_vertex>',
                `#include <worldpos_vertex>\nvec4 worldPosForSun = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\nworldPosForSun = instanceMatrix * worldPosForSun;\n#endif\nworldPosForSun = modelMatrix * worldPosForSun;\nvec3 sunDirWorld = normalize(vec3(0.0) - worldPosForSun.xyz);\nvSunDirViewSpace = normalize((viewMatrix * vec4(sunDirWorld, 0.0)).xyz);`
              );

              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <common>',
                `#include <common>\nvarying vec3 vSunDirViewSpace;`
              );

              shader.fragmentShader = shader.fragmentShader.replace(
                '#include <emissivemap_fragment>',
                `#ifdef USE_EMISSIVEMAP\nvec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );\n#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE\nemissiveColor = vec4( sRGBTransferEOTF( emissiveColor.rgb ), emissiveColor.a );\n#endif\nfloat dayNight = dot(normalize(vNormal), normalize(vSunDirViewSpace));\nfloat nightMix = smoothstep(0.2, -0.2, dayNight);\ntotalEmissiveRadiance *= emissiveColor.rgb * nightMix;\n#endif`
              );
            }}
          />
        </Sphere>

        {/* Clouds Layer */}
        {showAtmosphere && (
          <Sphere ref={cloudsRef} args={[1.015, 64, 64]} castShadow>
            <meshStandardMaterial
              map={cloudsMap}
              transparent
              opacity={0.5}
              depthWrite={false}
            />
          </Sphere>
        )}

        {/* Atmosphere Glow */}
        {showAtmosphere && (
          <Sphere args={[1.04, 64, 64]}>
            <shaderMaterial
              transparent
              side={THREE.FrontSide}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              vertexShader={`
                varying vec3 vNormal;
                void main() {
                  vNormal = normalize(normalMatrix * normal);
                  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
              `}
              fragmentShader={`
                varying vec3 vNormal;
                void main() {
                  // Đưa lại khí quyển rõ ràng hơn dạng Fresnel viền xanh
                  float ndotv = max(dot(vNormal, vec3(0.0, 0.0, 1.0)), 0.0);
                  float edge = 1.0 - ndotv;
                  float intensity = pow(edge, 3.0) * 1.2;
                  
                  // Chỉ lấy màu xanh mạnh ở viền
                  gl_FragColor = vec4(0.2, 0.5, 1.0, 1.0) * intensity;
                }
              `}
            />
          </Sphere>
        )}

        {/* MOON ORBIT (Child of Earth Group) */}
        <group ref={moonOrbitGroupRef}>
          <group ref={moonOrbitRef}>
            <group position={[3.5, 0, 0]}>
              <Sphere ref={moonRef} args={[0.27, 32, 32]} castShadow receiveShadow>
                <meshStandardMaterial
                  map={moonMap}
                  roughness={0.9}
                  metalness={0}
                />
              </Sphere>
            </group>
          </group>
        </group>
      </group>
    </group>
  );
}

