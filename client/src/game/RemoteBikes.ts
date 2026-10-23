import * as THREE from 'three';
import type { BikeState } from '../../../shared/src/contracts';
import type { RoomSnapshot } from '../../../shared/src/protocol';
import { BikeView } from './BikeView';
import { Resources } from './Resources';
import { SnapshotBuffer } from '../network/SnapshotBuffer';
interface RemoteSlot { id: string; view: BikeView; state: BikeState; steer: number }
/** Reuses remote bike slots across room membership changes instead of spawning during render. */
export class RemoteBikes {
  readonly root = new THREE.Group();
  private readonly slots: RemoteSlot[] = [];
  constructor(private readonly resources: Resources) {}
  /** Applies room membership at snapshot boundaries; hidden vehicles are pooled for reuse. */
  roster(frame: RoomSnapshot, localId: string): void {
    for (const slot of this.slots) if (!frame.players.some(player => player.id === slot.id)) { slot.id = ''; slot.view.root.visible = false; }
    for (const player of frame.players) {
      if (player.id === localId) continue;
      let slot = this.slots.find(item => item.id === player.id);
      if (!slot) {
        slot = this.slots.find(item => item.id === '');
        if (!slot) {
          const view = new BikeView(this.resources);
          slot = { id: '', view, state: { ...player }, steer: 0 }; this.slots.push(slot); this.root.add(view.root);
        }
        slot.id = player.id; Object.assign(slot.state, player); slot.view.root.visible = true; slot.view.tint(player.color);
      }
      slot.steer = player.steer;
    }
  }
  /** Samples all active remote views with no per-frame object construction. */
  update(buffer: SnapshotBuffer, time: number, dt: number): void {
    for (const slot of this.slots) if (slot.id && buffer.sample(slot.id, slot.state, time)) slot.view.update(slot.state, dt, slot.steer);
  }
  /** Returns visible membership count for lightweight debug telemetry. */
  count(): number { let count = 0; for (const slot of this.slots) if (slot.id) count++; return count; }
  /** Returns the first rendered remote position for verification/debugging. */
  firstProgress(): number { for (const slot of this.slots) if (slot.id) return -slot.view.root.position.z; return 0; }
  /** Hides and releases membership while preserving pooled GPU assets until Game disposal. */
  clear(): void { for (const slot of this.slots) { slot.id = ''; slot.view.root.visible = false; } }
}

