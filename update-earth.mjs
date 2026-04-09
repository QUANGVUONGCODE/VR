import fs from "fs";
const file = "src/components/Earth.tsx";
let code = fs.readFileSync(file, "utf8");

// Add imports
code = code.replace("import * as THREE from 'three';", "import * as THREE from 'three';\nimport { Planet } from './Planet';\nimport { SOLAR_SYSTEM_DATA, SUN_DATA } from '../constants/solarSystem';");

// Update constants
code = code.replace("const orbitRadius = 12;", "const orbitRadius = 14960;");

// Update JSX - Sun
code = code.replace("<Sphere ref={sunRef} args={[2, 64, 64]}>", `<Sphere ref={sunRef} args={[SUN_DATA.radius, 64, 64]}>`);
code = code.replace("<pointLight intensity={3000} distance={100} decay={2} color=\"#fff5e6\" castShadow />", "<pointLight intensity={1000000000} distance={1000000} decay={2} color=\"#fff5e6\" castShadow />");
code = code.replace("<Sphere args={[2.5, 32, 32]}>", "<Sphere args={[SUN_DATA.radius * 1.1, 32, 32]}>");
code = code.replace("<Sphere args={[3.0, 32, 32]}>", "<Sphere args={[SUN_DATA.radius * 1.3, 32, 32]}>");

// Update JSX - Earth
code = code.replace("<Sphere ref={earthRef} args={[1, 64, 64]} castShadow receiveShadow>", "<Sphere ref={earthRef} args={[0.637, 64, 64]} castShadow receiveShadow>");
code = code.replace("<Sphere ref={cloudsRef} args={[1.015, 64, 64]} castShadow>", "<Sphere ref={cloudsRef} args={[0.637 * 1.015, 64, 64]} castShadow>");
code = code.replace("<Sphere args={[1.03, 64, 64]}>", "<Sphere args={[0.637 * 1.03, 64, 64]}>");

// Update JSX - Moon Orbit Group
code = code.replace("<group position={[3.5, 0, 0]}>", "<group position={[38.4, 0, 0]}>"); // 384,400 km
code = code.replace("<Sphere ref={moonRef} args={[0.27, 32, 32]} castShadow receiveShadow>", "<Sphere ref={moonRef} args={[0.173, 32, 32]} castShadow receiveShadow>"); // 1,737 km

// Add other planets loop
const groupEnd = `      </group>\n    </group>\n  );\n}`;
const newGroupEnd = `      </group>\n\n      {/* Other Planets */}\n      {SOLAR_SYSTEM_DATA.map((data) => (\n        <Planet key={data.name} data={data} orbitCurrentRef={orbitCurrentRef} />\n      ))}\n    </group>\n  );\n}`;
code = code.replace(groupEnd, newGroupEnd);

fs.writeFileSync(file, code, "utf8");
console.log("Earth.tsx updated");
