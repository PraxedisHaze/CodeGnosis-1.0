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
function DraggableLegend({ fileTypes }: { fileTypes: Record<string, string> }) {
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [position, setPosition] = useState({ x: 10, y: 10 })
  const [size, setSize] = useState({ width: 180, height: 0 }) // height 0 = auto
  const [isDragging, setIsDragging] = useState(false)
  const [isResizing, setIsResizing] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 })
  const legendRef = useRef<HTMLDivElement>(null)

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
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    }
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
        position: 'absolute',
        left: position.x,
        top: position.y,
        zIndex: 1000,
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
              return (
                <div key={type} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.75rem',
                  whiteSpace: 'nowrap'
                }}>
                  <div style={{
                    width: '12px',
                    height: '12px',
                    borderRadius: '3px',
                    background: color,
                    border: '1px solid rgba(255,255,255,0.2)',
                    flexShrink: 0
                  }} />
                  <span style={{
                    color: type === 'Unfamiliar' ? '#E74C3C' : 'inherit',
                    fontWeight: type === 'Unfamiliar' ? 'bold' : 'normal',
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
  const { fitView } = useReactFlow()

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

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode(node.id)
  }, [])

  const selectedFileData = selectedNode ? allFiles[selectedNode] : null
  const selectedImports = selectedNode ? (dependencyGraph[selectedNode] || []) : []
  const selectedImportedBy = selectedFileData?.importedBy || []

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '600px',
    }}>
      {/* Draggable Legend - floats above everything */}
      <DraggableLegend fileTypes={fileTypes} />

      <div style={{
        display: 'flex',
        width: '100%',
        height: '100%',
        border: '1px solid var(--aeth-border)',
        borderRadius: '8px',
        overflow: 'hidden'
      }}>
      {/* Graph */}
      <div style={{
        flex: selectedNode ? '1' : '1',
        transition: 'flex 0.3s ease',
        position: 'relative'
      }}>
        {/* Fit View Button - recovers lost graph */}
        <button
          onClick={() => fitView({ padding: 0.2, duration: 300 })}
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            zIndex: 1000,
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

        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          fitView
          attributionPosition="bottom-right"
          zoomOnScroll={false}
          panOnScroll={true}
          panOnScrollMode="vertical"
          zoomActivationKeyCode="Control"
        >
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
            marginTop: 0,
            marginBottom: '0.5rem',
            fontSize: '1rem',
            wordBreak: 'break-word'
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
