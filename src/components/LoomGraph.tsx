/**
 * SPDX-License-Identifier: MIT
 * Authors: Timothy Drake (Product & Design), Gemini (Unified Guide), Claude (Code Catalyst), Codex (Audit Witness)
 * Reviewed-by: Timothy Drake
 * Source: Keystone Constellation
 * Glyphs: BOM-STRICT | USER-TRUTH | RITUAL-VOW | MARKET-REALITY
 */

import { useRef, useEffect, useMemo, useCallback, useState } from 'react'
import ForceGraph3D from 'react-force-graph-3d'
import * as THREE from 'three'
import SpriteText from 'three-spritetext'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { forceManyBody, forceLink, forceCenter } from 'd3-force-3d'
import { VerbosityLevel } from './TooltipContent'
import { NodeInfoPanel } from './NodeInfoPanel'
import './LoomGraph.css'

interface LoomGraphProps {
  dependencyGraph: Record<string, string[]>
  fileTypes: Record<string, string>
  allFiles: Record<string, any>
  cycles: Array<{ type: string, nodes: string[], description: string, severity?: string }>
  brokenReferences: Array<{ file: string, missingAssets: string[] }>
  activeMission?: string | null
  skipIntroAnimation?: boolean
  twinkleIntensity?: number
  starBrightness?: number
  skybox?: string
  tooltipLevel?: VerbosityLevel
  onNodeClick?: (file: string) => void
  onIntroComplete?: () => void
  onMissionChange?: (mission: string | null) => void
  // Lifted Props
  bloomIntensity: number
  starSize: number
  linkOpacity: number
  chargeStrength: number
  useShapes: boolean
  selectedFamilies: string[]
  soloFamily: string | null
  legendMode: 'intent' | 'tech'
}

// Skybox gradient definitions
const SKYBOX_PRESETS: Record<string, { top: string, bottom: string, horizon: string, name: string }> = {
  none: { top: '#000000', bottom: '#000000', horizon: '#000000', name: 'Deep Space (Black)' },
  nebula: { top: '#1a0a2e', bottom: '#0d001a', horizon: '#2d1b4e', name: 'Nebula Purple' },
  cosmos: { top: '#0a1628', bottom: '#000510', horizon: '#152238', name: 'Cosmic Blue' },
  aurora: { top: '#0a2818', bottom: '#001208', horizon: '#0d3d1f', name: 'Aurora Green' },
  ember: { top: '#2a0a0a', bottom: '#100000', horizon: '#3d1515', name: 'Ember Red' },
  twilight: { top: '#1a1025', bottom: '#0a0510', horizon: '#2d1a3d', name: 'Twilight' },
  blueprint: { top: '#e8f4f8', bottom: '#c4dce4', horizon: '#d6e8f0', name: 'Blueprint (Light)' }
}

interface GraphNode {
  id: string; category: string; group: number; size: number;
  fx?: number; fy?: number; fz?: number; x?: number; y?: number; z?: number;
}

interface GraphLink { source: string; target: string; }

interface ProminentTrait { label: string; color: string; }

const CATEGORY_COLORS: Record<string, string> = {
  'Logic': '#FFD700',     // The Sovereign (Deep Gold)
  'UI': '#00BFFF',        // The Mirror (Electric Cyan)
  'Data': '#228B22',      // The Ground (Forest Green)
  'Config': '#9370DB',    // The Braid (Steel Purple)
  'Integrity': '#FF4500', // The Integrity (Vibrant Red)
  'Common': '#A9A9A9',    // The Common (Soft Gray)
  'Archive': '#FF8C00',   // The Archive (Burnt Orange)
  'Void': '#4B0082',      // The Void (Dark Indigo)
  'External': '#ff00ff'
}

const CATEGORY_FAMILIES: Record<string, string> = {
  'TypeScript': 'Logic', 'TypeScript React': 'Logic', 'JavaScript': 'Logic', 'JavaScript Module': 'Logic', 'React': 'Logic', 'Rust': 'Logic', 'Python': 'Logic', 'TypeScript Module': 'Logic',
  'CSS': 'UI', 'SCSS': 'UI', 'HTML': 'UI', 'JSON': 'Data', 'YAML': 'Data', 'TOML': 'Data', 'SQL': 'Data', 'XML': 'Data',
  'Config': 'Config', 'ENV': 'Config', 'INI': 'Config', 'Image': 'Assets', 'Font': 'Assets', 'Video': 'Assets', 'Audio': 'Assets',
  'Markdown': 'Docs', 'Text': 'Docs', 'External': 'External'
}

function getCategoryFamily(category: string, filePath?: string): string { 
  if (filePath) {
    const filename = filePath.split(/[/\\]/).pop()?.toLowerCase() || ''
    if (filename.includes('config') || filename.includes('settings') || filename.includes('constant')) {
      return 'Config' // Intent Mode: The Braid
    }
  }
  return CATEGORY_FAMILIES[category] || 'Unknown' 
}

function getCategoryColor(category: string): string {
  if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category]
  const fam = getCategoryFamily(category)
  const famColors: Record<string, string> = { 'Logic': '#00BFFF', 'UI': '#FFD700', 'Data': '#FF6633', 'Config': '#32CD32', 'Assets': '#B794F6', 'Docs': '#A8F5C8', 'Unknown': '#D4D4DC', 'External': '#ff00ff' }
  return famColors[fam] || '#D4D4DC'
}

const TECH_COLORS: Record<string, string> = {
  'TypeScript': '#3178c6', 'TypeScript React': '#3178c6',
  'JavaScript': '#f7df1e', 'JavaScript React': '#f7df1e',
  'React': '#61dafb',
  'Rust': '#dea584',
  'Python': '#3572a5',
  'CSS': '#563d7c', 'SCSS': '#c6538c', 'HTML': '#e34c26',
  'JSON': '#f1e05a', 'YAML': '#cb171e', 'TOML': '#9c4221', 'SQL': '#e38c00',
  'Markdown': '#083fa1', 'Text': '#dcdcdc'
}

function getTechColor(type: string): string {
  if (TECH_COLORS[type]) return TECH_COLORS[type]
  // Use a hash-based color generation for consistency
  const colors = ['#00BFFF', '#FFD700', '#FF6633', '#32CD32', '#B794F6', '#A8F5C8', '#ff00ff', '#FF4500', '#ADFF2F', '#00FA9A', '#00CED1', '#FF69B4'];
  const hash = hashString(type);
  return colors[Math.abs(hash) % colors.length];
}

function createGlowTexture(): THREE.Texture {
  const size = 256, canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!, center = size / 2, glow = size / 2
  
  // Solid Core (25% radius)
  ctx.beginPath();
  ctx.arc(center, center, size * 0.125, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
  ctx.fill();

  const grad = ctx.createRadialGradient(center, center, size * 0.125, center, center, glow)
  // Glow gradient starting from edge of solid core
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
  grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)')
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.4)')
  grad.addColorStop(0.8, 'rgba(255, 255, 255, 0.15)')
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas); tex.needsUpdate = true; return tex
}

function createShapeTexture(type: 'oval' | 'rect' | 'parallelogram' | 'cylinder' | 'doc' | 'diamond' | 'hexagon'): THREE.Texture {
  const size = 256, canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  const c = size / 2
  const r = size * 0.35 // Base radius for shapes

  ctx.fillStyle = 'white'
  ctx.strokeStyle = 'white'
  ctx.lineWidth = 8
  ctx.beginPath()

  if (type === 'oval') {
    ctx.ellipse(c, c, r * 1.2, r * 0.8, 0, 0, Math.PI * 2)
    ctx.fill()
  } else if (type === 'rect') {
    ctx.rect(c - r, c - r * 0.7, r * 2, r * 1.4)
    ctx.fill()
  } else if (type === 'parallelogram') {
    ctx.moveTo(c - r * 0.8, c + r * 0.6)
    ctx.lineTo(c + r * 1.2, c + r * 0.6)
    ctx.lineTo(c + r * 0.8, c - r * 0.6)
    ctx.lineTo(c - r * 1.2, c - r * 0.6)
    ctx.closePath()
    ctx.fill()
  } else if (type === 'cylinder') {
    const w = r * 1.6, h = r * 1.4
    ctx.ellipse(c, c - h/2, w/2, h/4, 0, 0, Math.PI * 2) // Top
    ctx.fill()
    ctx.beginPath()
    ctx.rect(c - w/2, c - h/2, w, h)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(c, c + h/2, w/2, h/4, 0, 0, Math.PI * 2) // Bottom
    ctx.fill()
  } else if (type === 'doc') {
    const w = r * 1.4, h = r * 1.8
    ctx.moveTo(c - w/2, c - h/2)
    ctx.lineTo(c + w/2, c - h/2)
    ctx.lineTo(c + w/2, c + h/2 - 20)
    // Wavy bottom
    ctx.bezierCurveTo(c + w/4, c + h/2, c - w/4, c + h/2 - 40, c - w/2, c + h/2 - 20)
    ctx.closePath()
    ctx.fill()
  } else if (type === 'diamond') {
    ctx.moveTo(c, c - r)
    ctx.lineTo(c + r, c)
    ctx.lineTo(c, c + r)
    ctx.lineTo(c - r, c)
    ctx.closePath()
    ctx.fill()
  } else if (type === 'hexagon') {
    for (let i = 0; i < 6; i++) {
      const angle = i * Math.PI / 3
      const x = c + r * Math.cos(angle)
      const y = c + r * Math.sin(angle)
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.fill()
  }

  // Add glow
  ctx.globalCompositeOperation = 'source-over'
  ctx.shadowColor = 'white'
  ctx.shadowBlur = 20
  ctx.stroke() // Outline glow

  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

function createStarTexture(): THREE.Texture {
  const size = 64, canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size
  const ctx = canvas.getContext('2d')!
  const center = size / 2
  const grad = ctx.createRadialGradient(center, center, 0, center, center, center)
  grad.addColorStop(0, 'rgba(255, 255, 255, 1.0)')
  grad.addColorStop(0.2, 'rgba(255, 255, 255, 0.8)')
  grad.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)')
  grad.addColorStop(0.8, 'rgba(255, 255, 255, 0.05)')
  grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

function hashString(str: string): number {
  let hash = 0; for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i);
  return hash
}

function easeOutCubic(t: number): number { return 1 - Math.pow(1 - t, 3) }

function getSectorPosition(cat: string, idx: number, total: number, path: string): { x: number, y: number, z: number } {
  const scale = 1.33
  const fam = getCategoryFamily(cat), base = { 'Logic': 0, 'UI': Math.PI*0.4, 'Data': Math.PI, 'Config': Math.PI*1.4, 'Assets': Math.PI*1.7, 'Docs': Math.PI*0.7, 'Unknown': Math.PI*1.2, 'External': 0 }[fam] || 0
  const seed = hashString(path), angle = base + (Math.sin(seed)*10000 - Math.floor(Math.sin(seed)*10000) - 0.5) * 0.3
  const len = (60 + (idx / Math.max(1, total)) * 40) * scale
  return { x: Math.cos(angle) * len, y: (Math.sin(seed+1)*10000 - Math.floor(Math.sin(seed+1)*10000) - 0.5) * 30 * scale, z: Math.sin(angle) * len }
}

function calculateFormationPosition(filePath: string, category: string, allFilePaths: string[], fileTypesMap: Record<string, string>, spacingScale: number = 1.0): { x: number, y: number, z: number } {
  const family = getCategoryFamily(category)
  const typeOffsets: Record<string, number> = { 'Logic': -150, 'UI': -75, 'Data': 0, 'Config': 75, 'Assets': 150, 'Docs': 225, 'Unknown': 300, 'External': 375 }
  const x = (typeOffsets[family] ?? 300) * spacingScale
  const pathParts = filePath.replace(/\//g, '\\').split('\\')
  const depth = pathParts.length - 1
  const y = depth * 30
  const sameTypeFiles = allFilePaths.filter(f => getCategoryFamily(fileTypesMap[f] || 'Unknown') === family).sort((a, b) => a.localeCompare(b))
  const idx = sameTypeFiles.indexOf(filePath)
  const gridCols = 6, row = Math.floor(idx / gridCols), col = idx % gridCols
  const z = (row * 20 - 60) * spacingScale
  return { x: x + (col - 2.5) * 12 * spacingScale, y: y, z: z }
}

function createSkyboxTexture(topColor: string, bottomColor: string, horizonColor: string, isTop: boolean, isSide: boolean): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  if (isTop) {
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2)
    grad.addColorStop(0, topColor); grad.addColorStop(1, horizonColor); ctx.fillStyle = grad
  } else if (isSide) {
    const grad = ctx.createLinearGradient(0, 0, 0, size)
    grad.addColorStop(0, topColor); grad.addColorStop(0.5, horizonColor); grad.addColorStop(1, bottomColor); ctx.fillStyle = grad
  } else {
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2)
    grad.addColorStop(0, bottomColor); grad.addColorStop(1, horizonColor); ctx.fillStyle = grad
  }

  ctx.fillRect(0, 0, size, size)
  ctx.globalAlpha = 0.2
  for (let i = 0; i < 1200; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = Math.random() * 0.4
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.5})`; ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

export function LoomGraph({ 
  dependencyGraph, fileTypes, allFiles, cycles, brokenReferences, activeMission, 
  skipIntroAnimation, twinkleIntensity = 0.5, starBrightness: initialStarBrightness = 1.0, 
  skybox = 'none', tooltipLevel = 'professional', onNodeClick, onIntroComplete, onMissionChange,
  // Lifted Props
  bloomIntensity, starSize, linkOpacity, chargeStrength, useShapes, selectedFamilies, soloFamily, legendMode
}: LoomGraphProps) {
  console.log("Gnosis: LoomGraph Mounting...", { legendMode });
  // --- 1. STATE & REFS ---
  const fgRef = useRef<any>()
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const bloomPassRef = useRef<any>(null)
  const cameraInitialized = useRef(false)
  const starfieldRef = useRef<any>(null)
  const twinkleAnimationRef = useRef<number | null>(null)
  const missionProgressRef = useRef(0)
  const formationProgress = useRef(0)
  const isAnimating = useRef(false)
  const storedForces = useRef<any>(null)

  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [showIntroVideo, setShowIntroVideo] = useState(!skipIntroAnimation)
  const [introVideoOpacity, setIntroVideoOpacity] = useState(1)
  const [videoPlayedOnce, setVideoPlayedOnce] = useState(false)
  const [isExploding, setIsExploding] = useState(!skipIntroAnimation) // Start exploded if skipping intro
  
  const [showExternal, setShowExternal] = useState(true)
  const [isFormationMode, setIsFormationMode] = useState(false)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [panelSide, setPanelSide] = useState<'left' | 'right'>('right')
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null)
  const [hoverPos, setHoverPos] = useState({ x: 0, y: 0 })
  
  const [dragEnabled, setDragEnabled] = useState(false)
  const [localSkybox, setLocalSkybox] = useState(skybox)
  
  // Sync localSkybox with prop
  useEffect(() => {
    setLocalSkybox(skybox)
  }, [skybox])

  const starBrightness = initialStarBrightness;

  const explosionProgressRef = useRef(0)

  // FORCE OPACITY: 1.0
  const [canvasOpacity, setCanvasOpacity] = useState(1)
  const twinkleIntensityRef = useRef(twinkleIntensity)
  const starBrightnessRef = useRef(starBrightness)

  const totalFiles = Object.keys(allFiles).length
  // const isLargeGraph = totalFiles > 2000

  // Sync refs for animation loop
  useEffect(() => {
    twinkleIntensityRef.current = twinkleIntensity
    starBrightnessRef.current = starBrightness
  }, [twinkleIntensity, starBrightness])

  // Determine if app is ready (stars can be shown)
  const isAppReady = totalFiles > 0
  const isAppReadyRef = useRef(isAppReady)
  isAppReadyRef.current = isAppReady // Keep ref in sync

  // Handle intro video fade-out when ready
  useEffect(() => {
    if (!showIntroVideo) return

    // Preload buffer: Wait 1s before playing to prevent stutter
    const bufferTimer = setTimeout(() => {
        if (videoRef.current) {
            videoRef.current.play().catch(() => {
                // Autoplay blocked or failed - force end
                setVideoPlayedOnce(true)
            })
        }
    }, 1000)

    // If video played once AND app is ready, start fade out
    if (videoPlayedOnce && isAppReady) {
      let opacity = 1
      const fadeInterval = setInterval(() => {
        opacity -= 0.02
        if (opacity <= 0) {
          clearInterval(fadeInterval)
          setShowIntroVideo(false)
          setIsExploding(false)
          setIntroVideoOpacity(0)
          onIntroComplete?.()
        } else {
          setIntroVideoOpacity(opacity)
        }
      }, 16) // ~60fps
      return () => clearInterval(fadeInterval)
    }
    return () => clearTimeout(bufferTimer)
  }, [videoPlayedOnce, isAppReady, showIntroVideo, onIntroComplete])

  // Handle video ended - either loop or mark as played once
  const handleVideoEnded = useCallback(() => {
    if (!isAppReadyRef.current) {
      // Still loading - loop the video
      if (videoRef.current) {
        videoRef.current.currentTime = 0
        videoRef.current.play()
      }
    } else {
      // App ready - mark video as played, will trigger fade
      setVideoPlayedOnce(true)
    }
  }, [])

  // --- 2. DATA PROCESSING (MOVED TO TOP) ---
  const { graphData } = useMemo(() => {
    const nodePaths = Object.keys(dependencyGraph), nodeSet = new Set(nodePaths)
    Object.values(dependencyGraph).flat().forEach(d => nodeSet.add(d))
    const incoming: Record<string, number> = {}
    nodeSet.forEach(f => incoming[f] = 0)
    Object.values(dependencyGraph).forEach(ds => ds.forEach(d => { if (incoming[d] !== undefined) incoming[d]++; }))
    let sunId = '', maxC = 0
    nodeSet.forEach(f => { if (incoming[f] > maxC) { maxC = incoming[f]; sunId = f; } })
    const familyNodes: Record<string, string[]> = {}
    nodeSet.forEach(f => { const fam = getCategoryFamily(fileTypes[f] || 'Unknown', f); if (!familyNodes[fam]) familyNodes[fam] = []; familyNodes[fam].push(f); })
    const nodes = Array.from(nodeSet).map(f => {
      const cat = fileTypes[f] || 'Unknown', fam = getCategoryFamily(cat, f), flist = familyNodes[fam] || [], idx = flist.indexOf(f), seed = hashString(f)
      const pos = (fam === 'External') ? { x: Math.cos((idx/flist.length)*Math.PI*2)*465, y: (Math.sin(seed)*10-5)*13, z: Math.sin((idx/flist.length)*Math.PI*2)*465 } : getSectorPosition(cat, idx, flist.length, f)
      
      const inCount = incoming[f] || 0
      const expSize = 6 + Math.pow(inCount, 1.5) * 1.2
      const nodeObj: GraphNode = { id: f, category: cat, group: 0, size: (f === sunId) ? 40 : Math.max(6, Math.min(36, expSize)), ...pos }
      if (fam === 'External') { 
         nodeObj.fx = pos.x; nodeObj.fy = pos.y; nodeObj.fz = pos.z; 
      }
      return nodeObj
    })
    const links = []
    for (const [s, ts] of Object.entries(dependencyGraph)) {
      for (const t of ts) { if (nodeSet.has(s) && nodeSet.has(t)) links.push({ source: s, target: t }) }
    }
    return { graphData: { nodes, links } }
  }, [dependencyGraph, fileTypes])

  const filteredGraphData = useMemo(() => {
    const { nodes, links } = graphData
    if (!selectedNode && selectedFamilies.length === 0 && !activeMission && !isFormationMode) return graphData
    let filtered = [...nodes]

    // Selected node - show only connected
    if (selectedNode) {
      const connected = new Set([selectedNode])
      dependencyGraph[selectedNode]?.forEach(d => connected.add(d))
      Object.entries(dependencyGraph).forEach(([s, ds]) => { if (ds.includes(selectedNode)) connected.add(s) })
      filtered = filtered.filter(n => connected.has(n.id))
    }

    // Selected families checkbox filter (hide unchecked families)
    if (selectedFamilies.length > 0) {
      filtered = filtered.filter(n => selectedFamilies.includes(getCategoryFamily(n.category, n.id)))
    }

    // Mission filters
    if (activeMission === 'rot') {
      filtered = filtered.filter(n => allFiles[n.id]?.isUnused || (allFiles[n.id]?.inboundCount ?? 0) === 0)
    } else if (activeMission === 'onboard') {
      filtered = filtered.filter(n => allFiles[n.id]?.isEntryPoint || (allFiles[n.id]?.inboundCount ?? 0) === 0)
    }

    // External toggle
    if (!showExternal) {
      filtered = filtered.filter(n => getCategoryFamily(n.category, n.id) !== 'External')
    }

    // Inject Labels for Formation Mode
    if (isFormationMode) {
      const families = ['Logic', 'UI', 'Data', 'Config', 'Assets', 'Docs', 'External'];
      const typeOffsets: Record<string, number> = { 'Logic': -150, 'UI': -75, 'Data': 0, 'Config': 75, 'Assets': 150, 'Docs': 225, 'External': 375 }
      
      families.forEach(fam => {
        const x = typeOffsets[fam] ?? 300
        // Add a virtual node for the label
        filtered.push({
          id: `__LABEL_${fam}`,
          category: 'Label',
          group: 99,
          size: 0,
          x: x,
          y: 400, // High above the stack
          z: 0,
          fx: x,
          fy: 400,
          fz: 0
        } as any)
      })
    }

    const ids = new Set(filtered.map(n => n.id))
    if (filtered.length === 0 && nodes.length > 0) return { nodes, links }
    const filteredLinks = links.filter(l => {
      const sId = typeof l.source === 'string' ? l.source : (l.source as any).id
      const tId = typeof l.target === 'string' ? l.target : (l.target as any).id
      return ids.has(sId) && ids.has(tId)
    })
    return { nodes: filtered, links: filteredLinks }
  }, [graphData, selectedNode, selectedFamilies, showExternal, dependencyGraph, activeMission, allFiles, isFormationMode])

  // --- 3. HELPERS (HOISTED) ---
  const isBrokenFile = useCallback((id: string) => {
    const m = allFiles[id]
    return (m?.cycleParticipation || 0) > 0 || (brokenReferences.find(e => e.file === id)?.missingAssets.length || 0) > 0
  }, [allFiles, brokenReferences])

  const resetToGodView = useCallback(() => {
    setIsExploding(false)
    setChargeStrength(-40)
    if (fgRef.current) {
      const c = fgRef.current.controls();
      if (c) {
        c.enabled = true
        c.autoRotate = false
        c.enableDamping = false
        c.update()
      }
      setSoloFamily(null); setSelectedFamilies([]);
      // Restore Horizon: only reset orientation (lookAt origin), keep current camera position
      const cam = fgRef.current.camera()
      if (cam) {
        const currentPos = cam.position.clone()
        fgRef.current.cameraPosition(
          { x: currentPos.x, y: currentPos.y, z: currentPos.z },
          { x: 0, y: 0, z: 0 },
          800
        )
      }
    }
  }, [fgRef])

  const resetCamera = useCallback(() => {
    setIsExploding(false)
    if (fgRef.current) {
      const c = fgRef.current.controls();
      if (c) {
        c.enabled = true
        c.autoRotate = false
        c.enableDamping = false
        c.update()
      }
      // Reset View: teleport camera back to home position and look at center
      fgRef.current.cameraPosition(
        { x: 0, y: 0, z: 600 },
        { x: 0, y: 0, z: 0 },
        1200
      )
    }
  }, [fgRef])

  // Skip intro entirely
  const skipIntro = useCallback(() => {
    setShowIntroVideo(false)
    setIsExploding(false)
    setIntroVideoOpacity(0)
    resetToGodView()
    onIntroComplete?.()
  }, [resetToGodView, onIntroComplete])

  const toggleFormationMode = useCallback(() => {
    if (!fgRef.current) return
    const newMode = !isFormationMode
    setIsFormationMode(newMode)
    if (newMode) {
      if (!storedForces.current) {
        storedForces.current = {
          charge: fgRef.current.d3Force('charge'),
          link: fgRef.current.d3Force('link'),
          center: fgRef.current.d3Force('center')
        }
      }
      fgRef.current.d3Force('charge', null)
      fgRef.current.d3Force('link', null)
      fgRef.current.d3Force('center', null)

      const graphNodes = filteredGraphData.nodes
      const allFilePaths = graphNodes.map((n: GraphNode) => n.id)  
      const targets: Record<string, {x: number, y: number, z: number}> = {}
      
      const spacingMultiplier = Math.abs(chargeStrength) / 40;

      graphNodes.forEach((node: GraphNode) => {
        if (node.category === 'Label') {
           const fam = node.id.replace('__LABEL_', '');
           const typeOffsets: Record<string, number> = { 'Logic': -150, 'UI': -75, 'Data': 0, 'Config': 75, 'Assets': 150, 'Docs': 225, 'External': 375 };
           const lx = (typeOffsets[fam] ?? 300) * spacingMultiplier;
           targets[node.id] = { x: lx, y: 400, z: 0 };
           return;
        }
        const category = node.category || 'Unknown'
        const baseTarget = calculateFormationPosition(node.id, category, allFilePaths, fileTypes, spacingMultiplier)
        const lift = isBrokenFile(node.id) ? 120 : 0
        targets[node.id] = { x: baseTarget.x, y: baseTarget.y + lift, z: baseTarget.z }
      })
      formationProgress.current = 0
      isAnimating.current = true
      const animationDuration = 1500
      const startTime = Date.now()
      const startPositions: Record<string, {x: number, y: number, z: number}> = {}
      graphNodes.forEach((node: any) => {
        startPositions[node.id] = { x: node.x || 0, y: node.y || 0, z: node.z || 0 }
      })
      const animate = () => {
        if (!isAnimating.current || !fgRef.current) return
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / animationDuration, 1)  
        const easedProgress = easeOutCubic(progress)
        graphNodes.forEach((node: any) => {
          const start = startPositions[node.id] || { x: 0, y: 0, z: 0 }
          const target = targets[node.id] || start
          node.x = start.x + (target.x - start.x) * easedProgress  
          node.y = start.y + (target.y - start.y) * easedProgress  
          node.z = start.z + (target.z - start.z) * easedProgress  
          node.fx = node.x
          node.fy = node.y
          node.fz = node.z
        })
        fgRef.current.refresh()
        if (progress < 1) { requestAnimationFrame(animate) } else { isAnimating.current = false }
      }
      requestAnimationFrame(animate)
      // Front view: camera level with formation, looking straight at X-Y plane
      fgRef.current.cameraPosition({ x: 0, y: 100, z: 800 }, { x: 0, y: 100, z: 0 }, 1500)
    } else {
      isAnimating.current = false
      formationProgress.current = 0
      const fg = fgRef.current
      // Clear fixed positions on all nodes
      filteredGraphData.nodes.forEach((node: any) => {
        node.fx = null
        node.fy = null
        node.fz = null
      })
      fg.d3Force('charge', forceManyBody().strength(-40))
      fg.d3Force('link', forceLink(filteredGraphData.links).distance(25).id((d: any) => d.id))
      fg.d3Force('center', forceCenter().strength(0.02))
      // fg.d3Alpha(1) // Removed: Not exposed by ref, causes crash
      fg.d3ReheatSimulation()
      fg.refresh()
    }
  }, [isFormationMode, fileTypes, filteredGraphData, isBrokenFile])

  // --- 4. EFFECTS ---

  // REPAIR: Effect 1 - Core Navigation & Visibility (Must always run)
  useEffect(() => {
    const update = () => { if (containerRef.current) { const r = containerRef.current.getBoundingClientRect(); setContainerSize({ width: r.width, height: r.height }); } }
    update(); window.addEventListener('resize', update);
    
    let retryCount = 0
    const maxRetries = 50 // 5 seconds
    
    const initCamera = setInterval(() => {
      const fg = fgRef.current
      if (!fg) {
        retryCount++
        if (retryCount > maxRetries) clearInterval(initCamera)
        return
      }
      
      // SETUP 1: Camera & Horizon
      const cam = fg.camera()
      if (cam) {
        cam.far = 50000 // Ensure stars aren't clipped (starfield radius is 45000)
        cam.updateProjectionMatrix()
      }
      
      if (!cameraInitialized.current) { 
        // Force graph to center on origin
        fg.cameraPosition({ x: 0, y: 0, z: 1000 }, { x: 0, y: 0, z: 0 }, 0)
        cameraInitialized.current = true 
      }

      // SETUP 2: Controls Enforcement
      const enforceControls = () => {
        const controls = fg.controls()
        if (controls) {
          controls.autoRotate = false
          controls.enableDamping = true // Smooth feel
          controls.dampingFactor = 0.05
          controls.rotateSpeed = 1.0
          controls.enableZoom = false // Disable built-in zoom - we handle it manually
          controls.minDistance = 50
          controls.maxDistance = 8000 // Extended for wide view
          controls.enablePan = true
          controls.screenSpacePanning = true
          controls.mouseButtons = {
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN, // Middle mouse now pans instead of dolly
            RIGHT: THREE.MOUSE.PAN,
          }
        }
      }
      enforceControls()

      // LINEAR ZOOM: Custom wheel handler - simple forward/back along camera's view direction
      const renderer = fg.renderer()
      if (renderer && renderer.domElement) {
        const handleWheel = (e: WheelEvent) => {
          e.preventDefault()
          e.stopPropagation()
          const cam = fg.camera()
          if (!cam) return

          const zoomAmount = 300 // Fast zoom per scroll tick

          // Get the direction the camera is looking
          const direction = new THREE.Vector3()
          cam.getWorldDirection(direction)

          // Move camera forward/backward along its view direction
          if (e.deltaY > 0) {
            // Scroll down = move backward
            cam.position.addScaledVector(direction, -zoomAmount)
          } else {
            // Scroll up = move forward
            cam.position.addScaledVector(direction, zoomAmount)
          }
        }
        renderer.domElement.addEventListener('wheel', handleWheel, { passive: false, capture: true })
        ;(window as any).__wheelHandler = handleWheel
        ;(window as any).__wheelElement = renderer.domElement
      }

      // Clear loop once camera is set
      clearInterval(initCamera)

      // Start enforcer for drift prevention
      const controlsEnforcer = setInterval(enforceControls, 500)
      ;(window as any).__controlsEnforcer = controlsEnforcer

      if (typeof fg.d3AlphaDecay === 'function') fg.d3AlphaDecay(0.05);
      if (typeof fg.d3VelocityDecay === 'function') fg.d3VelocityDecay(0.3);
    }, 100)

    return () => {
      window.removeEventListener('resize', update)
      clearInterval(initCamera)
      if ((window as any).__controlsEnforcer) clearInterval((window as any).__controlsEnforcer)
    }
  }, []);

  // CAMERA LOCKDOWN: Force camera to viewable position after graphData changes
  // ForceGraph3D auto-repositions camera based on node count - we override that
  useEffect(() => {
    if (!fgRef.current || filteredGraphData.nodes.length === 0) return
    const timer = setTimeout(() => {
      const fg = fgRef.current
      if (!fg) return
      const cam = fg.camera()
      if (cam && cam.position.z > 1000) {
        // Library pushed camera too far - bring it back
        fg.cameraPosition({ x: 0, y: 0, z: 600 }, { x: 0, y: 0, z: 0 }, 0)
      }
    }, 200) // Run after library's onUpdate
    return () => clearTimeout(timer)
  }, [filteredGraphData])

  // REPAIR: Effect 2 - Visual Enhancements (Bloom) - Create on mount, update on change
  useEffect(() => {
    let attempts = 0
    const maxAttempts = 30 // 3 seconds

    const initBloom = setInterval(() => {
      attempts++
      const fg = fgRef.current
      if (!fg) {
        if (attempts > maxAttempts) clearInterval(initBloom)
        return
      }

      const composer = fg.postProcessingComposer()
      if (!composer) {
        if (attempts > maxAttempts) clearInterval(initBloom)
        return
      }

      // Create bloom pass if it doesn't exist
      if (!bloomPassRef.current) {
        try {
          const bloomPass = new UnrealBloomPass(
            new THREE.Vector2(window.innerWidth, window.innerHeight),
            bloomIntensity,
            0.4,
            0.85
          )
          composer.addPass(bloomPass)
          bloomPassRef.current = bloomPass
        } catch (e) {
          console.error("Atmosphere ignition failed.", e)
        }
      }

      clearInterval(initBloom)
    }, 100)

    return () => clearInterval(initBloom)
  }, []) // Only run on mount

  // Update bloom intensity when slider changes
  useEffect(() => {
    if (bloomPassRef.current) {
      bloomPassRef.current.strength = bloomIntensity
    }
  }, [bloomIntensity]) 

  // PAUSE CONTROL: Handle Stasis Field - Data Gate only (Removed render pause)

  // BIG BANG: Reset positions to origin on load or project change

  // SKYBOX: Isolated effect
  useEffect(() => {
    const fg = fgRef.current; if (!fg) return
    const scene = fg.scene(); 
    if (scene) {
        if (localSkybox === 'blueprint') {
          scene.background = new THREE.Color(0xf0f4f8) // Light blue-grey paper
        } else {
          const preset = SKYBOX_PRESETS[localSkybox] || SKYBOX_PRESETS.none
          if (localSkybox !== 'none') {
            const textures = [
              createSkyboxTexture(preset.top, preset.bottom, preset.horizon, false, true),
              createSkyboxTexture(preset.top, preset.bottom, preset.horizon, false, true),
              createSkyboxTexture(preset.top, preset.bottom, preset.horizon, true, false),
              createSkyboxTexture(preset.top, preset.bottom, preset.horizon, false, false),
              createSkyboxTexture(preset.top, preset.bottom, preset.horizon, false, true),
              createSkyboxTexture(preset.top, preset.bottom, preset.horizon, false, true),
            ]
            scene.background = new THREE.CubeTexture(textures.map(t => t.image))
            scene.background.needsUpdate = true
          } else {
            scene.background = new THREE.Color(0x000000)
          }
        }
    }
  }, [localSkybox]);

  // Starfield Creation (Run Once)
  useEffect(() => {
    let retryCount = 0
    const maxRetries = 50

    const initStarfield = setInterval(() => {
      retryCount++
      if (retryCount > maxRetries) {
        clearInterval(initStarfield)
        return
      }

      const scene = fg.scene()
      if (!scene) return

      clearInterval(initStarfield) // Engine found, stop polling

      if (!scene.getObjectByName('starfield-far')) {
          const starTexture = createStarTexture()
          const starColors = [[1.0, 1.0, 1.0], [0.9, 0.95, 1.0], [1.0, 0.95, 0.9], [0.8, 0.9, 1.0], [1.0, 0.98, 0.8], [0.95, 0.9, 1.0]]
          const layers = [
            { name: 'starfield-far', count: 4000, radius: 6000, size: 24.0, parallax: 0.02 },
            { name: 'starfield-mid', count: 2000, radius: 4000, size: 18.0, parallax: 0.06 },
            { name: 'starfield-near', count: 800, radius: 2500, size: 12.0, parallax: 0.12 },
          ]
          const allLayerData: any[] = []
          layers.forEach(layer => {
            const geo = new THREE.BufferGeometry()
            const pos = new Float32Array(layer.count * 3), colors = new Float32Array(layer.count * 3), baseColors = new Float32Array(layer.count * 3), phases = new Float32Array(layer.count)
            for (let i = 0; i < layer.count; i++) {
              pos[i*3] = (Math.random()-0.5)*layer.radius; pos[i*3+1] = (Math.random()-0.5)*layer.radius; pos[i*3+2] = (Math.random()-0.5)*layer.radius
              const color = starColors[Math.floor(Math.random()*starColors.length)]
              baseColors[i*3] = color[0]; baseColors[i*3+1] = color[1]; baseColors[i*3+2] = color[2]
              colors[i*3] = color[0]; colors[i*3+1] = color[1]; colors[i*3+2] = color[2]
              phases[i] = Math.random()*Math.PI*2
            }
            geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
            geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
            const material = new THREE.PointsMaterial({ size: layer.size, map: starTexture, transparent: true, opacity: 1.0, vertexColors: true, blending: THREE.AdditiveBlending, sizeAttenuation: true, depthWrite: false })
            const mesh = new THREE.Points(geo, material)
            mesh.name = layer.name; scene.add(mesh)
            allLayerData.push({ geo, colors, baseColors, phases, mesh, parallax: layer.parallax })
          })
          starfieldRef.current = { layers: allLayerData }
          
          let lastCamPos = new THREE.Vector3(0, 0, 400)
          const animateTwinkle = () => {
            const layerData = starfieldRef.current?.layers
            if (!layerData) { twinkleAnimationRef.current = requestAnimationFrame(animateTwinkle); return }
            const time = Date.now() * 0.001, cam = fg.camera()
            const camPos = cam ? cam.position.clone() : new THREE.Vector3(0, 0, 400)
            const delta = new THREE.Vector3().subVectors(camPos, lastCamPos)
            lastCamPos.copy(camPos)
            
            const tIntensity = twinkleIntensityRef.current, sBrightness = starBrightnessRef.current

            layerData.forEach((layer: any) => {
              const { geo, colors, baseColors, phases, mesh, parallax } = layer
              mesh.position.x -= delta.x * parallax; mesh.position.y -= delta.y * parallax; mesh.position.z -= delta.z * parallax
              const positions = geo.getAttribute('position') as THREE.BufferAttribute
              for (let i = 0; i < phases.length; i++) {
                const sx = positions.getX(i) + mesh.position.x, sy = positions.getY(i) + mesh.position.y, sz = positions.getZ(i) + mesh.position.z
                const dist = Math.sqrt((camPos.x-sx)**2 + (camPos.y-sy)**2 + (camPos.z-sz)**2)
                const fadeDist = Math.max(0, Math.min(1, (dist-200)/150)), phase = phases[i]
                const twinkle = tIntensity > 0 ? 0.7 + 0.3 * Math.sin(time * (1 + phase * 0.5) + phase) * tIntensity : 1.0
                const brightness = twinkle * fadeDist * sBrightness
                colors[i*3] = baseColors[i*3]*brightness; colors[i*3+1] = baseColors[i*3+1]*brightness; colors[i*3+2] = baseColors[i*3+2]*brightness
              }
              (geo.getAttribute('color') as THREE.BufferAttribute).needsUpdate = true
            })
            twinkleAnimationRef.current = requestAnimationFrame(animateTwinkle)
          }
          animateTwinkle()
      }
    }, 100)
    return () => { clearInterval(initStarfield); if (twinkleAnimationRef.current) cancelAnimationFrame(twinkleAnimationRef.current) }
  }, []) 

  // Track previous mission to detect mission changes (not manual Formation toggle)
  const prevMissionRef = useRef<string | null>(null)

  useEffect(() => {
    if (!fgRef.current || isExploding) return

    // Only auto-toggle Formation when MISSION changes, not when isFormationMode changes
    const missionChanged = prevMissionRef.current !== activeMission
    prevMissionRef.current = activeMission

    if (missionChanged) {
      if (activeMission && activeMission !== 'default' && !isFormationMode) toggleFormationMode()
      else if (!activeMission && isFormationMode) toggleFormationMode()
    }

    missionProgressRef.current = 0; const start = Date.now()
    const animateMiss = () => {
      const p = Math.min((Date.now() - start) / 1000, 1)
      missionProgressRef.current = p; fgRef.current?.refresh()
      if (p < 1) requestAnimationFrame(animateMiss)
    }
    requestAnimationFrame(animateMiss)
  }, [activeMission, soloFamily, isExploding, isFormationMode, toggleFormationMode])

  // Force graph refresh when visual parameters change so nodeThreeObject re-renders
  useEffect(() => {
    if (fgRef.current) {
      fgRef.current.refresh()
    }
  }, [starSize, soloFamily, activeMission, useShapes])

  // Update charge force when slider changes (Galaxy) OR Tightness (Formation)
  useEffect(() => {
    if (!fgRef.current) return;
    if (isFormationMode) {
      // Live Tightness Update
      const spacingMultiplier = Math.abs(chargeStrength) / 40;
      const graphNodes = filteredGraphData.nodes;
      const allFilePaths = graphNodes.map((n: GraphNode) => n.id);
      
      graphNodes.forEach((node: any) => {
        if (node.category === 'Label') {
           const fam = node.id.replace('__LABEL_', '');
           const typeOffsets: Record<string, number> = { 'Logic': -150, 'UI': -75, 'Data': 0, 'Config': 75, 'Assets': 150, 'Docs': 225, 'External': 375 };
           node.fx = (typeOffsets[fam] ?? 300) * spacingMultiplier;
           node.x = node.fx;
           return;
        }
        const pos = calculateFormationPosition(node.id, node.category || 'Unknown', allFilePaths, fileTypes, spacingMultiplier);
        const lift = isBrokenFile(node.id) ? 120 : 0;
        node.fx = pos.x;
        node.fy = pos.y + lift;
        node.fz = pos.z;
        node.x = node.fx; node.y = node.fy; node.z = node.fz;
      });
      fgRef.current.refresh();
    } else {
      fgRef.current.d3Force('charge', forceManyBody().strength(chargeStrength))
      fgRef.current.d3Force('center', forceCenter().strength(0.6)) // Anchor the Big Bang
      fgRef.current.d3ReheatSimulation()
    }
  }, [chargeStrength, isFormationMode])

  /*
  useEffect(() => {
    if (fgRef.current && !isFormationMode) {
      fgRef.current.d3Force('charge', forceManyBody().strength(chargeStrength))
      fgRef.current.d3ReheatSimulation()
    }
  }, [chargeStrength, isFormationMode])
  */

  // --- 5. RENDER HELPERS ---
  const getProminentTrait = useCallback((id: string): ProminentTrait => {
    const m = allFiles[id] || {}
    if (m.signature) return { label: `Signature: ${m.signature}`, color: '#9370DB' }
    if (m.cycleParticipation > 0) return { label: 'Circular dependency', color: '#ff4d4f' }
    if (m.isUnused) return { label: 'Unused file', color: '#c7c7cc' }
    if (m.inboundCount >= 8) return { label: 'Masterfully Crafted', color: '#FFD700' }
    return { label: 'Stable', color: '#cbd5f5' }
  }, [allFiles])

  const glowTexture = useMemo(() => createGlowTexture(), [])

  // Shape textures for different families
  const shapeTextures = useMemo(() => ({
    Logic: createShapeTexture('hexagon'),      // Code/Logic = Hexagon
    UI: createShapeTexture('rect'),            // UI = Rectangle
    Data: createShapeTexture('cylinder'),      // Data = Cylinder (database)
    Config: createShapeTexture('diamond'),     // Config = Diamond
    Assets: createShapeTexture('oval'),        // Assets = Oval
    Docs: createShapeTexture('doc'),           // Docs = Document
    External: createShapeTexture('parallelogram'), // External = Parallelogram
    Unknown: createShapeTexture('oval')
  }), [])

  const sharedMaterials = useMemo(() => {
    const mats: Record<string, THREE.SpriteMaterial> = {}
    Object.keys(CATEGORY_COLORS).forEach(cat => {
      mats[cat] = new THREE.SpriteMaterial({ map: glowTexture, color: new THREE.Color(getCategoryColor(cat)), transparent: true, opacity: 1.0, depthWrite: false, depthTest: true })
    })
    return mats
  }, [glowTexture])

  const shapeMaterials = useMemo(() => {
    const mats: Record<string, THREE.SpriteMaterial> = {}
    const families = ['Logic', 'UI', 'Data', 'Config', 'Assets', 'Docs', 'External', 'Unknown']
    families.forEach(fam => {
      const tex = shapeTextures[fam as keyof typeof shapeTextures]
      const color = { Logic: '#00BFFF', UI: '#FFD700', Data: '#FF6633', Config: '#32CD32', Assets: '#B794F6', Docs: '#A8F5C8', External: '#ff00ff', Unknown: '#D4D4DC' }[fam] || '#D4D4DC'
      mats[fam] = new THREE.SpriteMaterial({ map: tex, color: new THREE.Color(color), transparent: true, opacity: 1.0, depthWrite: false, depthTest: true })
    })
    return mats
  }, [shapeTextures])

  const nodeThreeObject = useCallback((node: GraphNode) => {
    // Handle Label Nodes
    if (node.category === 'Label') {
      const sprite = new SpriteText(node.id.replace('__LABEL_', ''));
      sprite.color = '#ffffff';
      sprite.textHeight = 24;
      sprite.fontFace = 'Courier New';
      sprite.fontWeight = 'bold';
      sprite.backgroundColor = 'rgba(0,0,0,0.5)';
      sprite.padding = 4;
      return sprite;
    }

    const nodeFamily = getCategoryFamily(node.category, node.id)
    const mat = useShapes
      ? (shapeMaterials[nodeFamily] || shapeMaterials['Unknown'])
      : (sharedMaterials[nodeFamily] || sharedMaterials['Unknown'])
    if (!mat) return new THREE.Object3D() // Ensure mat is not undefined
    const sprite = new THREE.Sprite(mat), baseSize = node.size * 2
    let tScale = 1.0, tOpacity = 1.0, tColor: string | null = null
    const missP = missionProgressRef.current

    // Apply color based on mode
    if (legendMode === 'tech') {
      tColor = getTechColor(node.category)
    }

    // PRIORITY 1: Solo Family Highlight (Legend) - Soft Filter
    if (soloFamily) {
      if (nodeFamily === soloFamily) {
        tScale = 1.4;
        tColor = '#ffffff'; // Radiant white highlight for selected family
      } else {
        tOpacity = 0.1; // Context dimming
      }
    } 
    // PRIORITY 2: Active Mission Logic (only if no Legend solo)
    else if (activeMission) {
      const m = allFiles[node.id] || {}, fam = nodeFamily
      switch (activeMission) {
        case 'incident':
          const age = (Date.now()/1000 - (m.mtime || Date.now()/1000))/3600
          if (age < 24) { tColor = '#ff4d4f'; tScale = 2.2; } else if (age < 168) { tColor = '#ffa940'; tScale = 1.6; }
          else if ((m.outboundCount || 0) > 8) { tColor = '#ff7875'; tScale = 1.4; } else tOpacity = 0.15
          break
        case 'rot': if (m.isUnused || (m.inboundCount || 0) === 0) { tColor = '#778899'; tScale = 1.5; } else tOpacity = 0.1; break
        case 'onboard': if (m.isEntryPoint || (m.inboundCount || 0) === 0) { tColor = '#FFD700'; tScale = 3.0; } else tOpacity = 0.2; break
        case 'risk': if ((m.inboundCount || 0) > 8 || (m.cycleParticipation || 0) > 0) { tColor = '#DC143C'; tScale = 1.4; } else tOpacity = 0.2; break
        case 'optimize': 
          // Highlight Assets and Deep dependency chains
          const chainDepth = m.chainDepth || 0;
          if (fam === 'Assets' || chainDepth > 6) { 
            tColor = '#00BFFF'; 
            tScale = 1.5; 
          } else {
            tOpacity = 0.2; 
          }
          break;
      }
    }
    const easedP = easeOutCubic(missP)
    const curScale = 1.0 + (tScale - 1.0) * easedP, curOpacity = Math.max(0.0001, 1.0 + (tOpacity - 1.0) * easedP)
    const pulse = (tScale > 1.0 && easedP === 1.0) ? (1.0 + Math.sin(Date.now() / 300) * 0.05) : 1.0
    // ENFORCE MINIMUM SIZE: 2.0 to ensure visibility even if starSize is low
    const finalS = Math.max(2.0, baseSize * starSize * (isBrokenFile(node.id) ? 1.4 : 1) * curScale * pulse)
    sprite.scale.set(finalS, finalS, 1)
    if (tColor || curOpacity < 1.0) {
      const cloned = mat.clone()
      if (tColor) cloned.color = new THREE.Color(getCategoryColor(node.category)).lerp(new THREE.Color(tColor), easedP)
      cloned.opacity = curOpacity
      sprite.material = cloned
    }
    sprite.userData = { nodeId: node.id, baseSize }; return sprite
  }, [sharedMaterials, shapeMaterials, useShapes, allFiles, activeMission, soloFamily, isBrokenFile, starSize, legendMode])

  // Track Ctrl key for node drag mode
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Control') setDragEnabled(true) }
    const handleKeyUp = (e: KeyboardEvent) => { if (e.key === 'Control') setDragEnabled(false) }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => { window.removeEventListener('keydown', handleKeyDown); window.removeEventListener('keyup', handleKeyUp) }
  }, [])

  // Drive Through Mode: WASDQEZXC keyboard controls
  const keysPressed = useRef<Set<string>>(new Set())
  const movementSpeed = useRef(2.0)
  const movementAnimationRef = useRef<number | null>(null)

  useEffect(() => {
    const baseSpeed = 2.0
    const maxSpeed = 12.0
    const accelRate = 0.15

    const handleMovementKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      if (['w', 'a', 's', 'd', 'q', 'e', 'z', 'x', 'c'].includes(key)) {
        e.preventDefault()
        keysPressed.current.add(key)
        if (e.shiftKey) keysPressed.current.add('shift')
        if (e.ctrlKey) keysPressed.current.add('ctrl')
      }
    }

    const handleMovementKeyUp = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase()
      keysPressed.current.delete(key)
      if (!e.shiftKey) keysPressed.current.delete('shift')
      if (!e.ctrlKey) keysPressed.current.delete('ctrl')
      // Reset speed when all movement keys released
      if (!['w', 'a', 's', 'd', 'q', 'e', 'z', 'x', 'c'].some(k => keysPressed.current.has(k))) {
        movementSpeed.current = baseSpeed
      }
    }

    const updateMovement = () => {
      const fg = fgRef.current
      if (!fg) {
        movementAnimationRef.current = requestAnimationFrame(updateMovement)
        return
      }

      const cam = fg.camera()
      const controls = fg.controls()
      if (!cam || !controls) {
        movementAnimationRef.current = requestAnimationFrame(updateMovement)
        return
      }

      const keys = keysPressed.current
      const hasMovement = ['w', 'a', 's', 'd', 'q', 'e', 'z', 'x', 'c'].some(k => keys.has(k))

      if (hasMovement) {
        // Accelerate with Ctrl held
        if (keys.has('ctrl')) {
          movementSpeed.current = Math.min(maxSpeed, movementSpeed.current + accelRate)
        }
        const speed = movementSpeed.current

        // Get camera direction vectors
        const forward = new THREE.Vector3()
        cam.getWorldDirection(forward)
        forward.y = 0
        forward.normalize()

        const right = new THREE.Vector3()
        right.crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize()

        const up = new THREE.Vector3(0, 1, 0)

        // Get selected node position for orbit calculations
        const selectedNodeData = selectedNode
          ? filteredGraphData.nodes.find((n: GraphNode) => n.id === selectedNode)
          : null
        const orbitTarget = selectedNodeData
          ? new THREE.Vector3(selectedNodeData.x || 0, selectedNodeData.y || 0, selectedNodeData.z || 0)
          : null

        // Movement vectors
        let moveX = 0, moveY = 0, moveZ = 0
        let yawDelta = 0

        // W/S: Forward/Backward (Shift+W = Up, Shift+S = Down)
        if (keys.has('w')) {
          if (keys.has('shift')) {
            moveY += speed
          } else {
            moveX += forward.x * speed
            moveZ += forward.z * speed
          }
        }
        if (keys.has('s')) {
          if (keys.has('shift')) {
            moveY -= speed
          } else {
            moveX -= forward.x * speed
            moveZ -= forward.z * speed
          }
        }

        // A/D: Strafe Left/Right
        if (keys.has('a')) {
          moveX -= right.x * speed
          moveZ -= right.z * speed
        }
        if (keys.has('d')) {
          moveX += right.x * speed
          moveZ += right.z * speed
        }

        // Q/E: Turn Left/Right (or Orbit if star selected)
        const turnSpeed = 0.02
        if (keys.has('q')) yawDelta -= turnSpeed
        if (keys.has('e')) yawDelta += turnSpeed

        // Z: Straight Down (or Parabola Down if star selected)
        if (keys.has('z')) {
          moveY -= speed
        }

        // X/C: Straight Up (or Parabola Up if star selected)
        if (keys.has('x') || keys.has('c')) {
          moveY += speed
        }

        // Apply movement
        if (orbitTarget && (yawDelta !== 0 || keys.has('z') || keys.has('x') || keys.has('c'))) {
          // Orbit mode when star is selected
          const camPos = cam.position.clone()
          const toCamera = camPos.sub(orbitTarget)
          const distance = toCamera.length()

          if (yawDelta !== 0) {
            // Horizontal orbit (Q/E)
            const angle = Math.atan2(toCamera.z, toCamera.x) + yawDelta
            cam.position.x = orbitTarget.x + Math.cos(angle) * distance
            cam.position.z = orbitTarget.z + Math.sin(angle) * distance
          }

          if (keys.has('z') || keys.has('x') || keys.has('c')) {
            // Vertical parabola (arc up/down around star)
            const horizontalDist = Math.sqrt(toCamera.x * toCamera.x + toCamera.z * toCamera.z)
            const currentElevation = Math.atan2(toCamera.y, horizontalDist)
            const elevationDelta = (keys.has('z') ? -1 : 1) * turnSpeed
            const newElevation = Math.max(-Math.PI / 2.5, Math.min(Math.PI / 2.5, currentElevation + elevationDelta))

            cam.position.y = orbitTarget.y + Math.sin(newElevation) * distance
            const newHorizDist = Math.cos(newElevation) * distance
            const horizAngle = Math.atan2(toCamera.z, toCamera.x)
            cam.position.x = orbitTarget.x + Math.cos(horizAngle) * newHorizDist
            cam.position.z = orbitTarget.z + Math.sin(horizAngle) * newHorizDist
          }

          cam.lookAt(orbitTarget)
        } else {
          // Free movement mode
          cam.position.x += moveX
          cam.position.y += moveY
          cam.position.z += moveZ

          // Apply yaw rotation (Q/E turn)
          if (yawDelta !== 0) {
            const lookTarget = controls.target.clone()
            const camPos = cam.position.clone()
            const toTarget = lookTarget.sub(camPos)
            const angle = Math.atan2(toTarget.z, toTarget.x) + yawDelta
            const dist = Math.sqrt(toTarget.x * toTarget.x + toTarget.z * toTarget.z)
            controls.target.x = cam.position.x + Math.cos(angle) * dist
            controls.target.z = cam.position.z + Math.sin(angle) * dist
          } else {
            // Move lookAt target with camera
            controls.target.x += moveX
            controls.target.y += moveY
            controls.target.z += moveZ
          }
        }

        controls.update()
      }

      movementAnimationRef.current = requestAnimationFrame(updateMovement)
    }

    window.addEventListener('keydown', handleMovementKeyDown)
    window.addEventListener('keyup', handleMovementKeyUp)
    movementAnimationRef.current = requestAnimationFrame(updateMovement)

    return () => {
      window.removeEventListener('keydown', handleMovementKeyDown)
      window.removeEventListener('keyup', handleMovementKeyUp)
      if (movementAnimationRef.current) cancelAnimationFrame(movementAnimationRef.current)
    }
  }, [selectedNode, filteredGraphData.nodes])

  const selectedNodeInfo = useMemo(() => selectedNode ? allFiles[selectedNode] : null, [selectedNode, allFiles])

  // Track last click for double-click detection
  const lastClickRef = useRef<{ nodeId: string; time: number } | null>(null)

  const handleNodeClick = useCallback((node: GraphNode) => {
    if (!fgRef.current) return
    const now = Date.now()
    const lastClick = lastClickRef.current

    // Check for double-click (same node within 400ms)
    if (lastClick && lastClick.nodeId === node.id && now - lastClick.time < 400) {
      // Double-click: zoom to star
      const distance = 120, pos = { x: node.x || 0, y: node.y || 0, z: node.z || 0 }
      const shift = (160 / window.innerWidth) * 2 * distance * Math.tan(30 * Math.PI / 180)
      fgRef.current.cameraPosition({ x: pos.x + shift, y: pos.y + 30, z: pos.z + distance }, { x: pos.x + shift, y: pos.y, z: pos.z }, 1200)
      lastClickRef.current = null
    } else {
      // Single click: select as orbit anchor (toggle if same node)
      if (selectedNode === node.id) {
        setSelectedNode(null)
      } else {
        setSelectedNode(node.id)
        // Update orbit controls target to this node
        const controls = fgRef.current.controls()
        if (controls) {
          controls.target.set(node.x || 0, node.y || 0, node.z || 0)
          controls.update()
        }
      }
      lastClickRef.current = { nodeId: node.id, time: now }
    }
    onNodeClick?.(node.id)
  }, [onNodeClick, selectedNode])

  const handleNodeHover = useCallback((node: GraphNode | null) => {
    setHoverNode(node)
    document.body.style.cursor = node ? 'pointer' : 'default'
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => setHoverPos({ x: e.clientX, y: e.clientY })
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [])

  return (
    <div className="loom-container" ref={containerRef}>
      <div className="loom-ui-layer"> 

        {showIntroVideo && (
          <div
            className="intro-video-overlay"
            style={{ opacity: introVideoOpacity, transition: 'opacity 0.1s ease-out', cursor: 'pointer' }}
            onClick={skipIntro}
          >
            <video
              ref={videoRef}
              className="intro-video"
              src="/intro.mp4"
              autoPlay
              muted
              playsInline
              onEnded={handleVideoEnded}
              onError={skipIntro}
            />
          </div>
        )}
        
        {selectedNode && selectedNodeInfo && (
          <NodeInfoPanel
            nodeId={selectedNode}
            nodeInfo={selectedNodeInfo}
            fileType={fileTypes[selectedNode] || 'Unknown'}
            dependencyGraph={dependencyGraph}
            onNodeClick={onNodeClick}
            onClose={() => setSelectedNode(null)}
            panelSide={panelSide}
            setPanelSide={setPanelSide}
            legendMode={legendMode}
          />
        )}

        <div className={`loom-floating-controls ${selectedNode ? 'panel-open' : ''} panel-${panelSide}`}> 
          {/* Mission Toolbar */}
          <button className={`loom-btn ${activeMission === 'risk' ? 'loom-btn-active' : ''}`} onClick={() => onMissionChange?.(activeMission === 'risk' ? null : 'risk')}>Risk</button>
          <button className={`loom-btn ${activeMission === 'rot' ? 'loom-btn-active' : ''}`} onClick={() => onMissionChange?.(activeMission === 'rot' ? null : 'rot')}>Rot</button>
          <button className={`loom-btn ${activeMission === 'onboard' ? 'loom-btn-active' : ''}`} onClick={() => onMissionChange?.(activeMission === 'onboard' ? null : 'onboard')}>Onboard</button>
          <button className={`loom-btn ${activeMission === 'incident' ? 'loom-btn-active' : ''}`} onClick={() => onMissionChange?.(activeMission === 'incident' ? null : 'incident')}>Incident</button>
          <div className="loom-separator" style={{ width: '1px', height: '24px', background: 'rgba(255,255,255,0.2)', margin: '0 8px' }}></div>
          <button className={`loom-btn ${isFormationMode ? 'loom-btn-active' : ''}`} onClick={toggleFormationMode}>{isFormationMode ? 'Galaxy' : 'Formation'}</button>
          <button className={`loom-btn ${showExternal ? 'loom-btn-active' : ''}`} onClick={() => setShowExternal(!showExternal)}>External</button>
          <button className="loom-btn" onClick={resetToGodView}>Restore Horizon</button>
          <button className="loom-btn" onClick={resetCamera}>Reset View</button>
        </div>
        
        {hoverNode && (
          <div className="loom-hover-tooltip" style={{
            position: 'fixed', left: Math.min(Math.max(10, hoverPos.x < window.innerWidth / 2 ? hoverPos.x + 12 : hoverPos.x - 12), window.innerWidth - 220),
            top: Math.min(Math.max(10, hoverPos.y < window.innerHeight / 2 ? hoverPos.y + 15 : hoverPos.y - 50), window.innerHeight - 60),
            transform: hoverPos.x < window.innerWidth / 2 ? 'translateX(0)' : 'translateX(-100%)',
            background: 'rgba(0, 0, 0, 0.85)', border: '1px solid rgba(255, 255, 255, 0.2)', borderRadius: '4px', padding: '4px 8px', color: '#fff', fontSize: '11px', pointerEvents: 'none', zIndex: 1000
          }}>
            <div style={{ fontWeight: 500 }}>{hoverNode.id.split('/').pop()}</div>
            <div style={{ color: getProminentTrait(hoverNode.id).color }}>{getProminentTrait(hoverNode.id).label}</div>
          </div>
        )}

      </div>
      <ForceGraph3D
        ref={fgRef}
        controlType="orbit"
        width={containerSize.width}
        height={containerSize.height}
        graphData={filteredGraphData}
        nodeThreeObject={nodeThreeObject}
        nodeLabel={() => ''}
        linkColor={() => `rgba(${Math.min(255, 68 + linkOpacity * 90)}, ${Math.min(255, 136 + linkOpacity * 60)}, 255, ${Math.min(1, linkOpacity)})`}
        linkOpacity={linkOpacity}
        onNodeClick={handleNodeClick}
        onNodeHover={handleNodeHover}
        enableNavigationControls={true}
        enablePointerInteraction={true}
        enableNodeDrag={dragEnabled}
        showNavInfo={false}
      />
    </div>
  )
}