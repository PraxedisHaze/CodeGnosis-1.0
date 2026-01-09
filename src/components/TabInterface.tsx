// BOM-STRICT
import './TabInterface.css'

type TabKey = 'analysis' | 'graph' | 'codeCity' | 'vault'

interface TabInterfaceProps {
  activeTab: TabKey
  onTabChange: (tab: TabKey) => void
}

const TABS: { key: TabKey; label: string }[] = [
  { key: 'analysis', label: 'Analysis Report' },
  { key: 'graph', label: '3D Graph' },
  { key: 'codeCity', label: 'Code City' },
  { key: 'vault', label: 'Vault of Value' }
]

export function TabInterface({ activeTab, onTabChange }: TabInterfaceProps) {
  const activeIndex = Math.max(0, TABS.findIndex((tab) => tab.key === activeTab))
  const indicatorLeft = `${(activeIndex / TABS.length) * 100}%`
  const indicatorWidth = `${100 / TABS.length}%`

  return (
    <div className="tab-container">
      {TABS.map((tab) => (
        <button
          key={tab.key}
          className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
          onClick={() => onTabChange(tab.key)}
        >
          {tab.label}
        </button>
      ))}
      <div className="tab-indicator" style={{ left: indicatorLeft, width: indicatorWidth }} />
    </div>
  )
}
