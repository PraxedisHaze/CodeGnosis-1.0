import React, { useState, useRef, useEffect, useMemo } from 'react'
import './LoomControlPanel.css'
import { Tooltip } from './Tooltip'
import { tooltips, getTooltip, VerbosityLevel } from './TooltipContent'

const CATEGORY_FAMILIES: Record<string, string> = {
  'TypeScript': 'Logic', 'TypeScript React': 'Logic', 'JavaScript': 'Logic', 'JavaScript Module': 'Logic', 'React': 'Logic', 'Rust': 'Logic', 'Python': 'Logic', 'TypeScript Module': 'Logic',
  'CSS': 'UI', 'SCSS': 'UI', 'HTML': 'UI', 'JSON': 'Data', 'YAML': 'Data', 'TOML': 'Data', 'SQL': 'Data', 'XML': 'Data',
  'Config': 'Config', 'ENV': 'Config', 'INI': 'Config', 'Image': 'Assets', 'Font': 'Assets', 'Video': 'Assets', 'Audio': 'Assets',
  'Markdown': 'Docs', 'Text': 'Docs', 'External': 'External'
}

// Alphabetized families - grid auto-expands for more
const FAMILIES = [
  { name: 'Assets', color: '#9370DB', tooltipKey: 'assets' as const },
  { name: 'Config', color: '#32CD32', tooltipKey: 'config' as const },
  { name: 'Data', color: '#FF4500', tooltipKey: 'logic' as const },
  { name: 'Docs', color: '#86efac', tooltipKey: 'assets' as const },
  { name: 'Logic', color: '#00BFFF', tooltipKey: 'logic' as const },
  { name: 'UI', color: '#FFD700', tooltipKey: 'components' as const },
]

interface Props {
  selectedFamilies: string[]
  soloFamily: string | null
  onToggleFamily: (family: string) => void
  onSoloFamily: (family: string) => void
  bloomIntensity: number
  setBloomIntensity: (val: number) => void
  starSize: number
  setStarSize: (val: number) => void
  linkOpacity: number
  setLinkOpacity: (val: number) => void
  starBrightness: number
  setStarBrightness: (val: number) => void
  twinkleIntensity: number
  setTwinkleIntensity: (val: number) => void
  chargeStrength: number
  setChargeStrength: (val: number) => void
  skybox: string
  setSkybox: (val: string) => void
  useShapes: boolean
  setUseShapes: (val: boolean) => void
  tooltipLevel: VerbosityLevel
  legendMode: 'intent' | 'tech'
  setLegendMode: (mode: 'intent' | 'tech') => void
  fileTypes: Record<string, string>
  allFiles: Record<string, any>
}

export function LoomControlPanel(props: Props) {
  const [calibrationOpen, setCalibrationOpen] = useState(true)
  const level = props.tooltipLevel

  // Map of Anothen Intent labels
  const ANOTHEN_LABELS: Record<string, string> = {
    'Logic': 'The Sovereign',
    'UI': 'The Mirror',
    'Data': 'The Ground',
    'Config': 'The Braid',
    'Assets': 'The Material', // From Lexicon: The Material or Assets
    'Docs': 'The Archive',
    'External': 'The External',
    'Unknown': 'The Void'
  }

  // Calculate counts for Tech mode
  const techCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    Object.values(props.fileTypes).forEach(type => {
      counts[type] = (counts[type] || 0) + 1
    })
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }, [props.fileTypes])

  // Calculate counts for Intent mode
  const intentCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    Object.entries(props.allFiles).forEach(([path, info]) => {
      // Use the same heuristic as LoomGraph
      let family = CATEGORY_FAMILIES[info.category] || 'Unknown'
      const filename = path.split(/[\\/]/).pop()?.toLowerCase() || ''
      if (filename.includes('config') || filename.includes('settings') || filename.includes('constant')) {
        family = 'Config'
      }
      counts[family] = (counts[family] || 0) + 1
    })
    return counts
  }, [props.allFiles])

  const getTechColor = (type: string): string => {
    const colors = ['#00BFFF', '#FFD700', '#FF6633', '#32CD32', '#B794F6', '#A8F5C8', '#ff00ff', '#FF4500', '#ADFF2F', '#00FA9A', '#00CED1', '#FF69B4'];
    let hash = 0; for (let i = 0; i < type.length; i++) hash = ((hash << 5) - hash) + type.charCodeAt(i);
    return colors[Math.abs(hash) % colors.length];
  }

  return (
    <div className="lcp-static">
      <div className="lcp-header-static">
        <span>Map Legend</span>
        <div className="lcp-mode-toggle">
          <button className={props.legendMode === 'intent' ? 'active' : ''} onClick={() => props.setLegendMode('intent')}>Intent</button>
          <button className={props.legendMode === 'tech' ? 'active' : ''} onClick={() => props.setLegendMode('tech')}>Tech</button>
        </div>
      </div>

      <div className="lcp-body">
        {/* DYNAMIC LEGEND */}
        <div className="lcp-section">
          <div className="lcp-section-title">
            {props.legendMode === 'intent' ? 'Anothen Intent' : 'Technology Type'}
          </div>
          <div className="lcp-legend-grid">
            {props.legendMode === 'intent' ? (
              FAMILIES.map(fam => {
                const count = intentCounts[fam.name] || 0
                const active = props.soloFamily === fam.name
                if (count === 0) return null // Hide empty families
                return (
                  <div
                    key={fam.name}
                    className={`lcp-legend-item ${active ? 'active' : ''}`}
                    style={{ background: `${fam.color}15`, color: active ? '#fff' : 'rgba(255,255,255,0.7)' }}
                    onClick={() => props.onSoloFamily(fam.name)}
                  >
                    <div className="lcp-dot" style={{ background: fam.color, boxShadow: `0 0 10px ${fam.color}` }} />
                    <span className="lcp-label-text">{ANOTHEN_LABELS[fam.name]}</span>
                    <span className="lcp-count">{count}</span>
                  </div>
                )
              })
            ) : (
              techCounts.map(([type, count]) => {
                const color = getTechColor(type)
                return (
                  <div key={type} className="lcp-legend-item" style={{ background: `${color}15` }}>
                    <div className="lcp-dot" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
                    <span className="lcp-label-text">{type}</span>
                    <span className="lcp-count">{count}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>

        {/* CALIBRATION */}        <div className="lcp-section">
          <div className="lcp-calibration">
              <Tooltip content={getTooltip(tooltips.controls.atmosphere, level)} anchored>
                <div className="lcp-slider">
                  <label>Atmosphere <small>(Bloom)</small></label>
                  <input type="range" min="0" max="2" step="0.05" value={props.bloomIntensity} onChange={e => props.setBloomIntensity(+e.target.value)} />
                  <span>{Math.round(props.bloomIntensity * 100)}%</span>
                </div>
              </Tooltip>
              <Tooltip content={getTooltip(tooltips.controls.starMass, level)} anchored>
                <div className="lcp-slider">
                  <label>Star Mass <small>(Size)</small></label>
                  <input type="range" min="0" max="2" step="0.05" value={props.starSize} onChange={e => props.setStarSize(+e.target.value)} />
                  <span>{Math.round(props.starSize * 100)}%</span>
                </div>
              </Tooltip>
              <Tooltip content={getTooltip(tooltips.controls.cableLinks, level)} anchored>
                <div className="lcp-slider">
                  <label>Cable Links <small>(Lines)</small></label>
                  <input type="range" min="0" max="2" step="0.05" value={props.linkOpacity} onChange={e => props.setLinkOpacity(+e.target.value)} />
                  <span>{Math.round(props.linkOpacity * 100)}%</span>
                </div>
              </Tooltip>
              <Tooltip content={getTooltip(tooltips.controls.background, level)} anchored>
                <div className="lcp-slider">
                  <label>Background <small>(Stars)</small></label>
                  <input type="range" min="0" max="2" step="0.05" value={props.starBrightness} onChange={e => props.setStarBrightness(+e.target.value)} />
                  <span>{Math.round(props.starBrightness * 100)}%</span>
                </div>
              </Tooltip>
              <Tooltip content={getTooltip(tooltips.settings.twinkle, level)} anchored>
                <div className="lcp-slider">
                  <label>Twinkle <small>(Animation)</small></label>
                  <input type="range" min="0" max="1" step="0.1" value={props.twinkleIntensity} onChange={e => props.setTwinkleIntensity(+e.target.value)} />
                  <span>{Math.round(props.twinkleIntensity * 100)}%</span>
                </div>
              </Tooltip>
              <Tooltip content={getTooltip(tooltips.controls.spread, level)} anchored>
                <div className="lcp-slider">
                  <label>Spread <small>(Gravity)</small></label>
                  <div className="lcp-segmented-control">
                    <button
                      className={props.chargeStrength > -40 ? 'active' : ''}
                      onClick={() => props.setChargeStrength(-25)}
                      title="Compact View"
                    >
                      Tight
                    </button>
                    <button
                      className={props.chargeStrength <= -40 && props.chargeStrength > -100 ? 'active' : ''}
                      onClick={() => props.setChargeStrength(-60)}
                      title="Standard View"
                    >
                      Norm
                    </button>
                    <button
                      className={props.chargeStrength <= -100 ? 'active' : ''}
                      onClick={() => props.setChargeStrength(-150)}
                      title="Expanded View"
                    >
                      Wide
                    </button>
                  </div>
                </div>
              </Tooltip>
              <div className="lcp-slider">
                <label>Node Style</label>
                <div className="lcp-segmented-control">
                  <button className={!props.useShapes ? 'active' : ''} onClick={() => props.setUseShapes(false)}>Stars</button>
                  <button className={props.useShapes ? 'active' : ''} onClick={() => props.setUseShapes(true)}>Shapes</button>
                </div>
              </div>
              <Tooltip content={getTooltip(tooltips.controls.skybox, level)} anchored>
                <div className="lcp-slider">
                  <label>Skybox</label>
                  <select value={props.skybox} onChange={e => props.setSkybox(e.target.value)}>
                    <option value="none">Deep Space</option>
                    <option value="nebula">Nebula Purple</option>
                    <option value="cosmos">Cosmic Blue</option>
                    <option value="aurora">Aurora Green</option>
                    <option value="ember">Ember Red</option>
                    <option value="twilight">Twilight</option>
                    <option value="blueprint">Blueprint (Light)</option>
                  </select>
                </div>
              </Tooltip>
          </div>
        </div>
      </div>
    </div>
  )
}
