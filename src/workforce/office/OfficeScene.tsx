import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { CameraControls, CameraControlsImpl, Html, OrthographicCamera, QuadraticBezierLine } from '@react-three/drei';
import * as THREE from 'three';
import type { Department, DepartmentId, Employee } from '../../shared/workforce';
import { STATE_META } from '../../shared/workforce';
import { Avatar, type AvatarPose } from './Avatar';
import { Chair, Desk, MeetingArea, Monitor, Plant, ServerRack, Shelf, Walls, Whiteboard } from './Furniture';
import { FLOOR, MEETING_SEATS, ZONE, ZONE_CENTERS, deskFor, deskIndexMap, walkPath, type Seat } from './layout';

export interface FocusTarget {
  x: number;
  z: number;
  zoomFactor: number;
  nonce: number;
}

interface SceneProps {
  departments: Department[];
  employees: Employee[];
  selectedId: number | null;
  onSelect: (id: number | null) => void;
  focus: FocusTarget | null;
}

type Positions = Map<number, THREE.Vector3>;

const STANDING_STATES = new Set(['AWAITING_APPROVAL', 'COMPLETED']);
const WALK_SPEED = 3.4;

function yawDelta(a: number, b: number) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// ---- One AI employee in the office ---------------------------------------------

function EmployeeAgent({ employee, home, meetingSeat, selected, onSelect, positions, color, compact }: {
  employee: Employee; home: Seat; meetingSeat?: Seat; selected: boolean;
  onSelect: (id: number) => void; positions: Positions; color: string; compact: boolean;
}) {
  const root = useRef<THREE.Group>(null!);
  const ring = useRef<THREE.Mesh>(null!);
  const path = useRef<THREE.Vector3[]>([]);
  const pose = useRef<AvatarPose>({ state: employee.state, seated: true, walking: false });
  const seat = employee.state === 'IN_MEETING' && meetingSeat ? meetingSeat : home;
  const seatKey = seat.position.join(',');
  const meta = STATE_META[employee.state];

  // Start at the right seat on first render.
  useEffect(() => {
    root.current.position.set(...seat.position);
    root.current.rotation.y = seat.rotation;
    positions.set(employee.id, root.current.position);
    return () => void positions.delete(employee.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // New destination: plan a walk through the aisle.
  useEffect(() => {
    const p = root.current.position;
    if (p.distanceTo(new THREE.Vector3(...seat.position)) < 0.05) return;
    path.current = walkPath([p.x, 0, p.z], seat.position).map((v) => new THREE.Vector3(...v));
  }, [seatKey]); // eslint-disable-line react-hooks/exhaustive-deps

  pose.current.state = employee.state;

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const g = root.current;
    let walking = false;
    if (path.current.length) {
      const next = path.current[0];
      const dir = next.clone().sub(g.position);
      const dist = dir.length();
      const step = WALK_SPEED * dt;
      if (dist <= step) {
        g.position.copy(next);
        path.current.shift();
      } else {
        dir.normalize();
        g.position.addScaledVector(dir, step);
        const yaw = Math.atan2(dir.x, dir.z);
        g.rotation.y += yawDelta(g.rotation.y, yaw) * Math.min(1, dt * 12);
      }
      walking = path.current.length > 0;
    }
    if (!walking) {
      let yaw = seat.rotation;
      const target = employee.target_employee_id != null ? positions.get(employee.target_employee_id) : undefined;
      if (employee.state === 'COMMUNICATING' && target) {
        const want = Math.atan2(target.x - g.position.x, target.z - g.position.z);
        yaw = seat.rotation + THREE.MathUtils.clamp(yawDelta(seat.rotation, want), -1.1, 1.1);
      }
      g.rotation.y += yawDelta(g.rotation.y, yaw) * Math.min(1, dt * 6);
    }
    pose.current.walking = walking;
    pose.current.seated = !walking && !STANDING_STATES.has(employee.state);

    const t = performance.now() / 1000;
    const urgent = employee.state === 'AWAITING_APPROVAL' || employee.state === 'ERROR';
    ring.current.scale.setScalar(urgent ? 1 + (Math.sin(t * 5) * 0.5 + 0.5) * 0.35 : 1);
  });

  const showBubble = selected || (!compact && ['THINKING', 'COMMUNICATING', 'AWAITING_APPROVAL', 'ERROR'].includes(employee.state));

  return (
    <group
      ref={root}
      onClick={(e) => { e.stopPropagation(); onSelect(employee.id); }}
      onPointerOver={(e) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
      onPointerOut={() => { document.body.style.cursor = ''; }}
    >
      <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[0.42, selected ? 0.6 : 0.52, 32]} />
        <meshBasicMaterial color={selected ? '#0f172a' : meta.color} transparent opacity={0.85} />
      </mesh>
      <Avatar config={employee.avatar} poseRef={pose} />
      <Html position={[0, 2.15, 0]} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className="flex flex-col items-center gap-1 select-none" style={{ transform: 'translateY(-50%)' }}>
          {showBubble && employee.state_detail && (
            <div
              className="max-w-[180px] rounded-lg bg-white/95 px-2 py-1 text-[10px] leading-snug text-slate-700 shadow-md ring-1"
              style={{ ['--tw-ring-color' as any]: meta.color }}
            >
              {employee.state_detail.length > 90 ? employee.state_detail.slice(0, 88) + '…' : employee.state_detail}
            </div>
          )}
          <div
            className="flex items-center gap-1 whitespace-nowrap rounded-full bg-slate-900/85 px-2 py-0.5 text-[10px] font-semibold text-white shadow"
            style={{ boxShadow: `0 0 0 2px ${meta.color}` }}
          >
            <span>{meta.icon}</span>
            {(!compact || selected) && <span>{employee.name.split(' ')[0]}</span>}
            {(!compact || selected) && <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />}
          </div>
        </div>
      </Html>
    </group>
  );
}

// ---- Department zone with its workstations -----------------------------------

function DepartmentZone({ dept, employees, deskIndex, onSelect, compact }: {
  dept: Department; employees: Employee[]; deskIndex: Map<number, number>; onSelect: (id: number) => void; compact: boolean;
}) {
  const [cx, cz] = ZONE_CENTERS[dept.id];
  const working = employees.filter((e) => !['IDLE', 'OFFLINE', 'COMPLETED'].includes(e.state)).length;
  const waiting = employees.filter((e) => e.state === 'AWAITING_APPROVAL').length;
  const backZ = cz - ZONE.depth / 2 + 0.9;

  return (
    <group>
      <mesh position={[cx, 0.012, cz]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ZONE.width, ZONE.depth]} />
        <meshStandardMaterial color={dept.color} transparent opacity={0.13} />
      </mesh>
      <mesh position={[cx, 0.014, cz - ZONE.depth / 2 + 0.06]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[ZONE.width, 0.12]} />
        <meshBasicMaterial color={dept.color} />
      </mesh>

      <DepartmentProps id={dept.id} color={dept.color} x={cx} z={backZ} />

      {employees.map((e) => {
        const { desk } = deskFor(dept.id, deskIndex.get(e.id) ?? 0);
        const away = e.state === 'IN_MEETING' || e.state === 'OFFLINE';
        return (
          <group key={e.id} position={desk} onClick={(ev) => { ev.stopPropagation(); onSelect(e.id); }}>
            <Desk accent={dept.color} />
            <group position={[0, 0.76, -0.2]}><Monitor state={e.state} /></group>
            <group position={[0, 0, away ? 0.6 : 0.85]}><Chair /></group>
            {e.state === 'OFFLINE' && !compact && (
              <Html position={[0, 1.6, 0.3]} center zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
                <div className="whitespace-nowrap rounded-full bg-slate-500/90 px-2 py-0.5 text-[10px] font-semibold text-white">
                  ⏻ {e.name.split(' ')[0]} · offline
                </div>
              </Html>
            )}
          </group>
        );
      })}

      <Html position={[cx, 2.9, cz < 0 ? cz - ZONE.depth / 2 + 0.2 : cz + ZONE.depth / 2 - 0.3]} center zIndexRange={[5, 0]} style={{ pointerEvents: 'none' }}>
        <div className="flex items-center gap-2 whitespace-nowrap rounded-md bg-white/90 px-2.5 py-1 text-[11px] font-bold text-slate-800 shadow-sm" style={{ borderLeft: `4px solid ${dept.color}` }}>
          {compact ? dept.short : dept.name}
          {!compact && <span className="font-medium text-slate-500">{working ? `${working} working` : 'quiet'}</span>}
          {waiting > 0 && <span className="rounded bg-orange-100 px-1 text-orange-700">{waiting} ✋</span>}
        </div>
      </Html>
    </group>
  );
}

function DepartmentProps({ id, color, x, z }: { id: DepartmentId; color: string; x: number; z: number }) {
  switch (id) {
    case 'executive':
      return (<group><group position={[x - 2.5, 0, z]}><Shelf color={color} /></group><group position={[x + 2.2, 0, z]}><Whiteboard color={color} /></group><group position={[x + 4.6, 0, z]}><Plant /></group></group>);
    case 'membership':
      return (<group><group position={[x - 2.6, 0, z]}><Shelf color={color} /></group><group position={[x - 0.6, 0, z]}><Shelf color={color} /></group><group position={[x + 3.6, 0, z]}><Plant scale={1.2} /></group></group>);
    case 'coop_dev':
      return (<group><group position={[x - 1.8, 0, z]}><Whiteboard color={color} /></group><group position={[x + 2.6, 0, z]}><Plant scale={1.3} /></group><group position={[x + 4.4, 0, z]}><Plant /></group></group>);
    case 'mne':
      return (<group><group position={[x - 1.5, 0, z]}><Whiteboard color={color} /></group><group position={[x + 2.5, 0, z]}><Shelf color={color} /></group></group>);
    case 'data':
      return (<group><group position={[x - 2, 0, z]}><Whiteboard color={color} /></group><group position={[x + 2.2, 0, z]}><Whiteboard color="#38bdf8" /></group></group>);
    case 'tech':
      return (<group>{[-3, -2.2, -1.4].map((dx) => <group key={dx} position={[x + dx, 0, z]}><ServerRack /></group>)}<group position={[x + 3.6, 0, z]}><Plant /></group></group>);
  }
}

// ---- Hand-off lines between communicating employees ------------------------------

function HandoffLine({ from, to, positions, color }: { from: number; to: number; positions: Positions; color: string }) {
  const ref = useRef<any>(null);
  const mid = useMemo(() => new THREE.Vector3(), []);
  const a = useMemo(() => new THREE.Vector3(), []);
  const b = useMemo(() => new THREE.Vector3(), []);
  useFrame((_, dt) => {
    const pa = positions.get(from);
    const pb = positions.get(to);
    if (!ref.current || !pa || !pb) return;
    a.set(pa.x, 1.9, pa.z);
    b.set(pb.x, 1.9, pb.z);
    mid.copy(a).add(b).multiplyScalar(0.5);
    mid.y += 1.5 + a.distanceTo(b) * 0.15;
    ref.current.setPoints(a, b, mid);
    ref.current.material.dashOffset -= dt * 2;
  });
  return <QuadraticBezierLine ref={ref} start={[0, 0, 0]} end={[0, 0, 0]} color={color} lineWidth={2.5} dashed dashSize={0.35} gapSize={0.2} />;
}

// Switches labels to a compact form when the camera is zoomed far out (e.g. phones).
function ZoomWatcher({ onCompact }: { onCompact: (compact: boolean) => void }) {
  const last = useRef<boolean | null>(null);
  useFrame(({ camera }) => {
    const compact = camera.zoom < 13;
    if (compact !== last.current) {
      last.current = compact;
      onCompact(compact);
    }
  });
  return null;
}

// ---- Camera ---------------------------------------------------------------------

function CameraRig({ focus }: { focus: FocusTarget | null }) {
  const controls = useRef<CameraControlsImpl>(null);
  const { size, camera } = useThree();
  const baseZoom = Math.max(6, Math.min(size.width / 46, size.height / 30));
  const baseRef = useRef(baseZoom);
  baseRef.current = baseZoom;
  const [initialZoom] = useState(baseZoom);

  // Re-run once the orthographic camera has become the default camera.
  useEffect(() => {
    const c = controls.current;
    if (!c || !(camera as THREE.OrthographicCamera).isOrthographicCamera) return;
    const A = CameraControlsImpl.ACTION;
    c.mouseButtons.left = A.TRUCK;
    c.mouseButtons.right = A.ROTATE;
    c.mouseButtons.wheel = A.ZOOM;
    c.touches.one = A.TOUCH_TRUCK;
    c.touches.two = A.TOUCH_ZOOM_TRUCK;
    c.touches.three = A.TOUCH_ROTATE;
    void c.setLookAt(30, 26, 30, 0, 0, 0, false);
    void c.zoomTo(baseRef.current, false);
  }, [camera]);

  useEffect(() => {
    const c = controls.current;
    if (!c || !focus) return;
    void c.moveTo(focus.x, 0, focus.z, true);
    void c.zoomTo(baseRef.current * focus.zoomFactor, true);
  }, [focus?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <OrthographicCamera makeDefault position={[30, 26, 30]} zoom={initialZoom} near={-100} far={300} />
      <CameraControls
        ref={controls}
        makeDefault
        minZoom={5}
        maxZoom={120}
        minPolarAngle={0.45}
        maxPolarAngle={1.2}
        minAzimuthAngle={0.05}
        maxAzimuthAngle={Math.PI / 2 - 0.05}
        smoothTime={0.35}
      />
    </>
  );
}

// ---- Scene root -------------------------------------------------------------------

export default function OfficeScene({ departments, employees, selectedId, onSelect, focus }: SceneProps) {
  const positions = useMemo<Positions>(() => new Map(), []);
  const [compact, setCompact] = useState(false);
  const deskIndex = useMemo(() => deskIndexMap(employees), [employees.map((e) => e.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps
  const deptColor = (id: string) => departments.find((d) => d.id === id)?.color ?? '#64748b';

  // Seat everyone who is in a meeting: the host at the head of the table.
  const meetingSeats = useMemo(() => {
    const seats = new Map<number, Seat>();
    const inMeeting = employees.filter((e) => e.state === 'IN_MEETING');
    const hosts = inMeeting.filter((e) => e.target_employee_id == null || !inMeeting.some((x) => x.id === e.target_employee_id));
    let slot = 0;
    for (const host of hosts) {
      seats.set(host.id, MEETING_SEATS[slot++ % MEETING_SEATS.length]);
      for (const p of inMeeting.filter((e) => e.target_employee_id === host.id).sort((a, b) => a.id - b.id)) {
        seats.set(p.id, MEETING_SEATS[slot++ % MEETING_SEATS.length]);
      }
    }
    return seats;
  }, [employees]);

  return (
    <Canvas shadows dpr={[1, 1.75]} onPointerMissed={() => onSelect(null)} gl={{ antialias: true }}>
      <color attach="background" args={['#e9eef6']} />
      <CameraRig focus={focus} />
      <ZoomWatcher onCompact={setCompact} />

      <hemisphereLight args={['#ffffff', '#cbd5e1', 0.7]} />
      <ambientLight intensity={0.35} />
      <directionalLight
        position={[14, 26, 12]}
        intensity={1.5}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={20}
        shadow-camera-bottom={-20}
        shadow-camera-near={1}
        shadow-camera-far={80}
        shadow-bias={-0.0005}
        shadow-radius={4}
      />

      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[FLOOR.width, FLOOR.depth]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.9} />
      </mesh>
      <Walls />
      <MeetingArea />
      {[[-6, 0], [6, 0], [-18.5, -12.5], [18.5, -12.5], [-18.5, 12.5], [18.5, 12.5]].map(([x, z]) => (
        <group key={`${x},${z}`} position={[x, 0, z]}><Plant scale={1.3} /></group>
      ))}

      {departments.map((d) => (
        <DepartmentZone
          key={d.id}
          dept={d}
          employees={employees.filter((e) => e.department === d.id)}
          deskIndex={deskIndex}
          onSelect={onSelect}
          compact={compact}
        />
      ))}

      {employees.filter((e) => e.state !== 'OFFLINE').map((e) => (
        <EmployeeAgent
          key={e.id}
          employee={e}
          home={deskFor(e.department, deskIndex.get(e.id) ?? 0).seat}
          meetingSeat={meetingSeats.get(e.id)}
          selected={selectedId === e.id}
          onSelect={onSelect}
          positions={positions}
          color={deptColor(e.department)}
          compact={compact}
        />
      ))}

      {employees
        .filter((e) => e.state === 'COMMUNICATING' && e.target_employee_id != null)
        .map((e) => (
          <HandoffLine key={`${e.id}-${e.target_employee_id}`} from={e.id} to={e.target_employee_id!} positions={positions} color={STATE_META.COMMUNICATING.color} />
        ))}
    </Canvas>
  );
}
