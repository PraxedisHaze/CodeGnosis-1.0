// BOM-STRICT
// AnalysisReport.tsx - Full-scale cognitive dashboard
// Transforms raw analysis data into actionable intelligence

import { useState, useRef, useEffect } from 'react'
import './AnalysisReport.css'
import { Tooltip } from './UnifiedTooltip'

interface AnalysisReportProps {
  result: any
  projectPath: string
  onOpenFolder: () => void
  onCopyPath: () => void
  onFileClick?: (file: string) => void
  onViewVault?: (articleId: string) => void
}

// Severity color mapping
const severityColor = (severity: string) => {
  switch (severity) {
    case 'critical': return '#E74C3C'
    case 'high': return '#E67E22'
    case 'medium': return '#F1C40F'
    case 'low': return '#3498DB'
    default: return '#95A5A6'
  }
}

// Health score interpretation
const healthInterpretation = (score: number) => {
  if (score >= 90) return { label: 'Excellent', color: '#27AE60', icon: 'shield-check' }
  if (score >= 75) return { label: 'Good', color: '#4CAF50', icon: 'shield' }
  if (score >= 60) return { label: 'Fair', color: '#F1C40F', icon: 'alert-triangle' }
  if (score >= 40) return { label: 'Poor', color: '#E67E22', icon: 'alert-circle' }
  return { label: 'Critical', color: '#E74C3C', icon: 'x-circle' }
}

// Estimate AI context fit
const estimateContextFit = (totalFiles: number, avgDeps: number) => {
  const estimatedTokens = totalFiles * 500 // rough estimate: 500 tokens per file
  if (estimatedTokens < 50000) return { fit: 'Full Context', color: '#27AE60', pct: 100 }
  if (estimatedTokens < 100000) return { fit: 'Partial Context', color: '#F1C40F', pct: 75 }
  if (estimatedTokens < 200000) return { fit: 'Chunked Required', color: '#E67E22', pct: 50 }
  return { fit: 'Database Required', color: '#E74C3C', pct: 25 }
}

// Estimate onboarding time
const estimateOnboardingTime = (totalFiles: number, maxDepth: number, cycles: number) => {
  const baseHours = totalFiles * 0.02 // 1.2 min per file
  const depthMultiplier = 1 + (maxDepth * 0.1)
  const cyclesPenalty = cycles * 2
  const hours = Math.ceil((baseHours * depthMultiplier) + cyclesPenalty)
  if (hours <= 4) return { time: `${hours}h`, label: 'Quick ramp-up', color: '#27AE60' }
  if (hours <= 16) return { time: `${Math.ceil(hours/8)}d`, label: 'Standard onboarding', color: '#4CAF50' }
  if (hours <= 40) return { time: `${Math.ceil(hours/8)}d`, label: 'Extended learning', color: '#F1C40F' }
  return { time: `${Math.ceil(hours/40)}w+`, label: 'Deep immersion needed', color: '#E67E22' }
}

// Minimum professional padding (Material Design / Apple HIG standard)
const MIN_PADDING = 16 // 1rem
const MAX_PADDING = 32 // 2rem - comfortable breathing room
const TOP_OFFSET = 48 // Clear the tab buttons

export function AnalysisReport({ result, projectPath, onOpenFolder, onCopyPath, onFileClick, onViewVault }: AnalysisReportProps) {
  const [expandedSection, setExpandedSection] = useState<string | null>('overview')
  const containerRef = useRef<HTMLDivElement>(null)
  const [dynamicPadding, setDynamicPadding] = useState(MIN_PADDING)

  // Dynamic padding: fit perfectly or commit to real scroll
  useEffect(() => {
    const adjustPadding = () => {
      if (!containerRef.current) return

      const viewportHeight = window.innerHeight
      const availableHeight = viewportHeight - TOP_OFFSET

      // Temporarily reset padding to measure true content height
      containerRef.current.style.paddingTop = `${TOP_OFFSET}px`
      containerRef.current.style.paddingBottom = `${MIN_PADDING}px`
      const contentHeight = containerRef.current.scrollHeight

      const gap = availableHeight - contentHeight

      if (gap >= 0) {
        // Content fits - distribute extra space evenly, capped at MAX_PADDING
        const extraPadding = Math.min(gap / 2, MAX_PADDING - MIN_PADDING)
        setDynamicPadding(MIN_PADDING + extraPadding)
      } else if (gap > -40) {
        // Almost fits but would have tiny scrollbar - add padding to make scroll meaningful
        setDynamicPadding(MIN_PADDING + 24)
      } else {
        // Real overflow - keep minimum padding, let scroll do its job
        setDynamicPadding(MIN_PADDING)
      }
    }

    adjustPadding()
    window.addEventListener('resize', adjustPadding)
    return () => window.removeEventListener('resize', adjustPadding)
  }, [result, expandedSection])

  const stats = result.statistics || {}
  const summary = result.summary || {}
  const graphStats = result.graphStats || {}
  const hubFiles = result.hubFiles || []
  const healthWarnings = result.healthWarnings || []
  const cycles = result.cycles || []
  const brokenRefs = result.brokenReferences || []
  const entryPoints = result.entryPoints || []
  const buildProfile = result.buildProfile || {}

  const health = healthInterpretation(stats.connectivityHealthScore || 0)
  const contextFit = estimateContextFit(summary.totalFiles || 0, stats.avgDependenciesPerFile || 0)
  const onboarding = estimateOnboardingTime(
    summary.totalFiles || 0,
    stats.maxDependencyChainDepth || 0,
    stats.circularDependencies || 0
  )

  // Calculate blast radius (avg files affected by a change)
  const avgBlastRadius = stats.avgDependenciesPerFile
    ? Math.round(stats.avgDependenciesPerFile * 1.5)
    : 0

  // Group warnings by severity
  const warningsBySeverity = healthWarnings.reduce((acc: any, w: any) => {
    const sev = w.severity || 'low'
    acc[sev] = (acc[sev] || 0) + 1
    return acc
  }, {})

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section)
  }

  return (
    <div
      ref={containerRef}
      className="analysis-report"
      style={{
        paddingTop: `${TOP_OFFSET}px`,
        paddingBottom: `${dynamicPadding}px`
      }}
    >
      {/* Hero Section - The Big Picture */}
      <header className="report-hero">
        <div className="hero-left">
          <h1>{summary.projectName || projectPath.split(/[/\\]/).pop()}</h1>
          <p className="project-type">{summary.projectType || 'Unknown Project Type'}</p>
          {summary.detectedFrameworks?.length > 0 && (
            <div className="framework-pills">
              {summary.detectedFrameworks.map((fw: string) => (
                <span key={fw} className="pill">{fw}</span>
              ))}
            </div>
          )}
        </div>
        <div className="hero-right">
          <Tooltip
            label="Health Score"
            content="Overall project health score (0-100). Based on circular dependencies, orphaned files, broken references, and code structure. Higher is better - aim for 80+."
          >
            <div
              className="health-ring"
              style={{
                '--health-color': health.color,
                '--health-score': stats.connectivityHealthScore || 0
              } as any}
            >
              <div className="health-score">{stats.connectivityHealthScore || 0}</div>
              <div className="health-label">{health.label}</div>
            </div>
          </Tooltip>
        </div>
      </header>

      {/* Command Center - Key Metrics Grid */}
      <section className="command-center">
        <Tooltip label="Files" content="How many files are in your project. More files = more complexity to manage. This helps you understand the scale of what you're working with.">
          <div className="metric-card primary">
            <div className="metric-icon">FILES</div>
            <div className="metric-value">{summary.totalFiles || 0}</div>
            <div className="metric-sublabel">{Object.keys(summary.languages || {}).length} languages</div>
          </div>
        </Tooltip>
        <Tooltip label="Links" content="How many connections exist between files (imports, dependencies). High numbers mean files are tightly coupled - changes ripple further.">
          <div className="metric-card primary">
            <div className="metric-icon">LINKS</div>
            <div className="metric-value">{summary.totalConnections || 0}</div>
            <div className="metric-sublabel">{stats.avgDependenciesPerFile || 0} avg/file</div>
          </div>
        </Tooltip>
        <Tooltip label="Depth" content="The longest chain of dependencies (A uses B uses C uses D...). Deep chains are harder for humans AND AI to follow. Keep it shallow when possible.">
          <div className="metric-card primary">
            <div className="metric-icon">DEPTH</div>
            <div className="metric-value">{stats.maxDependencyChainDepth || 0}</div>
            <div className="metric-sublabel">layers deep</div>
          </div>
        </Tooltip>
        <Tooltip label="Blast Radius" content="On average, how many other files are affected when you change one file. High blast radius means changes are risky - test carefully.">
          <div className="metric-card primary">
            <div className="metric-icon">BLAST</div>
            <div className="metric-value" style={{ color: avgBlastRadius > 5 ? '#E67E22' : '#4CAF50' }}>{avgBlastRadius}</div>
            <div className="metric-sublabel">avg impact</div>
          </div>
        </Tooltip>
      </section>

      {/* Intelligence Panels */}
      <div className="intel-grid">
        {/* Technical Debt Indicators */}
        <Tooltip label="Technical Debt" content="Technical debt is like clutter in your code - it slows you down over time. These meters show problem areas that will cost you time later if not addressed.">
        <section className="intel-panel debt-panel">
          <h3 onClick={() => toggleSection('debt')}>
            Technical Debt Indicators
            <span className="toggle">{expandedSection === 'debt' ? '−' : '+'}</span>
          </h3>
          <div className={`panel-content ${expandedSection === 'debt' ? 'expanded' : ''}`}>
            <div className="debt-meters">
              <div className="debt-meter">
                <div className="meter-label">Circular Dependencies</div>
                <div className="meter-bar">
                  <div
                    className="meter-fill"
                    style={{
                      width: `${Math.min((stats.circularDependencies || 0) * 10, 100)}%`,
                      backgroundColor: stats.circularDependencies > 0 ? '#E74C3C' : '#27AE60'
                    }}
                  />
                </div>
                <div className="meter-value">{stats.circularDependencies || 0} cycles</div>
              </div>
              <div className="debt-meter">
                <div className="meter-label">Orphaned Files</div>
                <div className="meter-bar">
                  <div
                    className="meter-fill"
                    style={{
                      width: `${Math.min((stats.unusedFiles || 0) * 5, 100)}%`,
                      backgroundColor: stats.unusedFiles > 5 ? '#E67E22' : '#4CAF50'
                    }}
                  />
                </div>
                <div className="meter-value">{stats.unusedFiles || 0} files</div>
              </div>
              <div className="debt-meter">
                <div className="meter-label">Broken References</div>
                <div className="meter-bar">
                  <div
                    className="meter-fill"
                    style={{
                      width: `${Math.min((stats.filesWithMissingAssets || 0) * 10, 100)}%`,
                      backgroundColor: stats.filesWithMissingAssets > 0 ? '#E74C3C' : '#27AE60'
                    }}
                  />
                </div>
                <div className="meter-value">{stats.filesWithMissingAssets || 0} files</div>
              </div>
              <div className="debt-meter">
                <div className="meter-label">Isolated Nodes</div>
                <div className="meter-bar">
                  <div
                    className="meter-fill"
                    style={{
                      width: `${Math.min((graphStats.isolatedNodes || 0) * 5, 100)}%`,
                      backgroundColor: graphStats.isolatedNodes > 10 ? '#F1C40F' : '#4CAF50'
                    }}
                  />
                </div>
                <div className="meter-value">{graphStats.isolatedNodes || 0} nodes</div>
              </div>
            </div>
          </div>
        </section>
        </Tooltip>

        {/* AI Readiness Assessment */}
        <Tooltip label="AI Readiness" content="How well can AI assistants like ChatGPT or Claude understand your codebase? This tells you if you can paste the whole thing or need to feed it in chunks.">
        <section className="intel-panel ai-panel">
          <h3 onClick={() => toggleSection('ai')}>
            AI Readiness
            <span className="toggle">{expandedSection === 'ai' ? '−' : '+'}</span>
          </h3>
          <div className={`panel-content ${expandedSection === 'ai' ? 'expanded' : ''}`}>
            <div className="ai-assessment">
              <div className="ai-metric">
                <div className="ai-label">Context Window Fit</div>
                <div className="ai-value" style={{ color: contextFit.color }}>{contextFit.fit}</div>
                <div className="context-bar">
                  <div className="context-fill" style={{ width: `${contextFit.pct}%`, backgroundColor: contextFit.color }} />
                </div>
              </div>
              <div className="ai-metric">
                <div className="ai-label">Dependency Complexity</div>
                <div className="ai-value">
                  {stats.maxDependencyChainDepth > 10 ? 'High' : stats.maxDependencyChainDepth > 5 ? 'Medium' : 'Low'}
                </div>
                <div className="ai-hint">
                  {stats.maxDependencyChainDepth > 10
                    ? 'AI may struggle with deep chains'
                    : 'AI can trace dependencies'}
                </div>
              </div>
              <div className="ai-metric">
                <div className="ai-label">Recommended Strategy</div>
                <div className="ai-recommendation">
                  {contextFit.pct === 100
                    ? 'Feed full bundle to AI'
                    : contextFit.pct >= 50
                      ? 'Use chunked context with file summaries'
                      : 'Use RAG with vector search'}
                </div>
              </div>
            </div>
          </div>
        </section>
        </Tooltip>

        {/* Onboarding Intelligence */}
        <Tooltip label="Onboarding" content="How long will it take a new developer (or you, after a break) to understand this codebase? This estimate helps with hiring decisions and project planning.">
        <section className="intel-panel onboard-panel">
          <h3 onClick={() => toggleSection('onboard')}>
            Onboarding Intelligence
            <span className="toggle">{expandedSection === 'onboard' ? '−' : '+'}</span>
          </h3>
          <div className={`panel-content ${expandedSection === 'onboard' ? 'expanded' : ''}`}>
            <div className="onboard-estimate">
              <div className="time-estimate" style={{ color: onboarding.color }}>
                <span className="time-value">{onboarding.time}</span>
                <span className="time-label">{onboarding.label}</span>
              </div>
              <div className="onboard-factors">
                <div className="factor">
                  <span className="factor-name">Files to understand</span>
                  <span className="factor-value">{summary.totalFiles || 0}</span>
                </div>
                <div className="factor">
                  <span className="factor-name">Complexity depth</span>
                  <span className="factor-value">{stats.maxDependencyChainDepth || 0} layers</span>
                </div>
                <div className="factor">
                  <span className="factor-name">Circular traps</span>
                  <span className="factor-value">{stats.circularDependencies || 0}</span>
                </div>
              </div>
            </div>
          </div>
        </section>
        </Tooltip>

        {/* Build Profile */}
        {buildProfile.devFootprint && (
          <Tooltip label="Build Profile" content="How big is your project really? Dev footprint is everything on disk during development. Shipping weight is what users actually download. Big difference = optimization opportunity.">
          <section className="intel-panel build-panel">
            <h3 onClick={() => toggleSection('build')}>
              Build Profile
              <span className="toggle">{expandedSection === 'build' ? '−' : '+'}</span>
            </h3>
            <div className={`panel-content ${expandedSection === 'build' ? 'expanded' : ''}`}>
              <div className="build-metrics">
                <div className="build-section">
                  <div className="build-header">Dev Footprint</div>
                  <div className="build-total">{buildProfile.devFootprint.total}</div>
                  <div className="build-breakdown">
                    {Object.entries(buildProfile.devFootprint.breakdown || {}).map(([key, value]) => (
                      <div key={key} className="breakdown-item">
                        <span className="breakdown-label">{key}</span>
                        <span className="breakdown-value">{value as string}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="build-section">
                  <div className="build-header">Shipping Weight</div>
                  <div className="build-total" style={{ color: '#27AE60' }}>
                    {buildProfile.shippingWeight?.total || 'Not built'}
                  </div>
                  {buildProfile.shippingWeight?.installers?.length > 0 && (
                    <div className="build-installers">
                      {buildProfile.shippingWeight.installers.map((inst: any) => (
                        <div key={inst.name} className="installer-item">
                          <span className="installer-name">{inst.name}</span>
                          <span className="installer-size">{inst.size}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Dependencies */}
              {(buildProfile.dependencies?.npm?.length > 0 || buildProfile.dependencies?.cargo?.length > 0) && (
                <div className="deps-section">
                  <div className="deps-header">Heavy Dependencies</div>
                  <div className="deps-list">
                    {buildProfile.dependencies?.npm?.slice(0, 5).map((dep: any) => (
                      <div key={dep.name} className="dep-item">
                        <span className="dep-name">{dep.name}</span>
                        <span className="dep-version">{dep.version || ''}</span>
                        <span className="dep-size">{dep.size}</span>
                      </div>
                    ))}
                    {buildProfile.dependencies?.cargo?.slice(0, 3).map((dep: any) => (
                      <div key={dep.name} className="dep-item rust">
                        <span className="dep-name">{dep.name}</span>
                        <span className="dep-version">{dep.version}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
          </Tooltip>
        )}

        {/* Critical Path - Hub Files */}
        <Tooltip label="Hub Files" content="These are the most important files in your project - many other files depend on them. Changes here affect everything. Handle with extra care and testing.">
        <section className="intel-panel hubs-panel">
          <h3 onClick={() => toggleSection('hubs')}>
            Critical Path (Hub Files)
            <span className="badge">{hubFiles.length}</span>
            <span className="toggle">{expandedSection === 'hubs' ? '−' : '+'}</span>
          </h3>
          <div className={`panel-content ${expandedSection === 'hubs' ? 'expanded' : ''}`}>
            <p className="panel-hint">Changes here ripple everywhere. Handle with care.</p>
            <div className="hub-list">
              {hubFiles.slice(0, 8).map((hub: any, i: number) => (
                <div
                  key={hub.file}
                  className="hub-item"
                  onClick={() => onFileClick?.(hub.file)}
                >
                  <span className="hub-rank">#{i + 1}</span>
                  <span className="hub-name">{hub.file}</span>
                  <span className="hub-imports">{hub.importedBy} dependents</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        </Tooltip>

        {/* Entry Points */}
        <Tooltip label="Entry Points" content="Start here when learning the codebase. These are the 'front doors' - main files, index files, and app entry points where execution begins.">
        <section className="intel-panel entry-panel">
          <h3 onClick={() => toggleSection('entry')}>
            Entry Points
            <span className="badge">{entryPoints.length}</span>
            <span className="toggle">{expandedSection === 'entry' ? '−' : '+'}</span>
          </h3>
          <div className={`panel-content ${expandedSection === 'entry' ? 'expanded' : ''}`}>
            <p className="panel-hint">Start reading here. These are the doorways in.</p>
            <div className="entry-list">
              {entryPoints.slice(0, 6).map((entry: any) => (
                <div
                  key={entry.file || entry}
                  className="entry-item"
                  onClick={() => onFileClick?.(entry.file || entry)}
                >
                  <span className="entry-icon">&#9654;</span>
                  <span className="entry-name">{entry.file || entry}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
        </Tooltip>

        {/* Health Warnings */}
        {healthWarnings.length > 0 && (
          <Tooltip label="Health Warnings" content="Problems found during analysis. These are issues that could cause bugs, slow builds, or confuse developers. Address high-severity items first.">
          <section className="intel-panel warnings-panel">
            <h3 onClick={() => toggleSection('warnings')}>
              Health Warnings
              <span className="badge warning">{healthWarnings.length}</span>
              <span className="toggle">{expandedSection === 'warnings' ? '−' : '+'}</span>
            </h3>
            <div className={`panel-content ${expandedSection === 'warnings' ? 'expanded' : ''}`}>
              <div className="warning-summary">
                {Object.entries(warningsBySeverity).map(([sev, count]) => (
                  <span key={sev} className="warning-count" style={{ color: severityColor(sev) }}>
                    {count as number} {sev}
                  </span>
                ))}
              </div>
              <div className="warning-list">
                {healthWarnings.slice(0, 10).map((w: any, i: number) => (
                  <div
                    key={i}
                    className="warning-item"
                    style={{ borderLeftColor: severityColor(w.severity) }}
                    onClick={() => w.file && onFileClick?.(w.file)}
                  >
                    <span className="warning-type">{w.type}</span>
                    <span className="warning-file">{w.file || w.message}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>
          </Tooltip>
        )}

        {/* Circular Dependencies Detail */}
        {cycles.length > 0 && (
          <Tooltip label="Circular Deps" content="File A needs B, B needs C, C needs A - an infinite loop! These cause bugs, slow builds, and confuse AI tools. Breaking these cycles should be a priority.">
          <section className="intel-panel cycles-panel">
            <h3 onClick={() => toggleSection('cycles')}>
              Circular Dependencies
              <span className="badge danger">{cycles.length}</span>
              <span className="toggle">{expandedSection === 'cycles' ? '−' : '+'}</span>
            </h3>
            <div className={`panel-content ${expandedSection === 'cycles' ? 'expanded' : ''}`}>
              <p className="panel-hint">These create infinite loops. Break them.</p>
              <div className="cycle-list">
                {cycles.slice(0, 5).map((cycle: any, i: number) => (
                  <div key={i} className="cycle-item">
                    <span className="cycle-number">Cycle {i + 1}</span>
                    <div className="cycle-chain">
                      {(cycle.files || []).map((f: string, j: number) => (
                        <span key={j}>
                          <span className="cycle-file" onClick={() => onFileClick?.(f)}>{f.split('/').pop()}</span>
                          {j < (cycle.files?.length || 0) - 1 && <span className="cycle-arrow"> → </span>}
                        </span>
                      ))}
                      <span className="cycle-arrow"> ↻</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
          </Tooltip>
        )}
      </div>

      {/* Action Bar */}
      <footer className="report-actions">
        <button className="btn btn-primary" onClick={onOpenFolder}>Open in Explorer</button>
        <button className="btn btn-secondary" onClick={onCopyPath}>Copy Path</button>
        <button className="btn btn-ghost" onClick={() => navigator.clipboard.writeText(JSON.stringify(result, null, 2))}>
          Export JSON
        </button>
      </footer>
    </div>
  )
}
