import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { AvatarConfig, EmployeeState } from '../../shared/workforce';

// Reusable low-poly character asset. Appearance comes entirely from an
// AvatarConfig, so every employee shares one consistent design and admins can
// customise looks later without new 3D assets. Pose and animation are driven
// by the employee's live execution state.

export interface AvatarPose {
  state: EmployeeState;
  seated: boolean;
  walking: boolean;
}

interface Props {
  config: AvatarConfig;
  poseRef: React.MutableRefObject<AvatarPose>;
}

const SEAT_DROP = 0.27;

function damp(current: number, target: number, dt: number, speed = 9) {
  return current + (target - current) * Math.min(1, dt * speed);
}

function Hair({ style, color }: { style: AvatarConfig['hairStyle']; color: string }) {
  const mat = <meshStandardMaterial color={color} roughness={0.9} />;
  switch (style) {
    case 'long':
      return (
        <group>
          <mesh position={[0, 0.06, -0.01]} castShadow scale={[1.08, 0.9, 1.08]}>
            <sphereGeometry args={[0.215, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.9]} />{mat}
          </mesh>
          <mesh position={[0, -0.12, -0.12]} castShadow>
            <boxGeometry args={[0.4, 0.36, 0.14]} />{mat}
          </mesh>
        </group>
      );
    case 'bun':
      return (
        <group>
          <mesh position={[0, 0.05, 0]} castShadow scale={[1.06, 0.85, 1.06]}>
            <sphereGeometry args={[0.215, 16, 12, 0, Math.PI * 2, 0, Math.PI / 1.9]} />{mat}
          </mesh>
          <mesh position={[0, 0.2, -0.14]} castShadow>
            <sphereGeometry args={[0.09, 12, 10]} />{mat}
          </mesh>
        </group>
      );
    case 'curly':
      return (
        <group>
          {[[-0.12, 0.13, 0.04], [0.12, 0.13, 0.04], [0, 0.19, 0], [-0.15, 0.06, -0.08], [0.15, 0.06, -0.08], [0, 0.12, -0.15], [-0.08, 0.17, -0.1], [0.08, 0.17, -0.1]].map((p, i) => (
            <mesh key={i} position={p as [number, number, number]} castShadow>
              <sphereGeometry args={[0.095, 10, 8]} />{mat}
            </mesh>
          ))}
        </group>
      );
    case 'buzz':
      return (
        <mesh position={[0, 0.03, 0]} scale={[1.02, 0.9, 1.02]}>
          <sphereGeometry args={[0.215, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2.2]} />{mat}
        </mesh>
      );
    case 'short':
    default:
      return (
        <mesh position={[0, 0.05, -0.01]} castShadow scale={[1.06, 0.9, 1.08]}>
          <sphereGeometry args={[0.215, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2]} />{mat}
        </mesh>
      );
  }
}

function Accessory({ kind }: { kind: AvatarConfig['accessory'] }) {
  if (kind === 'glasses') {
    return (
      <group position={[0, 0.02, 0.2]}>
        {[-0.075, 0.075].map((x) => (
          <mesh key={x} position={[x, 0, 0]}>
            <torusGeometry args={[0.05, 0.012, 6, 16]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
        ))}
        <mesh><boxGeometry args={[0.05, 0.012, 0.012]} /><meshStandardMaterial color="#111827" /></mesh>
      </group>
    );
  }
  if (kind === 'headset') {
    return (
      <group>
        <mesh rotation={[0, Math.PI / 2, 0]} position={[0, 0.04, 0]}>
          <torusGeometry args={[0.235, 0.018, 6, 20, Math.PI]} />
          <meshStandardMaterial color="#1f2937" />
        </mesh>
        {[-0.235, 0.235].map((x) => (
          <mesh key={x} position={[x, 0.0, 0]}>
            <cylinderGeometry args={[0.06, 0.06, 0.05, 12]} />
            <meshStandardMaterial color="#111827" />
          </mesh>
        ))}
        <mesh position={[0.16, -0.12, 0.13]} rotation={[0, -0.6, 0]}>
          <boxGeometry args={[0.02, 0.02, 0.16]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
      </group>
    );
  }
  return null;
}

export function Avatar({ config, poseRef }: Props) {
  const body = useRef<THREE.Group>(null!);
  const torso = useRef<THREE.Group>(null!);
  const head = useRef<THREE.Group>(null!);
  const armL = useRef<THREE.Group>(null!);
  const armR = useRef<THREE.Group>(null!);
  const legL = useRef<THREE.Group>(null!);
  const legR = useRef<THREE.Group>(null!);
  const kneeL = useRef<THREE.Group>(null!);
  const kneeR = useRef<THREE.Group>(null!);
  const seed = useMemo(() => Math.random() * 10, []);

  const skin = useMemo(() => new THREE.MeshStandardMaterial({ color: config.skin, roughness: 0.6 }), [config.skin]);
  const shirt = useMemo(() => new THREE.MeshStandardMaterial({ color: config.shirt, roughness: 0.75 }), [config.shirt]);
  const pants = useMemo(() => new THREE.MeshStandardMaterial({ color: config.pants, roughness: 0.85 }), [config.pants]);
  const shoe = useMemo(() => new THREE.MeshStandardMaterial({ color: '#1f2937', roughness: 0.6 }), []);
  const eye = useMemo(() => new THREE.MeshBasicMaterial({ color: '#111827' }), []);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const t = performance.now() / 1000 + seed;
    const { state, seated, walking } = poseRef.current;

    // Joint targets: [armL.x, armL.z, armR.x, armR.z, head.x, head.y, head.z, bodyBounce]
    let aLx = 0, aLz = 0.08, aRx = 0, aRz = -0.08, hx = 0, hy = 0, hz = 0, bounce = 0;
    let lean = 0;
    const typing = (speed: number, amp: number) => {
      aLx = -1.15 + Math.sin(t * speed) * amp;
      aRx = -1.15 + Math.sin(t * speed + Math.PI) * amp;
      aLz = 0.25; aRz = -0.25;
    };

    if (walking) {
      const s = Math.sin(t * 9);
      aLx = s * 0.6; aRx = -s * 0.6;
      bounce = Math.abs(Math.sin(t * 9)) * 0.04;
    } else {
      switch (state) {
        case 'IDLE':
          aLx = seated ? -0.55 : 0; aRx = seated ? -0.55 : 0;
          hy = Math.sin(t * 0.4) * 0.35; hx = Math.sin(t * 0.3) * 0.05;
          lean = -0.08;
          break;
        case 'THINKING':
          aLx = -0.6; aRx = -2.35; aRz = 0.35;
          hx = -0.15; hz = 0.15; hy = Math.sin(t * 0.8) * 0.12;
          break;
        case 'RESEARCHING':
          typing(7, 0.08);
          hy = Math.sin(t * 1.6) * 0.3; hx = 0.08;
          lean = 0.08;
          break;
        case 'WRITING':
          typing(11, 0.12);
          hx = 0.12 + Math.sin(t * 2) * 0.03;
          lean = 0.1;
          break;
        case 'CODING':
          typing(18, 0.16);
          hx = 0.1; hy = Math.sin(t * 0.7) * 0.08;
          lean = 0.15;
          break;
        case 'ANALYZING':
          aLx = -0.7; aRx = -1.2 + Math.sin(t * 3) * 0.05; aRz = -0.15;
          hx = 0.05 + Math.sin(t * 2.2) * 0.12;
          break;
        case 'COMMUNICATING':
          aLx = -0.6; aRx = -1.4 + Math.sin(t * 4) * 0.35; aRz = -0.5;
          hx = Math.sin(t * 5) * 0.08; hy = 0.25;
          break;
        case 'IN_MEETING':
          aLx = -1.0; aRx = -1.0 + Math.sin(t * 1.5) * 0.15;
          hy = Math.sin(t * 0.9) * 0.45; hx = Math.sin(t * 2.4) * 0.05;
          break;
        case 'AWAITING_APPROVAL':
          aLx = 0; aRx = -2.9; aRz = -0.15 + Math.sin(t * 5) * 0.25;
          hx = -0.12; hy = 0.35;
          break;
        case 'COMPLETED':
          aLx = -2.8; aRx = -2.8; aLz = 0.35; aRz = -0.35;
          bounce = Math.abs(Math.sin(t * 6)) * 0.12;
          hx = -0.15;
          break;
        case 'ERROR':
          aLx = -0.9; aRx = -0.9; aLz = 0.4; aRz = -0.4;
          hx = 0.55; hy = Math.sin(t * 1.2) * 0.1;
          lean = 0.25;
          break;
        default:
          break;
      }
    }

    // Breathing.
    torso.current.scale.y = 1 + Math.sin(t * 2) * 0.012;
    torso.current.rotation.x = damp(torso.current.rotation.x, lean, dt);

    armL.current.rotation.x = damp(armL.current.rotation.x, aLx, dt);
    armL.current.rotation.z = damp(armL.current.rotation.z, aLz, dt);
    armR.current.rotation.x = damp(armR.current.rotation.x, aRx, dt);
    armR.current.rotation.z = damp(armR.current.rotation.z, aRz, dt);
    head.current.rotation.x = damp(head.current.rotation.x, hx, dt);
    head.current.rotation.y = damp(head.current.rotation.y, hy, dt);
    head.current.rotation.z = damp(head.current.rotation.z, hz, dt);

    const sit = seated && !walking;
    const legSwing = walking ? Math.sin(t * 9) * 0.55 : 0;
    legL.current.rotation.x = damp(legL.current.rotation.x, sit ? -1.5 : legSwing, dt);
    legR.current.rotation.x = damp(legR.current.rotation.x, sit ? -1.5 : -legSwing, dt);
    kneeL.current.rotation.x = damp(kneeL.current.rotation.x, sit ? 1.5 : Math.max(0, -legSwing) * 0.6, dt);
    kneeR.current.rotation.x = damp(kneeR.current.rotation.x, sit ? 1.5 : Math.max(0, legSwing) * 0.6, dt);
    body.current.position.y = damp(body.current.position.y, (sit ? -SEAT_DROP : 0) + bounce, dt, 12);
  });

  return (
    <group ref={body}>
      {/* Legs: hip pivot → thigh → knee pivot → shin */}
      {[
        { ref: legL, knee: kneeL, x: -0.1 },
        { ref: legR, knee: kneeR, x: 0.1 },
      ].map(({ ref, knee, x }) => (
        <group key={x} ref={ref} position={[x, 0.78, 0]}>
          <mesh position={[0, -0.19, 0]} material={pants} castShadow>
            <capsuleGeometry args={[0.075, 0.26, 4, 8]} />
          </mesh>
          <group ref={knee} position={[0, -0.39, 0]}>
            <mesh position={[0, -0.18, 0]} material={pants} castShadow>
              <capsuleGeometry args={[0.068, 0.26, 4, 8]} />
            </mesh>
            <mesh position={[0, -0.37, 0.05]} material={shoe} castShadow>
              <boxGeometry args={[0.12, 0.07, 0.22]} />
            </mesh>
          </group>
        </group>
      ))}

      {/* Torso, arms and head */}
      <group ref={torso} position={[0, 0.78, 0]}>
        <mesh position={[0, 0.3, 0]} material={shirt} castShadow>
          <capsuleGeometry args={[0.2, 0.32, 4, 12]} />
        </mesh>
        {[
          { ref: armL, x: -0.27 },
          { ref: armR, x: 0.27 },
        ].map(({ ref, x }) => (
          <group key={x} ref={ref} position={[x, 0.5, 0]}>
            <mesh position={[0, -0.22, 0]} material={shirt} castShadow>
              <capsuleGeometry args={[0.06, 0.3, 4, 8]} />
            </mesh>
            <mesh position={[0, -0.44, 0]} material={skin} castShadow>
              <sphereGeometry args={[0.06, 10, 8]} />
            </mesh>
          </group>
        ))}
        <group ref={head} position={[0, 0.78, 0]}>
          <mesh position={[0, -0.14, 0]} material={skin}>
            <cylinderGeometry args={[0.07, 0.08, 0.1, 10]} />
          </mesh>
          <mesh material={skin} castShadow>
            <sphereGeometry args={[0.2, 20, 16]} />
          </mesh>
          <mesh position={[-0.07, 0.02, 0.185]} material={eye}><sphereGeometry args={[0.022, 8, 6]} /></mesh>
          <mesh position={[0.07, 0.02, 0.185]} material={eye}><sphereGeometry args={[0.022, 8, 6]} /></mesh>
          <Hair style={config.hairStyle} color={config.hair} />
          <Accessory kind={config.accessory} />
        </group>
      </group>
    </group>
  );
}
