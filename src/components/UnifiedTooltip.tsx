// BOM-STRICT
// UnifiedTooltip.tsx - Global tooltip system with shift-hold freeze behavior
// Single tooltip visible at a time, shift-hold freezes in place, shift+click pins

import { useState, useCallback, useRef, useEffect, createContext, useContext, ReactNode } from 'react'
import { createPortal } from 'react-dom'
import './UnifiedTooltip.css'

interface TooltipState {
  content: string
  label: string
  isPinned: boolean
  isShiftHeld: boolean
  activeKey: string | null
  position: { x: number; y: number; sidebarWidth?: number }
  anchor: 'left' | 'right' | 'sidebar'
}

interface UnifiedTooltipContextValue {
  show: (key: string, label: string, content: string, position: { x: number; y: number; anchor?: 'left' | 'right' | 'sidebar'; sidebarWidth?: number }) => void
  hide: (key: string) => void
  pin: (key: string) => void
  unpin: () => void
  setShiftHeld: (held: boolean) => void
  registerTriggerHover: (key: string) => void
  unregisterTriggerHover: (key: string) => void
  activeKey: string | null
  isPinned: boolean
  isShiftHeld: boolean
}

const UnifiedTooltipContext = createContext<UnifiedTooltipContextValue | null>(null)

interface UnifiedTooltipProviderProps {
  children: ReactNode
}

export function UnifiedTooltipProvider({ children }: UnifiedTooltipProviderProps) {
  const [state, setState] = useState<TooltipState>({
    content: '',
    label: '',
    isPinned: false,
    isShiftHeld: false,
    activeKey: null,
    position: { x: 0, y: 0 },
    anchor: 'right'
  })

  const hideTimer = useRef<number | null>(null)
  const tooltipHoveredRef = useRef<boolean>(false)
  const triggerHoveredRef = useRef<Set<string>>(new Set())

  const clearTimers = useCallback(() => {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current)
      hideTimer.current = null
    }
  }, [])

  // Global shift key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift' && !state.isShiftHeld) {
        setState(prev => ({ ...prev, isShiftHeld: true }))
      }
    }

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') {
        setState(prev => {
          // If shift released and not pinned, close tooltip
          if (!prev.isPinned) {
            return { ...prev, isShiftHeld: false, activeKey: null, content: '', label: '' }
          }
          return { ...prev, isShiftHeld: false }
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [state.isShiftHeld, state.isPinned])

  // FAILSAFE: Periodic check to dismiss stuck tooltips
  // If tooltip is visible but: not hovered, shift not held, not pinned -> dismiss
  useEffect(() => {
    const failsafeInterval = setInterval(() => {
      setState(prev => {
        // Only check if there's an active tooltip
        if (!prev.activeKey) return prev

        // Keep if pinned
        if (prev.isPinned) return prev

        // Keep if shift is held
        if (prev.isShiftHeld) return prev

        // Keep if tooltip box itself is hovered
        if (tooltipHoveredRef.current) return prev

        // Keep if any trigger is hovered
        if (triggerHoveredRef.current.size > 0) return prev

        // None of the conditions met - dismiss the stuck tooltip
        console.log('[Tooltip Failsafe] Dismissing stuck tooltip:', prev.label)
        return { ...prev, activeKey: null, content: '', label: '' }
      })
    }, 500) // Check every 500ms

    return () => clearInterval(failsafeInterval)
  }, [])

  const show = useCallback((key: string, label: string, content: string, position: { x: number; y: number; anchor?: 'left' | 'right' | 'sidebar'; sidebarWidth?: number }) => {
    clearTimers()

    const anchor = position.anchor || 'right'
    const posWithWidth = { x: position.x, y: position.y, sidebarWidth: position.sidebarWidth }

    setState(prev => {
      // If shift is held, freeze current tooltip (don't switch)
      if (prev.isShiftHeld && prev.activeKey && prev.activeKey !== key) {
        return prev
      }

      // If pinned to a different key, new hover replaces it
      if (prev.isPinned && prev.activeKey !== key) {
        return { ...prev, content, label, isPinned: false, activeKey: key, position: posWithWidth, anchor }
      }

      // If already showing this key and pinned, keep it
      if (prev.isPinned && prev.activeKey === key) {
        return prev
      }

      return { ...prev, content, label, activeKey: key, position: posWithWidth, anchor }
    })
  }, [clearTimers])

  const hide = useCallback((key: string) => {
    clearTimers()

    setState(prev => {
      // Don't hide if pinned or shift held
      if (prev.isPinned || prev.isShiftHeld) return prev
      // Don't hide if a different key is now active
      if (prev.activeKey !== key) return prev

      // Quick hide - 50ms just to debounce rapid hover changes
      hideTimer.current = window.setTimeout(() => {
        setState(p => {
          if (p.activeKey === key && !p.isPinned && !p.isShiftHeld) {
            return { ...p, activeKey: null, content: '', label: '' }
          }
          return p
        })
      }, 50)

      return prev
    })
  }, [clearTimers])

  const pin = useCallback((key: string) => {
    setState(prev => {
      if (prev.activeKey === key) {
        return { ...prev, isPinned: !prev.isPinned }
      }
      return prev
    })
  }, [])

  const unpin = useCallback(() => {
    setState(prev => ({ ...prev, isPinned: false, activeKey: null, content: '', label: '' }))
  }, [])

  const setShiftHeld = useCallback((held: boolean) => {
    setState(prev => ({ ...prev, isShiftHeld: held }))
  }, [])

  const registerTriggerHover = useCallback((key: string) => {
    triggerHoveredRef.current.add(key)
  }, [])

  const unregisterTriggerHover = useCallback((key: string) => {
    triggerHoveredRef.current.delete(key)
  }, [])

  const contextValue: UnifiedTooltipContextValue = {
    show,
    hide,
    pin,
    unpin,
    setShiftHeld,
    registerTriggerHover,
    unregisterTriggerHover,
    activeKey: state.activeKey,
    isPinned: state.isPinned,
    isShiftHeld: state.isShiftHeld
  }

  // Clamp position to viewport, accounting for anchor side
  const tooltipWidth = state.anchor === 'sidebar' && state.position.sidebarWidth
    ? state.position.sidebarWidth
    : 320

  const isSidebar = state.anchor === 'sidebar'

  const clampedPosition = isSidebar
    ? {
        x: state.position.x,
        y: state.position.y // Will use bottom positioning for sidebar
      }
    : {
        x: state.anchor === 'left'
          ? Math.max(state.position.x - tooltipWidth, 10)
          : Math.min(state.position.x, window.innerWidth - tooltipWidth - 20),
        y: Math.max(state.position.y, 10)
      }

  return (
    <UnifiedTooltipContext.Provider value={contextValue}>
      <div className={state.isShiftHeld ? 'shift-held-cursor' : ''}>
        {children}
      </div>
      {state.activeKey && state.content && createPortal(
        <div
          className={`unified-tooltip-box ${state.isPinned ? 'pinned' : ''} ${state.isShiftHeld ? 'shift-frozen' : ''} ${isSidebar ? 'sidebar-anchored' : ''}`}
          style={isSidebar ? {
            left: clampedPosition.x,
            top: 'auto',
            bottom: window.innerHeight - clampedPosition.y,
            width: tooltipWidth
          } : {
            left: clampedPosition.x,
            top: clampedPosition.y
          }}
          onMouseEnter={() => { tooltipHoveredRef.current = true }}
          onMouseLeave={() => { tooltipHoveredRef.current = false }}
        >
          <div className="unified-tooltip-header">
            <span className="unified-tooltip-label">
              {state.isPinned ? `📌 ${state.label}` : state.label}
            </span>
            {state.isPinned && (
              <button
                className="unified-tooltip-close"
                onClick={unpin}
                title="Close"
              >
                ✕
              </button>
            )}
          </div>
          <div className="unified-tooltip-content">
            {state.content}
          </div>
          <div className="unified-tooltip-hint">
            {state.isPinned
              ? 'Click ✕ to close'
              : state.isShiftHeld
                ? 'Click to pin • Release Shift to dismiss'
                : 'Hold Shift to freeze • Shift+Click to pin'}
          </div>
        </div>,
        document.body
      )}
    </UnifiedTooltipContext.Provider>
  )
}

// Hook for consuming the tooltip context
export function useUnifiedTooltip() {
  const context = useContext(UnifiedTooltipContext)
  if (!context) {
    throw new Error('useUnifiedTooltip must be used within UnifiedTooltipProvider')
  }
  return context
}

interface TooltipTriggerProps {
  label: string
  content: string
  children: ReactNode
  articleId?: string
  onViewVault?: (articleId: string) => void
  sidebarRef?: React.RefObject<HTMLElement | null>
}

export function Tooltip({ label, content, children, articleId, onViewVault, sidebarRef }: TooltipTriggerProps) {
  const context = useContext(UnifiedTooltipContext)
  const triggerRef = useRef<HTMLDivElement>(null)
  const showTimer = useRef<number | null>(null)
  const keyRef = useRef(Math.random().toString(36).substr(2, 9))

  if (!context) {
    // Fallback: render children without tooltip if no provider
    return <>{children}</>
  }

  const getPosition = () => {
    const triggerRect = triggerRef.current?.getBoundingClientRect()
    if (!triggerRect) return null

    // Sidebar mode: center in sidebar, bottom edge above Keystone Constellation
    if (sidebarRef?.current) {
      const sidebarRect = sidebarRef.current.getBoundingClientRect()
      const margin = 0
      return {
        x: sidebarRect.left + margin,
        y: sidebarRect.bottom - 48,  // 48px above sidebar bottom (where footer lives)
        anchor: 'sidebar' as const,
        sidebarWidth: sidebarRect.width - (margin * 2)
      }
    }

    // Standard mode: right of trigger
    return {
      x: triggerRect.right + 12,
      y: triggerRect.top
    }
  }

  const handleMouseEnter = () => {
    if (showTimer.current) clearTimeout(showTimer.current)
    context.registerTriggerHover(keyRef.current)

    // Shorter delay if shift is held
    const delay = context.isShiftHeld ? 100 : 500

    showTimer.current = window.setTimeout(() => {
      const pos = getPosition()
      if (pos) context.show(keyRef.current, label, content, pos)
    }, delay)
  }

  const handleMouseLeave = () => {
    if (showTimer.current) {
      clearTimeout(showTimer.current)
      showTimer.current = null
    }
    context.unregisterTriggerHover(keyRef.current)
    context.hide(keyRef.current)
  }

  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      const pos = getPosition()
      if (pos) {
        context.show(keyRef.current, label, content, pos)
        context.pin(keyRef.current)
      }
    }
  }

  return (
    <div
      ref={triggerRef}
      className="unified-tooltip-trigger"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClickCapture={handleClick}
    >
      {children}
    </div>
  )
}

// Re-export for tab-specific usage with custom anchor
interface TabTooltipTriggerProps {
  tooltipKey: string
  label: string
  content: string
  children: ReactNode
  anchorSide?: 'left' | 'right'
  containerRef?: React.RefObject<HTMLElement>
}

export function TabTooltipTrigger({ tooltipKey, label, content, children, anchorSide = 'right', containerRef }: TabTooltipTriggerProps) {
  const context = useContext(UnifiedTooltipContext)
  const triggerRef = useRef<HTMLDivElement>(null)
  const showTimer = useRef<number | null>(null)

  if (!context) {
    return <>{children}</>
  }

  const getPosition = () => {
    // Use container rect for x positioning, trigger rect for y positioning
    const containerRect = containerRef?.current?.getBoundingClientRect()
    const triggerRect = triggerRef.current?.getBoundingClientRect()

    if (containerRect && triggerRect) {
      if (anchorSide === 'left') {
        return {
          x: containerRect.left - 12,
          y: triggerRect.top,
          anchor: 'left' as const
        }
      }
      return {
        x: containerRect.right + 12,
        y: triggerRect.top,
        anchor: 'right' as const
      }
    }

    // Fallback to trigger-only positioning
    if (triggerRect) {
      if (anchorSide === 'left') {
        return {
          x: triggerRect.left - 12,
          y: triggerRect.top,
          anchor: 'left' as const
        }
      }
      return {
        x: triggerRect.right + 12,
        y: triggerRect.top,
        anchor: 'right' as const
      }
    }
    return { x: 0, y: 0, anchor: 'right' as const }
  }

  const handleMouseEnter = () => {
    if (showTimer.current) clearTimeout(showTimer.current)
    context.registerTriggerHover(tooltipKey)

    const delay = context.isShiftHeld ? 100 : 400

    showTimer.current = window.setTimeout(() => {
      context.show(tooltipKey, label, content, getPosition())
    }, delay)
  }

  const handleMouseLeave = () => {
    if (showTimer.current) {
      clearTimeout(showTimer.current)
      showTimer.current = null
    }
    context.unregisterTriggerHover(tooltipKey)
    context.hide(tooltipKey)
  }

  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey) {
      e.preventDefault()
      e.stopPropagation()
      context.show(tooltipKey, label, content, getPosition())
      context.pin(tooltipKey)
    }
  }

  return (
    <div
      ref={triggerRef}
      className="unified-tooltip-trigger"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClickCapture={handleClick}
    >
      {children}
    </div>
  )
}
