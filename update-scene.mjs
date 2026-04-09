import fs from "fs";
const file = "src/components/Scene.tsx";
let code = fs.readFileSync(file, "utf8");

code = code.replace("const EARTH_ORBIT_RADIUS = 12;", "const EARTH_ORBIT_RADIUS = 14960;");
code = code.replace("const MOON_CAMERA_OFFSET: [number, number, number] = [0, 0.18, 1.15];", "const MOON_CAMERA_OFFSET: [number, number, number] = [0, 0.05, 0.3];");

code = code.replace("nextDefaultPosition.set(0, 5, 15);", "nextDefaultPosition.set(0, 100, 300);"); 
code = code.replace("nextDefaultPosition.set(earthX, 2, earthZ + 5);", "nextDefaultPosition.set(earthX, 1, earthZ + 2);"); 

code = code.replace("maxDistance={viewpoint === 'moon' ? 8 : 60}", "maxDistance={10000000}");
code = code.replace("minDistance={viewpoint === 'moon' ? 0.8 : 1.2}", "minDistance={viewpoint === 'moon' ? 0.2 : 0.7}");

code = code.replace("<Canvas shadows dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>", "<Canvas shadows dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, logarithmicDepthBuffer: true }}>");
code = code.replace("<PerspectiveCamera makeDefault position={[0, 5, 15]} fov={45} />", "<PerspectiveCamera makeDefault position={[0, 1000, 20000]} fov={45} near={0.1} far={100000000} />");

fs.writeFileSync(file, code, "utf8");
console.log("Updated Scene.tsx");
