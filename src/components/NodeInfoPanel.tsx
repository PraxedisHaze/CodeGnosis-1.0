import React, { useState } from 'react'
import './NodeInfoPanel.css'

interface Props {
  nodeId: string
  nodeInfo: any
  fileType: string
  dependencyGraph: Record<string, string[]>
  onNodeClick?: (id: string) => void
  onClose: () => void
  panelSide: 'left' | 'right'
  setPanelSide: (side: 'left' | 'right') => void
  legendMode: 'intent' | 'tech'
}

export function NodeInfoPanel({ 
  nodeId, nodeInfo, fileType, dependencyGraph, 
  onNodeClick, onClose, panelSide, setPanelSide, legendMode 
}: Props) {
  
  const getProminentTrait = (info: any): { label: string, color: string } => {
    if (info.signature) return { label: `Signature: ${info.signature}`, color: '#9370DB' }
    if (info.cycleParticipation > 0) return { label: 'Circular dependency', color: '#ff4d4f' }
    if (info.isUnused) return { label: 'Unused file', color: '#c7c7cc' }
    if (info.inboundCount >= 8) return { label: 'Masterfully Crafted', color: '#FFD700' }
    return { label: 'Stable', color: '#cbd5f5' }
  }

  const trait = getProminentTrait(nodeInfo)

  return (
    <div className={`loom-info-panel side-${panelSide}`}>
      <div className="info-header">
        <div className="info-header-buttons">
          <button className="info-side-toggle" onClick={() => setPanelSide(panelSide === 'left' ? 'right' : 'left')}>
            {panelSide === 'left' ? '→' : '←'}
          </button>
          <button className="info-close" onClick={onClose}>x</button>
        </div>
        <span className="info-filename" title={nodeId}>{nodeId.split('/').pop()}</span>
      </div>
      
      <div className="info-path">{nodeId}</div>
      
      <div className="info-badges">
        <span className="info-badge type">{fileType}</span>
        {/* Only show subjective traits in Intent mode */}
        {(legendMode === 'intent' || trait.color === '#ff4d4f') && (
          <span className="info-badge trait" style={{ borderColor: trait.color, color: trait.color }}>
            {trait.label}
          </span>
        )}
      </div>

      <div className="info-grid">
        <div className="info-metric">
          <span className="label">{legendMode === 'intent' ? 'Gravity (In)' : 'Inbound'}</span>
          <span className="value">{nodeInfo.inboundCount || 0}</span>
        </div>
        <div className="info-metric">
          <span className="label">{legendMode === 'intent' ? 'Blast (Out)' : 'Outbound'}</span>
          <span className="value">{nodeInfo.outboundCount || 0}</span>
        </div>
        <div className="info-metric">
          <span className="label">Mass</span>
          <span className="value">{nodeInfo.size || '0KB'}</span>
        </div>
        <div className="info-metric">
          <span className="label">Lines</span>
          <span className="value">{nodeInfo.lines || 0}</span>
        </div>
      </div>

      <div className="info-lists">
        <details open={Object.entries(dependencyGraph).filter(([_, targets]) => targets.includes(nodeId)).length === 0}>
          <summary>
            {legendMode === 'intent' ? 'Imported By' : 'Dependents'} ({Object.entries(dependencyGraph).filter(([_, targets]) => targets.includes(nodeId)).length})
          </summary>
          <ul className="file-list">
            {Object.entries(dependencyGraph).filter(([_, targets]) => targets.includes(nodeId)).map(([source]) => (
              <li key={source} onClick={() => onNodeClick?.(source)}>{source.split('/').pop()}</li>
            ))}
            {Object.entries(dependencyGraph).filter(([_, targets]) => targets.includes(nodeId)).length === 0 && <li className="empty">No dependents</li>}
          </ul>
        </details>

        <details open={(dependencyGraph[nodeId] || []).length === 0}>
          <summary>
            {legendMode === 'intent' ? 'Imports' : 'Dependencies'} ({(dependencyGraph[nodeId] || []).length})
          </summary>
          <ul className="file-list">
            {(dependencyGraph[nodeId] || []).map((target: string) => (
              <li key={target} onClick={() => onNodeClick?.(target)}>{target.split('/').pop()}</li>
            ))}
            {(dependencyGraph[nodeId] || []).length === 0 && <li className="empty">No imports</li>}
          </ul>
        </details>
      </div>
    </div>
  )
}
