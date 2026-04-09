import { Canvas, useFrame } from "@react-three/fiber";
import {
  Stars,
  OrbitControls,
  PerspectiveCamera,
  Environment,
  Html,
  useProgress,
} from "@react-three/drei";
import {
  XR,
  XROrigin,
  createXRStore,
  useXR,
  useXRControllerLocomotion,
} from "@react-three/xr";
import SolarSystem from "./Earth";
import {
  useState,
  Suspense,
  useMemo,
  useRef,
  type MutableRefObject,
} from "react";
import {
  Camera,
  RotateCw,
  Maximize,
  Sun,
  Moon,
  Loader2,
  Calendar,
  CloudLightning,
  SunMedium,
} from "lucide-react";
import * as THREE from "three";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";

const store = createXRStore({
  // Force VR-focused flow for Quest headsets.
  offerSession: "immersive-vr",
  enterGrantedSession: false,
});

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const EARTH_ORBIT_RADIUS = 12;
const MOON_CAMERA_OFFSET: [number, number, number] = [0, 0.18, 1.15];
const XR_EYE_HEIGHT_OFFSET = 1.6;

function getViewpointTargetAndCamera(
  day: number,
  viewpoint: "earth" | "sun" | "moon",
  cameraYOffset = 0,
) {
  const earthAngle = (day / 365.256) * Math.PI * 2;
  const earthX = Math.cos(earthAngle) * EARTH_ORBIT_RADIUS;
  const earthZ = Math.sin(earthAngle) * EARTH_ORBIT_RADIUS;
  const target = new THREE.Vector3();
  const defaultPosition = new THREE.Vector3();

  switch (viewpoint) {
    case "sun":
      target.set(0, 0, 0);
      defaultPosition.set(0, 5 + cameraYOffset, 15);
      break;
    case "moon": {
      const DEG2RAD = Math.PI / 180;
      const EARTH_TILT_RAD = 23.44 * DEG2RAD;
      const MOON_ORBIT_TILT_RAD = 5.14 * DEG2RAD;
      const moonOrbitAngle = (day / 27.322) * Math.PI * 2;

      const moonPos = new THREE.Vector3(3.5, 0, 0);
      moonPos.applyAxisAngle(new THREE.Vector3(0, 1, 0), moonOrbitAngle);
      moonPos.applyAxisAngle(new THREE.Vector3(0, 0, 1), MOON_ORBIT_TILT_RAD);
      moonPos.applyAxisAngle(new THREE.Vector3(0, 0, 1), EARTH_TILT_RAD);

      const worldX = earthX + moonPos.x;
      const worldY = moonPos.y;
      const worldZ = earthZ + moonPos.z;

      target.set(worldX, worldY, worldZ);
      defaultPosition.set(
        worldX + MOON_CAMERA_OFFSET[0],
        worldY + MOON_CAMERA_OFFSET[1] + cameraYOffset,
        worldZ + MOON_CAMERA_OFFSET[2],
      );
      break;
    }
    default:
      target.set(earthX, 0, earthZ);
      defaultPosition.set(earthX, 2 + cameraYOffset, earthZ + 5);
  }

  return { target, defaultPosition };
}

function Loader() {
  const { progress } = useProgress();
  return (
    <Html center>
      <div className="flex flex-col items-center gap-4 bg-black/80 p-8 rounded-3xl backdrop-blur-xl border border-white/10 min-w-[200px]">
        <Loader2 className="text-blue-500 animate-spin" size={48} />
        <div className="text-white font-black text-xl">
          {Math.round(progress)}%
        </div>
        <div className="text-white/40 text-[10px] uppercase tracking-[0.2em]">
          Loading Universe...
        </div>
      </div>
    </Html>
  );
}

function PhysicsSimulator({
  targetProgress,
  currentRef,
  playbackSpeed,
}: {
  targetProgress: number;
  currentRef: MutableRefObject<number>;
  playbackSpeed: number;
}) {
  const previousTargetProgressRef = useRef(targetProgress);

  useFrame((_, delta) => {
    const targetChanged =
      Math.abs(targetProgress - previousTargetProgressRef.current) > 0.0001;

    // Chỉ snap theo slider khi đang pause; nếu đang autoplay thì bỏ qua target UI để tránh giật do đồng bộ state
    if (playbackSpeed === 0 && targetChanged) {
      currentRef.current = targetProgress;
    }

    if (playbackSpeed > 0) {
      // Tự động xoay: Tua nhanh thời gian
      currentRef.current = currentRef.current + playbackSpeed * delta;
    } else {
      // Quán tính trượt khi chỉnh tay
      currentRef.current = THREE.MathUtils.lerp(
        currentRef.current,
        targetProgress,
        delta * 6.0,
      );
    }

    previousTargetProgressRef.current = targetProgress;
  });
  return null;
}

function CameraRig({
  viewpoint,
  orbitCurrentRef,
}: {
  viewpoint: "earth" | "sun" | "moon";
  orbitCurrentRef: MutableRefObject<number>;
}) {
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const previousViewpointRef = useRef<"earth" | "sun" | "moon">(viewpoint);
  const previousTargetRef = useRef(new THREE.Vector3(0, 0, 0));
  const isTargetInitializedRef = useRef(false);
  const isXRSessionActive = useXR((xr) => xr.session != null);

  useFrame(({ camera }) => {
    const controls = controlsRef.current;
    if (!controls) return;

    // In XR mode camera is managed by XROrigin; keep desktop controls out.
    if (isXRSessionActive) {
      isTargetInitializedRef.current = false;
      previousViewpointRef.current = viewpoint;
      return;
    }

    const day = orbitCurrentRef.current;
    const { target: nextTarget, defaultPosition: nextDefaultPosition } =
      getViewpointTargetAndCamera(day, viewpoint);

    const viewpointChanged = previousViewpointRef.current !== viewpoint;
    if (viewpointChanged || !isTargetInitializedRef.current) {
      camera.position.copy(nextDefaultPosition);
      controls.target.copy(nextTarget);
      camera.lookAt(nextTarget); // Force camera to look perfectly at target immediately
      previousTargetRef.current.copy(nextTarget);
      previousViewpointRef.current = viewpoint;
      isTargetInitializedRef.current = true;
      controls.update();
      return;
    }

    if (viewpoint === "moon") {
      // Khóa cứng camera vào vị trí tương đối của Mặt Trăng, loại bỏ sai số cộng dồn delta và Damping lệch
      camera.position.copy(nextDefaultPosition);
      controls.target.copy(nextTarget);
      // Ép OrbitControls tính toán lại tọa độ hình cầu quay quanh mục tiêu
      controls.update();
    } else {
      // Các chế độ khác vẫn cho phép dùng Damping và Delta để di chuyển mượt mà
      const delta = nextTarget.clone().sub(previousTargetRef.current);
      if (delta.lengthSq() > 0) {
        camera.position.add(delta);
        controls.target.copy(nextTarget);
        controls.update();
      }
    }

    previousTargetRef.current.copy(nextTarget);
  });

  return (
    <OrbitControls
      ref={controlsRef}
      enabled={!isXRSessionActive}
      enablePan={false}
      minDistance={viewpoint === "moon" ? 0.8 : 1.2}
      maxDistance={viewpoint === "moon" ? 8 : 60}
      enableDamping={viewpoint !== "moon"}
      dampingFactor={0.08}
    />
  );
}

function XROriginRig({
  viewpoint,
  orbitCurrentRef,
}: {
  viewpoint: "earth" | "sun" | "moon";
  orbitCurrentRef: MutableRefObject<number>;
}) {
  const originRef = useRef<THREE.Group>(null);
  const previousViewpointRef = useRef<"earth" | "sun" | "moon">(viewpoint);
  const previousTargetRef = useRef(new THREE.Vector3(0, 0, 0));
  const isInitializedRef = useRef(false);
  const isXRSessionActive = useXR((xr) => xr.session != null);

  // Native XR locomotion based on controller thumbsticks.
  useXRControllerLocomotion(
    originRef,
    { speed: 3 },
    { type: "smooth", speed: 1.6, deadZone: 0.2 },
    "left",
  );

  useFrame(() => {
    if (!isXRSessionActive || !originRef.current) return;

    const day = orbitCurrentRef.current;
    const { target, defaultPosition } = getViewpointTargetAndCamera(
      day,
      viewpoint,
      -XR_EYE_HEIGHT_OFFSET,
    );

    const viewpointChanged = previousViewpointRef.current !== viewpoint;
    if (viewpointChanged || !isInitializedRef.current) {
      originRef.current.position.copy(defaultPosition);
      originRef.current.lookAt(target);
      previousTargetRef.current.copy(target);
      previousViewpointRef.current = viewpoint;
      isInitializedRef.current = true;
      return;
    }

    // Keep the user following the selected celestial body while the simulation advances.
    const delta = target.clone().sub(previousTargetRef.current);
    if (delta.lengthSq() > 0) {
      originRef.current.position.add(delta);
    }

    previousTargetRef.current.copy(target);
  });

  return <XROrigin ref={originRef} />;
}

import { useEffect } from "react";

export default function Scene() {
  const [orbitProgress, setOrbitProgress] = useState(0); // 0 to 365 days
  const [playbackSpeed, setPlaybackSpeed] = useState(0.1); // days per second
  const orbitCurrentRef = useRef(0);
  const [viewpoint, setViewpoint] = useState<"earth" | "sun" | "moon">("earth");
  const [sunIntensity, setSunIntensity] = useState(3000);
  const [showAtmosphere, setShowAtmosphere] = useState(true);
  const [xrIssue, setXrIssue] = useState<string | null>(null);

  const currentMonth = useMemo(() => {
    let safeProgress = orbitProgress % 365;
    if (safeProgress < 0) safeProgress += 365;
    const monthIndex = Math.floor((safeProgress / 365) * 12);
    return MONTHS[Math.max(0, Math.min(monthIndex, 11))];
  }, [orbitProgress]);

  // Đồng bộ State UI khi auto play
  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (playbackSpeed > 0) {
      interval = setInterval(() => {
        setOrbitProgress(orbitCurrentRef.current);
      }, 50); // ~20fps UI
    }
    return () => clearInterval(interval);
  }, [playbackSpeed]);

  const handleEnterVR = async () => {
    setXrIssue(null);

    if (typeof navigator === "undefined" || !navigator.xr) {
      setXrIssue("Thiết bị/trình duyệt hiện tại chưa hỗ trợ WebXR.");
      return;
    }

    try {
      const isSupported = await navigator.xr.isSessionSupported("immersive-vr");
      if (!isSupported) {
        setXrIssue("Thiết bị không hỗ trợ immersive-vr hoặc quyền XR chưa được cấp.");
        return;
      }

      const session = await store.enterVR();
      if (!session) {
        setXrIssue("Không thể bắt đầu phiên VR. Hãy kiểm tra HTTPS/permissions trên Quest.");
      }
    } catch {
      setXrIssue("Bắt đầu phiên VR thất bại. Hãy thử mở bằng HTTPS hoặc localhost trực tiếp.");
    }
  };

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden font-sans">
      {/* UI Overlay */}
      <div className="absolute top-6 left-6 z-10 flex flex-col gap-4 pointer-events-none max-w-sm">
        <div className="bg-black/60 backdrop-blur-xl p-6 rounded-3xl border border-white/10 pointer-events-auto shadow-2xl">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <Sun size={18} className="text-white animate-pulse" />
            </div>
            <h1 className="text-white text-2xl font-bold tracking-tight">
              Solar VR
            </h1>
          </div>
          <p className="text-white/50 text-sm mb-6">
            Orbital Mechanics Simulation.
          </p>

          <div className="flex flex-col gap-6">
            {/* Orbit Slider */}
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold text-white/40 uppercase tracking-widest flex items-center gap-2">
                  <Calendar size={14} /> Orbital Timeline
                </span>
                <span className="text-blue-400 font-black text-sm">
                  {currentMonth}
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="365"
                step="0.01"
                value={((orbitProgress % 365) + 365) % 365}
                onChange={(e) => setOrbitProgress(parseFloat(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-white/20 font-bold uppercase">
                <span>Jan</span>
                <span>Jun</span>
                <span>Dec</span>
              </div>
            </div>

            {/* Time Speed Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-white/40 uppercase tracking-widest">
                <span>Time Speed</span>
                <span>{playbackSpeed.toFixed(1)} days/s</span>
              </div>
              <input
                type="range"
                min="0"
                max="30"
                step="0.1"
                value={playbackSpeed}
                onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-yellow-500"
              />
            </div>

            {/* Sun Brightness Slider */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-white/40 uppercase tracking-widest relative">
                <span className="flex items-center gap-1">
                  <SunMedium size={14} /> Sun
                </span>
                <span>{Math.round((sunIntensity / 3000) * 100)}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="10000"
                step="100"
                value={sunIntensity}
                onChange={(e) => setSunIntensity(parseFloat(e.target.value))}
                className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
            </div>

            {/* Atmosphere Toggle */}
            <div className="flex items-center justify-between font-bold">
              <span className="text-xs text-white/40 uppercase tracking-widest flex items-center gap-2">
                <CloudLightning size={14} /> Atmosphere
              </span>
              <button
                onClick={() => setShowAtmosphere(!showAtmosphere)}
                className={`w-12 h-6 rounded-full transition-colors relative flex items-center ${showAtmosphere ? "bg-blue-600" : "bg-gray-600"}`}
              >
                <div
                  className={`w-4 h-4 bg-white rounded-full mx-1 transition-transform ${showAtmosphere ? "translate-x-6" : "translate-x-0"}`}
                />
              </button>
            </div>

            <div className="space-y-3">
              <span className="text-xs font-bold text-white/40 uppercase tracking-widest block">
                Focus Viewpoint
              </span>
              <div className="grid grid-cols-3 gap-2">
                {(["earth", "sun", "moon"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setViewpoint(v)}
                    className={`px-2 py-2 rounded-xl text-[10px] font-black uppercase transition-all border ${
                      viewpoint === v
                        ? "bg-white text-black border-white shadow-xl scale-105"
                        : "bg-transparent text-white/40 border-white/10 hover:border-white/30"
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={handleEnterVR}
          className="bg-blue-600 text-white px-8 py-5 rounded-3xl font-black text-lg hover:bg-blue-500 transition-all pointer-events-auto flex items-center justify-center gap-3 shadow-2xl group"
        >
          <Maximize
            size={24}
            className="group-hover:scale-110 transition-transform"
          />
          START VR ODYSSEY
        </button>
        {xrIssue && (
          <div className="pointer-events-auto max-w-sm rounded-2xl border border-red-400/30 bg-red-950/60 px-4 py-3 text-sm text-red-100">
            {xrIssue}
          </div>
        )}
      </div>

      {/* 3D Scene */}
      <Canvas
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}
      >
        <PhysicsSimulator
          targetProgress={orbitProgress}
          currentRef={orbitCurrentRef}
          playbackSpeed={playbackSpeed}
        />
        <XR store={store}>
          <PerspectiveCamera makeDefault position={[0, 5, 15]} fov={45} />
          <XROriginRig viewpoint={viewpoint} orbitCurrentRef={orbitCurrentRef} />
          <color attach="background" args={["#000000"]} />

          <ambientLight intensity={0.05} />

          <Stars
            radius={200}
            depth={50}
            count={10000}
            factor={6}
            saturation={0.5}
            fade
            speed={0.5}
          />

          <Suspense fallback={<Loader />}>
            <SolarSystem
              orbitCurrentRef={orbitCurrentRef}
              sunIntensity={sunIntensity}
              showAtmosphere={showAtmosphere}
            />
            <CameraRig
              viewpoint={viewpoint}
              orbitCurrentRef={orbitCurrentRef}
            />
          </Suspense>

          <Environment preset="night" />
        </XR>
      </Canvas>
      {/* Realistic Accents */}
      <div className="absolute bottom-8 left-8 flex items-center gap-4">
        <div className="flex -space-x-2">
          <div className="w-8 h-8 rounded-full border-2 border-black bg-blue-400 shadow-lg shadow-blue-400/20" />
          <div className="w-8 h-8 rounded-full border-2 border-black bg-gray-400 shadow-lg shadow-gray-400/20" />
          <div className="w-8 h-8 rounded-full border-2 border-black bg-yellow-400 shadow-lg shadow-yellow-400/20" />
        </div>
        <div className="text-white/20 text-[10px] font-bold uppercase tracking-[0.3em]">
          Orbital Mechanics Active • Day {orbitProgress.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
