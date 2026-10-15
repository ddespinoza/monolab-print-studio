import {
  AmbientLight,
  Box3,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  Color,
  DirectionalLight,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  Vector3,
  WebGLRenderer,
  WireframeGeometry,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { BUILD_VOLUME } from "@/lib/fit";

export interface ViewerModel {
  id: string;
  /** Triangle positions in STL axes (Z up). */
  positions: Float32Array;
  scalePercent: number;
  visible: boolean;
}
export type ViewPreset = "iso" | "top" | "front" | "side";

interface Entry {
  positions: Float32Array;
  geometry: BufferGeometry;
  mesh: Mesh;
  wire: LineSegments | null;
}

const GAP_MM = 12;

/** Palette tokens are the single source of colour: read them from CSS at runtime. */
function token(name: string): Color {
  return new Color(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
}

export class ViewerController {
  private scene = new Scene();
  private camera: PerspectiveCamera;
  private renderer: WebGLRenderer;
  private controls: OrbitControls;
  private entries = new Map<string, Entry>();
  private resizeObserver: ResizeObserver;
  private frame = 0;
  private wireframe = false;
  private colors = { model: token("--prussian-blue"), active: token("--orange") };
  private order: ViewerModel[] = [];

  constructor(private container: HTMLElement) {
    const { clientWidth: w, clientHeight: h } = container;
    this.scene.background = token("--bg-canvas");
    this.camera = new PerspectiveCamera(45, (w || 600) / (h || 450), 0.1, 4000);
    this.camera.up.set(0, 0, 1);
    this.renderer = new WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(w || 600, h || 450);
    container.appendChild(this.renderer.domElement);
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.minDistance = 10;
    this.controls.maxDistance = 1500;
    this.addLights();
    this.addBuildPlate();
    this.setView("iso");
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    const loop = (): void => {
      this.frame = requestAnimationFrame(loop);
      this.controls.update();
      this.renderer.render(this.scene, this.camera);
    };
    loop();
  }

  private addLights(): void {
    this.scene.add(new AmbientLight(0xffffff, 1.1));
    const key = new DirectionalLight(0xffffff, 1.4);
    key.position.set(120, -160, 220);
    this.scene.add(key);
    const fill = new DirectionalLight(0xffffff, 0.5);
    fill.position.set(-140, 100, 80);
    this.scene.add(fill);
  }

  private addBuildPlate(): void {
    const { x, y, z } = BUILD_VOLUME;
    const plate = new Mesh(
      new BoxGeometry(x, y, 2),
      new MeshStandardMaterial({ color: token("--bg-deep"), roughness: 0.8 }),
    );
    plate.position.z = -1;
    this.scene.add(plate);
    const pts: number[] = [];
    for (let gx = -x / 2; gx <= x / 2 + 0.01; gx += 10) pts.push(gx, -y / 2, 0.05, gx, y / 2, 0.05);
    for (let gy = -y / 2; gy <= y / 2 + 0.01; gy += 10) pts.push(-x / 2, gy, 0.05, x / 2, gy, 0.05);
    const grid = new BufferGeometry();
    grid.setAttribute("position", new BufferAttribute(new Float32Array(pts), 3));
    this.scene.add(
      new LineSegments(
        grid,
        new LineBasicMaterial({ color: token("--text-muted"), transparent: true, opacity: 0.5 }),
      ),
    );
    const box = new LineSegments(
      new EdgesGeometry(new BoxGeometry(x, y, z)),
      new LineBasicMaterial({ color: token("--border-medium"), transparent: true, opacity: 0.6 }),
    );
    box.position.z = z / 2;
    this.scene.add(box);
  }

  private build(model: ViewerModel): Entry {
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(model.positions, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    const b = geometry.boundingBox as Box3;
    geometry.translate(-(b.min.x + b.max.x) / 2, -(b.min.y + b.max.y) / 2, -b.min.z);
    geometry.computeBoundingBox();
    const mesh = new Mesh(
      geometry,
      new MeshStandardMaterial({
        color: this.colors.model,
        flatShading: true,
        roughness: 0.6,
        metalness: 0.05,
      }),
    );
    this.scene.add(mesh);
    return { positions: model.positions, geometry, mesh, wire: null };
  }

  private drop(entry: Entry): void {
    this.scene.remove(entry.mesh);
    entry.geometry.dispose();
    (entry.mesh.material as MeshStandardMaterial).dispose();
    if (entry.wire) {
      entry.wire.geometry.dispose();
      (entry.wire.material as LineBasicMaterial).dispose();
    }
  }

  /** Syncs the scene with the given models (rebuilding only changed geometry) and lays them out along X. */
  setModels(models: ViewerModel[], activeId?: string): void {
    this.order = models;
    const keep = new Set(models.map((m) => m.id));
    for (const [id, entry] of this.entries) {
      if (!keep.has(id)) {
        this.drop(entry);
        this.entries.delete(id);
      }
    }
    for (const m of models) {
      let entry = this.entries.get(m.id);
      if (entry && entry.positions !== m.positions) {
        this.drop(entry);
        entry = undefined;
      }
      if (!entry) {
        entry = this.build(m);
        this.entries.set(m.id, entry);
      }
      const scale = m.scalePercent / 100;
      entry.mesh.scale.setScalar(scale);
      entry.mesh.visible = m.visible;
      (entry.mesh.material as MeshStandardMaterial).color.copy(
        m.id === activeId ? this.colors.active : this.colors.model,
      );
    }
    this.layout();
    this.applyWireframe();
  }

  private layout(): void {
    const visible = this.order.filter((m) => m.visible && this.entries.has(m.id));
    const widths = visible.map((m) => {
      const b = (this.entries.get(m.id) as Entry).geometry.boundingBox as Box3;
      return (b.max.x - b.min.x) * (m.scalePercent / 100);
    });
    const total = widths.reduce((s, w) => s + w, 0) + GAP_MM * Math.max(0, visible.length - 1);
    let x = -total / 2;
    visible.forEach((m, i) => {
      (this.entries.get(m.id) as Entry).mesh.position.set(x + widths[i] / 2, 0, 0);
      x += widths[i] + GAP_MM;
    });
  }

  private combinedSize(): Vector3 | null {
    const box = new Box3();
    for (const m of this.order) {
      const e = this.entries.get(m.id);
      if (e && m.visible) box.union(new Box3().setFromObject(e.mesh));
    }
    return box.isEmpty() ? null : box.getSize(new Vector3());
  }

  setWireframe(on: boolean): void {
    this.wireframe = on;
    this.applyWireframe();
  }

  private applyWireframe(): void {
    for (const entry of this.entries.values()) {
      if (this.wireframe && !entry.wire) {
        entry.wire = new LineSegments(
          new WireframeGeometry(entry.geometry),
          new LineBasicMaterial({ color: token("--orange-dark") }),
        );
        entry.mesh.add(entry.wire);
      }
      if (entry.wire) entry.wire.visible = this.wireframe;
    }
  }

  setView(preset: ViewPreset): void {
    const d = this.combinedSize();
    const max = Math.max(d?.x ?? 0, d?.y ?? 0, d?.z ?? 0, 60);
    const cz = (d?.z ?? 0) / 2;
    const positions: Record<ViewPreset, [number, number, number]> = {
      iso: [max * 1.5, -max * 1.8, max * 1.4 + cz],
      top: [0, -max * 0.01, max * 2.8],
      front: [0, -max * 2.5, cz],
      side: [max * 2.5, 0, cz],
    };
    this.camera.position.set(...positions[preset]);
    this.controls.target.set(0, 0, cz);
    this.controls.update();
  }

  private resize(): void {
    const { clientWidth: w, clientHeight: h } = this.container;
    if (!w || !h) return;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  dispose(): void {
    cancelAnimationFrame(this.frame);
    this.resizeObserver.disconnect();
    for (const entry of this.entries.values()) this.drop(entry);
    this.entries.clear();
    this.controls.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
