// BOM-STRICT
// Tooltip.tsx - Smart tooltip that avoids cursor occlusion
// Appears above or below based on screen position, wraps long text

import { useState, useRef, useEffect, ReactNode } from 'react'
import './Tooltip.css'

interface TooltipProps {
  content: string
  children: ReactNode
  maxWidth?: number
}

export function Tooltip({ content, children, maxWidth = 280 }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<'above' | 'below'>('below')
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const tooltipRef = useRef<HTMLDivElement>(null)

  const handleMouseEnter = (e: React.MouseEvent) => {
    const viewportMidY = window.innerHeight / 2
    const cursorY = e.clientY

    // If cursor is in top half, show tooltip below; if bottom half, show above
    setPosition(cursorY < viewportMidY ? 'below' : 'above')
    setVisible(true)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    setCoords({ x: e.clientX, y: e.clientY })
  }

  const handleMouseLeave = () => {
    setVisible(false)
  }

  // Format content: break at natural boundaries for long text
  const formatContent = (text: string): string[] => {
    if (text.length <= 60) return [text]

    // Try to break at sentence boundaries first (. ! ?)
    const sentences = text.split(/(?<=[.!?])\s+/)
    if (sentences.length > 1 && sentences.every(s => s.length <= 70)) {
      return sentences
    }

    // Try to break at clause boundaries (commas, semicolons, colons, dashes)
    const clauses = text.split(/(?<=[,;:\-])\s+/)
    if (clauses.length > 1) {
      const lines: string[] = []
      let currentLine = ''

      for (const clause of clauses) {
        if (currentLine.length === 0) {
          currentLine = clause
        } else if ((currentLine + ' ' + clause).length <= 65) {
          currentLine = currentLine + ' ' + clause
        } else {
          lines.push(currentLine)
          currentLine = clause
        }
      }
      if (currentLine) lines.push(currentLine)
      return lines
    }

    // Fallback: break at word boundaries, aiming for ~60 char lines
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= 60) {
        currentLine = (currentLine + ' ' + word).trim()
      } else {
        if (currentLine) lines.push(currentLine)
        currentLine = word
      }
    }
    if (currentLine) lines.push(currentLine)

    return lines
  }

  const lines = formatContent(content)

  return (
    <div
      ref={triggerRef}
      className="tooltip-trigger"
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
    >
      {children}
      {visible && (
        <div
          ref={tooltipRef}
          className={`tooltip-box tooltip-${position}`}
          style={{
            left: coords.x,
            top: position === 'below' ? coords.y + 20 : coords.y - 20,
            maxWidth: maxWidth,
            transform: position === 'below'
              ? 'translateX(-50%)'
              : 'translateX(-50%) translateY(-100%)'
          }}
        >
          {lines.map((line, i) => (
            <span key={i} className="tooltip-line">{line}</span>
          ))}
        </div>
      )}
    </div>
  )
}
