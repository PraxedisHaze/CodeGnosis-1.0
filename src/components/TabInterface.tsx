// BOM-STRICT
import { useRef } from 'react'
import './TabInterface.css'
import { TabTooltipTrigger } from './UnifiedTooltip'
import { tooltips, getTooltip, VerbosityLevel } from './TooltipContent'

type TabKey = 'analysis' | 'graph' | 'codeCity' | 'vault' | 'controls'

interface TabInterfaceProps {
  openDrawers: TabKey[]
  onToggleDrawer: (tab: TabKey) => void
  tooltipLevel: VerbosityLevel
  sidebarPosition: 'left' | 'right'
}

const TABS: { key: TabKey; label: string; tooltipKey: keyof typeof tooltips.tabs }[] = [
  { key: 'controls', label: 'Calibration', tooltipKey: 'graph' },
  { key: 'analysis', label: 'Analysis Report', tooltipKey: 'analysis' },
  { key: 'codeCity', label: 'The Construct', tooltipKey: 'theConstruct' },
  { key: 'vault', label: 'Vault of Value', tooltipKey: 'vault' },
  { key: 'graph', label: 'Export', tooltipKey: 'graph' }
]

export function TabInterface({ openDrawers, onToggleDrawer, tooltipLevel, sidebarPosition }: TabInterfaceProps) {
  const hasOpenDrawer = openDrawers.length > 0
  const drawerState = hasOpenDrawer ? 'drawer-open' : 'drawer-closed'
  const containerRef = useRef<HTMLDivElement>(null)

  return (
    <div className={`tab-system side-${sidebarPosition} ${drawerState}`}>
      {/* Tab Buttons - Horizontal row */}
      <div className="tab-row">
        <div className="tab-container" ref={containerRef}>
          {TABS.map((tab) => (
            <TabTooltipTrigger
              key={tab.key}
              tooltipKey={tab.key}
              label={tab.label}
              content={getTooltip(tooltips.tabs[tab.tooltipKey], tooltipLevel)}
              anchorSide={sidebarPosition === 'left' ? 'right' : 'left'}
              containerRef={containerRef}
            >
              <button
                className={`tab-button ${openDrawers.includes(tab.key) ? 'active' : ''}`}
                onClick={() => onToggleDrawer(tab.key)}
              >
                {tab.label}
              </button>
            </TabTooltipTrigger>
          ))}
        </div>
      </div>
    </div>
  )
}
