// BOM-STRICT
import { useRef, useEffect, useMemo, useCallback } from 'react'
import ForceGraph3D, { ForceGraph3DInstance } from 'react-force-graph-3d'
import * as THREE from 'three'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import './LoomGraph.css'

interface LoomGraphProps {
  dependencyGraph: Record<string, string[]>
  fileTypes: Record<string, string>
  allFiles: Record<string, any>
  onNodeClick?: (file: string) => void
}

interface GraphNode {
  id: string
  category: string
  group: number
  size: number
}

interface GraphLink {
  source: string
  target: string
}

// Color mapping for node categories - brightness equalized
const CATEGORY_COLORS: Record<string, string> = {
  'TypeScript': '#3178c6',
  'JavaScript': '#f7df1e',
  'React': '#61dafb',
  'CSS': '#264de4',
  'HTML': '#e34c26',
  'Rust': '#dea584',
  'Python': '#3776ab',
  'JSON': '#292929',
  'Config': '#6b7280',
  'UI-Root': '#fbbf24',    // Gold - The Interface (unchanged)
  'Logic': '#60a5fa',       // Blue - The Mind (brighter)
  'Data': '#f87171',        // Red - The Memory (brighter)
  'Unknown': '#a1a1aa',     // Grey - The Dust (brighter)
}

// Generate glow texture programmatically
function createGlowTexture(): THREE.Texture {
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  // Radial gradient: white center fading to transparent
  const gradient = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2
  )
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)')
  gradient.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)')
  gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)')
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)')

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, size, size)

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

// Map file category to semantic group
function getSemanticGroup(category: string, filePath: string): string {
  // UI-Root detection
  if (filePath.includes('App.tsx') || filePath.includes('index.tsx') || filePath.includes('main.tsx')) {
    return 'UI-Root'
  }
  // Logic detection
  if (category === 'TypeScript' || category === 'JavaScript' || category === 'Rust' || category === 'Python') {
    if (filePath.includes('util') || filePath.includes('lib') || filePath.includes('core') || filePath.includes('engine')) {
      return 'Logic'
    }
  }
  // Data detection
  if (category === 'JSON' || filePath.includes('data') || filePath.includes('config') || filePath.includes('schema')) {
    return 'Data'
  }
  // Default based on category
  if (['TypeScript', 'JavaScript', 'React', 'Rust', 'Python'].includes(category)) {
    return 'Logic'
  }
  if (['CSS', 'HTML'].includes(category)) {
    return 'UI-Root'
  }
  return 'Unknown'
}

export function LoomGraph({ dependencyGraph, fileTypes, allFiles, onNodeClick }: LoomGraphProps) {
  const fgRef = useRef<ForceGraph3DInstance>()
  const glowTexture = useMemo(() => createGlowTexture(), [])

  // Transform data into graph format
  const graphData = useMemo(() => {
    const nodes: GraphNode[] = []
    const links: GraphLink[] = []
    const nodeSet = new Set<string>()

    // Collect all files
    Object.keys(dependencyGraph).forEach(file => {
      nodeSet.add(file)
      dependencyGraph[file].forEach(dep => nodeSet.add(dep))
    })

    // Create nodes
    nodeSet.forEach(file => {
      const category = fileTypes[file] || 'Unknown'
      const semanticGroup = getSemanticGroup(category, file)
      const importCount = Object.values(dependencyGraph).filter(deps => deps.includes(file)).length

      nodes.push({
        id: file,
        category: semanticGroup,
        group: ['UI-Root', 'Logic', 'Data', 'Unknown'].indexOf(semanticGroup),
        size: Math.max(8, Math.min(24, 8 + importCount * 1.5))
      })
    })

    // Create links
    Object.entries(dependencyGraph).forEach(([source, targets]) => {
      targets.forEach(target => {
        if (nodeSet.has(target)) {
          links.push({ source, target })
        }
      })
    })

    return { nodes, links }
  }, [dependencyGraph, fileTypes])

  // Setup bloom effect - delayed to ensure graph is mounted
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!fgRef.current) return

      const fg = fgRef.current

      // Add bloom pass - gentle glow
      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.9,   // Intensity
        0.35,  // Radius
        0.3    // Threshold
      )

      // Access the postprocessing composer
      const composer = fg.postProcessingComposer()
      if (composer) {
        composer.addPass(bloomPass)
        console.log('Bloom pass added successfully')
      } else {
        console.warn('postProcessingComposer not available')
      }

      // Set background to void black
      const scene = fg.scene()
      if (scene) {
        scene.background = new THREE.Color(0x000000)

        // Add galactic ring for orientation
        const ringGeometry = new THREE.RingGeometry(960, 1000, 64)
        const ringMaterial = new THREE.MeshBasicMaterial({
          color: 0x4488ff,
          side: THREE.DoubleSide,
          transparent: true,
          opacity: 0.15
        })
        const ring = new THREE.Mesh(ringGeometry, ringMaterial)
        ring.rotation.x = Math.PI / 2  // Lay flat on XZ plane
        scene.add(ring)
      }

      // Configure physics - balanced
      fg.d3Force('charge')?.strength(-80)
      fg.d3Force('link')?.distance(35)

      // Auto-rotate when idle
      fg.controls().autoRotate = true
      fg.controls().autoRotateSpeed = 0.5
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  // Create sprite material for each node
  const nodeThreeObject = useCallback((node: GraphNode) => {
    const color = CATEGORY_COLORS[node.category] || CATEGORY_COLORS['Unknown']

    const spriteMaterial = new THREE.SpriteMaterial({
      map: glowTexture,
      color: new THREE.Color(color),
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending
    })

    const sprite = new THREE.Sprite(spriteMaterial)
    sprite.scale.set(node.size * 2, node.size * 2, 1)

    return sprite
  }, [glowTexture])

  // Handle node click
  const handleNodeClick = useCallback((node: GraphNode) => {
    if (!fgRef.current) return

    // Fly to node
    const distance = 40
    const distRatio = 1 + distance / Math.hypot(node.x || 0, node.y || 0, node.z || 0)

    fgRef.current.cameraPosition(
      {
        x: (node.x || 0) * distRatio,
        y: (node.y || 0) * distRatio,
        z: (node.z || 0) * distRatio
      },
      { x: node.x || 0, y: node.y || 0, z: node.z || 0 },
      1500 // ms flight duration
    )

    onNodeClick?.(node.id)
  }, [onNodeClick])

  // Handle node hover
  const handleNodeHover = useCallback((node: GraphNode | null) => {
    document.body.style.cursor = node ? 'pointer' : 'default'
  }, [])

  return (
    <div className="loom-container">
      <ForceGraph3D
        ref={fgRef}
        graphData={graphData}
        nodeThreeObject={nodeThreeObject}
        nodeLabel={(node: GraphNode) => node.id}
        linkColor={() => 'rgba(255, 255, 255, 0.8)'}
        linkWidth={2}
        linkOpacity={0.6}
        backgroundColor="#000000"
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        enableNodeDrag={true}
        enableNavigationControls={true}
        showNavInfo={false}
        cameraPosition={{ x: 0, y: -70, z: 200 }}
      />
      <div className="loom-legend">
        <div className="legend-item">
          <span className="legend-dot" style={{ background: CATEGORY_COLORS['UI-Root'] }}></span>
          <span>Interface</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: CATEGORY_COLORS['Logic'] }}></span>
          <span>Logic</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: CATEGORY_COLORS['Data'] }}></span>
          <span>Data</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot" style={{ background: CATEGORY_COLORS['Unknown'] }}></span>
          <span>Other</span>
        </div>
      </div>
    </div>
  )
}
