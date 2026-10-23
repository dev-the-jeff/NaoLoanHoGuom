import * as THREE from 'three';
import { GAME_CONFIG as C } from '../config/gameConfig';
import { RACE_RULES, ROAD_OBSTACLES } from '../../../shared/src/course'; import { Road } from './Road';
import { Resources } from './Resources';
/** Procedural static environment. Repeated props and continuous rails use instancing. */
export class Track {
  readonly root = new THREE.Group();
  constructor(road: Road, resources: Resources) {
    const mat = (color: number) => resources.material(new THREE.MeshLambertMaterial({ color, flatShading: true }));
    const box = resources.geometry(new THREE.BoxGeometry(1, 1, 1));
    const asphalt = mat(0x373c40); const sand = mat(0xbe9468); const curb = mat(0xd6b288);
    const white = mat(0xf7dfb1); const orange = mat(0xe97336); const steel = mat(0x657276);
    const ground = new THREE.Mesh(resources.geometry(new THREE.PlaneGeometry(2600, road.length + 1200)), sand);
    ground.rotation.x = -Math.PI / 2; ground.position.set(0, -0.07, -road.length / 2); this.root.add(ground);
    const ribbon = (left: number, right: number, height: number, material: THREE.Material): void => {
      const positions: number[] = []; const indices: number[] = [];
      const count = Math.ceil(road.length / C.roadSampleStep);
      for (let i = 0; i <= count; i++) {
        const p = Math.min(road.length, i * C.roadSampleStep); const x = road.centerAt(p);
        positions.push(x + left, height, -p, x + right, height, -p);
        if (i < count) { const a = i * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
      const geometry = resources.geometry(new THREE.BufferGeometry());
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
      this.root.add(new THREE.Mesh(geometry, material));
    };
    ribbon(-road.halfWidth - 2, road.halfWidth + 2, -0.03, curb); ribbon(-road.halfWidth, road.halfWidth, 0, asphalt);
    ribbon(-road.halfWidth + 0.5, -road.halfWidth + 0.65, 0.013, white); ribbon(road.halfWidth - 0.65, road.halfWidth - 0.5, 0.013, white);
    const count = Math.ceil(road.length / C.roadSampleStep);
    const rails = new THREE.InstancedMesh(box, steel, count * 2);
    const marks = new THREE.InstancedMesh(box, white, Math.floor(road.length / 12) * (C.laneCount - 1));
    const posts = new THREE.InstancedMesh(box, orange, Math.floor(road.length / C.roadsidePostSpacing) * 2);
    const dummy = new THREE.Object3D(); let n = 0;
    for (let i = 0; i < count; i++) {
      const start = i * C.roadSampleStep; const end = Math.min(road.length, start + C.roadSampleStep);
      const x0 = road.centerAt(start); const x1 = road.centerAt(end);
      for (const side of [-1, 1]) {
        dummy.position.set((x0 + x1) / 2 + side * (road.halfWidth + 0.15), 0.55, -(start + end) / 2);
        dummy.rotation.set(0, -Math.atan2(x1 - x0, end - start), 0);
        dummy.scale.set(0.3, 0.65, Math.hypot(x1 - x0, end - start) + 0.08); dummy.updateMatrix(); rails.setMatrixAt(n++, dummy.matrix);
      }
    }
    for (let i = 0; i < marks.count; i++) {
      const p = Math.floor(i / (C.laneCount - 1)) * 12 + 5;
      const lateral = -road.halfWidth + (i % (C.laneCount - 1) + 1) * C.laneWidth;
      dummy.position.set(road.centerAt(p) + lateral, 0.018, -p);
      dummy.rotation.set(0, -Math.atan2(road.centerAt(p + 2) - road.centerAt(p - 2), 4), 0);
      dummy.scale.set(0.14, 0.018, 4); dummy.updateMatrix(); marks.setMatrixAt(i, dummy.matrix);
    }
    n = 0;
    for (let i = 0; i < posts.count / 2; i++) {
      const p = i * C.roadsidePostSpacing + 2;
      for (const side of [-1, 1]) {
        dummy.position.set(road.centerAt(p) + side * (road.halfWidth + 0.3), 0.95, -p); dummy.rotation.set(0, 0, 0);
        dummy.scale.set(0.25, 1.9, 0.25); dummy.updateMatrix(); posts.setMatrixAt(n++, dummy.matrix);
      }
    }
    this.root.add(rails, marks, posts);
    // Short, alternating edge markers provide high-frequency optic flow close to the rider.
    // Static instancing keeps this detail to two draw calls for the whole route.
    const rumbleCount = Math.floor(road.length / C.rumbleSpacing);
    const rumble = new THREE.InstancedMesh(box, orange, rumbleCount * 2);
    const gravel = new THREE.InstancedMesh(resources.geometry(new THREE.IcosahedronGeometry(1, 0)), mat(0x8c765f), rumbleCount * 2);
    n = 0;
    for (let i = 0; i < rumbleCount; i++) {
      const p = i * C.rumbleSpacing + 1;
      const yaw = -Math.atan2(road.centerAt(p + 0.5) - road.centerAt(p - 0.5), 1);
      for (const side of [-1, 1]) {
        dummy.position.set(road.centerAt(p) + side * (road.halfWidth - 0.25), 0.025, -p);
        dummy.rotation.set(0, yaw, 0); dummy.scale.set(0.42, 0.025, 1.15);
        dummy.updateMatrix(); rumble.setMatrixAt(n, dummy.matrix);
        dummy.position.set(road.centerAt(p) + side * (road.halfWidth + 1.4 + i * 7 % 13 * 0.27), 0.18, -p);
        dummy.rotation.set(0, i * 1.7, 0); dummy.scale.set(0.25 + i % 3 * 0.12, 0.22, 0.4);
        dummy.updateMatrix(); gravel.setMatrixAt(n++, dummy.matrix);
      }
    }
    this.root.add(rumble, gravel);
    const mountainGeometry = resources.geometry(new THREE.ConeGeometry(1, 1, 5));
    const mountains = new THREE.InstancedMesh(mountainGeometry, mat(0x9c735a), Math.ceil(road.length / 27) * 2);
    for (let i = 0; i < mountains.count; i++) {
      const side = i % 2 === 0 ? -1 : 1; const p = Math.floor(i / 2) * 27;
      const height = 22 + (i * 17 % 51);
      dummy.position.set(road.centerAt(p) + side * (65 + (i * 23 % 125)), height / 2 - 2, -p);
      dummy.rotation.set(0, i * 1.7, 0); dummy.scale.set(27 + i * 13 % 36, height, 28 + i * 7 % 27);
      dummy.updateMatrix(); mountains.setMatrixAt(i, dummy.matrix);
    }
    this.root.add(mountains);
    const trunks = new THREE.InstancedMesh(box, mat(0x405a44), Math.ceil(road.length / 7.7));
    const arms = new THREE.InstancedMesh(box, mat(0x405a44), Math.ceil(road.length / 7.7));
    for (let i = 0; i < trunks.count; i++) {
      const p = i * 7.7; const side = i % 2 ? 1 : -1;
      const x = road.centerAt(p) + side * (road.halfWidth + 2.8 + (i * 11 % 18)); const height = 2 + i % 4;
      dummy.position.set(x, height / 2, -p); dummy.rotation.set(0, 0, 0); dummy.scale.set(0.6, height, 0.6);
      dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x + 0.6, height * 0.65, -p); dummy.scale.set(1.7, 0.4, 0.45);
      dummy.updateMatrix(); arms.setMatrixAt(i, dummy.matrix);
    }
    this.root.add(trunks, arms);
    const teal = mat(0x28c4bd);
    const sign = (text: string, p: number, height: number): void => {
      const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
      const context = canvas.getContext('2d'); if (!context) return;
      context.fillStyle = '#172429'; context.fillRect(0, 0, 1024, 128);
      context.fillStyle = '#f7dfb1'; context.font = 'bold 70px sans-serif'; context.textAlign = 'center'; context.fillText(text, 512, 91);
      const texture = resources.texture(new THREE.CanvasTexture(canvas)); texture.colorSpace = THREE.SRGBColorSpace;
      const material = resources.material(new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
      const mesh = new THREE.Mesh(resources.geometry(new THREE.PlaneGeometry(18, 2.25)), material);
      mesh.position.set(road.centerAt(p), height, -p); this.root.add(mesh);
    };
    for (let i = 0; i < RACE_RULES.checkpoints.length; i++) {
      const p = RACE_RULES.checkpoints[i]; const finish = i === RACE_RULES.checkpoints.length - 1;
      const beam = new THREE.Mesh(box, finish ? orange : teal);
      beam.position.set(road.centerAt(p), 7, -p); beam.scale.set(road.halfWidth * 2 + 2, 2.5, 0.5); this.root.add(beam);
      sign(finish ? 'FINISH' : 'CHECKPOINT ' + (i + 1), p - 0.3, 7);
      for (const side of [-1, 1]) {
        const pole = new THREE.Mesh(box, steel); pole.position.set(road.centerAt(p) + side * (road.halfWidth + 1), 3.5, -p);
        pole.scale.set(0.5, 7, 0.5); this.root.add(pole);
      }
      const stripe = new THREE.Mesh(box, finish ? white : teal); stripe.position.set(road.centerAt(p), 0.03, -p);
      stripe.scale.set(road.halfWidth * 2, 0.03, 0.6); this.root.add(stripe);
    }
    for (const obstacle of ROAD_OBSTACLES) {
      const p = obstacle.progress; const x = road.centerAt(p) + obstacle.lateral;
      const barrier = new THREE.Mesh(box, orange); barrier.position.set(x, 0.7, -p);
      barrier.scale.set(obstacle.halfWidth * 2, 1.4, obstacle.halfLength * 2); this.root.add(barrier);
      const band = new THREE.Mesh(box, white); band.position.set(x, 0.9, -p + obstacle.halfLength + 0.01);
      band.scale.set(obstacle.halfWidth * 2, 0.25, 0.02); this.root.add(band);
      for (let i = 1; i <= 3; i++) {
        const cone = new THREE.Mesh(resources.geometry(new THREE.ConeGeometry(0.35, 1, 6)), orange);
        cone.position.set(road.centerAt(p - i * 6) + obstacle.lateral, 0.5, -p + i * 6); this.root.add(cone);
      }
    }
    sign('ROADWORKS AHEAD', 1210, 5);
    // Physical end caps sit beyond the finish gate.
    for (const p of [0, road.length]) {
      const cap = new THREE.Mesh(box, orange); cap.position.set(road.centerAt(p), 0.7, -p); cap.scale.set(road.halfWidth * 2 + 0.4, 1.4, 0.4); this.root.add(cap);
    }
    const startLine = new THREE.Mesh(box, white); startLine.position.set(0, 0.024, -14); startLine.scale.set(road.halfWidth * 2 - 1, 0.025, 0.5); this.root.add(startLine);
    const beam = new THREE.Mesh(box, orange); beam.position.set(0, 6, -20); beam.scale.set(road.halfWidth * 2 + 2, 0.6, 0.6); this.root.add(beam);
    for (const side of [-1, 1]) {
      const pole = new THREE.Mesh(box, steel); pole.position.set(side * (road.halfWidth + 1), 3, -20); pole.scale.set(0.45, 6, 0.45); this.root.add(pole);
    }
  }
}


