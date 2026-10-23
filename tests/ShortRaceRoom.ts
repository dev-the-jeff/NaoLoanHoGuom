import { RaceRoom } from '../server/src/rooms/RaceRoom';
import { RaceSimulation } from '../server/src/simulation/RaceSimulation';
import { RACE_RULES } from '../shared/src/course';
/** Test-only server dependency injection; never exposed through matchmaking or production options. */
export class ShortRaceRoom extends RaceRoom {
  /** Runs the exact production simulation against short, straight gates for bounded end-to-end tests. */
  protected override createSimulation(): RaceSimulation {
    return new RaceSimulation({ ...RACE_RULES, checkpoints: [60, 120, 180, 240, 300], finishWindowMs: 1000, maxRaceMs: 25000 });
  }
}
