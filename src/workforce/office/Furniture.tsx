import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { EmployeeState } from '../../shared/workforce';
import { STATE_META } from '../../shared/workforce';
import { FLOOR, MEETING_SEATS } from './layout';

// Office furniture and props. Monitors render the employee's live state.

const W = 0.62;
const H = 0.36;

function Lines({ count, color, speed, typed }: { count: number; color: string[]; speed: number; typed?: boolean }) {
  const group = useRef<THREE.Group>(null!);
  const widths = useRef(Array.from({ length: count }, () => 0.15 + Math.random() * 0.4));
  const indents = useRef(Array.from({ length: count }, () => (Math.random() < 0.4 ? 0.06 : 0)));
  useFrame(() => {
    const t = performance.now() / 1000;
    group.current.children.forEach((m, i) => {
      const mesh = m as THREE.Mesh;
      const y = (((i / count) + t * speed * 0.05) % 1);
      mesh.position.y = H / 2 - 0.04 - y * (H - 0.06);
      const grow = typed ? Math.min(1, ((t * speed * 0.2 + i * 0.37) % 1) * 1.6) : 1;
      mesh.scale.x = Math.max(0.01, grow);
    });
  });
  return (
    <group ref={group}>
      {widths.current.map((w, i) => (
        <mesh key={i} position={[-W / 2 + 0.05 + indents.current[i] + w / 2, 0, 0.001]}>
          <planeGeometry args={[w, 0.018]} />
          <meshBasicMaterial color={color[i % color.length]} />
        </mesh>
      ))}
    </group>
  );
}

function Bars() {
  const group = useRef<THREE.Group>(null!);
  useFrame(() => {
    const t = performance.now() / 1000;
    group.current.children.forEach((m, i) => {
      const h = 0.06 + (Math.sin(t * 1.7 + i * 1.3) * 0.5 + 0.5) * 0.2;
      m.scale.y = h / 0.2;
      m.position.y = -H / 2 + 0.04 + h / 2;
    });
  });
  const colors = ['#c084fc', '#818cf8', '#38bdf8', '#34d399', '#facc15'];
  return (
    <group ref={group}>
      {colors.map((c, i) => (
        <mesh key={i} position={[-0.2 + i * 0.1, 0, 0.001]}>
          <planeGeometry args={[0.06, 0.2]} />
          <meshBasicMaterial color={c} />
        </mesh>
      ))}
    </group>
  );
}

function Pulse({ color, speed = 3 }: { color: string; speed?: number }) {
  const mesh = useRef<THREE.Mesh>(null!);
  useFrame(() => {
    const t = performance.now() / 1000;
    (mesh.current.material as THREE.MeshBasicMaterial).opacity = 0.35 + (Math.sin(t * speed) * 0.5 + 0.5) * 0.5;
  });
  return (
    <mesh ref={mesh} position={[0, 0, 0.001]}>
      <planeGeometry args={[W - 0.04, H - 0.04]} />
      <meshBasicMaterial color={color} transparent />
    </mesh>
  );
}

function Dots() {
  const group = useRef<THREE.Group>(null!);
  useFrame(() => {
    const t = performance.now() / 1000;
    group.current.children.forEach((m, i) => m.scale.setScalar(0.6 + (Math.sin(t * 4 - i) * 0.5 + 0.5) * 0.8));
  });
  return (
    <group ref={group}>
      {[-0.08, 0, 0.08].map((x) => (
        <mesh key={x} position={[x, 0, 0.001]}>
          <circleGeometry args={[0.022, 12]} />
          <meshBasicMaterial color="#f9a8d4" />
        </mesh>
      ))}
    </group>
  );
}

function Search() {
  const ring = useRef<THREE.Group>(null!);
  useFrame(() => {
    const t = performance.now() / 1000;
    ring.current.position.x = Math.sin(t * 1.3) * 0.18;
    ring.current.position.y = Math.cos(t * 0.9) * 0.07;
  });
  return (
    <group>
      {Array.from({ length: 6 }).map((_, i) => (
        <mesh key={i} position={[-0.18 + (i % 3) * 0.18, i < 3 ? 0.07 : -0.07, 0.001]}>
          <planeGeometry args={[0.14, 0.1]} />
          <meshBasicMaterial color="#1e3a5f" />
        </mesh>
      ))}
      <group ref={ring} position={[0, 0, 0.002]}>
        <mesh><ringGeometry args={[0.04, 0.055, 20]} /><meshBasicMaterial color="#7dd3fc" /></mesh>
        <mesh position={[0.05, -0.05, 0]} rotation={[0, 0, Math.PI / 4]}><planeGeometry args={[0.05, 0.014]} /><meshBasicMaterial color="#7dd3fc" /></mesh>
      </group>
    </group>
  );
}

function Check() {
  return (
    <group position={[0, -0.01, 0.002]}>
      <mesh position={[-0.035, -0.01, 0]} rotation={[0, 0, -Math.PI / 4]}><planeGeometry args={[0.07, 0.025]} /><meshBasicMaterial color="#ffffff" /></mesh>
      <mesh position={[0.03, 0.02, 0]} rotation={[0, 0, Math.PI / 3.2]}><planeGeometry args={[0.13, 0.025]} /><meshBasicMaterial color="#ffffff" /></mesh>
    </group>
  );
}

function ScreenContent({ state }: { state: EmployeeState }) {
  switch (state) {
    case 'CODING': return <Lines count={9} color={['#4ade80', '#c084fc', '#60a5fa', '#fbbf24']} speed={3} />;
    case 'WRITING': return <Lines count={7} color={['#e2e8f0']} speed={1} typed />;
    case 'ANALYZING': return <Bars />;
    case 'RESEARCHING': return <Search />;
    case 'THINKING': return <Dots />;
    case 'COMMUNICATING': return <Lines count={4} color={['#5eead4', '#94a3b8']} speed={0.8} />;
    case 'AWAITING_APPROVAL': return <Pulse color="#fb923c" />;
    case 'ERROR': return <Pulse color="#ef4444" speed={7} />;
    case 'COMPLETED': return <group><Pulse color="#16a34a" speed={1} /><Check /></group>;
    case 'IN_MEETING': return <Pulse color="#4338ca" speed={0.6} />;
    case 'IDLE': return <Pulse color="#334155" speed={0.5} />;
    default: return null;
  }
}

export function Monitor({ state }: { state: EmployeeState }) {
  const off = state === 'OFFLINE';
  return (
    <group>
      <mesh position={[0, 0.05, 0]} castShadow><boxGeometry args={[0.2, 0.02, 0.14]} /><meshStandardMaterial color="#334155" /></mesh>
      <mesh position={[0, 0.2, -0.02]} castShadow><boxGeometry args={[0.04, 0.3, 0.03]} /><meshStandardMaterial color="#334155" /></mesh>
      <group position={[0, 0.42, 0]}>
        <mesh castShadow><boxGeometry args={[W + 0.05, H + 0.05, 0.035]} /><meshStandardMaterial color="#1e293b" /></mesh>
        <group position={[0, 0, 0.019]}>
          <mesh><planeGeometry args={[W, H]} /><meshBasicMaterial color={off ? '#020617' : '#0b1222'} /></mesh>
          {!off && <ScreenContent state={state} />}
        </group>
        {/* status LED */}
        <mesh position={[W / 2 - 0.02, -H / 2 - 0.012, 0.02]}>
          <circleGeometry args={[0.008, 8]} />
          <meshBasicMaterial color={off ? '#475569' : STATE_META[state].color} />
        </mesh>
      </group>
    </group>
  );
}

export function Desk({ accent }: { accent: string }) {
  return (
    <group>
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.8, 0.05, 0.85]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.5} />
      </mesh>
      {[[-0.85, -0.38], [0.85, -0.38], [-0.85, 0.38], [0.85, 0.38]].map(([x, z]) => (
        <mesh key={`${x}${z}`} position={[x, 0.36, z]} castShadow>
          <boxGeometry args={[0.05, 0.72, 0.05]} />
          <meshStandardMaterial color="#94a3b8" />
        </mesh>
      ))}
      <mesh position={[0, 0.5, -0.4]} castShadow><boxGeometry args={[1.7, 0.4, 0.02]} /><meshStandardMaterial color={accent} roughness={0.8} /></mesh>
      {/* keyboard + mouse */}
      <mesh position={[0, 0.775, 0.15]}><boxGeometry args={[0.5, 0.02, 0.15]} /><meshStandardMaterial color="#cbd5e1" /></mesh>
      <mesh position={[0.4, 0.775, 0.17]}><boxGeometry args={[0.07, 0.02, 0.1]} /><meshStandardMaterial color="#cbd5e1" /></mesh>
      {/* mug */}
      <mesh position={[-0.65, 0.81, 0.1]} castShadow><cylinderGeometry args={[0.045, 0.04, 0.1, 12]} /><meshStandardMaterial color={accent} /></mesh>
    </group>
  );
}

export function Chair({ color = '#334155' }: { color?: string }) {
  return (
    <group>
      <mesh position={[0, 0.47, 0]} castShadow><boxGeometry args={[0.5, 0.07, 0.5]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 0.8, 0.24]} castShadow><boxGeometry args={[0.48, 0.6, 0.06]} /><meshStandardMaterial color={color} /></mesh>
      <mesh position={[0, 0.23, 0]}><cylinderGeometry args={[0.03, 0.03, 0.4, 8]} /><meshStandardMaterial color="#64748b" /></mesh>
      <mesh position={[0, 0.04, 0]}><cylinderGeometry args={[0.25, 0.25, 0.04, 12]} /><meshStandardMaterial color="#64748b" /></mesh>
    </group>
  );
}

export function Plant({ scale = 1 }: { scale?: number }) {
  return (
    <group scale={scale}>
      <mesh position={[0, 0.22, 0]} castShadow><cylinderGeometry args={[0.2, 0.15, 0.44, 12]} /><meshStandardMaterial color="#e2e8f0" /></mesh>
      {[[0, 0.7, 0, 0.3], [0.12, 0.55, 0.08, 0.22], [-0.12, 0.6, -0.06, 0.24], [0.02, 0.9, -0.05, 0.2]].map(([x, y, z, r], i) => (
        <mesh key={i} position={[x, y, z]} castShadow><icosahedronGeometry args={[r, 0]} /><meshStandardMaterial color={i % 2 ? '#16a34a' : '#22c55e'} flatShading /></mesh>
      ))}
    </group>
  );
}

export function Whiteboard({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 1.2, 0]} castShadow><boxGeometry args={[2.2, 1.1, 0.05]} /><meshStandardMaterial color="#ffffff" /></mesh>
      <mesh position={[-0.5, 1.35, 0.03]}><planeGeometry args={[0.8, 0.04]} /><meshBasicMaterial color={color} /></mesh>
      <mesh position={[-0.35, 1.2, 0.03]}><planeGeometry args={[1.1, 0.04]} /><meshBasicMaterial color="#94a3b8" /></mesh>
      <mesh position={[0.45, 1.05, 0.03]}><planeGeometry args={[0.6, 0.3]} /><meshBasicMaterial color={color} transparent opacity={0.3} /></mesh>
      {[-0.95, 0.95].map((x) => (
        <mesh key={x} position={[x, 0.5, 0]}><boxGeometry args={[0.05, 1, 0.05]} /><meshStandardMaterial color="#94a3b8" /></mesh>
      ))}
    </group>
  );
}

export function ServerRack() {
  const leds = useRef<THREE.Group>(null!);
  useFrame(() => {
    const t = performance.now() / 1000;
    leds.current.children.forEach((m, i) => ((m as THREE.Mesh).visible = Math.sin(t * (3 + i)) > -0.3));
  });
  return (
    <group>
      <mesh position={[0, 0.9, 0]} castShadow><boxGeometry args={[0.7, 1.8, 0.7]} /><meshStandardMaterial color="#64748b" roughness={0.5} /></mesh>
      <mesh position={[0, 0.9, 0.352]}><planeGeometry args={[0.6, 1.7]} /><meshStandardMaterial color="#334155" /></mesh>
      <group ref={leds}>
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} position={[-0.2 + (i % 2) * 0.1, 0.35 + Math.floor(i / 2) * 0.35, 0.355]}>
            <planeGeometry args={[0.05, 0.03]} />
            <meshBasicMaterial color={i % 3 ? '#22c55e' : '#38bdf8'} />
          </mesh>
        ))}
      </group>
    </group>
  );
}

export function Shelf({ color }: { color: string }) {
  return (
    <group>
      <mesh position={[0, 0.8, 0]} castShadow><boxGeometry args={[1.6, 1.6, 0.4]} /><meshStandardMaterial color="#e2e8f0" /></mesh>
      {[0.35, 0.85, 1.3].map((y) =>
        [-0.5, -0.25, 0.05, 0.35].map((x, i) => (
          <mesh key={`${y}${x}`} position={[x, y, 0.1]} castShadow>
            <boxGeometry args={[0.15, 0.3, 0.25]} />
            <meshStandardMaterial color={i % 2 ? color : '#64748b'} />
          </mesh>
        )),
      )}
    </group>
  );
}

export function MeetingArea() {
  return (
    <group>
      <mesh position={[0, 0.01, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[9, 4.6]} />
        <meshStandardMaterial color="#e0e7ff" />
      </mesh>
      <mesh position={[0, 0.74, 0]} castShadow receiveShadow scale={[1, 1, 0.42]}>
        <cylinderGeometry args={[2.8, 2.8, 0.06, 40]} />
        <meshStandardMaterial color="#ffffff" roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.37, 0]} castShadow><cylinderGeometry args={[0.18, 0.3, 0.72, 12]} /><meshStandardMaterial color="#94a3b8" /></mesh>
      {/* laptop + screen on the table */}
      <mesh position={[0, 0.79, 0]}><boxGeometry args={[0.5, 0.02, 0.35]} /><meshStandardMaterial color="#cbd5e1" /></mesh>
      {MEETING_SEATS.map((s, i) => (
        <group key={i} position={s.position} rotation={[0, s.rotation + Math.PI, 0]}>
          <Chair color="#6366f1" />
        </group>
      ))}
    </group>
  );
}

export function Walls() {
  const glass = <meshStandardMaterial color="#bfdbfe" transparent opacity={0.35} />;
  const wall = <meshStandardMaterial color="#f1f5f9" />;
  const hw = FLOOR.width / 2;
  const hd = FLOOR.depth / 2;
  return (
    <group>
      <mesh position={[0, 1.4, -hd - 0.1]} receiveShadow><boxGeometry args={[FLOOR.width + 0.4, 2.8, 0.2]} />{wall}</mesh>
      <mesh position={[-hw - 0.1, 1.4, 0]} receiveShadow><boxGeometry args={[0.2, 2.8, FLOOR.depth]} />{wall}</mesh>
      {[-14, -5, 5, 14].map((x) => (
        <mesh key={x} position={[x, 1.6, -hd + 0.01]}><planeGeometry args={[5, 1.4]} />{glass}</mesh>
      ))}
      {[-8, 0, 8].map((z) => (
        <mesh key={z} position={[-hw + 0.01, 1.6, z]} rotation={[0, Math.PI / 2, 0]}><planeGeometry args={[5, 1.4]} />{glass}</mesh>
      ))}
    </group>
  );
}
