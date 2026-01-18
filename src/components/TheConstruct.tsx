/**
 * SPDX-License-Identifier: MIT
 * Authors: Gemini (Unified Guide), Timothy Drake (Design)
 * Source: Keystone Constellation
 * Glyphs: BOM-STRICT | USER-TRUTH
 */

import React, { useMemo, useState } from 'react'
import './TheConstruct.css'
import { Tooltip } from './UnifiedTooltip'

interface TheConstructProps {
  analysisResult: any
}

export function TheConstruct({ analysisResult }: TheConstructProps) {
  const [activeView, setActiveView] = useState<'files' | 'health' | 'topology'>('files')
  const [search, setSearch] = useState('')
  const [sortConfig, setSortKey] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'path', direction: 'asc' })

  if (!analysisResult) return null

  const stats = analysisResult.statistics || {}
  const files = Object.entries(analysisResult.files || {}) as [string, any][]
  const warnings = analysisResult.cycles || []
  
  // Sorting Logic
  const sortedFiles = useMemo(() => {
    let items = [...files]
    if (sortConfig.key) {
      items.sort((a, b) => {
        let aVal = sortConfig.key === 'path' ? a[0] : (a[1] as any)[sortConfig.key]
        let bVal = sortConfig.key === 'path' ? b[0] : (b[1] as any)[sortConfig.key]
        
        // Numerical sort for Size (strip KB)
        if (sortConfig.key === 'size') {
          aVal = parseFloat(aVal.replace('KB', '')) || 0
          bVal = parseFloat(bVal.replace('KB', '')) || 0
        }

        if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1
        if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }
    return items
  }, [files, sortConfig])

  // Filtered files for the Ledger
  const filteredFiles = useMemo(() => {
    return sortedFiles.filter(([path]) => path.toLowerCase().includes(search.toLowerCase()))
  }, [sortedFiles, search])

  const requestSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc'
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc'
    }
    setSortKey({ key, direction })
  }

  const getSortIcon = (key: string) => {
    if (sortConfig.key !== key) return '↕'
    return sortConfig.direction === 'asc' ? '▲' : '▼'
  }

  return (
    <div className="construct-hall">
      <header className="construct-header">
        <div className="construct-stats">
          <Tooltip label="Integrity" content="Overall structural integrity. High scores indicate a clean, decoupled architecture.">
            <div className="construct-stat-card">
              <span className="stat-label">Integrity</span>
              <span className="stat-value" style={{
                color: stats.connectivityHealthScore >= 80 ? '#4CAF50' : '#FF9800'
              }}>{stats.connectivityHealthScore}/100</span>
            </div>
          </Tooltip>
          <Tooltip label="Complexity" content="Average links per file. Measures how tightly coupled the stars are.">
            <div className="construct-stat-card">
              <span className="stat-label">Complexity</span>
              <span className="stat-value">{stats.avgDependenciesPerFile} avg deps</span>
            </div>
          </Tooltip>
          <Tooltip label="Scale" content="Total number of nodes detected in the current lattice.">
            <div className="construct-stat-card">
              <span className="stat-label">Scale</span>
              <span className="stat-value">{analysisResult.summary.totalFiles} stars</span>
            </div>
          </Tooltip>
        </div>

        <nav className="construct-nav">
          <Tooltip label="The Ledger" content="The master list of every star, categorized and sorted.">
            <button
              className={`construct-nav-btn ${activeView === 'files' ? 'active' : ''}`}
              onClick={() => setActiveView('files')}
            >
              The Ledger (Files)
            </button>
          </Tooltip>
          <Tooltip label="Forensic Log" content="A detailed audit of structural fractures and circular loops.">
            <button
              className={`construct-nav-btn ${activeView === 'health' ? 'active' : ''}`}
              onClick={() => setActiveView('health')}
            >
              Forensic Log (Health)
            </button>
          </Tooltip>
          <Tooltip label="Outer Rim" content="Insights into detected frameworks and critical hub files.">
            <button
              className={`construct-nav-btn ${activeView === 'topology' ? 'active' : ''}`}
              onClick={() => setActiveView('topology')}
            >
              Outer Rim (Topology)
            </button>
          </Tooltip>
        </nav>
      </header>

      <main className="construct-content">
        <div className="construct-search-bar">
          <input 
            type="text" 
            placeholder="Search the archives..." 
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {activeView === 'files' && (
          <div className="construct-table-wrapper">
            <table className="construct-table">
              <thead>
                <tr>
                  <th onClick={() => requestSort('path')} className="sortable">File Path {getSortIcon('path')}</th>
                  <th onClick={() => requestSort('category')} className="sortable">Type {getSortIcon('category')}</th>
                  <th onClick={() => requestSort('size')} className="sortable">Size {getSortIcon('size')}</th>
                  <th onClick={() => requestSort('inboundCount')} className="sortable">In {getSortIcon('inboundCount')}</th>
                  <th onClick={() => requestSort('outboundCount')} className="sortable">Out {getSortIcon('outboundCount')}</th>
                  <th onClick={() => requestSort('chainDepth')} className="sortable">Depth {getSortIcon('chainDepth')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredFiles.map(([path, data]) => (
                  <tr key={path}>
                    <td className="path-cell" title={path}>{path}</td>
                    <td><span className="type-tag">{data.category}</span></td>
                    <td>{data.size}</td>
                    <td>{data.inboundCount}</td>
                    <td>{data.outboundCount}</td>
                    <td>{data.chainDepth}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {activeView === 'health' && (
          <div className="construct-health-list">
            {warnings.length === 0 ? (
              <p className="clean-report">No structural rot detected. The architecture is sound.</p>
            ) : (
              warnings.map((w: any, i: number) => (
                <div key={i} className={`construct-warning-card ${w.severity}`}>
                  <div className="warning-header">
                    <span className="warning-type">{w.type.replace(/_/g, ' ').toUpperCase()}</span>
                    <span className="warning-severity">{w.severity}</span>
                  </div>
                  <p className="warning-reason">{w.reason || w.description}</p>
                  {w.file && <code className="warning-file">{w.file}</code>}
                </div>
              ))
            )}
          </div>
        )}

        {activeView === 'topology' && (
          <div className="construct-topology-view">
            <h3>Detected Frameworks</h3>
            <div className="framework-tags">
              {analysisResult.summary.detectedFrameworks.map((f: string) => (
                <span key={f} className="framework-tag">{f}</span>
              ))}
            </div>
            
            <h3>Hub Files (Most Critical)</h3>
            <div className="hub-list">
              {analysisResult.hubFiles.map((h: any) => (
                <div key={h.file} className="hub-item">
                  <span className="hub-path">{h.file}</span>
                  <span className="hub-count">{h.importedBy} dependents</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  )
}