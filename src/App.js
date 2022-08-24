import * as THREE from "three"
import { useState, useMemo, useRef } from "react"
import { Canvas, useThree, useFrame } from "@react-three/fiber"
import { useAspect, useFBO, useGLTF, useTexture } from "@react-three/drei"
import BackfaceMaterial from "./backface-material"
import RefractionMaterial from "./refraction-material"
import diamondUrl from "./assets/diamond.glb"
import textureUrl from "./assets/233.jpg"
import "./styles.css"

function Background() {
  const texture = useTexture(textureUrl)
  const size = useAspect(5000, 3800)
  return (
    <mesh /*layers={1}*/ scale={size}>
      <planeGeometry />
      <meshBasicMaterial map={texture} map-minFilter={THREE.LinearFilter} depthTest={false} />
    </mesh>
  )
}

function Diamonds() {
  const { size, viewport, gl, scene, camera, clock } = useThree()
  const model = useRef()
  const gltf = useGLTF(diamondUrl)
  const envFbo = useFBO({ encoding: THREE.LinearEncoding })
  const backfaceFbo = useFBO()
  const [backfaceMaterial] = useState(() => new BackfaceMaterial())
  const [refractionMaterial] = useState(
    () => new RefractionMaterial({ envMap: envFbo.texture, backfaceMap: backfaceFbo.texture, resolution: [size.width, size.height] })
  )

  // Create random position data
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const diamonds = useMemo(
    () =>
      new Array(20).fill().map((_, i) => ({
        position: [i < 5 ? 0 : viewport.width / 2 - Math.random() * viewport.width, 40 - Math.random() * 40, i < 5 ? 26 : 10 - Math.random() * 20],
        factor: 0.1 + Math.random(),
        direction: Math.random() < 0.5 ? -1 : 1,
        rotation: [Math.sin(Math.random()) * Math.PI, Math.sin(Math.random()) * Math.PI, Math.cos(Math.random()) * Math.PI]
      })),
    []
  )

  // Render-loop
  useFrame(() => {
    // Update instanced diamonds
    diamonds.forEach((data, i) => {
      const t = clock.getElapsedTime()
      data.position[1] -= (data.factor / 5) * data.direction
      if (data.direction === 1 ? data.position[1] < -50 : data.position[1] > 50)
        data.position = [i < 5 ? 0 : viewport.width / 2 - Math.random() * viewport.width, 50 * data.direction, data.position[2]]
      const { position, rotation, factor } = data
      dummy.position.set(position[0], position[1], position[2])
      dummy.rotation.set(rotation[0] + t * factor, rotation[1] + t * factor, rotation[2] + t * factor)
      dummy.scale.set(1 + factor, 1 + factor, 1 + factor)
      dummy.updateMatrix()
      model.current.setMatrixAt(i, dummy.matrix)
    })
    model.current.instanceMatrix.needsUpdate = true

    // Render env to fbo
    //gl.autoClear = false
    model.current.visible = false
    gl.setRenderTarget(envFbo)
    gl.render(scene, camera)

    // Render cube backfaces to fbo
    model.current.visible = true
    model.current.material = backfaceMaterial
    gl.setRenderTarget(backfaceFbo)
    gl.render(scene, camera)
    gl.setRenderTarget(null)

    // Render cube with refraction material to screen
    model.current.visible = true
    model.current.material = refractionMaterial
  })

  return <instancedMesh ref={model} args={[gltf.nodes.Cylinder.geometry, null, diamonds.length]} />
}

export default function App() {
  return (
    <Canvas camera={{ fov: 50, position: [0, 0, 30] }}>
      <Background />
      <Diamonds />
    </Canvas>
  )
}
