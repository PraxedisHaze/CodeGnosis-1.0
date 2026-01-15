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

export function TabInterface({ openDrawers, onToggleDrawer, tooltipLevel, sidebarPosition }: TabInterfaceProps) {
  return (
    <div className={`tab-container side-${sidebarPosition}`}>
      {TABS.map((tab) => (
        <Tooltip 
          key={tab.key} 
          content={getTooltip(tooltips.tabs[tab.tooltipKey], tooltipLevel)}
          anchored={true}
          anchorDirection="right"
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
  )
}
