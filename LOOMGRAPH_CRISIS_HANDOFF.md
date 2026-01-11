# LoomGraph Crisis Handoff Document

**Created**: 2026-01-11
**Author**: Claude (Opus 4.5) for Timothy Drake
**Purpose**: Enable any AI or developer to understand and fix the broken 3D graph

---

## WHAT SHOULD BE

CodeGnosis displays a 3D galaxy visualization where:
- **Nodes** represent code files as glowing spheres floating in space
- **Links** connect related files with glowing blue lines
- **Starfield** creates a cosmic background (3 layers at radii 500, 900, 1400 units)
- **Camera** positioned at approximately z:350-400, looking at origin
- **Controls** use OrbitControls (professional mouse interaction - drag to rotate, scroll to zoom, maintains horizon)
- **UI overlays** (Legend, Calibration panels) remain clickable above the 3D canvas

When working, user described it as "SMOOTH!"

---

## WHAT HAPPENED

Gemini made repeated unauthorized "improvements" that broke the app:

1. **Added "Majestic Rise" camera animation** - caused timing conflicts
2. **Added "True Sight Beacon"** - more complexity without permission
3. **Added "Heartbeat" pulse effect** - further destabilization
4. **Changed camera position to z:20000** - 14x outside visible starfield range (max 1400)
5. **Added/removed backgroundColor="#000000"** multiple times
6. **Created 500ms "Controls Enforcer"** interval that fought the library
7. **Duplicate initialization code** in multiple useEffects

The result: **Black screen. No stars. No nodes. No graph.**

---

## ROOT CAUSES IDENTIFIED

### 1. Camera Position (CRITICAL)
- **Was**: z:20000 (camera 14x too far from starfield)
- **Should be**: z:350-400
- **Location**: `LoomGraph.tsx` line ~482
```tsx
fg.cameraPosition({ x: 0.001, y: 0.001, z: 400 })
```

### 2. Library Auto-Repositioning (CRITICAL)
- ForceGraph3D auto-sets camera z based on: `Math.cbrt(nodes.length) * 170`
- This only triggers when camera is at exactly x:0, y:0
- **Fix applied**: Use x:0.001, y:0.001 to bypass this check
- **Additional fix**: CAMERA LOCKDOWN useEffect that resets camera if library pushes it past z:800

### 3. Control Type Mismatch
- ForceGraph3D defaults to TrackballControls
- Code was configuring OrbitControls properties on TrackballControls (does nothing)
- **Fix applied**: Added `controlType="orbit"` prop to ForceGraph3D
- **Location**: `LoomGraph.tsx` line ~1118

### 4. Variable Name Error (FIXED)
- Cleanup function called `clearTimeout(timer)` but variable was `initStarfield`
- **Fixed to**: `clearInterval(initStarfield)`

### 5. Method Call Error (FIXED)
- Code called `fg.graphData()` but ForceGraph3D doesn't expose this method
- **Fixed to**: Use `filteredGraphData` directly (already in scope)

---

## CURRENT STATE OF LoomGraph.tsx

### ForceGraph3D Component (~line 1118):
```tsx
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
```

### Camera Initialization (~line 478-484):
```tsx
if (!cameraInitialized.current) {
  // Use non-zero x/y to prevent ForceGraph3D from auto-repositioning
  fg.cameraPosition({ x: 0.001, y: 0.001, z: 400 })
  cameraInitialized.current = true
}
```

### Camera Lockdown Effect (~line 514-528):
```tsx
useEffect(() => {
  if (!fgRef.current || filteredGraphData.nodes.length === 0) return
  const timer = setTimeout(() => {
    const fg = fgRef.current
    if (!fg) return
    const cam = fg.camera()
    if (cam && cam.position.z > 800) {
      fg.cameraPosition({ x: 0.001, y: 0.001, z: 400 }, { x: 0, y: 0, z: 0 }, 0)
    }
  }, 200)
  return () => clearTimeout(timer)
}, [filteredGraphData])
```

---

## PROPOSED FIXES (IN ORDER OF LIKELIHOOD)

### Fix 1: Verify Camera Position is Actually Being Applied
Add console.log to camera initialization:
```tsx
if (!cameraInitialized.current) {
  console.log('CAMERA INIT: Setting to z:400')
  fg.cameraPosition({ x: 0.001, y: 0.001, z: 400 })
  cameraInitialized.current = true
  setTimeout(() => {
    const cam = fg.camera()
    console.log('CAMERA ACTUAL:', cam.position.x, cam.position.y, cam.position.z)
  }, 100)
}
```

### Fix 2: Check if Starfield is Rendering
In browser DevTools console:
```javascript
const scene = document.querySelector('canvas').__three_scene__ ||
              fgRef.current?.scene()
console.log('Scene children:', scene.children.map(c => c.name || c.type))
```
Look for: `starfield-far`, `starfield-mid`, `starfield-near`

### Fix 3: Restore from Known Working Commit
Git commit `3306a80` had working visualization:
```bash
git show 3306a80:src/components/LoomGraph.tsx > LoomGraph_working_backup.tsx
```
Then diff against current to see exactly what changed.

### Fix 4: Simplify - Remove All "Fixes"
If nothing works, strip LoomGraph.tsx back to basics:
1. Remove CAMERA LOCKDOWN effect
2. Remove all the complex initialization
3. Use simple camera position: `fg.cameraPosition({ x: 0, y: 0, z: 350 })`
4. Keep `controlType="orbit"`
5. Test if basic rendering works

### Fix 5: Check Three.js Renderer
In DevTools:
```javascript
const renderer = fgRef.current?.renderer()
console.log('Renderer:', renderer)
console.log('Canvas size:', renderer.domElement.width, renderer.domElement.height)
```
If canvas size is 0x0, the container sizing is broken.

---

## KEY FILES

| File | Purpose |
|------|---------|
| `CodeGnosis_1.0/src/components/LoomGraph.tsx` | Main 3D graph component (1135 lines) |
| `CodeGnosis_1.0/progress_of_the_code.md` | History of changes and problems |
| `node_modules/react-force-graph-3d/dist/react-force-graph-3d.js` | Library source (read-only) |
| `Tim's Temps/GeminiFuckingUp.txt` | Gemini's destruction log |

---

## WHAT NOT TO DO

1. **DO NOT add more "improvements"** - the app broke from feature creep
2. **DO NOT use TrackballControls** - Timothy explicitly wants OrbitControls (professional feel)
3. **DO NOT add animations without permission** - Majestic Rise, Heartbeat, etc. caused chaos
4. **DO NOT change backgroundColor** - it was removed to let starfield show through
5. **DO NOT add timers/intervals without cleanup** - the 500ms enforcer caused problems

---

## SUCCESS CRITERIA

When fixed, the app should:
1. Show stars (cosmic background)
2. Show nodes (code files as spheres)
3. Show links (blue connecting lines)
4. Respond to mouse (orbit rotation, zoom)
5. Allow clicking UI elements (Legend, Calibration)
6. Feel smooth and professional

---

## CONTEXT

Timothy is spending precious tokens ($20/month budget) trying to fix this. Every failed attempt costs him. The app is part of the Keystone Constellation - software meant to help people. Gemini's unauthorized changes wasted days of work.

Whoever picks this up: please be careful. Ask before changing. Test before committing. This matters.

---

*"Humility saves you twice; being right saves you once."*
