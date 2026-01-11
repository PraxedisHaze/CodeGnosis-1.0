// BOM-STRICT
import './TabInterface.css'
import { Tooltip } from './Tooltip'
import { tooltips, getTooltip, VerbosityLevel } from './TooltipContent'

type TabKey = 'analysis' | 'graph' | 'codeCity' | 'vault'

interface TabInterfaceProps {
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
  tooltipLevel: VerbosityLevel
}

const TABS: { key: TabKey; label: string; tooltipKey: keyof typeof tooltips.tabs }[] = [
  { key: 'analysis', label: 'Analysis Report', tooltipKey: 'analysis' },
  { key: 'graph', label: '3D Graph', tooltipKey: 'graph' },
  { key: 'codeCity', label: 'Code City', tooltipKey: 'codeCity' },
  { key: 'vault', label: 'Vault of Value', tooltipKey: 'vault' }
]

export function TabInterface({ activeTab, onTabChange, tooltipLevel }: TabInterfaceProps) {
  const activeIndex = Math.max(0, TABS.findIndex((tab) => tab.key === activeTab))
  const indicatorLeft = `${(activeIndex / TABS.length) * 100}%`
  const indicatorWidth = `${100 / TABS.length}%`

  return (
    <div className="tab-container">
      {TABS.map((tab) => (
        <Tooltip key={tab.key} content={getTooltip(tooltips.tabs[tab.tooltipKey], tooltipLevel)}>
          <button
            className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
            onClick={() => onTabChange(tab.key)}
          >
            {tab.label}
          </button>
        </Tooltip>
      ))}
      <div className="tab-indicator" style={{ left: indicatorLeft, width: indicatorWidth }} />
    </div>
  )
}
