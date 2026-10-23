import * as THREE from 'three';
/** Tracks unique GPU resources once at creation time; never collects resources during frames. */
export class Resources {
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly textures = new Set<THREE.Texture>(); private readonly materials = new Set<THREE.Material>();
  /** Registers and returns reusable geometry. */
  geometry<T extends THREE.BufferGeometry>(value: T): T { this.geometries.add(value); return value; }
  /** Registers and returns reusable material. */
  material<T extends THREE.Material>(value: T): T { this.materials.add(value); return value; }
  /** Registers a shared texture for deterministic teardown. */
  texture<T extends THREE.Texture>(value: T): T { this.textures.add(value); return value; }
  /** Releases every unique resource exactly once. */
  dispose(): void {
    this.geometries.forEach(g => g.dispose()); this.materials.forEach(m => m.dispose());
    this.textures.forEach(texture => texture.dispose()); this.textures.clear(); this.geometries.clear(); this.materials.clear();
  }
}
