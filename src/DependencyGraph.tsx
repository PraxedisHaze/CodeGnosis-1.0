import { useCallback, useMemo, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import ReactFlow, {
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
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
  'Python': '#3776AB',
  'JavaScript': '#F7DF1E',
  'TypeScript': '#3178C6',
  'React': '#61DAFB',
  'TypeScript React': '#61DAFB',
  'HTML': '#E34F26',
  'CSS': '#1572B6',
  'JSON': '#292929',
  'Markdown': '#083FA1',
  'Default': '#999999',
}

export default function DependencyGraph({ dependencyGraph, fileTypes, allFiles, projectPath }: DependencyGraphProps) {
  const [selectedNode, setSelectedNode] = useState<string | null>(null)

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
      display: 'flex',
      width: '100%',
      height: '600px',
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
  )
}
