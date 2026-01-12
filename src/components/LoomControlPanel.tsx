import React, { useState, useRef, useEffect } from 'react'
import './LoomControlPanel.css'
import { Tooltip } from './Tooltip'
import { tooltips, getTooltip, VerbosityLevel } from './TooltipContent'

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
  chargeStrength: number
  setChargeStrength: (val: number) => void
  skybox: string
  setSkybox: (val: string) => void
  useShapes: boolean
  setUseShapes: (val: boolean) => void
  tooltipLevel: VerbosityLevel
}

export function LoomControlPanel(props: Props) {
  const [pos, setPos] = useState({ x: 16, y: 24 })
  const [isDragging, setIsDragging] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [calibrationOpen, setCalibrationOpen] = useState(true)
  const dragStart = useRef({ x: 0, y: 0 })
  const level = props.tooltipLevel

  useEffect(() => {
    if (!isDragging) return
    const onMove = (e: MouseEvent) => {
      // Clamp position so the 'Controls' box can't leave the viewport
      const newX = Math.max(0, Math.min(window.innerWidth - 340, e.clientX - dragStart.current.x))
      const newY = Math.max(0, Math.min(window.innerHeight - 40, e.clientY - dragStart.current.y))
      setPos({ x: newX, y: newY })
    }
    const onUp = () => setIsDragging(false)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDragging])

  const startDrag = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).tagName === 'BUTTON') return
    setIsDragging(true)
    dragStart.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
  }

  if (collapsed) {
    return (
      <div className="lcp" style={{ left: pos.x, top: pos.y }} onClick={() => setCollapsed(false)}>
        <div className="lcp-collapsed">☰</div>
      </div>
    )
  }

  return (
    <div className="lcp" style={{ left: pos.x, top: pos.y }}>
      <div className="lcp-header" onMouseDown={startDrag}>
        <span>Controls</span>
        <button onClick={() => setCollapsed(true)}>−</button>
      </div>

      <div className="lcp-body">
        {/* LEGEND */}
        <div className="lcp-section">
          <div className="lcp-section-title">Galaxy Map</div>
          <div className="lcp-legend-grid">
            {FAMILIES.map(fam => {
              const active = props.soloFamily === fam.name
              return (
                <div
                  key={fam.name}
                  className={`lcp-legend-item ${active ? 'active' : ''}`}
                  style={{ 
                    background: `${fam.color}15`, // Dimly colored background (15% opacity)
                    color: active ? '#fff' : 'rgba(255,255,255,0.7)'
                  }}
                  onClick={() => props.onSoloFamily(fam.name)}
                >
                  <div
                    className="lcp-dot"
                    style={{ 
                      background: fam.color,
                      color: fam.color, // For box-shadow currentColor
                      boxShadow: `0 0 10px ${fam.color}` 
                    }}
                  />
                  <span>{fam.name}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* CALIBRATION */}
        <div className="lcp-section">
          <div className="lcp-section-title lcp-clickable" onClick={() => setCalibrationOpen(!calibrationOpen)}>
            Calibration <span>{calibrationOpen ? '−' : '+'}</span>
          </div>
          {calibrationOpen && (
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
              <Tooltip content={getTooltip(tooltips.controls.spread, level)} anchored>
                <div className="lcp-slider">
                  <label>Spread <small>(Gravity)</small></label>
                  <div className="lcp-segmented-control">
                    <button 
                      className={props.chargeStrength > -30 ? 'active' : ''} 
                      onClick={() => props.setChargeStrength(-10)}
                      title="Compact View"
                    >
                      Tight
                    </button>
                    <button 
                      className={props.chargeStrength <= -30 && props.chargeStrength > -100 ? 'active' : ''} 
                      onClick={() => props.setChargeStrength(-60)}
                      title="Standard View"
                    >
                      Norm
                    </button>
                    <button 
                      className={props.chargeStrength <= -100 ? 'active' : ''} 
                      onClick={() => props.setChargeStrength(-300)}
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
                  </select>
                </div>
              </Tooltip>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
