import { battingCrease, type WagonShot } from "./wagon-wheel";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { GroundZone } from "./analysis-ground";
import type { RateSeries } from "./dashboard-analysis";
export const dashboardColors = [
  0xc73751, 0xe9b949, 0x54b8af, 0x7e91dc, 0xb477c4, 0x7eb779, 0xc48452, 0x5593b8, 0xd67f9d,
  0xa7a15b, 0x778b9a,
];
export function createDashboardScene(
  host: HTMLElement,
  kind: "wheel" | "rate",
  zones: GroundZone[],
  series: RateSeries,
  onSelect: (key: string) => void,
  onFailure: () => void,
  shots: WagonShot[] = [],
) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x17191e, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.style.cssText = "width:100%;height:100%;display:block";
  renderer.domElement.setAttribute("aria-hidden", "true");
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene(),
    camera = new THREE.PerspectiveCamera(42, 1, 0.1, 150);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x354052, 2.5));
  const light = new THREE.DirectionalLight(0xffead1, 3);
  light.position.set(-12, 25, 20);
  scene.add(light);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = 20;
  controls.maxDistance = 65;
  controls.maxPolarAngle = Math.PI / 2.1;
  const picks: THREE.Mesh[] = [];
  const ownedGeometries = new Set<THREE.BufferGeometry>();
  const ownedMaterials = new Set<THREE.Material>();
  const ownedTextures = new Set<THREE.Texture>();
  const mesh = (g: THREE.BufferGeometry, color: number) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.18 });
    ownedGeometries.add(g);
    ownedMaterials.add(m);
    const o = new THREE.Mesh(g, m);
    scene.add(o);
    return o;
  };
  const label = (text: string, x: number, y: number, z: number) => {
    const c = document.createElement("canvas");
    c.width = 256;
    c.height = 64;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.font = "600 30px sans-serif";
    ctx.fillStyle = "#ece8df";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 32);
    const t = new THREE.CanvasTexture(c);
    ownedTextures.add(t);
    const m = new THREE.SpriteMaterial({ map: t, depthTest: false });
    ownedMaterials.add(m);
    const o = new THREE.Sprite(m);
    o.position.set(x, y, z);
    o.scale.set(5, 1.25, 1);
    scene.add(o);
  };
  if (kind === "wheel") {
    mesh(new THREE.CylinderGeometry(9, 9, 0.35, 80), 0x124c43).position.y = -0.2;
    const boundary = mesh(new THREE.TorusGeometry(8.8, 0.035, 6, 80), 0xe5e7cf);
    boundary.rotation.x = Math.PI / 2;
    mesh(new THREE.BoxGeometry(1, 0.05, 4.2), 0xc4ad7b).position.y = 0.02;
    for (const z of [-1.7, 1.7]) {
      const crease = mesh(new THREE.BoxGeometry(1.4, 0.03, 0.025), 0xffffff);
      crease.position.set(0, 0.08, z);
    }
    const batter = mesh(new THREE.SphereGeometry(0.15, 12, 8), 0xffffff);
    batter.position.set(battingCrease.x / 5, 0.2, battingCrease.z / 5);
    for (const shot of shots.slice(0, 500)) {
      const color = Number.parseInt(shot.color.slice(1), 16);
      if (!shot.fielding) {
        const path = mesh(
          new THREE.TubeGeometry(
            new THREE.LineCurve3(
              new THREE.Vector3(battingCrease.x / 5, 0.13, battingCrease.z / 5),
              new THREE.Vector3(shot.x / 5, 0.13, shot.z / 5),
            ),
            1,
            0.035,
            6,
            false,
          ),
          color,
        );
        path.userData["key"] = shot.zone;
        picks.push(path);
      }
      const ball = mesh(new THREE.SphereGeometry(0.1, 10, 8), color);
      ball.position.set(shot.x / 5, 0.18, shot.z / 5);
      ball.userData["key"] = shot.zone;
      picks.push(ball);
    }
    zones.forEach((zone, i) => label(`${i + 1}. ${zone.name}`, zone.x / 4.1, 0.5, zone.z / 4.1));
  } else {
    const points = series.flatMap((s) => s.points);
    const maxRate = Math.max(1, ...points.map((p) => p.rate ?? 0));
    const maxOver = Math.max(1, ...points.map((p) => p.over));
    for (let i = 0; i <= 4; i++) {
      const y = i * 3;
      const grid = mesh(new THREE.BoxGeometry(20, 0.025, 0.025), 0x454952);
      grid.position.set(0, y, 0);
      label(((maxRate * i) / 4).toFixed(1), -12, y, 0);
      const x = -10 + i * 5;
      const vertical = mesh(new THREE.BoxGeometry(0.025, 12, 0.025), 0x30343d);
      vertical.position.set(x, 6, 0);
      label(((maxOver * i) / 4).toFixed(1), x, -1.2, 0);
    }
    label("Runs / over", -8, 14, 0);
    label("Recorded over", 5, -3, 0);
    series.forEach((s, i) => {
      let previous: THREE.Vector3 | null = null;
      for (const p of s.points) {
        if (p.rate === null) {
          previous = null;
          continue;
        }
        const pos = new THREE.Vector3(
          -10 + (20 * p.over) / maxOver,
          (12 * p.rate) / maxRate,
          i * 0.35 + 0.25,
        );
        const color = dashboardColors[i % 4]!;
        const dot = mesh(new THREE.SphereGeometry(0.18, 10, 8), color);
        dot.position.copy(pos);
        dot.userData["key"] = `${s.id}:${p.over}`;
        picks.push(dot);
        if (previous && previous.distanceTo(pos) > 0) {
          mesh(
            new THREE.TubeGeometry(new THREE.LineCurve3(previous, pos), 1, 0.07, 6, false),
            color,
          );
        }
        previous = pos;
      }
    });
  }
  let disposed = false;
  const render = () => {
    if (!disposed)
      try {
        renderer.render(scene, camera);
      } catch {
        onFailure();
      }
  };
  controls.addEventListener("change", render);
  const resize = () => {
    if (disposed) return;
    const w = Math.max(1, host.clientWidth),
      h = Math.max(1, host.clientHeight);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const scale = Math.max(1, 1 / camera.aspect);
    camera.position.set(
      kind === "wheel" ? 0 : 3,
      (kind === "wheel" ? 19 : 12) * scale,
      (kind === "wheel" ? 21 : 25) * scale,
    );
    controls.target.set(0, kind === "wheel" ? 0 : 5, 0);
    controls.update();
    render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  let down = { x: 0, y: 0 };
  const pointer = (e: PointerEvent) => {
    down = { x: e.clientX, y: e.clientY };
  };
  const click = (e: MouseEvent) => {
    if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
    const b = renderer.domElement.getBoundingClientRect();
    const ray = new THREE.Raycaster();
    ray.setFromCamera(
      new THREE.Vector2(
        (2 * (e.clientX - b.left)) / b.width - 1,
        1 - (2 * (e.clientY - b.top)) / b.height,
      ),
      camera,
    );
    const hit = ray.intersectObjects(picks)[0];
    if (hit) onSelect(String(hit.object.userData["key"]));
  };
  const lost = (e: Event) => {
    e.preventDefault();
    onFailure();
  };
  renderer.domElement.addEventListener("pointerdown", pointer);
  renderer.domElement.addEventListener("click", click);
  renderer.domElement.addEventListener("webglcontextlost", lost);
  resize();
  return {
    dispose() {
      if (disposed) return;
      disposed = true;
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", pointer);
      renderer.domElement.removeEventListener("click", click);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      ownedGeometries.forEach((g) => g.dispose());
      ownedMaterials.forEach((m) => m.dispose());
      ownedTextures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
