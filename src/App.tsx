/**
 * SPDX-License-Identifier: MIT
 * Authors: Timothy Drake (Product & Design), Gemini (Unified Guide), Claude (Code Catalyst), Codex (Audit Witness)
 * Reviewed-by: Timothy Drake
 * Source: Keystone Constellation
 * Glyphs: BOM-STRICT | USER-TRUTH | RITUAL-VOW | MARKET-REALITY
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { join } from '@tauri-apps/api/path'
import { SettingsModal } from './components/SettingsModal'
import { TabInterface } from './components/TabInterface'
import { WelcomeOverlay } from './components/WelcomeOverlay'
import { LoomGraph } from './components/LoomGraph'
import { LoomControlPanel } from './components/LoomControlPanel'
import { TheConstruct } from './components/TheConstruct'
import { VaultOfValue } from './components/VaultOfValue'
import { AnalysisReport } from './components/AnalysisReport'
import { PrintableReport } from './components/PrintableReport'
import { Tooltip } from './components/Tooltip'
import { tooltips, getTooltip, VerbosityLevel } from './components/TooltipContent'
import './App.css'

// MAVERICK: Gnostic Shield (Error Boundary)
class ErrorBoundary extends React.Component<{children: React.ReactNode}, {hasError: boolean, error: any}> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="error-shield">
          <h2>Galaxy Engine Stalled</h2>
          <p>{this.state.error?.message || "Unknown Fracture"}</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Re-Ignite Engine</button>
        </div>
      );
    }
    return this.props.children;
  }
}

function App() {
  const [projectPath, setProjectPath] = useState('')
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sidebarPosition, setSidebarPosition] = useState<'left' | 'right'>('left')
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  
  // Drawer System: Stack of open tabs (last opened is on top)
  const [openDrawers, setOpenDrawers] = useState<TabKey[]>(['analysis']) 
  
  // --- VISUALIZATION STATE (Lifted) ---
  const [bloomIntensity, setBloomIntensity] = useState(1.35)
  const [starSize, setStarSize] = useState(0.5)
  const [linkOpacity, setLinkOpacity] = useState(0.4)
  const [starBrightness, setStarBrightness] = useState(1.0)
  const [chargeStrength, setChargeStrength] = useState(-60)
  const [twinkleIntensity, setTwinkleIntensity] = useState(0.5) // Lifted
  const [useShapes, setUseShapes] = useState(false)
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>([])
  const [soloFamily, setSoloFamily] = useState<string | null>(null)
  const [legendMode, setLegendMode] = useState<'intent' | 'tech'>('intent')

  const [activeVaultArticleId, setActiveVaultArticleId] = useState<string | undefined>()
  const [showWelcomeOverlay, setShowWelcomeOverlay] = useState(false)
  
  const toggleDrawer = useCallback((tab: TabKey) => {
    setOpenDrawers(prev => {
      if (prev.includes(tab)) {
        // If already open, close it (remove from stack)
        return prev.filter(t => t !== tab);
      } else {
        // If closed, open it (add to top of stack)
        return [...prev, tab];
      }
    });
  }, [])

  const onViewVault = useCallback((articleId: string) => {
    setActiveVaultArticleId(articleId)
    if (!openDrawers.includes('vault')) {
      toggleDrawer('vault');
    } else {
      // Bring to top
      setOpenDrawers(prev => [...prev.filter(t => t !== 'vault'), 'vault']);
    }
  }, [openDrawers, toggleDrawer])

  const [activeMission, setActiveMission] = useState<string | null>(null)
  const [introComplete, setIntroComplete] = useState(false)
  const [showAnalysisVideo, setShowAnalysisVideo] = useState(false)
  const [analysisVideoOpacity, setAnalysisVideoOpacity] = useState(1)
  const [graphReady, setGraphReady] = useState(false)
  const [dartAnimating, setDartAnimating] = useState(false)
  const [boardHit, setBoardHit] = useState(false)
  const [dartQuivering, setDartQuivering] = useState(false)
  const analysisVideoRef = useRef<HTMLVideoElement>(null)
  const [settings, setSettings] = useState({
    theme: 'Dark',
    excluded: 'node_modules,.git,dist,build',
    deepScan: true,
    autoSave: true,
    skipIntroAnimation: true,
    twinkleIntensity: 0.5,
    starBrightness: 1.0,
    skybox: 'none',
    tooltipLevel: 'professional' as VerbosityLevel
  })

  // Close splash screens when React is ready
  useEffect(() => {
    // Close native Tauri splash window immediately
    invoke('close_splash').catch(() => {})

    // Close HTML splash (with 3 second minimum wait)
    if ((window as any).__closeSplash) {
      (window as any).__closeSplash()
    }
  }, [])

  // Apply theme on settings change
  useEffect(() => {
    if (settings.skybox === 'none') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', settings.skybox);
    }
  }, [settings.skybox])

  const handleIntroComplete = useCallback(() => setIntroComplete(true), [])

  const selectDirectory = async () => {
    try {
      const selected = await open({
        directory: true,
        multiple: false,
        title: 'Select Project Directory'
      })
      if (selected && typeof selected === 'string') {
        setProjectPath(selected)
        setError(null)
        // Trigger dart animation sequence
        setDartAnimating(true)
        setBoardHit(true) // Start board reaction state
        setDartQuivering(false)
        
        // Phase 1: Flight ends, Quiver starts (0.7s)
        setTimeout(() => {
          setDartAnimating(false)
          setDartQuivering(true)
          
          // Phase 2: Quiver ends (0.7s + 0.5s = 1.2s)
          setTimeout(() => {
            setDartQuivering(false)
            // Auto-Fire Analysis AFTER quiver finishes
            analyzeProject(selected)
          }, 500)
          
          // Phase 3: Board recoil ends (0.7s + 0.53s = 1.23s)
          setTimeout(() => setBoardHit(false), 530)
        }, 700)
      }
    } catch (error) {
      setError('Failed to select directory')
    }
  }

  const analyzeProject = async (pathOverride?: string) => {
    const targetPath = typeof pathOverride === 'string' ? pathOverride : projectPath
    if (!targetPath) return
    setLoading(true)
    setError(null)
    setIntroComplete(false)
    setGraphReady(false)
    
    // START VORTEX: Visual feedback immediately
    setShowAnalysisVideo(true)
    setAnalysisVideoOpacity(1)

    try {
      const result = await invoke('analyze', {
        projectPath: targetPath,
        extensions: '',
        excluded: settings.excluded,
        theme: settings.theme
      })
      setAnalysisResult(result)

      // REVEAL GRAPH BEHIND VIDEO (starts explosion)
      setGraphReady(true)

      // FADE OUT VORTEX: Smooth transition to Mission Select
      let opacity = 1
      const fadeInterval = setInterval(() => {
        opacity -= 0.05
        if (opacity <= 0) {
          clearInterval(fadeInterval)
          setShowAnalysisVideo(false)
          setAnalysisVideoOpacity(0)
          
          // REVEAL UI
          setShowWelcomeOverlay(true)
          setIntroComplete(true)
        } else {
          setAnalysisVideoOpacity(opacity)
        }
      }, 30) // ~1.5s fade

      // Auto-save handled by backend database (SQLite)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setShowAnalysisVideo(false)
    } finally {
      setLoading(false)
    }
  }

  const loomDependencyGraph = useMemo(() => analysisResult?.dependencyGraph || {}, [analysisResult])
  const loomFileTypes = useMemo(() => {
    if (!analysisResult?.files) return {}
    return Object.fromEntries(Object.entries(analysisResult.files).map(([f, d]: [string, any]) => [f, d.category]))
  }, [analysisResult])
  const loomAllFiles = useMemo(() => analysisResult?.files || {}, [analysisResult])

  return (
    <div className={`app app-with-sidebar ${sidebarPosition === 'right' ? 'sidebar-right' : ''}`}>
      <aside className="sidebar">
        {/* ... Sidebar content kept identical ... */}
        <div className="sidebar-header">
          <h1>CodeGnosis</h1>
          <p className="subtitle">Project Analyzer Star</p>
          <div className="header-actions">
            <Tooltip content={getTooltip(tooltips.sidebar.settings, settings.tooltipLevel)} title="SETTINGS" anchored={true} anchorDirection={sidebarPosition === 'left' ? 'right' : 'left'}>
              <button className="btn-icon" onClick={() => setIsSettingsOpen(true)}>⚙️</button>
            </Tooltip>
            <Tooltip content={getTooltip(tooltips.sidebar.toggleSide, settings.tooltipLevel)} title="SIDEBAR SWAP SIDES" anchored={true} anchorDirection={sidebarPosition === 'left' ? 'right' : 'left'}>
              <button className="btn-toggle-side" onClick={() => setSidebarPosition(p => p === 'left' ? 'right' : 'left')}>
                {sidebarPosition === 'left' ? '→' : '←'}
              </button>
            </Tooltip>
          </div>
        </div>
        <div className="sidebar-controls">
          {!projectPath ? (
            <Tooltip content={getTooltip(tooltips.sidebar.selectDirectory, settings.tooltipLevel)} anchored={true} anchorDirection={sidebarPosition === 'left' ? 'right' : 'left'}>
              <button onClick={selectDirectory} className="btn btn-primary btn-hero-large">
                <span className="hero-text-top">TARGET</span>
                <span className="hero-text-bottom">SELECT & ANALYZE</span>
              </button>
            </Tooltip>
          ) : analysisResult ? (
            <Tooltip content={getTooltip(tooltips.sidebar.reset, settings.tooltipLevel)} anchored={true} anchorDirection={sidebarPosition === 'left' ? 'right' : 'left'}>
              <button onClick={() => { setProjectPath(''); setAnalysisResult(null); setError(null); }} className="btn btn-secondary btn-full btn-hero-analyze">
                RESET TO BASE
              </button>
            </Tooltip>
          ) : (
            <>
              {/* Analysis in progress state */}
              <div className="sidebar-controls-row">
                 <button className="btn btn-secondary btn-small" disabled={true}>Analysis in Progress...</button>
              </div>
            </>
          )}
        </div>
        {projectPath && (
          <div className="sidebar-section">
            <h3>Project</h3>
            <div className="project-path-sidebar">{projectPath.replace(/\//g, '\\').split('\\').pop()}</div>
            <div className="project-path-full">{projectPath}</div>
          </div>
        )}
        {error && <div className="sidebar-error"><strong>Error:</strong> {error}</div>}
        {analysisResult && (
          <div className="sidebar-section">
            <h3>Quick Stats</h3>
            <div className="sidebar-stats">
              <Tooltip content={getTooltip(tooltips.stats.files, settings.tooltipLevel)} anchored={true} anchorDirection={sidebarPosition === 'left' ? 'right' : 'left'}>
                <div className="sidebar-stat"><span className="stat-value">{analysisResult.summary?.totalFiles || 0}</span><span className="stat-label">Files</span></div>
              </Tooltip>
              <Tooltip content={getTooltip(tooltips.stats.links, settings.tooltipLevel)} anchored={true} anchorDirection={sidebarPosition === 'left' ? 'right' : 'left'}>
                <div className="sidebar-stat"><span className="stat-value">{analysisResult.summary?.totalConnections || 0}</span><span className="stat-label">Links</span></div>
              </Tooltip>
              <Tooltip 
                content={getTooltip(tooltips.stats.health, settings.tooltipLevel)} 
                anchored={true} 
                anchorDirection={sidebarPosition === 'left' ? 'right' : 'left'}
                articleId="concept-health"
                onViewVault={onViewVault}
              >
                <div className="sidebar-stat">
                  <span className="stat-value" style={{ color: (analysisResult.statistics?.connectivityHealthScore || 0) >= 80 ? '#4CAF50' : '#FF9800' }}>
                    {analysisResult.statistics?.connectivityHealthScore || 0}
                  </span>
                  <span className="stat-label">Health</span>
                </div>
              </Tooltip>
            </div>
          </div>
        )}
        <div className="sidebar-footer"><p>Keystone Constellation</p></div>
      </aside>

      <main className="main-content">
        {/* Tab Handles - Mechanical Toggles */}
        {analysisResult && (
          <TabInterface 
            openDrawers={openDrawers} 
            onToggleDrawer={toggleDrawer} 
            tooltipLevel={settings.tooltipLevel} 
            sidebarPosition={sidebarPosition} 
          />
        )}

        {/* Background Galaxy Layer */}
        {analysisResult && (
          <div className="loom-wrapper">
            <ErrorBoundary>
              <LoomGraph
                dependencyGraph={loomDependencyGraph}
                fileTypes={loomFileTypes}
                allFiles={loomAllFiles}
                cycles={analysisResult?.cycles || []}
                brokenReferences={analysisResult?.brokenReferences || []}
                activeMission={activeMission}
                skipIntroAnimation={settings.skipIntroAnimation}
                twinkleIntensity={twinkleIntensity}
                starBrightness={settings.starBrightness}
                skybox={settings.skybox}
                tooltipLevel={settings.tooltipLevel}
                onNodeClick={(file) => console.log('Selected:', file)}
                onIntroComplete={handleIntroComplete}
                onMissionChange={setActiveMission}
                // Lifted Props
                bloomIntensity={bloomIntensity}
                starSize={starSize}
                linkOpacity={linkOpacity}
                chargeStrength={chargeStrength}
                useShapes={useShapes}
                selectedFamilies={selectedFamilies}
                soloFamily={soloFamily}
                legendMode={legendMode}
              />
            </ErrorBoundary>
          </div>
        )}

        {/* Drawer Panels - Slide out over graph */}
        {analysisResult && (
          <div className="drawer-container">
            <div className={`drawer-panel ${openDrawers.includes('analysis') ? 'open' : 'closed'}`} style={{ zIndex: 50 + openDrawers.indexOf('analysis') }}>
              <AnalysisReport
                result={analysisResult}
                projectPath={projectPath}
                onOpenFolder={async () => await invoke('open_folder', { path: projectPath })}
                onCopyPath={async () => await navigator.clipboard.writeText(projectPath)}
                onFileClick={(file) => console.log('Navigate to:', file)}
                onViewVault={onViewVault}
              />
            </div>

            <div className={`drawer-panel ${openDrawers.includes('codeCity') ? 'open' : 'closed'}`} style={{ zIndex: 50 + openDrawers.indexOf('codeCity') }}>
              <TheConstruct analysisResult={analysisResult} />
            </div>

            <div className={`drawer-panel wide-drawer ${openDrawers.includes('vault') ? 'open' : 'closed'}`} style={{ zIndex: 50 + openDrawers.indexOf('vault') }}>
              <VaultOfValue 
                activeId={activeVaultArticleId} 
                onArticleChange={setActiveVaultArticleId} 
              />
            </div>

            <div className={`drawer-panel ${openDrawers.includes('controls') ? 'open' : 'closed'}`} style={{ zIndex: 50 + openDrawers.indexOf('controls') }}>
              <LoomControlPanel
                selectedFamilies={selectedFamilies}
                soloFamily={soloFamily}
                onToggleFamily={f => setSelectedFamilies(prev => prev.includes(f) ? prev.filter(x=>x!==f) : [...prev, f])}
                onSoloFamily={f => setSoloFamily(p => p === f ? null : f)}
                legendMode={legendMode}
                setLegendMode={setLegendMode}
                fileTypes={loomFileTypes}
                allFiles={loomAllFiles}
                bloomIntensity={bloomIntensity} setBloomIntensity={setBloomIntensity}
                starSize={starSize} setStarSize={setStarSize}
                linkOpacity={linkOpacity} setLinkOpacity={setLinkOpacity}
                starBrightness={starBrightness} setStarBrightness={setStarBrightness}
                twinkleIntensity={twinkleIntensity} setTwinkleIntensity={setTwinkleIntensity}
                chargeStrength={chargeStrength} setChargeStrength={setChargeStrength}
                skybox={settings.skybox} setSkybox={(val) => setSettings(s => ({ ...s, skybox: val }))}
                useShapes={useShapes} setUseShapes={setUseShapes}
                tooltipLevel={settings.tooltipLevel}
              />
            </div>

            <div className={`drawer-panel ${openDrawers.includes('graph') ? 'open' : 'closed'}`} style={{ zIndex: 50 + openDrawers.indexOf('graph') }}>
              <PrintableReport
                result={analysisResult}
                projectPath={projectPath}
                legendMode={legendMode}
                setLegendMode={setLegendMode}
              />
            </div>
          </div>
        )}

        {/* Loading Overlay */}
        {loading && !analysisResult && (
          <div className="content-shield">
            <div className="loading-state">
              <div className="spinner"></div>
              <div className="loading-text">Analyzing Project...</div>
              <div className="loading-subtext">Scanning files, tracing dependencies, building galaxy</div>
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && !analysisResult && (
          <div className="content-shield">
            <div className="empty-state">
              <div className="empty-state-icon">
                {projectPath ? (
                  <div className="dart-target-container">
                    <img src="/Dartboard.png" alt="" className={`dartboard-img ${boardHit ? 'dart-hit' : ''}`} />
                    <img
                      src="/Dart.png"
                      alt=""
                      className={`dart-img ${dartAnimating ? 'dart-flying' : ''} ${dartQuivering ? 'dart-quiver' : ''} ${!dartAnimating && !dartQuivering ? 'dart-landed' : ''}`}
                    />
                  </div>
                ) : '📂'}
              </div>
              <h2>{projectPath ? projectPath.replace(/\//g, '\\').split('\\').pop() : 'Select a Project'}</h2>
              <p>{projectPath ? 'Ready to analyze - click "Analyze Project" to begin' : 'Choose a directory to visualize its architecture.'}</p>
            </div>
          </div>
        )}
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onSave={(s) => { setSettings(s); setIsSettingsOpen(false); }}
        initialSettings={settings} 
      />

      {analysisResult && (
        <WelcomeOverlay 
          isOpen={showWelcomeOverlay} 
          onClose={() => {
            setShowWelcomeOverlay(false);
            setGraphReady(true);
          }} 
          onMissionSelect={(m) => {
            setActiveMission(m);
            setShowWelcomeOverlay(false);
            setGraphReady(true);
          }}
        />
      )}

      {/* Analysis video overlay - fades to black when done */}
      {showAnalysisVideo && (
        <div
          className="analysis-video-overlay"
          style={{ opacity: analysisVideoOpacity }}
        >
          <video
            ref={analysisVideoRef}
            className="analysis-video"
            src="/intro.mp4"
            autoPlay
            loop
            muted
            playsInline
          />
          <div className="analysis-loading-text">ANALYZING</div>
        </div>
      )}

    </div>
  )
}

export default App