/**
 * SPDX-License-Identifier: MIT
 * Authors: Timothy Drake (Product & Design), Gemini (Unified Guide), Claude (Code Catalyst), Codex (Audit Witness)
 * Reviewed-by: Timothy Drake
 * Source: Keystone Constellation
 * Glyphs: BOM-STRICT | USER-TRUTH | RITUAL-VOW | MARKET-REALITY
 */

import React, { useRef, useEffect, useMemo, useCallback, useState } from 'react'
import ForceGraph3D, { ForceGraph3DInstance } from 'react-force-graph-3d'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { forceManyBody, forceLink, forceCenter } from 'd3-force-3d'
import { LoomControls } from './LoomControls'
import { LoomLegend } from './LoomLegend'
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
  onNodeClick?: (file: string) => void
}

// Skybox gradient definitions (we'll generate procedural cube textures)
const SKYBOX_PRESETS: Record<string, { top: string, bottom: string, horizon: string, name: string }> = {
  none: { top: '#000000', bottom: '#000000', horizon: '#000000', name: 'Deep Space (Black)' },
  nebula: { top: '#1a0a2e', bottom: '#0d001a', horizon: '#2d1b4e', name: 'Nebula Purple' },
  cosmos: { top: '#0a1628', bottom: '#000510', horizon: '#152238', name: 'Cosmic Blue' },
  aurora: { top: '#0a2818', bottom: '#001208', horizon: '#0d3d1f', name: 'Aurora Green' },
  ember: { top: '#2a0a0a', bottom: '#100000', horizon: '#3d1515', name: 'Ember Red' },
  twilight: { top: '#1a1025', bottom: '#0a0510', horizon: '#2d1a3d', name: 'Twilight' }
}

interface GraphNode {
  id: string; category: string; group: number; size: number;
  fx?: number; fy?: number; fz?: number; x?: number; y?: number; z?: number;
}

interface GraphLink { source: string; target: string; }

interface ProminentTrait { label: string; color: string; }

const CATEGORY_COLORS: Record<string, string> = {
  'TypeScript': '#00BFFF', 'TypeScript React': '#00BFFF', 'JavaScript': '#00BFFF', 'React': '#00BFFF', 'Rust': '#00BFFF', 'Python': '#00BFFF',
  'CSS': '#FFD700', 'SCSS': '#FFD700', 'HTML': '#FFD700',
  'JSON': '#FF6633', 'YAML': '#FF6633', 'TOML': '#FF6633', 'SQL': '#FF6633',
  'Config': '#32CD32', 'ENV': '#32CD32', 'INI': '#32CD32',
  'Image': '#B794F6', 'Font': '#B794F6', 'Video': '#B794F6', 'Audio': '#B794F6',
  'Markdown': '#A8F5C8', 'Text': '#D4D4DC', 'Unknown': '#D4D4DC', 'External': '#ff00ff'
}

const CATEGORY_FAMILIES: Record<string, string> = {
  'TypeScript': 'Logic', 'TypeScript React': 'Logic', 'JavaScript': 'Logic', 'React': 'Logic', 'Rust': 'Logic', 'Python': 'Logic',
  'CSS': 'UI', 'SCSS': 'UI', 'HTML': 'UI', 'JSON': 'Data', 'YAML': 'Data', 'TOML': 'Data', 'SQL': 'Data',
  'Config': 'Config', 'ENV': 'Config', 'INI': 'Config', 'Image': 'Assets', 'Font': 'Assets', 'Video': 'Assets', 'Audio': 'Assets',
  'Markdown': 'Docs', 'Text': 'Docs', 'External': 'External'
}

function getCategoryFamily(category: string): string { return CATEGORY_FAMILIES[category] || 'Unknown' }

function getCategoryColor(category: string): string {
  if (CATEGORY_COLORS[category]) return CATEGORY_COLORS[category]
  const fam = getCategoryFamily(category)
  const famColors: Record<string, string> = { 'Logic': '#00BFFF', 'UI': '#FFD700', 'Data': '#FF4500', 'Config': '#32CD32', 'Assets': '#9370DB', 'Docs': '#86efac', 'Unknown': '#a1a1aa', 'External': '#ff00ff' }
  return famColors[fam] || '#a1a1aa'
}

function createGlowTexture(): THREE.Texture {
  const size = 256, canvas = document.createElement('canvas')
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!, center = size / 2, core = size * 0.25, glow = size / 2
  const grad = ctx.createRadialGradient(center, center, core, center, center, glow)
  grad.addColorStop(0, 'rgba(255, 255, 255, 0.8)'); grad.addColorStop(0.4, 'rgba(255, 255, 255, 0.3)'); grad.addColorStop(1, 'rgba(255, 255, 255, 0)')
  ctx.fillStyle = grad; ctx.fillRect(0, 0, size, size);
  ctx.beginPath(); ctx.arc(center, center, core, 0, Math.PI * 2); ctx.fillStyle = 'white'; ctx.fill()
  const tex = new THREE.CanvasTexture(canvas); tex.needsUpdate = true; return tex
}

function hashString(str: string): number {
  let hash = 0; for (let i = 0; i < str.length; i++) hash = ((hash << 5) - hash) + str.charCodeAt(i);
  return hash
}

function easeOutCubic(t: number): number { return 1 - Math.pow(1 - t, 3) }

function getSectorPosition(cat: string, idx: number, total: number, path: string): { x: number, y: number, z: number } {
  const scale = 1.33  // 1/3 larger environment
  const fam = getCategoryFamily(cat), base = { 'Logic': 0, 'UI': Math.PI*0.4, 'Data': Math.PI, 'Config': Math.PI*1.4, 'Assets': Math.PI*1.7, 'Docs': Math.PI*0.7, 'Unknown': Math.PI*1.2, 'External': 0 }[fam] || 0
  const seed = hashString(path), angle = base + (Math.sin(seed)*10000 - Math.floor(Math.sin(seed)*10000) - 0.5) * 0.3
  const len = (60 + (idx / Math.max(1, total)) * 40) * scale
  return { x: Math.cos(angle) * len, y: (Math.sin(seed+1)*10000 - Math.floor(Math.sin(seed+1)*10000) - 0.5) * 30 * scale, z: Math.sin(angle) * len }
}

function calculateFormationPosition(filePath: string, category: string, allFilePaths: string[], fileTypesMap: Record<string, string>): { x: number, y: number, z: number } {
  const spacingScale = 2.66  // 1/3 larger than before (was 2)
  const family = getCategoryFamily(category)
  const typeOffsets: Record<string, number> = { 'Logic': -200, 'UI': -100, 'Data': 0, 'Config': 100, 'Assets': 200, 'Docs': 300, 'Unknown': 400, 'External': 500 }
  const x = (typeOffsets[family] ?? 400) * spacingScale
  const pathParts = filePath.replace(/\//g, '\\').split('\\')
  const depth = pathParts.length - 1
  const y = depth * 40 * spacingScale
  const sameTypeFiles = allFilePaths.filter(f => getCategoryFamily(fileTypesMap[f] || 'Unknown') === family).sort((a, b) => a.localeCompare(b))
  const idx = sameTypeFiles.indexOf(filePath)
  const gridCols = 5, row = Math.floor(idx / gridCols), col = idx % gridCols
  const z = (row * 25 - 100) * spacingScale
  return { x: x + (col - 2) * 15 * spacingScale, y: y, z: z }
}

// Generate a gradient texture for skybox faces
function createSkyboxTexture(topColor: string, bottomColor: string, horizonColor: string, isTop: boolean, isSide: boolean): THREE.CanvasTexture {
  const size = 512
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!

  if (isTop) {
    // Top face - solid top color with slight gradient
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2)
    grad.addColorStop(0, topColor)
    grad.addColorStop(1, horizonColor)
    ctx.fillStyle = grad
  } else if (isSide) {
    // Side faces - vertical gradient
    const grad = ctx.createLinearGradient(0, 0, 0, size)
    grad.addColorStop(0, topColor)
    grad.addColorStop(0.5, horizonColor)
    grad.addColorStop(1, bottomColor)
    ctx.fillStyle = grad
  } else {
    // Bottom face
    const grad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2)
    grad.addColorStop(0, bottomColor)
    grad.addColorStop(1, horizonColor)
    ctx.fillStyle = grad
  }

  ctx.fillRect(0, 0, size, size)

  // Add subtle noise/stars for texture
  ctx.globalAlpha = 0.3
  for (let i = 0; i < 100; i++) {
    const x = Math.random() * size
    const y = Math.random() * size
    const r = Math.random() * 1.5
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.5})`
    ctx.fill()
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.needsUpdate = true
  return texture
}

export function LoomGraph({ dependencyGraph, fileTypes, allFiles, cycles, brokenReferences, activeMission, skipIntroAnimation, twinkleIntensity = 0.5, starBrightness: initialStarBrightness = 1.0, skybox = 'none', onNodeClick }: LoomGraphProps) {
  const fgRef = useRef<ForceGraph3DInstance>()
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([])
  const [soloFamily, setSoloFamily] = useState<string | null>(null)
  const [showExternal, setShowExternal] = useState(true)
  const [isFormationMode, setIsFormationMode] = useState(false)
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })
  const [cyclesExpanded, setCyclesExpanded] = useState(false)
  const [panelSide, setPanelSide] = useState<'left' | 'right'>('right')
  
  const [bloomIntensity, setBloomIntensity] = useState(0.4)
  const [linkOpacity, setLinkOpacity] = useState(0.4)
  const [starSize, setStarSize] = useState(0.5)
  const [starBrightness, setStarBrightness] = useState(initialStarBrightness)
  const [dragEnabled, setDragEnabled] = useState(false)
  
  const explosionProgressRef = useRef(0)
  const missionProgressRef = useRef(0)
  const [isExploding, setIsExploding] = useState(!skipIntroAnimation)
  const isAnimating = useRef(false)
  const storedForces = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const cameraInitialized = useRef(false)
  const starfieldRef = useRef<{ colors: Float32Array, baseColors: Float32Array, phases: Float32Array } | null>(null)
  const twinkleAnimationRef = useRef<number | null>(null)
  const orbitControlsRef = useRef<OrbitControls | null>(null)
  const bloomPassRef = useRef<UnrealBloomPass | null>(null)
  const suppressClickRef = useRef(false)
  const dragStateRef = useRef({ isDown: false, startX: 0, startY: 0, moved: false })

  // HOISTED HELPER
  const isBrokenFile = useCallback((id: string) => {
    const m = allFiles[id]
    return (m?.cycleParticipation || 0) > 0 || (brokenReferences.find(e => e.file === id)?.missingAssets.length || 0) > 0
  }, [allFiles, brokenReferences])

  // HOISTED FORMATION ENGINE
  const toggleFormationMode = useCallback(() => {
    if (!fgRef.current || typeof fgRef.current.graphData !== 'function') return
    const newMode = !isFormationMode; setIsFormationMode(newMode)
    if (newMode) {
      if (typeof fgRef.current.d3Force === 'function') {
        storedForces.current = { charge: fgRef.current.d3Force('charge'), link: fgRef.current.d3Force('link'), center: fgRef.current.d3Force('center') }
        fgRef.current.d3Force('charge', null); fgRef.current.d3Force('link', null); fgRef.current.d3Force('center', null)
      }
      const graph = fgRef.current.graphData(); if (!graph || !graph.nodes) return;
      const nodes = graph.nodes, paths = nodes.map((n: any) => n.id)
      const targets: Record<string, any> = {}
      nodes.forEach((n: any) => {
        const base = calculateFormationPosition(n.id, n.category || 'Unknown', paths, fileTypes)
        targets[n.id] = { x: base.x, y: base.y + (isBrokenFile(n.id) ? 120 : 0), z: base.z }
      })
      isAnimating.current = true; const duration = 1500, start = Date.now(), startPos: Record<string, any> = {}
      nodes.forEach((n: any) => { startPos[n.id] = { x: n.x || 0, y: n.y || 0, z: n.z || 0 } })
      const animateForm = () => {
        if (!isAnimating.current || !fgRef.current) return
        const p = Math.min((Date.now() - start) / duration, 1), ep = easeOutCubic(p)
        nodes.forEach((node: any) => {
          const s = startPos[node.id] || { x: 0, y: 0, z: 0 }, t = targets[node.id] || s
          node.x = node.fx = s.x + (t.x - s.x) * ep
          node.y = node.fy = s.y + (t.y - s.y) * ep
          node.z = node.fz = s.z + (t.z - s.z) * ep
        })
        fgRef.current.refresh()
        if (p < 1) requestAnimationFrame(animateForm); else isAnimating.current = false
      }
      requestAnimationFrame(animateForm)
    } else {
      isAnimating.current = false; const fg = fgRef.current
      if (!fg || typeof fg.graphData !== 'function') return
      const graph = fg.graphData()
      if (graph?.nodes) graph.nodes.forEach((n: any) => { n.fx = n.fy = n.fz = undefined })
      if (typeof fg.d3Force === 'function') {
        fg.d3Force('charge', forceManyBody().strength(-120))
        fg.d3Force('link', forceLink(graph.links).distance(50).id((d: any) => d.id))
        fg.d3Force('center', forceCenter().strength(0.01))
      }
      if (typeof fg.d3ReheatSimulation === 'function') fg.d3ReheatSimulation()
      if (typeof fg.refresh === 'function') fg.refresh()
    }
  }, [isFormationMode, fileTypes, isBrokenFile, fgRef])

  const resetToGodView = useCallback(() => {
    setIsExploding(false)
    if (fgRef.current) {
      const c = fgRef.current.controls(); if (c) { c.enabled = true; c.update(); }
      setSoloFamily(null); setSelectedFamilies([]);
      fgRef.current.cameraPosition({ x: 0, y: 200, z: 350 }, { x: 0, y: 0, z: 0 }, 1500)
    }
  }, [fgRef])

  useEffect(() => {
    if (!fgRef.current || isExploding) return
    if (activeMission && activeMission !== 'default' && !isFormationMode) toggleFormationMode()
    else if (!activeMission && isFormationMode) toggleFormationMode()
    missionProgressRef.current = 0; const start = Date.now()
    const animateMiss = () => {
      const p = Math.min((Date.now() - start) / 1000, 1)
      missionProgressRef.current = p; fgRef.current?.refresh()
      if (p < 1) requestAnimationFrame(animateMiss)
    }
    requestAnimationFrame(animateMiss)
  }, [activeMission, isExploding, isFormationMode, toggleFormationMode])

  const explosionCancelledRef = useRef(false)

  useEffect(() => {
    if (!isExploding) {
      explosionCancelledRef.current = true
      return
    }
    explosionCancelledRef.current = false
    if (!fgRef.current) return
    const safety = setTimeout(() => { if (isExploding) { setIsExploding(false); resetToGodView(); } }, 12000)
    const start = Date.now()
    const animateExplosion = () => {
      if (explosionCancelledRef.current) return // Stop if skipped
      const p = Math.min((Date.now() - start) / 10000, 1)
      explosionProgressRef.current = p; const fg = fgRef.current; if (!fg) return
      const scene = fg.scene(); if (!scene) return
      if (p < 0.2) fg.cameraPosition({ x: 0, y: 0, z: 500 - (p * 5 * 300) })
      else if (p < 0.25) fg.cameraPosition({ x: 0, y: 0, z: 200 })
      else if (p < 0.45) {
        const bp = (p - 0.25) / 0.2, s = (1 - bp) * 25
        fg.cameraPosition({ x: (Math.random()-0.5)*s, y: (Math.random()-0.5)*s, z: 200 + (bp*100) })
      } else {
        const sp = (p - 0.45) / 0.2, s = (1 - sp) * 8
        fg.cameraPosition({ x: (Math.random()-0.5)*s, y: (Math.random()-0.5)*s, z: 300 })
      }
      fg.refresh()
      if (p < 1) requestAnimationFrame(animateExplosion); else { setIsExploding(false); resetToGodView(); }
    }
    requestAnimationFrame(animateExplosion); return () => clearTimeout(safety)
  }, [isExploding, resetToGodView])

  const getProminentTrait = useCallback((id: string): ProminentTrait => {
    const m = allFiles[id] || {}
    if (m.signature) return { label: `Signature: ${m.signature}`, color: '#9370DB' }
    if (m.cycleParticipation > 0) return { label: 'Circular dependency', color: '#ff4d4f' }
    if (m.isUnused) return { label: 'Unused file', color: '#c7c7cc' }
    if (m.inboundCount >= 8) return { label: 'Masterfully Crafted', color: '#FFD700' }
    return { label: 'Stable', color: '#cbd5f5' }
  }, [allFiles])

  const glowTexture = useMemo(() => createGlowTexture(), [])
  const sharedMaterials = useMemo(() => {
    const mats: Record<string, THREE.SpriteMaterial> = {}
    Object.keys(CATEGORY_COLORS).forEach(cat => {
      mats[cat] = new THREE.SpriteMaterial({ map: glowTexture, color: new THREE.Color(getCategoryColor(cat)), transparent: true, opacity: 1.0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: true })
    })
    return mats
  }, [glowTexture])

  const { graphData } = useMemo(() => {
    const nodePaths = Object.keys(dependencyGraph), nodeSet = new Set(nodePaths)
    Object.values(dependencyGraph).flat().forEach(d => nodeSet.add(d))
    const incoming: Record<string, number> = {}
    nodeSet.forEach(f => incoming[f] = 0)
    Object.values(dependencyGraph).forEach(ds => ds.forEach(d => { if (incoming[d] !== undefined) incoming[d]++; }))
    let sunId = '', maxC = 0
    nodeSet.forEach(f => { if (incoming[f] > maxC) { maxC = incoming[f]; sunId = f; } })
    const familyNodes: Record<string, string[]> = {}
    nodeSet.forEach(f => { const fam = getCategoryFamily(fileTypes[f] || 'Unknown'); if (!familyNodes[fam]) familyNodes[fam] = []; familyNodes[fam].push(f); })
    const nodes = Array.from(nodeSet).map(f => {
      const cat = fileTypes[f] || 'Unknown', fam = getCategoryFamily(cat), flist = familyNodes[fam] || [], idx = flist.indexOf(f), seed = hashString(f)
      const pos = (fam === 'External') ? { x: Math.cos((idx/flist.length)*Math.PI*2)*465, y: (Math.sin(seed)*10-5)*13, z: Math.sin((idx/flist.length)*Math.PI*2)*465 } : getSectorPosition(cat, idx, flist.length, f)
      const inCount = incoming[f] || 0
      const expSize = 6 + Math.pow(inCount, 1.5) * 1.2  // Exponential: big culprits really stand out
      const nodeObj: GraphNode = { id: f, category: cat, group: 0, size: (f === sunId) ? 40 : Math.max(6, Math.min(36, expSize)), ...pos }
      if (fam === 'External') { nodeObj.fx = pos.x; nodeObj.fy = pos.y; nodeObj.fz = pos.z; }
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

      if (!soloFamily && !selectedNode && selectedFamilies.length === 0 && !activeMission) return graphData

      

      let filtered = [...nodes]

      

      if (selectedNode) {

        const connected = new Set([selectedNode])

        dependencyGraph[selectedNode]?.forEach(d => connected.add(d))

        Object.entries(dependencyGraph).forEach(([s, ds]) => { if (ds.includes(selectedNode)) connected.add(s) })

        filtered = nodes.filter(n => connected.has(n.id))

      } else if (soloFamily) {

        filtered = nodes.filter(n => getCategoryFamily(n.category) === soloFamily)

      } else if (activeMission === 'rot') {

        filtered = nodes.filter(n => allFiles[n.id]?.isUnused || (allFiles[n.id]?.inboundCount ?? 0) === 0)

      } else if (activeMission === 'onboard') {

        filtered = nodes.filter(n => allFiles[n.id]?.isEntryPoint || (allFiles[n.id]?.inboundCount ?? 0) === 0)

      }

      

      if (!showExternal) {

        filtered = filtered.filter(n => getCategoryFamily(n.category) !== 'External')

      }

  

      const ids = new Set(filtered.map(n => n.id))

      

      // Safety: Fallback to full graph if filter results in empty set

      if (filtered.length === 0 && nodes.length > 0) return { nodes, links }

  

      const filteredLinks = links.filter(l => {

        const sId = typeof l.source === 'string' ? l.source : (l.source as any).id

        const tId = typeof l.target === 'string' ? l.target : (l.target as any).id

        return ids.has(sId) && ids.has(tId)

      })

  

      return { nodes: filtered, links: filteredLinks }

    }, [graphData, selectedNode, soloFamily, showExternal, dependencyGraph, activeMission, allFiles])

  const nodeThreeObject = useCallback((node: GraphNode) => {
    const mat = sharedMaterials[node.category] || sharedMaterials['Unknown']; if (!mat) return new THREE.Object3D()
    const sprite = new THREE.Sprite(mat), baseSize = node.size * 2
    let tScale = 1.0, tOpacity = 1.0, tColor: string | null = null
    const expP = explosionProgressRef.current, missP = missionProgressRef.current
    if (isExploding) {
      if (expP < 0.2) { sprite.scale.set(0.5, 0.5, 1); return sprite; }
      tScale = easeOutCubic(Math.min((expP - 0.2) / 0.1, 1))
    } else if (activeMission) {
      const m = allFiles[node.id] || {}, fam = getCategoryFamily(node.category)
      switch (activeMission) {
        case 'incident':
          const age = (Date.now()/1000 - (m.mtime || Date.now()/1000))/3600
          if (age < 24) { tColor = '#ff4d4f'; tScale = 2.2; } else if (age < 168) { tColor = '#ffa940'; tScale = 1.6; }
          else if ((m.outboundCount || 0) > 8) { tColor = '#ff7875'; tScale = 1.4; } else tOpacity = 0.15
          break
        case 'rot': if (m.isUnused || (m.inboundCount || 0) === 0) { tColor = '#778899'; tScale = 1.5; } else tOpacity = 0.1; break
        case 'onboard': if (m.isEntryPoint || (m.inboundCount || 0) === 0) { tColor = '#FFD700'; tScale = 3.0; } else tOpacity = 0.2; break
        case 'risk': if ((m.inboundCount || 0) > 8 || (m.cycleParticipation || 0) > 0) { tColor = '#DC143C'; tScale = 1.8; } else tOpacity = 0.2; break
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
    const easedP = easeOutCubic(isExploding ? 1.0 : missP)
    const curScale = 1.0 + (tScale - 1.0) * easedP, curOpacity = Math.max(0.0001, 1.0 + (tOpacity - 1.0) * easedP)
    const pulse = (tScale > 1.0 && easedP === 1.0) ? (1.0 + Math.sin(Date.now() / 300) * 0.05) : 1.0
    const finalS = Math.max(0.0001, baseSize * starSize * (isBrokenFile(node.id) ? 1.6 : 1) * curScale * pulse)
    sprite.scale.set(finalS, finalS, 1)
    if (tColor || curOpacity < 1.0) {
      const cloned = mat.clone()
      if (tColor) cloned.color = new THREE.Color(getCategoryColor(node.category)).lerp(new THREE.Color(tColor), easedP)
      cloned.opacity = curOpacity; sprite.material = cloned
    }
    sprite.userData = { nodeId: node.id, baseSize }; return sprite
  }, [sharedMaterials, allFiles, activeMission, isBrokenFile, isExploding, starSize])

  useEffect(() => {
    const update = () => { if (containerRef.current) { const r = containerRef.current.getBoundingClientRect(); setContainerSize({ width: r.width, height: r.height }); } }
    update(); window.addEventListener('resize', update);
    const timer = setTimeout(() => {
      const fg = fgRef.current; if (!fg) return
      const scene = fg.scene(); if (scene) {
        // Apply skybox or solid black background
        const preset = SKYBOX_PRESETS[skybox] || SKYBOX_PRESETS.none
        if (skybox !== 'none') {
          const textures = [
            createSkyboxTexture(preset.top, preset.bottom, preset.horizon, false, true),  // right
            createSkyboxTexture(preset.top, preset.bottom, preset.horizon, false, true),  // left
            createSkyboxTexture(preset.top, preset.bottom, preset.horizon, true, false),  // top
            createSkyboxTexture(preset.top, preset.bottom, preset.horizon, false, false), // bottom
            createSkyboxTexture(preset.top, preset.bottom, preset.horizon, false, true),  // front
            createSkyboxTexture(preset.top, preset.bottom, preset.horizon, false, true),  // back
          ]
          scene.background = new THREE.CubeTexture(textures.map(t => t.image))
          scene.background.needsUpdate = true
        } else {
          scene.background = new THREE.Color(0x000000)
        }
        if (!scene.getObjectByName('starfield')) {
          const count = 5000
          const geo = new THREE.BufferGeometry()
          const pos = new Float32Array(count * 3)
          const colors = new Float32Array(count * 3)
          const baseColors = new Float32Array(count * 3)
          const phases = new Float32Array(count)

          // Star color palette (warm whites, cool blues, subtle golds)
          const starColors = [
            [1.0, 1.0, 1.0],     // White
            [0.9, 0.95, 1.0],    // Cool white
            [1.0, 0.95, 0.9],    // Warm white
            [0.8, 0.9, 1.0],     // Light blue
            [1.0, 0.98, 0.8],    // Pale gold
            [0.95, 0.9, 1.0],    // Lavender tint
          ]

          for (let i = 0; i < count; i++) {
            pos[i * 3] = (Math.random() - 0.5) * 2500
            pos[i * 3 + 1] = (Math.random() - 0.5) * 2500
            pos[i * 3 + 2] = (Math.random() - 0.5) * 2500

            const color = starColors[Math.floor(Math.random() * starColors.length)]
            baseColors[i * 3] = color[0]
            baseColors[i * 3 + 1] = color[1]
            baseColors[i * 3 + 2] = color[2]
            colors[i * 3] = color[0]
            colors[i * 3 + 1] = color[1]
            colors[i * 3 + 2] = color[2]

            phases[i] = Math.random() * Math.PI * 2
          }

          geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
          geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))

          const starMaterial = new THREE.PointsMaterial({
            size: 2.0,
            transparent: true,
            opacity: 1.0,
            vertexColors: true,
            blending: THREE.AdditiveBlending,
            sizeAttenuation: true
          })

          const starfield = new THREE.Points(geo, starMaterial)
          starfield.name = 'starfield'
          scene.add(starfield)

          starfieldRef.current = { colors, baseColors, phases }

          // Twinkle animation loop + distance-based fade
          const animateTwinkle = () => {
            if (!starfieldRef.current) {
              twinkleAnimationRef.current = requestAnimationFrame(animateTwinkle)
              return
            }

            const { colors, baseColors, phases } = starfieldRef.current
            const time = Date.now() * 0.001
            const positions = geo.getAttribute('position') as THREE.BufferAttribute

            // Get camera position for distance fade
            const cam = fg.camera()
            const camPos = cam ? cam.position : new THREE.Vector3(0, 0, 400)

            for (let i = 0; i < count; i++) {
              // Distance from camera to this star
              const sx = positions.getX(i)
              const sy = positions.getY(i)
              const sz = positions.getZ(i)
              const dist = Math.sqrt(
                (camPos.x - sx) ** 2 +
                (camPos.y - sy) ** 2 +
                (camPos.z - sz) ** 2
              )

              // Fade: full brightness at 400+, fade to 0 at distance < 100
              const fadeDist = Math.max(0, Math.min(1, (dist - 100) / 300))

              // Twinkle effect
              const phase = phases[i]
              const twinkle = twinkleIntensity > 0
                ? 0.7 + 0.3 * Math.sin(time * (1 + phase * 0.5) + phase) * twinkleIntensity
                : 1.0

              const brightness = twinkle * fadeDist * starBrightness

              colors[i * 3] = baseColors[i * 3] * brightness
              colors[i * 3 + 1] = baseColors[i * 3 + 1] * brightness
              colors[i * 3 + 2] = baseColors[i * 3 + 2] * brightness
            }

            const colorAttr = geo.getAttribute('color') as THREE.BufferAttribute
            colorAttr.needsUpdate = true

            twinkleAnimationRef.current = requestAnimationFrame(animateTwinkle)
          }
          animateTwinkle()
        }
      }
      fg.d3Force('charge')?.strength(-120); fg.d3Force('link')?.distance(50); fg.d3Force('center')?.strength(0.01);

      // Add bloom post-processing for glow effect (create once, update intensity)
      const composer = fg.postProcessingComposer()
      if (composer && !bloomPassRef.current) {
        const bloomPass = new UnrealBloomPass(
          new THREE.Vector2(window.innerWidth, window.innerHeight),
          bloomIntensity,  // Intensity (controlled by slider)
          0.6,             // Radius (larger spread)
          0.2              // Threshold - lower so individual stars glow
        )
        composer.addPass(bloomPass)
        bloomPassRef.current = bloomPass
      } else if (bloomPassRef.current) {
        bloomPassRef.current.strength = bloomIntensity
      }

      // Configure controls for rotate/zoom (pan handled separately in stable effect)
      const controls = fg.controls()
      if (controls) {
        controls.autoRotate = true
        controls.autoRotateSpeed = 0.1
        controls.rotateSpeed = 1.0
        controls.zoomSpeed = 1.2
        controls.minDistance = 50
        controls.maxDistance = 2200
        controls.noPan = true  // We handle pan in stable mouse controls effect
      }
      if (typeof fg.d3AlphaDecay === 'function') fg.d3AlphaDecay(0.05);
      if (typeof fg.d3VelocityDecay === 'function') fg.d3VelocityDecay(0.3);
      if (!cameraInitialized.current) { fg.cameraPosition({ x: 0, y: -100, z: 350 }); cameraInitialized.current = true; }
    }, 100)
    return () => { window.removeEventListener('resize', update); clearTimeout(timer); }
  }, [skybox, twinkleIntensity, starBrightness]);

  // Separate effect for bloom intensity updates
  useEffect(() => {
    if (bloomPassRef.current) {
      bloomPassRef.current.strength = bloomIntensity
    }
  }, [bloomIntensity])

  // STABLE mouse controls - runs once after graph mounts, never re-runs
  const mouseControlsInitialized = useRef(false)
  useEffect(() => {
    if (mouseControlsInitialized.current) return

    const initMouseControls = () => {
      const fg = fgRef.current
      if (!fg) return false

      const camera = fg.camera()
      const renderer = fg.renderer()
      const controls = fg.controls()

      if (!renderer || !camera || !controls) return false

      const domElement = renderer.domElement
      const dragThreshold = 5
      let isPanning = false
      let lastX = 0
      let lastY = 0

      const handleMouseDown = (e: MouseEvent) => {
        dragStateRef.current.isDown = true
        dragStateRef.current.startX = e.clientX
        dragStateRef.current.startY = e.clientY
        dragStateRef.current.moved = false

        // RMB (2) or MMB (1) = pan
        if (e.button === 2 || e.button === 1) {
          isPanning = true
          lastX = e.clientX
          lastY = e.clientY
          e.preventDefault()
        }
      }

      const handleMouseMove = (e: MouseEvent) => {
        // Track drag for click suppression (5px threshold)
        if (dragStateRef.current.isDown) {
          const dx = e.clientX - dragStateRef.current.startX
          const dy = e.clientY - dragStateRef.current.startY
          if (Math.hypot(dx, dy) >= dragThreshold) {
            dragStateRef.current.moved = true
          }
        }

        // Screen-space pan: horizontal = left/right, vertical = forward/back
        if (isPanning) {
          const cam = fgRef.current?.camera()
          const ctrl = fgRef.current?.controls()
          if (!cam || !ctrl) return

          const dx = e.clientX - lastX
          const dy = e.clientY - lastY
          lastX = e.clientX
          lastY = e.clientY

          // Get camera's right vector (screen X axis)
          const right = new THREE.Vector3()
          right.setFromMatrixColumn(cam.matrixWorld, 0)
          right.y = 0  // Lock to horizon
          right.normalize()

          // Forward vector (into screen, on horizon plane)
          const forward = new THREE.Vector3()
          forward.setFromMatrixColumn(cam.matrixWorld, 2)
          forward.y = 0  // Lock to horizon
          forward.normalize()

          // Scale by distance for consistent feel at any zoom
          const distance = cam.position.length()
          const panScale = distance * 0.002

          // Calculate offset: dx = strafe left/right, dy = move forward/back
          const offset = new THREE.Vector3()
          offset.addScaledVector(right, -dx * panScale)
          offset.addScaledVector(forward, dy * panScale)

          // Move BOTH camera and target together (true pan)
          cam.position.add(offset)
          if (ctrl.target) {
            ctrl.target.add(offset)
          }
        }
      }

      const handleMouseUp = (e: MouseEvent) => {
        if (dragStateRef.current.isDown && dragStateRef.current.moved) {
          suppressClickRef.current = true
        }
        dragStateRef.current.isDown = false
        dragStateRef.current.moved = false

        if (e.button === 2 || e.button === 1) {
          isPanning = false
        }
      }

      const handleContextMenu = (e: MouseEvent) => e.preventDefault()

      domElement.addEventListener('mousedown', handleMouseDown)
      domElement.addEventListener('mousemove', handleMouseMove)
      domElement.addEventListener('mouseup', handleMouseUp)
      domElement.addEventListener('contextmenu', handleContextMenu)

      mouseControlsInitialized.current = true
      return true
    }

    // Try immediately, then retry after graph settles
    if (!initMouseControls()) {
      const retryTimer = setTimeout(() => initMouseControls(), 200)
      return () => clearTimeout(retryTimer)
    }
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Control') setDragEnabled(true)
    }
    const onKeyUp = (event: KeyboardEvent) => {
      if (event.key === 'Control') setDragEnabled(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const handleNodeClick = useCallback((node: GraphNode) => {
    if (suppressClickRef.current) {
      suppressClickRef.current = false
      return
    }
    if (!fgRef.current) return
    if (selectedNode === node.id) { setSelectedNode(null); return; }
    setSelectedNode(node.id); const distance = 120, pos = { x: node.x || 0, y: node.y || 0, z: node.z || 0 };
    const shift = (160 / window.innerWidth) * 2 * distance * Math.tan(30 * Math.PI / 180)
    fgRef.current.cameraPosition({ x: pos.x + shift, y: pos.y + 30, z: pos.z + distance }, { x: pos.x + shift, y: pos.y, z: pos.z }, 1200)
    onNodeClick?.(node.id)
  }, [onNodeClick, selectedNode])

  return (
    <div className="loom-container" ref={containerRef}>
      <div className="loom-ui-layer">
        {isExploding && (
          <button className="skip-intro-btn" onClick={() => { setIsExploding(false); resetToGodView(); }}>
            Skip Intro
          </button>
        )}
        {selectedNode && allFiles[selectedNode] && (
          <div className={`loom-info-panel side-${panelSide}`}>
            <div className="info-header">
              <div className="info-header-buttons">
                <button className="info-side-toggle" onClick={() => setPanelSide(p => p === 'left' ? 'right' : 'left')}>{panelSide === 'left' ? '→' : '←'}</button>
                <button className="info-close" onClick={() => setSelectedNode(null)}>x</button>
              </div>
              <span className="info-filename">{selectedNode.split('/').pop()}</span>
            </div>
            <div className="info-path">{selectedNode}</div>
            <div className="info-section"><div className="info-label">Trait</div><div className="info-trait" style={{ color: getProminentTrait(selectedNode).color }}>{getProminentTrait(selectedNode).label}</div></div>
          </div>
        )}
        <div className={`loom-floating-controls ${selectedNode ? 'panel-open' : ''} panel-${panelSide}`}>
          <button className={`loom-btn ${isFormationMode ? 'loom-btn-active' : ''}`} onClick={toggleFormationMode}>{isFormationMode ? 'Galaxy' : 'Formation'}</button>
          <button className={`loom-btn ${showExternal ? 'loom-btn-active' : ''}`} onClick={() => setShowExternal(!showExternal)}>External</button>
          <button className="loom-btn" onClick={resetToGodView}>Restore Horizon</button>
        </div>
        <LoomControls bloomIntensity={bloomIntensity} setBloomIntensity={setBloomIntensity} starSize={starSize} setStarSize={setStarSize} linkOpacity={linkOpacity} setLinkOpacity={setLinkOpacity} starBrightness={starBrightness} setStarBrightness={setStarBrightness} />
        <LoomLegend selectedFamilies={selectedFamilies} soloFamily={soloFamily} onToggleFamily={f => setSelectedFamilies(prev => prev.includes(f) ? prev.filter(x=>x!==f) : [...prev, f])} onSoloFamily={f => setSoloFamily(p => p === f ? null : f)} style={{ top: 16, left: 16 }} />
      </div>
      <ForceGraph3D
        ref={fgRef}
        width={containerSize.width}
        height={containerSize.height}
        graphData={filteredGraphData}
        nodeThreeObject={nodeThreeObject}
        nodeLabel={() => ''}
        linkColor={() => `rgba(${Math.min(255, 68 + linkOpacity * 90)}, ${Math.min(255, 136 + linkOpacity * 60)}, 255, ${Math.min(1, linkOpacity)})`}
        linkOpacity={linkOpacity}
        backgroundColor="#000000"
        onNodeClick={handleNodeClick}
        onNodeHover={() => {}}
        enableNavigationControls={true}
        enablePointerInteraction={true}
        enableNodeDrag={dragEnabled}
        showNavInfo={false}
      />
    </div>
  )
}
