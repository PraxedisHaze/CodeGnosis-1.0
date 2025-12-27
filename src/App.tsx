// BOM-STRICT
import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import DependencyGraph from './DependencyGraph'
import './App.css'

function App() {
  const [projectPath, setProjectPath] = useState('')
  const [analysisResult, setAnalysisResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
        console.log('[CodeGnosis] Directory selected:', selected)
      }
    } catch (error) {
      console.error('[CodeGnosis] Error selecting directory:', error)
      setError('Failed to select directory')
    }
  }

  const analyzeProject = async () => {
    if (!projectPath) return

    setLoading(true)
    setError(null)
    setAnalysisResult(null)

    try {
      const result = await invoke('analyze', {
        projectPath,
        extensions: '',  // Empty = analyze all files
        excluded: 'node_modules,.git,dist,build',
        theme: 'Dark'
      })
      setAnalysisResult(result)
      console.log('[CodeGnosis] Analysis complete:', result)
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err)
      console.error('[CodeGnosis] Analysis failed:', err)
      setError(errorMsg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>CodeGnosis</h1>
        <p className="subtitle">Project Analyzer Star</p>
      </header>

      <main className="app-main">
        <div className="controls">
          <button onClick={selectDirectory} className="btn btn-primary">
            Select Directory
          </button>

          <button
            onClick={() => {
              setProjectPath('')
              setAnalysisResult(null)
              setError(null)
            }}
            className="btn btn-secondary"
            style={{ marginLeft: '0.5rem' }}
          >
            Reset
          </button>

          {projectPath && (
            <div className="project-path">
              <strong>Project:</strong> {projectPath}
            </div>
          )}

          {error && (
            <div className="error-message" style={{
              padding: '1rem',
              background: '#ff4444',
              color: 'white',
              borderRadius: '8px',
              marginTop: '1rem'
            }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          <button
            onClick={analyzeProject}
            disabled={!projectPath || loading}
            className="btn btn-success"
          >
            {loading ? 'Analyzing...' : 'Generate Visual Chart'}
          </button>
        </div>

        {loading && (
          <div className="loading" style={{
            textAlign: 'center',
            padding: '3rem 2rem',
            fontSize: '1.2rem'
          }}>
            <div className="spinner" style={{
              width: '60px',
              height: '60px',
              margin: '0 auto 1.5rem',
              border: '4px solid var(--aeth-border)',
              borderTop: '4px solid var(--aeth-primary)',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite'
            }}></div>
            <div style={{fontWeight: 'bold', marginBottom: '0.5rem'}}>Analyzing Project...</div>
            <div style={{fontSize: '0.9rem', opacity: 0.7}}>
              Scanning files, tracing dependencies, building graph
            </div>
            <div style={{
              marginTop: '1.5rem',
              display: 'flex',
              justifyContent: 'center',
              gap: '0.5rem'
            }}>
              <span className="dot" style={{
                width: '8px',
                height: '8px',
                background: 'var(--aeth-primary)',
                borderRadius: '50%',
                animation: 'pulse 1.4s infinite ease-in-out',
                animationDelay: '0s'
              }}></span>
              <span className="dot" style={{
                width: '8px',
                height: '8px',
                background: 'var(--aeth-primary)',
                borderRadius: '50%',
                animation: 'pulse 1.4s infinite ease-in-out',
                animationDelay: '0.2s'
              }}></span>
              <span className="dot" style={{
                width: '8px',
                height: '8px',
                background: 'var(--aeth-primary)',
                borderRadius: '50%',
                animation: 'pulse 1.4s infinite ease-in-out',
                animationDelay: '0.4s'
              }}></span>
            </div>
            <style>{`
              @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
              }
              @keyframes pulse {
                0%, 80%, 100% { transform: scale(0.6); opacity: 0.5; }
                40% { transform: scale(1); opacity: 1; }
              }
            `}</style>
          </div>
        )}

        {analysisResult && (
          <div className="results">
            <h2>Analysis Results</h2>

            {/* Stats Grid */}
            <div className="stats-grid" style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1rem',
              marginBottom: '2rem'
            }}>
              <div className="stat-card" style={{padding: '1rem', background: 'var(--aeth-border)', borderRadius: '8px'}}>
                <div style={{fontSize: '0.9rem', opacity: 0.7}}>Total Files</div>
                <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{analysisResult.summary?.totalFiles || 0}</div>
              </div>
              <div className="stat-card" style={{padding: '1rem', background: 'var(--aeth-border)', borderRadius: '8px'}}>
                <div style={{fontSize: '0.9rem', opacity: 0.7}}>Dependencies</div>
                <div style={{fontSize: '2rem', fontWeight: 'bold'}}>{analysisResult.summary?.totalConnections || 0}</div>
              </div>
              <div className="stat-card" style={{padding: '1rem', background: 'var(--aeth-border)', borderRadius: '8px'}}>
                <div style={{fontSize: '0.9rem', opacity: 0.7}}>Health Score</div>
                <div style={{fontSize: '2rem', fontWeight: 'bold', color:
                  (analysisResult.statistics?.connectivityHealthScore || 0) >= 80 ? '#4CAF50' :
                  (analysisResult.statistics?.connectivityHealthScore || 0) >= 60 ? '#FF9800' : '#f44336'
                }}>{analysisResult.statistics?.connectivityHealthScore || 0}/100</div>
              </div>
              <div className="stat-card" style={{padding: '1rem', background: 'var(--aeth-border)', borderRadius: '8px'}}>
                <div style={{fontSize: '0.9rem', opacity: 0.7}}>Project Type</div>
                <div style={{fontSize: '1rem', fontWeight: 'bold', marginTop: '0.5rem'}}>{analysisResult.summary?.projectType || 'Unknown'}</div>
              </div>
            </div>

            {/* Frameworks Detected */}
            {analysisResult.summary?.detectedFrameworks && analysisResult.summary.detectedFrameworks.length > 0 && (
              <div style={{marginBottom: '2rem', padding: '1rem', background: 'var(--aeth-border)', borderRadius: '8px'}}>
                <h3 style={{margin: '0 0 0.5rem 0', fontSize: '1.1rem'}}>🛠️ Detected Frameworks</h3>
                <div style={{display: 'flex', gap: '0.5rem', flexWrap: 'wrap'}}>
                  {analysisResult.summary.detectedFrameworks.map((fw: string) => (
                    <span key={fw} style={{
                      padding: '0.25rem 0.75rem',
                      background: 'var(--aeth-primary)',
                      color: 'white',
                      borderRadius: '12px',
                      fontSize: '0.85rem'
                    }}>{fw}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Health Warnings */}
            {analysisResult.healthWarnings && analysisResult.healthWarnings.length > 0 && (
              <div style={{marginBottom: '2rem'}}>
                <h3 style={{margin: '0 0 1rem 0', fontSize: '1.2rem'}}>⚠️ Health Warnings ({analysisResult.healthWarnings.length})</h3>
                <div style={{display: 'flex', flexDirection: 'column', gap: '0.75rem'}}>
                  {analysisResult.healthWarnings.slice(0, 10).map((warning: any, idx: number) => (
                    <div key={idx} style={{
                      padding: '1rem',
                      background: warning.severity === 'high' ? '#ff44441a' : '#ff980026',
                      border: `1px solid ${warning.severity === 'high' ? '#ff4444' : '#FF9800'}`,
                      borderRadius: '8px'
                    }}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem'}}>
                        <span style={{
                          padding: '0.125rem 0.5rem',
                          background: warning.severity === 'high' ? '#ff4444' : '#FF9800',
                          color: 'white',
                          borderRadius: '4px',
                          fontSize: '0.75rem',
                          fontWeight: 'bold',
                          textTransform: 'uppercase'
                        }}>{warning.severity}</span>
                        <span style={{fontWeight: 'bold'}}>{warning.type.replace(/_/g, ' ').toUpperCase()}</span>
                      </div>
                      {warning.type === 'circular_dependency' && (
                        <div style={{fontSize: '0.9rem', opacity: 0.9}}>
                          Cycle: {warning.files?.join(' → ')}
                        </div>
                      )}
                      {warning.type === 'missing_asset' && (
                        <div style={{fontSize: '0.9rem', opacity: 0.9}}>
                          File: <code style={{background: 'var(--aeth-bg)', padding: '0.125rem 0.25rem', borderRadius: '2px'}}>{warning.file}</code>
                          <br/>Missing: {warning.missingAssets?.join(', ')}
                        </div>
                      )}
                      {warning.type === 'unused_file' && (
                        <div style={{fontSize: '0.9rem', opacity: 0.9}}>
                          File: <code style={{background: 'var(--aeth-bg)', padding: '0.125rem 0.25rem', borderRadius: '2px'}}>{warning.file}</code>
                          <br/>{warning.reason}
                        </div>
                      )}
                    </div>
                  ))}
                  {analysisResult.healthWarnings.length > 10 && (
                    <div style={{textAlign: 'center', opacity: 0.7, fontSize: '0.9rem'}}>
                      ... and {analysisResult.healthWarnings.length - 10} more warnings (view full JSON)
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Entry Points */}
            <div style={{marginBottom: '2rem', padding: '1rem', background: 'var(--aeth-border)', borderRadius: '8px'}}>
              <h3 style={{margin: '0 0 0.75rem 0', fontSize: '1.1rem'}}>
                🎯 Entry Points ({analysisResult.entryPoints?.length || 0})
              </h3>
              <div style={{fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.5rem'}}>
                Files that are not imported by anything else
              </div>
              {analysisResult.entryPoints && analysisResult.entryPoints.length > 0 ? (
                <div style={{display: 'flex', flexDirection: 'column', gap: '0.25rem'}}>
                  {analysisResult.entryPoints.slice(0, 5).map((ep: any, idx: number) => (
                    <div key={idx} style={{fontSize: '0.9rem'}}>
                      <code style={{background: 'var(--aeth-bg)', padding: '0.25rem 0.5rem', borderRadius: '4px'}}>
                        {ep.file}
                      </code>
                      <span style={{marginLeft: '0.5rem', opacity: 0.6}}>({ep.category})</span>
                    </div>
                  ))}
                  {analysisResult.entryPoints.length > 5 && (
                    <div style={{opacity: 0.6, fontSize: '0.85rem', marginTop: '0.25rem'}}>
                      ... and {analysisResult.entryPoints.length - 5} more
                    </div>
                  )}
                </div>
              ) : (
                <div style={{fontSize: '0.9rem', opacity: 0.7, fontStyle: 'italic'}}>
                  No standalone entry points detected. All files are imported by others, or check for circular dependencies.
                </div>
              )}
            </div>

            {/* Hub Files */}
            {analysisResult.hubFiles && analysisResult.hubFiles.length > 0 && (
              <div style={{marginBottom: '2rem', padding: '1rem', background: 'var(--aeth-border)', borderRadius: '8px'}}>
                <h3 style={{margin: '0 0 0.75rem 0', fontSize: '1.1rem'}}>🔥 Hub Files (Most Imported)</h3>
                <div style={{fontSize: '0.85rem', opacity: 0.7, marginBottom: '0.5rem'}}>These files are used by many others</div>
                <div style={{display: 'flex', flexDirection: 'column', gap: '0.5rem'}}>
                  {analysisResult.hubFiles.map((hub: any, idx: number) => (
                    <div key={idx} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '0.5rem',
                      background: 'var(--aeth-bg)',
                      borderRadius: '4px'
                    }}>
                      <code style={{fontSize: '0.9rem'}}>{hub.file}</code>
                      <span style={{
                        padding: '0.25rem 0.5rem',
                        background: 'var(--aeth-primary)',
                        color: 'white',
                        borderRadius: '12px',
                        fontSize: '0.75rem',
                        fontWeight: 'bold'
                      }}>
                        {hub.importedBy} imports
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Interactive Dependency Graph */}
            <div style={{marginBottom: '2rem'}}>
              <h3 style={{margin: '0 0 1rem 0', fontSize: '1.2rem'}}>🗺️ Dependency Graph</h3>

              {analysisResult.graphSkipReason && (
                <div style={{
                  marginBottom: '1rem',
                  padding: '0.75rem 1rem',
                  background: '#ff980026',
                  border: '1px solid #FF9800',
                  borderRadius: '8px',
                  color: '#d35400'
                }}>
                  {analysisResult.graphSkipReason}
                </div>
              )}

              {analysisResult.dependencyGraph && analysisResult.files ? (
                <>
                  <div style={{fontSize: '0.85rem', opacity: 0.7, marginBottom: '1rem'}}>
                    Interactive visualization - drag nodes, zoom, pan. Colors represent file types.
                  </div>
                  <DependencyGraph
                    dependencyGraph={analysisResult.dependencyGraph}
                    fileTypes={Object.fromEntries(
                      Object.entries(analysisResult.files).map(([file, data]: [string, any]) => [file, data.category])
                    )}
                    allFiles={analysisResult.files}
                    projectPath={projectPath}
                  />
                </>
              ) : (
                <div style={{fontSize: '0.9rem', opacity: 0.7}}>
                  No dependency graph available for this analysis. Check the JSON output for details.
                </div>
              )}
            </div>

            {/* Full JSON Collapsed */}
            <details style={{marginTop: '1rem'}}>
              <summary style={{cursor: 'pointer', padding: '0.5rem', background: 'var(--aeth-border)', borderRadius: '4px'}}>
                📄 View Full JSON
              </summary>
              <pre style={{marginTop: '1rem', padding: '1rem', background: 'var(--aeth-bg)', borderRadius: '4px', overflow: 'auto', maxHeight: '400px'}}>
                {JSON.stringify(analysisResult, null, 2)}
              </pre>
            </details>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <p>Part of the Alethéari Constellation</p>
        <code>window.AETH.version: {window.AETH?.version}</code>
      </footer>
    </div>
  )
}

export default App
