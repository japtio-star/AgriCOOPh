import type { DepartmentId, Employee } from '../../shared/workforce';

// World layout of the office floor. Units are metres; +x right, +z toward the camera.

export const FLOOR = { width: 40, depth: 27 };
export const ZONE = { width: 10.5, depth: 8.5 };

export const ZONE_CENTERS: Record<DepartmentId, [number, number]> = {
  pmo: [-12.5, -7.6],
  inclusion: [0, -7.6],
  enterprise: [12.5, -7.6],
  mne: [-12.5, 7.6],
  data: [0, 7.6],
  extension: [12.5, 7.6],
};

export interface Seat {
  position: [number, number, number];
  rotation: number; // yaw the seated avatar faces
}

// Desk slots inside a zone (supports up to 4 employees per department).
const DESK_OFFSETS: [number, number][] = [
  [-2.3, 0.4],
  [2.3, 0.4],
  [-2.3, 3.0],
  [2.3, 3.0],
];

export function deskFor(dept: DepartmentId, index: number) {
  const [cx, cz] = ZONE_CENTERS[dept];
  const [ox, oz] = DESK_OFFSETS[index % DESK_OFFSETS.length];
  const desk: [number, number, number] = [cx + ox, 0, cz + oz];
  // Avatar sits on the +z side of the desk facing the monitor (-z).
  const seat: Seat = { position: [desk[0], 0, desk[2] + 0.85], rotation: Math.PI };
  return { desk, seat };
}

// Collaboration table in the central aisle.
export const MEETING_CENTER: [number, number] = [0, 0];

export const MEETING_SEATS: Seat[] = (() => {
  const seats: Seat[] = [{ position: [-3.25, 0, 0], rotation: Math.PI / 2 }]; // chair
  for (const x of [-1.8, -0.6, 0.6, 1.8]) {
    seats.push({ position: [x, 0, -1.35], rotation: 0 });
    seats.push({ position: [x, 0, 1.35], rotation: Math.PI });
  }
  seats.push({ position: [3.25, 0, 0], rotation: -Math.PI / 2 });
  return seats;
})();

export function deskIndexMap(employees: Employee[]) {
  const counters: Record<string, number> = {};
  const map = new Map<number, number>();
  for (const e of [...employees].sort((a, b) => a.id - b.id)) {
    counters[e.department] = counters[e.department] ?? 0;
    map.set(e.id, counters[e.department]++);
  }
  return map;
}

// Walk through the aisle and around the meeting table instead of through furniture.
export function walkPath(from: [number, number, number], to: [number, number, number]): [number, number, number][] {
  const aisle = (z: number) => (z < 0 ? -2.75 : 2.75);
  const inAisle = (p: [number, number, number]) => Math.abs(p[2]) < 3;
  // Desks in the front row sit between their chair and the aisle, so step beside the desk first.
  const sidestep = (p: [number, number, number]) => (p[2] > 3 ? p[0] + 1.2 : p[0]);
  const pts: [number, number, number][] = [];

  if (!inAisle(from) && from[2] > 3) pts.push([sidestep(from), 0, from[2]]);
  const startZ = aisle(from[2]);
  pts.push([inAisle(from) ? from[0] : sidestep(from), 0, startZ]);

  const endZ = aisle(to[2]);
  if (startZ !== endZ) {
    const ex = (from[0] + to[0]) / 2 >= 0 ? 4.6 : -4.6;
    pts.push([ex, 0, startZ], [ex, 0, endZ]);
  }
  pts.push([inAisle(to) ? to[0] : sidestep(to), 0, endZ]);
  if (!inAisle(to) && to[2] > 3) pts.push([sidestep(to), 0, to[2]]);
  pts.push(to);
  return pts;
}
