import type { RoomPhase, ZoneId } from '@shared/types';
import { Backdrop } from '../artApi';

export interface BackdropLayerProps {
  zone: ZoneId;
  phase?: RoomPhase;
}

/**
 * Pins the zone artwork to the viewport, behind everything else, no matter
 * how the artwork positions itself. Screens render this as the first child
 * of their `<main>`; content scrolls over a steady scene.
 */
export function BackdropLayer({ zone, phase }: BackdropLayerProps) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-creek-950">
      <Backdrop zone={zone} phase={phase} />
    </div>
  );
}
