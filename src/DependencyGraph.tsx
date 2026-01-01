import { useCallback, useMemo, useState, useRef, useEffect } from 'react'
import { invoke } from '@tauri-apps/api/core'
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
  useOnViewportChange,
  getNodesBounds,
  Viewport,
} from 'reactflow'
import 'reactflow/dist/style.css'

interface DependencyGraphProps {
  dependencyGraph: Record<string, string[]>
  fileTypes: Record<string, string>
  allFiles: Record<string, any>
  projectPath: string
}

const FILE_TYPE_COLORS: Record<string, string> = {
  // Languages
  'Python': '#3776AB',
  'JavaScript': '#F7DF1E',
  'TypeScript': '#3178C6',
  'React': '#61DAFB',
  'TypeScript React': '#61DAFB',
  'HTML': '#E34F26',
  'CSS': '#1572B6',
  'SCSS': '#CC6699',
  'SASS': '#CC6699',
  'Less': '#1D365D',
  'JSON': '#292929',
  'YAML': '#CB171E',
  'TOML': '#9C4121',
  'XML': '#F16529',
  'Markdown': '#083FA1',
  'Rust': '#DEA584',
  'Go': '#00ADD8',
  'Java': '#ED8B00',
  'C#': '#239120',
  'C++': '#00599C',
  'C': '#A8B9CC',
  'C/C++ Header': '#5C8DBC',
  'Header': '#5C8DBC',
  'PHP': '#777BB4',
  'Ruby': '#CC342D',
  'SQL': '#E38C00',
  'Shell': '#4EAA25',
  'Bash/Shell': '#4EAA25',
  'PowerShell': '#012456',
  'Batch': '#C1F12E',
  'Kotlin': '#7F52FF',
  'Swift': '#FA7343',
  'Dart': '#0175C2',
  'Scala': '#DC322F',
  'Perl': '#39457E',
  'Lua': '#000080',
  'R': '#276DC3',

  // Images & Graphics
  'Image': '#8E44AD',
  'PNG': '#8E44AD',
  'JPG': '#8E44AD',
  'JPEG': '#8E44AD',
  'GIF': '#8E44AD',
  'WebP': '#8E44AD',
  'SVG': '#FFB13B',
  'Icon': '#9B59B6',
  'ICO': '#9B59B6',
  'BMP': '#8E44AD',
  'TIFF': '#8E44AD',
  'PSD': '#31A8FF',       // Photoshop
  'XCF': '#7B7B7B',       // GIMP
  'AI': '#FF9A00',        // Illustrator
  'EPS': '#FF9A00',
  'RAW': '#8E44AD',
  'HEIC': '#8E44AD',
  'AVIF': '#8E44AD',

  // Video
  'Video': '#E74C3C',
  'MP4': '#E74C3C',
  'WebM': '#E74C3C',
  'AVI': '#E74C3C',
  'MOV': '#E74C3C',
  'MKV': '#E74C3C',

  // Audio
  'Audio': '#1DB954',
  'MP3': '#1DB954',
  'WAV': '#1DB954',
  'FLAC': '#1DB954',
  'OGG': '#1DB954',
  'AAC': '#1DB954',

  // Fonts
  'Font': '#F39C12',
  'TTF': '#F39C12',
  'OTF': '#F39C12',
  'WOFF': '#F39C12',
  'WOFF2': '#F39C12',
  'EOT': '#F39C12',

  // Documents
  'Document': '#2980B9',
  'PDF': '#FF0000',
  'DOC': '#2B579A',
  'DOCX': '#2B579A',
  'Spreadsheet': '#217346',
  'XLSX': '#217346',
  'CSV': '#217346',
  'Text': '#95A5A6',

  // Config & Data
  'Config': '#95A5A6',
  'ENV': '#ECD53F',
  'INI': '#95A5A6',
  'Source Map': '#607D8B',

  // Archives
  'Archive': '#F1C40F',
  'ZIP': '#F1C40F',
  'TAR': '#F1C40F',
  'GZ': '#F1C40F',
  '7Z': '#F1C40F',
  'RAR': '#F1C40F',

  // Other
  'Executable': '#E74C3C',
  'Database': '#336791',
  'SQLite': '#003B57',
  'Graphviz': '#E535AB',
  'CoffeeScript': '#244776',
  'Unfamiliar': '#E74C3C',
  'Default': '#999999',
}

// Draggable, Resizable Legend Component
interface LegendProps {
  fileTypes: Record<string, string>
  highlightedTypes: Set<string>
  onToggleType: (type: string) => void
}

function DraggableLegend({ fileTypes, highlightedTypes, onToggleType }: LegendProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [position, setPosition] = useState({ x: 10, y: 10 })
  const [size, setSize] = useState({ width: 180, height: 0 }) // height 0 = auto
  const [isDragging, setIsDragging] = useState(false)
  const [hasDragged, setHasDragged] = useState(false) // Track if actual drag occurred
  const [isResizing, setIsResizing] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const dragStart = useRef({ x: 0, y: 0 }) // Track start position for threshold
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 })
  const legendRef = useRef<HTMLDivElement>(null)
  const DRAG_THRESHOLD = 4 // pixels before considered a drag

  // Get unique file types present in this graph
  const presentTypes = useMemo(() => {
    const types = new Set(Object.values(fileTypes))
    return Array.from(types).sort()
  }, [fileTypes])

  // Calculate optimal initial size to fit all items
  const itemHeight = 24 // approx height per item
  const headerHeight = 40
  const padding = 16
  const optimalHeight = Math.min(400, presentTypes.length * itemHeight + headerHeight + padding)

  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't drag if clicking the collapse button or resize handle
    if ((e.target as HTMLElement).closest('.legend-collapse-btn')) return
    if ((e.target as HTMLElement).closest('.legend-resize-handle')) return

    setIsDragging(true)
    setHasDragged(false) // Reset drag detection
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    }
    dragStart.current = { x: e.clientX, y: e.clientY }
  }

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation()
    setIsResizing(true)
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height || optimalHeight
    }
  }

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        // Check if we've exceeded the drag threshold
        const dx = Math.abs(e.clientX - dragStart.current.x)
        const dy = Math.abs(e.clientY - dragStart.current.y)
        if (dx > DRAG_THRESHOLD || dy > DRAG_THRESHOLD) {
          setHasDragged(true)
        }
        setPosition({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y
        })
      }
      if (isResizing) {
        const deltaX = e.clientX - resizeStart.current.x
        const deltaY = e.clientY - resizeStart.current.y
        setSize({
          width: Math.max(150, resizeStart.current.width + deltaX),
          height: Math.max(100, resizeStart.current.height + deltaY)
        })
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      setIsResizing(false)
    }

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, isResizing])

  // Calculate columns based on width
  const columnWidth = 140
  const numColumns = Math.max(1, Math.floor(size.width / columnWidth))

  return (
    <div
      ref={legendRef}
      onMouseDown={handleMouseDown}
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        zIndex: 9999,
        background: 'rgba(30, 30, 30, 0.95)',
        border: '1px solid var(--aeth-border)',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
        cursor: isDragging ? 'grabbing' : 'grab',
        userSelect: 'none',
        width: isCollapsed ? '120px' : size.width,
        transition: isCollapsed ? 'width 0.2s ease' : 'none'
      }}
    >
      {/* Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.5rem 0.75rem',
        borderBottom: isCollapsed ? 'none' : '1px solid var(--aeth-border)',
        fontSize: '0.85rem',
        fontWeight: 'bold'
      }}>
        <span>Legend ({presentTypes.length})</span>
        <button
          className="legend-collapse-btn"
          onClick={(e) => {
            e.stopPropagation()
            setIsCollapsed(!isCollapsed)
          }}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--aeth-fg)',
            cursor: 'pointer',
            fontSize: '1rem',
            padding: '0.25rem',
            lineHeight: 1,
            borderRadius: '4px'
          }}
          onMouseEnter={(e) => (e.target as HTMLElement).style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={(e) => (e.target as HTMLElement).style.background = 'transparent'}
        >
          {isCollapsed ? '▼' : '▲'}
        </button>
      </div>

      {/* Content */}
      {!isCollapsed && (
        <div style={{
          padding: '0.5rem 0.75rem',
          maxHeight: size.height > 0 ? size.height - headerHeight : optimalHeight,
          overflowY: 'auto',
          cursor: 'grab'
        }}>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${numColumns}, 1fr)`,
            gap: '0.25rem 0.75rem'
          }}>
            {presentTypes.map(type => {
              const color = FILE_TYPE_COLORS[type] || FILE_TYPE_COLORS['Default']
              const isHighlighted = highlightedTypes.has(type)
              return (
                <div
                  key={type}
                  onClick={(e) => {
                    e.stopPropagation()
                    // Only toggle if we didn't drag (threshold: 4px)
                    if (!hasDragged) {
                      onToggleType(type)
                    }
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    fontSize: '0.75rem',
                    whiteSpace: 'nowrap',
                    cursor: 'pointer',
                    padding: '0.2rem 0.4rem',
                    borderRadius: '4px',
                    background: isHighlighted ? 'rgba(255,255,255,0.15)' : 'transparent',
                    boxShadow: isHighlighted ? `0 0 8px ${color}, 0 0 12px ${color}` : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '3px',
                    background: color,
                    border: isHighlighted ? `2px solid white` : '1px solid rgba(255,255,255,0.2)',
                    flexShrink: 0,
                    boxShadow: isHighlighted ? `0 0 6px ${color}` : 'none'
                  }} />
                  <span style={{
                    color: isHighlighted ? '#fff' : (type === 'Unfamiliar' ? '#E74C3C' : 'inherit'),
                    fontWeight: isHighlighted || type === 'Unfamiliar' ? 'bold' : 'normal',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}>
                    {type}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Resize Handle */}
      {!isCollapsed && (
        <div
          className="legend-resize-handle"
          onMouseDown={handleResizeMouseDown}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: '16px',
            height: '16px',
            cursor: 'se-resize',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 0.5
          }}
          onMouseEnter={(e) => (e.target as HTMLElement).style.opacity = '1'}
          onMouseLeave={(e) => (e.target as HTMLElement).style.opacity = '0.5'}
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M9 1v8H1" stroke="currentColor" strokeWidth="1.5" fill="none"/>
          </svg>
        </div>
      )}
    </div>
  )
}

// Inner component that uses ReactFlow hooks
function DependencyGraphInner({ dependencyGraph, fileTypes, allFiles, projectPath }: DependencyGraphProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [highlightedTypes, setHighlightedTypes] = useState<Set<string>>(new Set())
  const [snapToGrid, setSnapToGrid] = useState(false)
  const [boundingBox, setBoundingBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const { fitView, getNodes, setViewport, getViewport } = useReactFlow()
  const containerRef = useRef<HTMLDivElement>(null)

  // Calculate bounding box of all nodes and constrain viewport
  const updateBoundingBox = useCallback(() => {
    const nodes = getNodes()
    if (nodes.length === 0) return

    const bounds = getNodesBounds(nodes)
    const padding = 50 // padding around nodes
    setBoundingBox({
      x: bounds.x - padding,
      y: bounds.y - padding,
      width: bounds.width + padding * 2,
      height: bounds.height + padding * 2,
    })
  }, [getNodes])

  // Update bounding box when nodes change
  useEffect(() => {
    updateBoundingBox()
  }, [updateBoundingBox])

  // Constrain viewport so at least one corner of bounding box is 5% inside viewport
  useOnViewportChange({
    onEnd: useCallback((viewport: Viewport) => {
      if (!boundingBox || !containerRef.current) return

      const container = containerRef.current
      const viewportWidth = container.clientWidth
      const viewportHeight = container.clientHeight
      const margin = 0.05 // 5% margin

      // Convert bounding box corners to screen coordinates
      const { x: vx, y: vy, zoom } = viewport
      const boxScreenLeft = boundingBox.x * zoom + vx
      const boxScreenRight = (boundingBox.x + boundingBox.width) * zoom + vx
      const boxScreenTop = boundingBox.y * zoom + vy
      const boxScreenBottom = (boundingBox.y + boundingBox.height) * zoom + vy

      // Define the "safe zone" (5% inward from edges)
      const safeLeft = viewportWidth * margin
      const safeRight = viewportWidth * (1 - margin)
      const safeTop = viewportHeight * margin
      const safeBottom = viewportHeight * (1 - margin)

      // Check if any corner of the bounding box is in the safe zone
      const corners = [
        { x: boxScreenLeft, y: boxScreenTop },     // top-left
        { x: boxScreenRight, y: boxScreenTop },    // top-right
        { x: boxScreenLeft, y: boxScreenBottom },  // bottom-left
        { x: boxScreenRight, y: boxScreenBottom }, // bottom-right
      ]

      const anyCornerVisible = corners.some(corner =>
        corner.x >= safeLeft && corner.x <= safeRight &&
        corner.y >= safeTop && corner.y <= safeBottom
      )

      // If no corner is visible, snap the nearest corner into view
      if (!anyCornerVisible) {
        let newVx = vx
        let newVy = vy

        // Find how far out of bounds we are and correct
        if (boxScreenRight < safeLeft) {
          // Graph is too far left - move it right
          newVx = vx + (safeLeft - boxScreenRight) + 20
        } else if (boxScreenLeft > safeRight) {
          // Graph is too far right - move it left
          newVx = vx - (boxScreenLeft - safeRight) - 20
        }

        if (boxScreenBottom < safeTop) {
          // Graph is too far up - move it down
          newVy = vy + (safeTop - boxScreenBottom) + 20
        } else if (boxScreenTop > safeBottom) {
          // Graph is too far down - move it up
          newVy = vy - (boxScreenTop - safeBottom) - 20
        }

        if (newVx !== vx || newVy !== vy) {
          setViewport({ x: newVx, y: newVy, zoom }, { duration: 200 })
        }
      }
    }, [boundingBox, setViewport])
  })

  // Toggle a type in the highlighted set
  const handleToggleType = useCallback((type: string) => {
    setHighlightedTypes(prev => {
      const next = new Set(prev)
      if (next.has(type)) {
        next.delete(type)
      } else {
        next.add(type)
      }
      return next
    })
  }, [])

  const handleOpenInEditor = async (relativePath: string) => {
    const fullPath = `${projectPath}/${relativePath}`.replace(/\//g, '\\')
    try {
      await invoke('open_in_editor', { filePath: fullPath })
    } catch (error) {
      console.error('Failed to open file:', error)
      alert(`Failed to open file: ${error}`)
    }
  }
  // Convert dependency graph to React Flow nodes and edges
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []
    const nodeMap = new Map<string, { x: number; y: number }>()

    // Create nodes from all files
    Object.keys(fileTypes).forEach((file, index) => {
      const fileType = fileTypes[file] || 'Default'
      const color = FILE_TYPE_COLORS[fileType] || FILE_TYPE_COLORS['Default']

      // Simple grid layout
      const col = index % 8
      const row = Math.floor(index / 8)
      const x = col * 250
      const y = row * 100

      nodeMap.set(file, { x, y })

      nodes.push({
        id: file,
        data: {
          label: file.split('/').pop() || file,
          fullPath: file,
          fileType: fileType
        },
        position: { x, y },
        style: {
          background: color,
          color: fileType === 'JavaScript' ? '#000' : '#fff',
          border: '2px solid #222',
          borderRadius: '8px',
          padding: '10px',
          fontSize: '12px',
          width: 200,
        },
      })
    })

    // Create edges from dependency graph
    Object.entries(dependencyGraph).forEach(([source, targets]) => {
      targets.forEach((target) => {
        if (fileTypes[target]) { // Only create edge if target exists
          edges.push({
            id: `${source}-${target}`,
            source: source,
            target: target,
            type: 'smoothstep',
            animated: false,
            style: { stroke: '#666', strokeWidth: 1 },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#666',
            },
          })
        }
      })
    })

    return { nodes, edges }
  }, [dependencyGraph, fileTypes])

  const [nodes, setNodesState, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdgesState, onEdgesChange] = useEdgesState(initialEdges)

  // Update node/edge styles when highlighted types change
  useEffect(() => {
    const hasHighlights = highlightedTypes.size > 0

    setNodesState((nds) =>
      nds.map((node) => {
        const fileType = node.data.fileType as string
        const isHighlighted = hasHighlights && highlightedTypes.has(fileType)
        const baseColor = FILE_TYPE_COLORS[fileType] || FILE_TYPE_COLORS['Default']
        const textColor = fileType === 'JavaScript' ? '#000' : '#fff'

        return {
          ...node,
          style: {
            background: baseColor,
            color: textColor,
            border: isHighlighted ? '3px solid white' : '2px solid #222',
            borderRadius: '8px',
            padding: '10px',
            fontSize: '12px',
            width: 200,
            opacity: hasHighlights ? (isHighlighted ? 1 : 0.25) : 1,
            boxShadow: isHighlighted ? `0 0 20px ${baseColor}, 0 0 30px ${baseColor}` : 'none',
            transition: 'all 0.3s ease',
          },
        }
      })
    )

    setEdgesState((eds) =>
      eds.map((edge) => {
        const sourceType = fileTypes[edge.source]
        const targetType = fileTypes[edge.target]
        const isHighlighted = hasHighlights && (highlightedTypes.has(sourceType) || highlightedTypes.has(targetType))
        const highlightColor = highlightedTypes.has(sourceType)
          ? (FILE_TYPE_COLORS[sourceType] || '#666')
          : (FILE_TYPE_COLORS[targetType] || '#666')

        return {
          ...edge,
          animated: isHighlighted,
          style: {
            stroke: isHighlighted ? highlightColor : '#666',
            strokeWidth: isHighlighted ? 3 : 1,
            opacity: hasHighlights ? (isHighlighted ? 1 : 0.15) : 1,
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            color: isHighlighted ? highlightColor : '#666',
          },
        }
      })
    )
  }, [highlightedTypes, fileTypes, setNodesState, setEdgesState])

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id)
  }, [])

  const selectedFileData = selectedNode ? allFiles[selectedNode] : null
  const selectedImports = selectedNode ? (dependencyGraph[selectedNode] || []) : []
  const selectedImportedBy = selectedFileData?.importedBy || []

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        height: '600px',
      }}>
      {/* Draggable Legend - floats above everything */}
      <DraggableLegend
        fileTypes={fileTypes}
        highlightedTypes={highlightedTypes}
        onToggleType={handleToggleType}
      />

      <div className="graph-container" style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        border: '3px solid var(--aeth-primary)',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 0 20px rgba(102, 126, 234, 0.2), inset 0 0 60px rgba(0,0,0,0.3)'
      }}>
      {/* Graph */}
      <div style={{
        flex: selectedNode ? '1' : '1',
        transition: 'flex 0.3s ease',
        position: 'relative'
      }}>
        {/* Graph Control Buttons */}
        <div style={{
          position: 'absolute',
          top: '10px',
          right: '10px',
          zIndex: 1000,
          display: 'flex',
          gap: '0.5rem'
        }}>
          <button
            onClick={() => setSnapToGrid(!snapToGrid)}
            style={{
              padding: '0.5rem 0.75rem',
              background: snapToGrid ? 'var(--aeth-primary)' : 'rgba(30, 30, 30, 0.9)',
              border: '1px solid var(--aeth-border)',
              borderRadius: '6px',
              color: 'var(--aeth-fg)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
              transition: 'background 0.2s ease'
            }}
            title={snapToGrid ? "Disable snap to grid" : "Enable snap to grid"}
          >
            <span>⊞</span> Snap {snapToGrid ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => fitView({ padding: 0.2, duration: 300 })}
            style={{
              padding: '0.5rem 0.75rem',
              background: 'rgba(30, 30, 30, 0.9)',
              border: '1px solid var(--aeth-border)',
              borderRadius: '6px',
              color: 'var(--aeth-fg)',
              cursor: 'pointer',
              fontSize: '0.8rem',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
            }}
            title="Reset view to fit all nodes (recovers lost graph)"
          >
            <span>⟲</span> Fit View
          </button>
        </div>

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={(changes) => {
            onNodesChange(changes)
            // Update bounding box after node positions change
            setTimeout(updateBoundingBox, 0)
          }}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          fitView
          attributionPosition="bottom-right"
          zoomOnScroll={false}
          panOnScroll={true}
          panOnScrollMode="vertical"
          zoomActivationKeyCode="Control"
          snapToGrid={snapToGrid}
          snapGrid={[20, 20]}
        >
          {/* Visual bounding box - slightly darker than background */}
          {boundingBox && (
            <svg
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                pointerEvents: 'none',
                overflow: 'visible',
              }}
            >
              <defs>
                <filter id="boundingBoxShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feDropShadow dx="0" dy="0" stdDeviation="3" floodColor="rgba(102, 126, 234, 0.3)" />
                </filter>
              </defs>
              <rect
                x={boundingBox.x}
                y={boundingBox.y}
                width={boundingBox.width}
                height={boundingBox.height}
                fill="rgba(0, 0, 0, 0.15)"
                stroke="rgba(102, 126, 234, 0.4)"
                strokeWidth="2"
                strokeDasharray="8 4"
                rx="8"
                filter="url(#boundingBoxShadow)"
              />
            </svg>
          )}
          <Background />
          <Controls />
          <MiniMap
            nodeColor={(node) => {
              const style = node.style as any
              return style?.background || '#999'
            }}
            style={{
              background: 'var(--aeth-bg)',
              border: '1px solid var(--aeth-border)',
            }}
            pannable={true}
            zoomable={true}
            maskColor="rgba(0, 0, 0, 0.6)"
          />
        </ReactFlow>
      </div>

      {/* Details Panel */}
      {selectedNode && (
        <div style={{
          width: '350px',
          background: 'var(--aeth-bg)',
          borderLeft: '1px solid var(--aeth-border)',
          padding: '1rem',
          overflowY: 'auto',
          position: 'relative'
        }}>
          <button
            onClick={() => setSelectedNode(null)}
            style={{
              position: 'absolute',
              top: '0.5rem',
              right: '0.5rem',
              background: 'transparent',
              border: 'none',
              color: 'var(--aeth-fg)',
              fontSize: '1.5rem',
              cursor: 'pointer',
              padding: '0.25rem 0.5rem',
              lineHeight: 1
            }}
          >
            ×
          </button>

          <h3 style={{
            marginTop: '10px',
            marginBottom: '0.5rem',
            fontSize: '1rem',
            wordBreak: 'break-word',
            paddingRight: '2rem'
          }}>
            {selectedNode}
          </h3>

          <div style={{
            padding: '0.25rem 0.5rem',
            background: 'var(--aeth-border)',
            borderRadius: '4px',
            fontSize: '0.75rem',
            marginBottom: '1rem',
            display: 'inline-block'
          }}>
            {selectedFileData?.category || 'Unknown'}
          </div>

          <button
            onClick={() => handleOpenInEditor(selectedNode)}
            style={{
              width: '100%',
              padding: '0.75rem',
              background: 'var(--aeth-primary)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: 'pointer',
              fontSize: '0.9rem',
              fontWeight: 'bold',
              marginBottom: '1rem'
            }}
          >
            🚀 Open in Editor
          </button>

          {selectedFileData?.size && (
            <div style={{ fontSize: '0.85rem', marginBottom: '0.5rem', opacity: 0.7 }}>
              Size: {selectedFileData.size}
            </div>
          )}

          {selectedFileData?.lines && (
            <div style={{ fontSize: '0.85rem', marginBottom: '1rem', opacity: 0.7 }}>
              Lines: {selectedFileData.lines}
            </div>
          )}

          {/* Imports (Outgoing) */}
          <div style={{ marginBottom: '1rem' }}>
            <h4 style={{
              fontSize: '0.9rem',
              marginBottom: '0.5rem',
              color: 'var(--aeth-primary)'
            }}>
              📤 Imports ({selectedImports.length})
            </h4>
            {selectedImports.length > 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                fontSize: '0.8rem'
              }}>
                {selectedImports.map((file: string) => (
                  <div
                    key={file}
                    onClick={() => setSelectedNode(file)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: 'var(--aeth-border)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      wordBreak: 'break-word'
                    }}
                  >
                    {file}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', opacity: 0.6, fontStyle: 'italic' }}>
                No imports
              </div>
            )}
          </div>

          {/* Imported By (Incoming) */}
          <div>
            <h4 style={{
              fontSize: '0.9rem',
              marginBottom: '0.5rem',
              color: 'var(--aeth-success)'
            }}>
              📥 Imported By ({selectedImportedBy.length})
            </h4>
            {selectedImportedBy.length > 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                fontSize: '0.8rem'
              }}>
                {selectedImportedBy.map((file: string) => (
                  <div
                    key={file}
                    onClick={() => setSelectedNode(file)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: 'var(--aeth-border)',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      wordBreak: 'break-word'
                    }}
                  >
                    {file}
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', opacity: 0.6, fontStyle: 'italic' }}>
                Not imported by any file (Entry Point)
              </div>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}

// Wrapper component that provides ReactFlow context
export default function DependencyGraph(props: DependencyGraphProps) {
  return (
    <ReactFlowProvider>
      <DependencyGraphInner {...props} />
    </ReactFlowProvider>
  )
}
