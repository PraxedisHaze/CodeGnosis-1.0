/**
 * SPDX-License-Identifier: MIT
 * Authors: Timothy Drake (Product & Design), Gemini (Unified Guide), Claude (Code Catalyst), Codex (Audit Witness)
 * Reviewed-by: Timothy Drake
 * Source: Keystone Constellation
 * Glyphs: BOM-STRICT | USER-TRUTH | RITUAL-VOW | MARKET-REALITY
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { writeTextFile } from '@tauri-apps/plugin-fs'
import { join } from '@tauri-apps/api/path'
import { SettingsModal } from './components/SettingsModal'
import { TabInterface } from './components/TabInterface'
import { WelcomeOverlay } from './components/WelcomeOverlay'
import { LoomGraph } from './components/LoomGraph'
import { CodeCity } from './components/CodeCity'
import { VaultOfValue } from './components/VaultOfValue'
import { AnalysisReport } from './components/AnalysisReport'
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
  const [activeTab, setActiveTab] = useState<'analysis' | 'graph' | 'codeCity' | 'vault'>('analysis')
  const [showWelcomeOverlay, setShowWelcomeOverlay] = useState(false)
  const [activeMission, setActiveMission] = useState<string | null>(null)
  const [introComplete, setIntroComplete] = useState(false)
  const [settings, setSettings] = useState({
    theme: 'Dark',
    excluded: 'node_modules,.git,dist,build',
    deepScan: true,
    autoSave: true,
    skipIntroAnimation: false,
    twinkleIntensity: 0.5,
    starBrightness: 1.0,
    skybox: 'none'
  })

  // Apply theme on settings change
  useEffect(() => {
    if (settings.skybox === 'none') {
      document.documentElement.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', settings.skybox);
    }
  }, [settings.skybox])

  // No auto-hide - user must make a choice

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
      }
    } catch (error) {
      setError('Failed to select directory')
    }
  }

  const analyzeProject = async () => {
    if (!projectPath) return
    setLoading(true)
    setError(null)
    try {
      const result = await invoke('analyze', {
        projectPath,
        extensions: '',
        excluded: settings.excluded,
        theme: settings.theme
      })
      setAnalysisResult(result)
      setShowWelcomeOverlay(true)
      if (settings.autoSave) {
        try {
          const bundlePath = await join(projectPath, 'ai-bundle.json')
          await writeTextFile(bundlePath, JSON.stringify(result, null, 2))
        } catch (saveErr) {}
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
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
        <div className="sidebar-header">
          <h1>CodeGnosis</h1>
          <p className="subtitle">Project Analyzer Star</p>
          <div className="header-actions">
            <button className="btn-icon" onClick={() => setIsSettingsOpen(true)}>⚙️</button>
            <button className="btn-toggle-side" onClick={() => setSidebarPosition(p => p === 'left' ? 'right' : 'left')}>
              {sidebarPosition === 'left' ? '→' : '←'}
            </button>
          </div>
        </div>
        <div className="sidebar-controls">
          <button onClick={selectDirectory} disabled={!!projectPath} className="btn btn-primary btn-full">Select Directory</button>
          <button onClick={analyzeProject} disabled={!projectPath || loading || !!analysisResult} className="btn btn-success btn-full">
            {loading ? 'Analyzing...' : 'Analyze Project'}
          </button>
          <button onClick={() => { setProjectPath(''); setAnalysisResult(null); setError(null); }} className="btn btn-secondary btn-full">Reset</button>
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
              <div className="sidebar-stat"><span className="stat-value">{analysisResult.summary?.totalFiles || 0}</span><span className="stat-label">Files</span></div>
              <div className="sidebar-stat"><span className="stat-value">{analysisResult.summary?.totalConnections || 0}</span><span className="stat-label">Links</span></div>
              <div className="sidebar-stat">
                <span className="stat-value" style={{ color: (analysisResult.statistics?.connectivityHealthScore || 0) >= 80 ? '#4CAF50' : '#FF9800' }}>
                  {analysisResult.statistics?.connectivityHealthScore || 0}
                </span>
                <span className="stat-label">Health</span>
              </div>
            </div>
          </div>
        )}
        <div className="sidebar-footer"><p>Keystone Constellation</p></div>
      </aside>

      <main className="main-content">
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
                twinkleIntensity={settings.twinkleIntensity}
                starBrightness={settings.starBrightness}
                skybox={settings.skybox}
                onNodeClick={(file) => console.log('Selected:', file)}
                onIntroComplete={handleIntroComplete}
              />
            </ErrorBoundary>
          </div>
        )}

        {/* HUD UI Layer - hidden during intro video */}
        {(introComplete || settings.skipIntroAnimation || !analysisResult) && (
          <div className="content-shield">
            {analysisResult && (
              <div className="tab-row-top">
                <TabInterface activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab)} />
              </div>
            )}

            {loading && !analysisResult && (
              <div className="loading-state">
                <div className="spinner"></div>
                <div className="loading-text">Analyzing Project...</div>
                <div className="loading-subtext">Scanning files, tracing dependencies, building galaxy</div>
              </div>
            )}

            {analysisResult && activeTab === 'codeCity' && <CodeCity analysisResult={analysisResult} />}
            {activeTab === 'vault' && <VaultOfValue />}

            {analysisResult && activeTab === 'analysis' && (
              <AnalysisReport
                result={analysisResult}
                projectPath={projectPath}
                onOpenFolder={async () => await invoke('open_folder', { path: projectPath })}
                onCopyPath={async () => await navigator.clipboard.writeText(projectPath)}
                onFileClick={(file) => console.log('Navigate to:', file)}
              />
            )}

            {!loading && !analysisResult && (
              <div className="empty-state">
                <div className="empty-state-icon">{projectPath ? '🎯' : '📂'}</div>
                <h2>{projectPath ? projectPath.replace(/\//g, '\\').split('\\').pop() : 'Select a Project'}</h2>
                <p>{projectPath ? 'Ready to analyze - click "Analyze Project" to begin' : 'Choose a directory to visualize its architecture.'}</p>
              </div>
            )}
          </div>
        )}
      </main>

      <SettingsModal 
        isOpen={isSettingsOpen} 
        onClose={() => setIsSettingsOpen(false)} 
        onSave={(s) => { setSettings(s); setIsSettingsOpen(false); }}
        initialSettings={settings} 
      />

      {showWelcomeOverlay && analysisResult && (introComplete || settings.skipIntroAnimation) && (
        <WelcomeOverlay
          result={analysisResult}
          onClose={(m) => { setShowWelcomeOverlay(false); if (m && m !== 'default') { setActiveMission(m); setActiveTab('graph'); } }}
          onReset={() => { setShowWelcomeOverlay(false); setProjectPath(''); setAnalysisResult(null); setIntroComplete(false); }}
        />
      )}
    </div>
  )
}

export default App