// BOM-STRICT
import './TabInterface.css'
import { Tooltip } from './Tooltip'
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
  { key: 'vault', label: 'Vault of Value', tooltipKey: 'vault' }
]

// Drawer widths for positioning tabs at drawer edge
const DRAWER_WIDTHS: Record<TabKey, number> = {
  controls: 333,
  analysis: 333,
  codeCity: 333,
  vault: 800,
  graph: 333
}

export function TabInterface({ openDrawers, onToggleDrawer, tooltipLevel, sidebarPosition }: TabInterfaceProps) {
  const hasOpenDrawer = openDrawers.length > 0
  const drawerState = hasOpenDrawer ? 'drawer-open' : 'drawer-closed'

  return (
    <div className={`tab-system side-${sidebarPosition} ${drawerState}`}>
      {/* Hydraulic Rail - Horizontal bar at top */}
      <div className="hydraulic-rail" />

      {/* Tab Buttons - Horizontal row */}
      <div className="tab-container">
        {TABS.map((tab) => (
          <Tooltip
            key={tab.key}
            content={getTooltip(tooltips.tabs[tab.tooltipKey], tooltipLevel)}
            anchored={true}
            anchorDirection="bottom"
          >
            <button
              className={`tab-button ${openDrawers.includes(tab.key) ? 'active' : ''}`}
              onClick={() => onToggleDrawer(tab.key)}
            >
              {tab.label}
            </button>
          </Tooltip>
        ))}
      </div>
    </div>
  )
}
