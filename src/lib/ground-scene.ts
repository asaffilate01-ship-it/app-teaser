import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { SpatialMark } from "./spatial-analysis";
import type { GroundZone, GroundMetric } from "./analysis-ground";
export type GroundView = "perspective" | "overhead" | "end" | "pitch";

/** On-demand rendering only. The owner must call dispose on hide/unmount. */
export function createGroundScene(
  host: HTMLElement,
  onSelect: (name: string) => void,
  onFailure: () => void,
) {
  const renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "low-power",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x080f1d, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.setAttribute("aria-hidden", "true");
  renderer.domElement.style.width = "100%";
  renderer.domElement.style.height = "100%";
  renderer.domElement.style.display = "block";
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 500);
  scene.add(new THREE.HemisphereLight(0xd6f8ff, 0x243345, 2.4));
  const light = new THREE.DirectionalLight(0xffdf9f, 3);
  light.position.set(-35, 60, 25);
  scene.add(light);
  const accent = new THREE.DirectionalLight(0x60e8e0, 2);
  accent.position.set(40, 20, -30);
  scene.add(accent);
  const materials = new Set<THREE.Material>();
  const geometries = new Set<THREE.BufferGeometry>();
  const textures = new Set<THREE.Texture>();
  const mesh = (geometry: THREE.BufferGeometry, color: number, parent: THREE.Object3D = scene) => {
    const material = new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.18 });
    materials.add(material);
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, material);
    parent.add(object);
    return object;
  };
  mesh(new THREE.CylinderGeometry(47, 49, 3, 96), 0x172638).position.y = -2;
  for (let i = 0; i < 5; i++) {
    const ring = mesh(
      new THREE.TorusGeometry(44 + i * 0.85, 0.22, 6, 96),
      i === 4 ? 0xbe9453 : 0x365166,
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.1 + i * 0.26;
  }
  mesh(new THREE.CylinderGeometry(43, 43, 0.4, 96), 0x124c43).position.y = -0.2;
  for (const radius of [12, 24, 36]) {
    const ring = mesh(new THREE.RingGeometry(radius, radius + 0.1, 96), 0x337b68);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
  }
  const boundary = mesh(new THREE.TorusGeometry(42, 0.13, 6, 96), 0xd9e4cc);
  boundary.rotation.x = Math.PI / 2;
  boundary.position.y = 0.1;
  mesh(new THREE.BoxGeometry(5, 0.15, 21), 0xb69c69).position.y = 0.1;
  for (const z of [-8.5, 8.5]) {
    const crease = mesh(new THREE.BoxGeometry(7, 0.08, 0.15), 0xf1e5c6);
    crease.position.set(0, 0.22, z);
    for (const x of [-0.5, 0, 0.5]) {
      const stump = mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 6), 0xffedcb);
      stump.position.set(x, 0.8, z > 0 ? 10 : -10);
    }
  }
  const bars: THREE.Mesh[] = [];
  const labels: THREE.Sprite[] = [];
  const ray = new THREE.Raycaster();
  let disposed = false;
  let view: GroundView = "perspective";
  const render = () => {
    if (!disposed) {
      try {
        renderer.render(scene, camera);
      } catch {
        onFailure();
      }
    }
  };
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enablePan = false;
  controls.minDistance = 18;
  controls.maxDistance = 500;
  controls.maxPolarAngle = Math.PI / 2.05;
  controls.addEventListener("change", render);
  const resize = () => {
    if (disposed) return;
    const width = Math.max(1, host.clientWidth),
      height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    // Fit the whole ground on narrow screens as well as desktop.
    const distance = Math.max(
      view === "pitch" ? 32 : view === "perspective" ? 116 : 145,
      (view === "pitch" ? 40 : view === "perspective" ? 120 : 145) / camera.aspect,
    );
    if (view === "overhead") camera.position.set(0, distance, 0.01);
    else if (view === "pitch") camera.position.set(distance * 0.35, distance * 0.7, distance * 0.7);
    else if (view === "end") camera.position.set(0, distance * 0.55, -distance * 0.85);
    else camera.position.set(distance * 0.42, distance * 0.72, distance * 0.75);
    camera.lookAt(0, 0, 0);
    controls.update();
    render();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  let pointerStart = { x: 0, y: 0 };
  const pointerDown = (event: PointerEvent) => {
    pointerStart = { x: event.clientX, y: event.clientY };
  };
  const click = (event: MouseEvent) => {
    if (Math.hypot(event.clientX - pointerStart.x, event.clientY - pointerStart.y) > 5) return;
    const bounds = renderer.domElement.getBoundingClientRect();
    ray.setFromCamera(
      new THREE.Vector2(
        ((event.clientX - bounds.left) / bounds.width) * 2 - 1,
        (-(event.clientY - bounds.top) / bounds.height) * 2 + 1,
      ),
      camera,
    );
    const hit = ray.intersectObjects(bars)[0];
    if (hit) onSelect(String(hit.object.userData["zone"]));
  };
  const lost = (event: Event) => {
    event.preventDefault();
    onFailure();
  };
  renderer.domElement.addEventListener("pointerdown", pointerDown);
  renderer.domElement.addEventListener("click", click);
  renderer.domElement.addEventListener("webglcontextlost", lost);
  resize();
  return {
    update(
      zones: GroundZone[],
      metric: GroundMetric,
      selected: string,
      nextView: GroundView,
      marks: SpatialMark[] = [],
    ) {
      for (const bar of bars) {
        scene.remove(bar);
        bar.geometry.dispose();
        geometries.delete(bar.geometry);
        const m = bar.material as THREE.Material;
        m.dispose();
        materials.delete(m);
      }
      bars.length = 0;
      for (const label of labels) {
        scene.remove(label);
        label.material.map?.dispose();
        if (label.material.map) textures.delete(label.material.map);
        label.material.dispose();
        materials.delete(label.material);
      }
      labels.length = 0;
      const max = Math.max(1, ...zones.map((z) => z[metric]));
      zones.forEach((zone, index) => {
        const height = zone[metric] === 0 ? 0.3 : 1 + (14 * zone[metric]) / max;
        const bar = mesh(
          new THREE.CylinderGeometry(1.35, 1.35, height, 16),
          zone.name === selected ? 0xffca76 : zone[metric] > 0 ? 0x65e5c1 : 0x47736b,
        );
        bar.position.set(zone.x, height / 2 + 0.2, zone.z);
        bar.userData["zone"] = zone.name;
        bars.push(bar);
        const canvas = document.createElement("canvas");
        canvas.width = 64;
        canvas.height = 64;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.fillStyle = "#0b1726";
        ctx.beginPath();
        ctx.roundRect(4, 4, 56, 56, 28);
        ctx.fill();
        ctx.strokeStyle = zone.name === selected ? "#ffca76" : "#71cdb3";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = "600 32px sans-serif";
        ctx.fillText(String(index + 1), 32, 34);
        const texture = new THREE.CanvasTexture(canvas);
        textures.add(texture);
        const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
        materials.add(material);
        const label = new THREE.Sprite(material);
        label.position.set(zone.x, height + 3.2, zone.z);
        label.scale.set(8, 8, 1);
        scene.add(label);
        labels.push(label);
      });
      for (const mark of marks) {
        const color = mark.id === selected ? 0xffffff : mark.color;
        const geometry =
          mark.shape === "shot"
            ? new THREE.TubeGeometry(
                new THREE.LineCurve3(
                  new THREE.Vector3(0, 0.4, 8.5),
                  new THREE.Vector3(mark.x, 0.4, mark.z),
                ),
                1,
                0.16,
                5,
                false,
              )
            : mark.shape === "bar"
              ? new THREE.BoxGeometry(1, mark.height, 2)
              : mark.shape === "fielder"
                ? new THREE.CapsuleGeometry(0.6, 1.8, 4, 8)
                : new THREE.SphereGeometry(0.45, 12, 8);
        const object = mesh(geometry, color);
        if (mark.shape !== "shot")
          object.position.set(
            mark.x,
            mark.shape === "bar"
              ? mark.height / 2 + 0.2
              : mark.shape === "fielder"
                ? 1.7
                : mark.height,
            mark.z,
          );
        if (mark.shape === "trend") {
          const start = new THREE.Vector3(
            mark.fromX ?? mark.x,
            mark.fromHeight ?? mark.height,
            mark.z,
          );
          const end = new THREE.Vector3(mark.x, mark.height, mark.z);
          if (start.distanceTo(end) > 0.001) {
            const line = mesh(
              new THREE.TubeGeometry(new THREE.LineCurve3(start, end), 1, 0.18, 6, false),
              color,
            );
            line.userData["zone"] = mark.id;
            bars.push(line);
          }
        }
        if (mark.shape === "fielder") {
          const head = mesh(new THREE.SphereGeometry(0.65, 10, 8), color);
          head.position.set(mark.x, 3.8, mark.z);
          head.userData["zone"] = mark.id;
          bars.push(head);
        }
        object.userData["zone"] = mark.id;
        bars.push(object);
      }
      if (view !== nextView) {
        view = nextView;
        resize();
      } else render();
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("click", click);
      renderer.domElement.removeEventListener("webglcontextlost", lost);
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      textures.forEach((t) => t.dispose());
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    },
  };
}
