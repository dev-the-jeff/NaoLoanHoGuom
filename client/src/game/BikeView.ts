import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { BikeState } from '../../../shared/src/contracts';
import { Resources } from './Resources';
/** Original primitive motorcycle/rider; procedural lean has no animation allocations. */
export class BikeView {
  readonly root = new THREE.Group();
  private readonly lean = new THREE.Group();
  private readonly frontWheel = new THREE.Group();
  private readonly rearWheel = new THREE.Group();
  private readonly flame: THREE.Mesh;
  private readonly bodyMaterial: THREE.MeshLambertMaterial;
  constructor(resources: Resources) {
    const material = (color: number) => resources.material(new THREE.MeshLambertMaterial({ color, flatShading: true }));
    const box = resources.geometry(new THREE.BoxGeometry(1, 1, 1));
    const dark = material(0x18272e); const metal = material(0xaab8b7); const rider = material(0xeb783b);
    this.bodyMaterial = material(0x28c4bd);
    const part = (parent: THREE.Object3D, mat: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number): THREE.Mesh => {
      const mesh = new THREE.Mesh(box, mat); mesh.position.set(x, y, z); mesh.scale.set(sx, sy, sz); parent.add(mesh); return mesh;
    };
    this.root.add(this.lean);
    const tyre = resources.geometry(new THREE.CylinderGeometry(0.44, 0.44, 0.28, 10));
    const hub = resources.geometry(new THREE.CylinderGeometry(0.24, 0.24, 0.3, 8));
    for (const [wheel, z] of [[this.frontWheel, -0.95], [this.rearWheel, 0.95]] as const) {
      wheel.position.set(0, 0.45, z);
      const rubber = new THREE.Mesh(tyre, dark); rubber.rotation.z = Math.PI / 2; wheel.add(rubber);
      const rim = new THREE.Mesh(hub, metal); rim.rotation.z = Math.PI / 2; wheel.add(rim); this.lean.add(wheel);
    }
    part(this.lean, this.bodyMaterial, 0, 0.98, -0.18, 0.58, 0.55, 1.3);
    part(this.lean, dark, 0, 1.26, 0.52, 0.56, 0.15, 0.85);
    part(this.lean, this.bodyMaterial, 0, 0.92, 1.05, 0.64, 0.28, 0.55);
    part(this.lean, metal, 0, 0.82, -0.83, 0.16, 0.75, 0.15).rotation.x = -0.25;
    part(this.lean, dark, 0, 1.44, -0.68, 1.05, 0.1, 0.18);
    part(this.lean, material(0xffe8a5), 0, 1.13, -0.87, 0.45, 0.24, 0.13);
    part(this.lean, material(0xe75439), 0, 1, 1.34, 0.3, 0.12, 0.1);
    part(this.lean, metal, 0.38, 0.63, 0.72, 0.2, 0.2, 1.1);
    part(this.lean, rider, 0, 1.78, 0.12, 0.65, 0.7, 0.42).rotation.x = -0.34;
    for (const side of [-1, 1]) {
      part(this.lean, dark, side * 0.34, 1.13, 0.38, 0.2, 0.64, 0.4).rotation.x = -0.5;
      part(this.lean, rider, side * 0.37, 1.63, -0.35, 0.19, 0.22, 0.75).rotation.x = -0.3;
      part(this.lean, dark, side * 0.37, 0.8, 0.18, 0.23, 0.17, 0.43);
    }
    const helmet = new THREE.Mesh(resources.geometry(new THREE.IcosahedronGeometry(0.36, 0)), this.bodyMaterial);
    helmet.position.set(0, 2.25, -0.14); this.lean.add(helmet);
    part(this.lean, dark, 0, 2.27, -0.43, 0.49, 0.16, 0.09);
    const flameMaterial = resources.material(new THREE.MeshBasicMaterial({ color: 0x6ffff1, transparent: true, opacity: 0.8 }));
    this.flame = new THREE.Mesh(resources.geometry(new THREE.ConeGeometry(0.16, 1.4, 5)), flameMaterial);
    this.flame.rotation.x = Math.PI / 2; this.flame.position.set(0.38, 0.63, 1.8); this.flame.visible = false; this.lean.add(this.flame);
    const shadow = new THREE.Mesh(resources.geometry(new THREE.CircleGeometry(1, 16)), resources.material(new THREE.MeshBasicMaterial({ color: 0x262d2d, transparent: true, opacity: 0.22, depthWrite: false })));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.025; shadow.scale.set(0.65, 1.65, 1); this.root.add(shadow);
    this.mergeStaticParts(resources);
  }
  private mergeStaticParts(resources: Resources): void {
    const groups = new Map<THREE.Material, THREE.Mesh[]>();
    for (const child of this.lean.children) {
      if (!(child instanceof THREE.Mesh) || child === this.flame || Array.isArray(child.material)) continue;
      const group = groups.get(child.material);
      if (group) group.push(child); else groups.set(child.material, [child]);
    }
    for (const [material, meshes] of groups) {
      if (meshes.length < 2) continue;
      const temporary: THREE.BufferGeometry[] = [];
      try {
        for (const mesh of meshes) { mesh.updateMatrix(); const baked = mesh.geometry.index ? mesh.geometry.toNonIndexed() : mesh.geometry.clone(); temporary.push(baked.applyMatrix4(mesh.matrix)); }
        const combined = mergeGeometries(temporary);
        if (!combined) continue;
        this.lean.add(new THREE.Mesh(resources.geometry(combined), material));
        for (const mesh of meshes) this.lean.remove(mesh);
      } finally { for (const geometry of temporary) geometry.dispose(); }
    }
  }
  /** Applies the server-selected vehicle colour without replacing materials. */
  tint(color: number): void { this.bodyMaterial.color.setHex(color); }
  /** Synchronizes reusable meshes with the current physical state. */
  update(s: Readonly<BikeState>, dt: number, steer: number): void {
    this.root.position.set(s.x, 0.02, -s.progress); this.root.rotation.y = -s.heading;
    const target = -steer * Math.min(1, s.speed / 15) * 0.22;
    this.lean.rotation.z += (target - this.lean.rotation.z) * (1 - Math.exp(-8 * dt));
    this.frontWheel.rotation.x -= s.speed * dt / 0.44; this.rearWheel.rotation.x = this.frontWheel.rotation.x;
    this.flame.visible = s.boosting; this.bodyMaterial.emissive.setHex(s.contact ? 0x63271b : 0x000000);
  }
}



