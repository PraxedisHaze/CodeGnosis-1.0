// BOM-STRICT
// PrintableReport.tsx - Exportable dual-view mission report
// Captures Anothen and Terran perspectives with actionable intelligence

import { useState, useRef, useCallback } from 'react'
import './PrintableReport.css'

interface PrintableReportProps {
  result: any
  projectPath: string
  canvasRef?: React.RefObject<HTMLCanvasElement>
  legendMode: 'intent' | 'tech'
  setLegendMode: (mode: 'intent' | 'tech') => void
}

// Mission data extractors
const getMissionData = (result: any) => {
  if (!result) return null

  // files is an object, not array - get keys
  const filesObj = result.files || {}
  const files = Object.keys(filesObj)
  const deps = result.dependencyGraph || {}
  const cycles = Array.isArray(result.cycles) ? result.cycles : []
  const broken = result.brokenReferences || []

  // Calculate inbound counts
  const inboundCounts: Record<string, number> = {}
  Object.entries(deps).forEach(([file, targets]) => {
    (targets as string[]).forEach(target => {
      inboundCounts[target] = (inboundCounts[target] || 0) + 1
    })
  })

  // RISK: High-dependency files (bus factor)
  const riskFiles = files
    .map((f: string) => ({ file: f, inbound: inboundCounts[f] || 0 }))
    .filter((f: any) => f.inbound > 8)
    .sort((a: any, b: any) => b.inbound - a.inbound)
    .slice(0, 10)

  // ROT: Dead code candidates (no inbound, not entry points)
  const entryPatterns = /index\.|main\.|app\.|entry\./i
  const rotFiles = files
    .filter((f: string) => (inboundCounts[f] || 0) === 0 && !entryPatterns.test(f))
    .slice(0, 15)

  // ONBOARD: Entry points and key files
  const onboardFiles = files
    .filter((f: string) => entryPatterns.test(f) || (inboundCounts[f] || 0) === 0)
    .slice(0, 10)

  // INCIDENT: Files in cycles (fragile dependencies)
  const cycleFiles = new Set<string>()
  cycles.forEach((cycle: any) => {
    if (Array.isArray(cycle)) {
      cycle.forEach(f => cycleFiles.add(f))
    }
  })

  // OPTIMIZE: Heavy dependency chains
  const outboundCounts = Object.entries(deps)
    .map(([file, targets]) => ({ file, outbound: (targets as string[]).length }))
    .sort((a, b) => b.outbound - a.outbound)
    .slice(0, 10)

  return {
    risk: {
      title: '🛡️ Risk Assessment',
      subtitle: 'High-dependency files (Bus Factor)',
      description: 'These files have many dependents. If they break, the blast radius is significant.',
      files: riskFiles,
      metric: 'inbound dependencies'
    },
    rot: {
      title: '🧹 Code Rot Detection',
      subtitle: 'Potential dead code',
      description: 'Files with no inbound dependencies that aren\'t entry points. Consider removing.',
      files: rotFiles.map((f: string) => ({ file: f })),
      metric: 'orphaned files'
    },
    onboard: {
      title: '🗺️ Onboarding Path',
      subtitle: 'Start here',
      description: 'Entry points and root files - the golden path for new developers.',
      files: onboardFiles.map((f: string) => ({ file: f, inbound: inboundCounts[f] || 0 })),
      metric: 'entry points'
    },
    incident: {
      title: '🔥 Incident Response',
      subtitle: 'Circular dependencies',
      description: 'Files caught in dependency cycles. Changes here can cascade unpredictably.',
      files: Array.from(cycleFiles).slice(0, 15).map(f => ({ file: f })),
      cycles: cycles.length,
      metric: 'cycle participants'
    },
    optimize: {
      title: '⚖️ Optimization Targets',
      subtitle: 'Heavy importers',
      description: 'Files with many outbound dependencies. Prime targets for code splitting.',
      files: outboundCounts,
      metric: 'outbound dependencies'
    },
    broken: {
      title: '💔 Broken References',
      subtitle: 'Missing imports',
      description: 'Import statements pointing to non-existent files.',
      files: broken.slice(0, 15).map((b: any) => ({ file: b.source || b, target: b.target })),
      metric: 'broken imports'
    }
  }
}

export function PrintableReport({ result, projectPath, canvasRef, legendMode, setLegendMode }: PrintableReportProps) {
  const [anothenSnapshot, setAnothenSnapshot] = useState<string | null>(null)
  const [terranSnapshot, setTerranSnapshot] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [reportReady, setReportReady] = useState(false)
  const reportRef = useRef<HTMLDivElement>(null)

  const missionData = getMissionData(result)
  const summary = result?.summary || {}
  const stats = result?.statistics || {}

  const captureCanvas = useCallback(() => {
    // Find the Three.js canvas in the DOM
    const canvas = document.querySelector('canvas[data-engine]') as HTMLCanvasElement
    if (canvas) {
      return canvas.toDataURL('image/png')
    }
    return null
  }, [])

  const generateReport = useCallback(async () => {
    setIsGenerating(true)

    // Capture Anothen view (Intent mode)
    setLegendMode('intent')
    await new Promise(r => setTimeout(r, 500)) // Wait for render
    const anothen = captureCanvas()
    setAnothenSnapshot(anothen)

    // Capture Terran view (Tech mode)
    setLegendMode('tech')
    await new Promise(r => setTimeout(r, 500)) // Wait for render
    const terran = captureCanvas()
    setTerranSnapshot(terran)

    // Restore original mode
    setLegendMode(legendMode)

    setReportReady(true)
    setIsGenerating(false)
  }, [captureCanvas, legendMode, setLegendMode])

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const handleCopyHTML = useCallback(async () => {
    if (reportRef.current) {
      const html = reportRef.current.innerHTML
      await navigator.clipboard.writeText(html)
      alert('Report HTML copied to clipboard!')
    }
  }, [])

  if (!result) {
    return (
      <div className="printable-report empty">
        <p>No analysis data available. Run an analysis first.</p>
      </div>
    )
  }

  return (
    <div className="printable-report">
      <div className="report-controls no-print">
        <h2>📊 Exportable Report</h2>
        <p>Generate a printable report with dual-perspective views and mission intelligence.</p>

        <div className="control-buttons">
          <button
            className="btn-generate"
            onClick={generateReport}
            disabled={isGenerating}
          >
            {isGenerating ? 'Capturing Views...' : '📸 Generate Report'}
          </button>

          {reportReady && (
            <>
              <button className="btn-print" onClick={handlePrint}>
                🖨️ Print / Save PDF
              </button>
              <button className="btn-copy" onClick={handleCopyHTML}>
                📋 Copy HTML
              </button>
            </>
          )}
        </div>
      </div>

      {reportReady && (
        <div className="report-content" ref={reportRef}>
          {/* Header */}
          <div className="report-header">
            <h1>CodeGnosis Analysis Report</h1>
            <div className="report-meta">
              <span className="project-name">{summary.projectName || projectPath.split(/[\\/]/).pop()}</span>
              <span className="report-date">{new Date().toLocaleDateString()}</span>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="report-stats">
            <div className="stat-box">
              <span className="stat-value">{summary.totalFiles || 0}</span>
              <span className="stat-label">Files</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{summary.totalConnections || 0}</span>
              <span className="stat-label">Connections</span>
            </div>
            <div className="stat-box">
              <span className="stat-value" style={{ color: (stats.connectivityHealthScore || 0) >= 80 ? '#27AE60' : '#E67E22' }}>
                {stats.connectivityHealthScore || 0}
              </span>
              <span className="stat-label">Health Score</span>
            </div>
            <div className="stat-box">
              <span className="stat-value">{Object.keys(summary.languages || {}).length}</span>
              <span className="stat-label">Languages</span>
            </div>
          </div>

          {/* Dual View Section */}
          <div className="dual-view-section">
            <h2>Perspective Comparison</h2>
            <div className="dual-views">
              <div className="view-panel">
                <h3>🌊 Anothen View (Intent)</h3>
                <p className="view-desc">Semantic gravity - files sink by how many depend on them</p>
                {anothenSnapshot ? (
                  <img src={anothenSnapshot} alt="Anothen perspective" className="view-snapshot" />
                ) : (
                  <div className="view-placeholder">Capture pending...</div>
                )}
              </div>
              <div className="view-panel">
                <h3>🏙️ Terran View (Tech)</h3>
                <p className="view-desc">Structural hierarchy - files rise by folder depth</p>
                {terranSnapshot ? (
                  <img src={terranSnapshot} alt="Terran perspective" className="view-snapshot" />
                ) : (
                  <div className="view-placeholder">Capture pending...</div>
                )}
              </div>
            </div>
          </div>

          {/* Mission Intelligence */}
          <div className="mission-intelligence">
            <h2>Mission Intelligence</h2>

            {missionData && Object.entries(missionData).map(([key, mission]: [string, any]) => (
              <div key={key} className="mission-section">
                <div className="mission-header">
                  <h3>{mission.title}</h3>
                  <span className="mission-subtitle">{mission.subtitle}</span>
                </div>
                <p className="mission-description">{mission.description}</p>

                {mission.files && mission.files.length > 0 ? (
                  <div className="mission-files">
                    <table>
                      <thead>
                        <tr>
                          <th>File</th>
                          {mission.files[0]?.inbound !== undefined && <th>Inbound</th>}
                          {mission.files[0]?.outbound !== undefined && <th>Outbound</th>}
                          {mission.files[0]?.target !== undefined && <th>Missing Target</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {mission.files.map((f: any, i: number) => (
                          <tr key={i}>
                            <td className="file-path">{f.file}</td>
                            {f.inbound !== undefined && <td className="metric">{f.inbound}</td>}
                            {f.outbound !== undefined && <td className="metric">{f.outbound}</td>}
                            {f.target !== undefined && <td className="file-path secondary">{f.target}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="file-count">{mission.files.length} {mission.metric}</div>
                  </div>
                ) : (
                  <p className="no-issues">✓ No issues detected</p>
                )}

                {mission.cycles !== undefined && mission.cycles > 0 && (
                  <div className="cycle-count">{mission.cycles} dependency cycles detected</div>
                )}
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className="report-footer">
            <p>Generated by <strong>CodeGnosis</strong> · Keystone Constellation</p>
            <p className="report-path">{projectPath}</p>
          </div>
        </div>
      )}
    </div>
  )
}
