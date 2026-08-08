import { Suspense, useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float } from '@react-three/drei'
import * as THREE from 'three'

const BRAND_PURPLE = '#7C3AED'
const BRAND_BLUE = '#3B82F6'

interface ShapeProps {
  position: [number, number, number]
  color: string
  kind: 'icosahedron' | 'torus' | 'octahedron' | 'dodecahedron'
  size: number
  speed: number
  wireframe?: boolean
}

function FloatingShape({ position, color, kind, size, speed, wireframe = true }: ShapeProps) {
  const ref = useRef<THREE.Mesh>(null)

  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.rotation.x += delta * speed
    ref.current.rotation.y += delta * speed * 1.25
  })

  const geometry = useMemo(() => {
    switch (kind) {
      case 'torus':
        return <torusGeometry args={[size, size * 0.34, 20, 40]} />
      case 'octahedron':
        return <octahedronGeometry args={[size, 0]} />
      case 'dodecahedron':
        return <dodecahedronGeometry args={[size, 0]} />
      default:
        return <icosahedronGeometry args={[size, 0]} />
    }
  }, [kind, size])

  return (
    <Float speed={2} rotationIntensity={0.6} floatIntensity={1.6}>
      <mesh ref={ref} position={position}>
        {geometry}
        <meshStandardMaterial
          color={color}
          wireframe={wireframe}
          transparent
          opacity={wireframe ? 0.55 : 0.28}
          roughness={0.4}
          metalness={0.6}
          emissive={color}
          emissiveIntensity={0.25}
        />
      </mesh>
    </Float>
  )
}

function CoreGlow() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ref.current) return
    const t = clock.elapsedTime
    ref.current.scale.setScalar(1 + Math.sin(t * 0.8) * 0.08)
  })
  return (
    <mesh ref={ref}>
      <sphereGeometry args={[1.15, 48, 48]} />
      <meshBasicMaterial color="#1E1E2E" transparent opacity={0.92} />
    </mesh>
  )
}

function ParticleField({ count = 700 }: { count?: number }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 22
      arr[i * 3 + 1] = (Math.random() - 0.5) * 14
      arr[i * 3 + 2] = (Math.random() - 0.5) * 12 - 2
    }
    return arr
  }, [count])

  const ref = useRef<THREE.Points>(null)
  useFrame((_, delta) => {
    if (!ref.current) return
    ref.current.rotation.y += delta * 0.02
  })

  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.025}
        color={BRAND_BLUE}
        transparent
        opacity={0.7}
        sizeAttenuation
      />
    </points>
  )
}

function Rig({ children }: { children: React.ReactNode }) {
  const group = useRef<THREE.Group>(null)

  useFrame(({ pointer }) => {
    if (!group.current) return
    group.current.rotation.y = THREE.MathUtils.lerp(group.current.rotation.y, pointer.x * 0.35, 0.03)
    group.current.rotation.x = THREE.MathUtils.lerp(group.current.rotation.x, -pointer.y * 0.2, 0.03)
  })

  return <group ref={group}>{children}</group>
}

export default function HeroScene() {
  return (
    <Canvas
      dpr={[1, 1.8]}
      camera={{ position: [0, 0, 7], fov: 45 }}
      gl={{ alpha: true, antialias: true }}
      style={{ background: 'transparent' }}
    >
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 5, 5]} intensity={1.1} color="#fff" />
      <directionalLight position={[-5, -3, 2]} intensity={0.6} color={BRAND_PURPLE} />
      <pointLight position={[0, 0, 4]} intensity={0.5} color={BRAND_BLUE} />

      <Rig>
        <CoreGlow />
        <Suspense fallback={null}>
          <FloatingShape position={[-3.6, 1.6, -1]} color={BRAND_PURPLE} kind="icosahedron" size={0.7} speed={0.3} />
          <FloatingShape position={[3.4, 1.9, -1.5]} color={BRAND_BLUE} kind="torus" size={0.55} speed={0.4} />
          <FloatingShape position={[2.9, -1.8, -1]} color={BRAND_PURPLE} kind="octahedron" size={0.5} speed={0.5} />
          <FloatingShape position={[-3.2, -1.7, -1.2]} color={BRAND_BLUE} kind="dodecahedron" size={0.6} speed={0.35} />
          <FloatingShape position={[-1.2, 2.6, -2.2]} color={BRAND_BLUE} kind="octahedron" size={0.28} speed={0.6} wireframe />
          <FloatingShape position={[1.5, -2.6, -2]} color={BRAND_PURPLE} kind="icosahedron" size={0.3} speed={0.7} wireframe />
          <FloatingShape position={[0, 2.9, -3]} color={BRAND_PURPLE} kind="torus" size={0.35} speed={0.5} />
          <FloatingShape position={[0, -2.9, -2.6]} color={BRAND_BLUE} kind="dodecahedron" size={0.4} speed={0.45} />
        </Suspense>
        <ParticleField count={700} />
      </Rig>
    </Canvas>
  )
}
