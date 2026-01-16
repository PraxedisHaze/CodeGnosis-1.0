// BOM-STRICT
// Tooltip.tsx - Micro-Portal Tooltips
// Supports pinning (Shift+Click or Icon), rich content, and Vault links

import { useState, useRef, ReactNode, useCallback } from 'react'
import { createPortal } from 'react-dom'
import './Tooltip.css'

interface TooltipProps {
  content: string
  title?: string
  children: ReactNode
  maxWidth?: number
  anchored?: boolean
  anchorDirection?: 'above' | 'below' | 'left' | 'right'
  articleId?: string
  onViewVault?: (articleId: string) => void
}

export function Tooltip({ 
  content,
  title,
  children, 
  maxWidth = 350, 
  anchored = false, 
  anchorDirection = 'right',
  articleId,
  onViewVault
}: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const [isPinned, setIsPinned] = useState(false)
  const [position, setPosition] = useState<'above' | 'below' | 'left' | 'right'>('below')
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const hideTimer = useRef<number | null>(null)
  const showTimer = useRef<number | null>(null)

  const updatePosition = useCallback((e?: React.MouseEvent) => {
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    
    // Estimate dimensions (since we render via portal, we can't measure before render easily)
    // We use safe estimates or measure after first render if we wanted to be pixel-perfect.
    // For now, robust estimation + safety margins.
    const estWidth = 320
    const estHeight = 150 

    if (anchored && triggerRef.current) {
      const targetEl = triggerRef.current.firstElementChild as HTMLElement || triggerRef.current
      const rect = targetEl.getBoundingClientRect()
      let x = 0, y = 0
      let newPos = anchorDirection

      // Default calculation based on preference
      if (anchorDirection === 'right') {
        x = rect.right + 10
        y = rect.top + rect.height / 2
      } else if (anchorDirection === 'left') {
        x = rect.left - 10
        y = rect.top + rect.height / 2
      } else {
        x = rect.left + rect.width / 2
        y = rect.top + rect.height / 2
        newPos = y < viewportHeight / 2 ? 'below' : 'above'
      }

      // COLLISION DETECTION & ADJUSTMENT
      // 1. Right Edge Breach
      if (anchorDirection === 'right' && x + estWidth > viewportWidth) {
        // Flip to left if space permits
        if (rect.left - estWidth > 0) {
          newPos = 'left'
          x = rect.left - 10
        } else {
          // Clamp to edge
          x = viewportWidth - estWidth - 10
          newPos = 'below' // Fallback to below if side squeeze
          y = rect.bottom + 10
        }
      }

      // 2. Left Edge Breach
      if (anchorDirection === 'left' && x - estWidth < 0) {
        // Flip to right if space permits
        if (rect.right + estWidth < viewportWidth) {
          newPos = 'right'
          x = rect.right + 10
        } else {
          x = 10
          newPos = 'below'
          y = rect.bottom + 10
        }
      }

      // 3. Bottom Edge Breach
      // (Simplified: if y is low, force 'above')
      if (y + estHeight/2 > viewportHeight) {
         if (newPos === 'below') {
            newPos = 'above'
            y = rect.top - 10
         } else {
            // Shift Y up for side tooltips
            y = viewportHeight - estHeight/2 - 10
         }
      }

      // 4. Top Edge Breach
      if (y - estHeight/2 < 0) {
         if (newPos === 'above') {
            newPos = 'below'
            y = rect.bottom + 10
         } else {
            y = estHeight/2 + 10
         }
      }

      setPosition(newPos as any)
      setCoords({ x, y })

    } else if (e) {
      // Cursor logic
      let x = e.clientX
      let y = e.clientY
      let newPos = e.clientY < viewportHeight / 2 ? 'below' : 'above'

      // Keep x within bounds
      if (x + estWidth/2 > viewportWidth) x = viewportWidth - estWidth/2 - 10
      if (x - estWidth/2 < 0) x = estWidth/2 + 10

      setPosition(newPos)
      setCoords({ x, y })
    }
  }, [anchored, anchorDirection])

  const handleMouseEnter = (e: React.MouseEvent) => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
    if (isPinned) return
    
    // Capture position now, show later
    const clientX = e.clientX
    const clientY = e.clientY
    
    showTimer.current = window.setTimeout(() => {
      // Manually trigger position update with captured coords
      const mockEvent = { clientX, clientY } as React.MouseEvent
      updatePosition(mockEvent)
      setVisible(true)
    }, 1000)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!anchored && !isPinned) {
      updatePosition(e)
    }
  }

  const handleMouseLeave = () => {
    if (showTimer.current) {
      clearTimeout(showTimer.current)
      showTimer.current = null
    }
    if (!isPinned) {
      // Small delay to allow bridging the gap to the tooltip
      hideTimer.current = window.setTimeout(() => {
        setVisible(false)
      }, 300)
    }
  }

  // Handle tooltip hover to prevent closing while interacting with it
  const handleTooltipEnter = () => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }

  const handleTooltipLeave = () => {
    if (!isPinned) {
      hideTimer.current = window.setTimeout(() => {
        setVisible(false)
      }, 300)
    }
  }

  // Use Capture phase to intercept Shift+Click before children see it
  const handleClickCapture = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      setIsPinned(!isPinned)
      if (!isPinned) {
        updatePosition(e) // Ensure position is fresh when pinning
        setVisible(true)
      }
    }
  }

  const togglePin = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsPinned(!isPinned)
  }

  const handleVaultLink = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (articleId && onViewVault) {
      onViewVault(articleId)
      setIsPinned(false)
      setVisible(false)
    }
  }

  const lines = content.split('\n')

  return (
    <div
      ref={triggerRef}
      className={`tooltip-trigger ${isPinned ? 'is-pinned' : ''}`}
      onMouseEnter={handleMouseEnter}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onClickCapture={handleClickCapture}
    >
      {children}
      {visible && (coords.x !== 0 || coords.y !== 0) && createPortal(
        <div
          className={`tooltip-box tooltip-${position} ${isPinned ? 'pinned' : ''}`}
          onMouseEnter={handleTooltipEnter}
          onMouseLeave={handleTooltipLeave}
          style={{
            left: coords.x,
            top: (position === 'right' || position === 'left') ? coords.y : (position === 'below' ? coords.y + 20 : coords.y - 20),
            maxWidth: maxWidth,
            width: 'max-content',
            transform: position === 'right' 
              ? 'translateY(-50%)' 
              : position === 'left'
                ? 'translateX(-100%) translateY(-50%)'
                : (position === 'below' ? 'translateX(-50%)' : 'translateX(-50%) translateY(-100%)'),
            pointerEvents: 'auto' // Always allow interaction for pin/links
          }}
        >
          <div className="tooltip-header">
            {title && <span className="tooltip-title">{title}</span>}
            {isPinned && !title && <span className="tooltip-pin-indicator">Pinned Portal</span>}
            <button className={`tooltip-pin-btn ${isPinned ? 'active' : ''}`} onClick={togglePin} title="Pin Tooltip (Shift+Click)">
              📌
            </button>
          </div>

          <div className="tooltip-content">
            {lines.map((line, i) => (
              <span key={i} className="tooltip-line">{line}</span>
            ))}
          </div>

          {(isPinned || articleId) && (
            <div className="tooltip-footer">
              {articleId && (
                <button className="tooltip-vault-link" onClick={handleVaultLink}>
                  Explore in Vault →
                </button>
              )}
              {isPinned && !articleId && (
                <div className="tooltip-drag-hint">Micro-Portal Active</div>
              )}
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  )
}
