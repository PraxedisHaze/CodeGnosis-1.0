// BOM-STRICT
import './TabInterface.css'

interface TabInterfaceProps {
  activeTab: 'analysis' | 'graph';
  onTabChange: (tab: 'analysis' | 'graph') => void;
}

export function TabInterface({ activeTab, onTabChange }: TabInterfaceProps) {
  return (
    <div className="tab-container">
      <button 
        className={`tab-button ${activeTab === 'analysis' ? 'active' : ''}`}
        onClick={() => onTabChange('analysis')}
      >
        <span className="tab-icon">📄</span>
        Analysis Report
      </button>
      <button 
        className={`tab-button ${activeTab === 'graph' ? 'active' : ''}`}
        onClick={() => onTabChange('graph')}
      >
        <span className="tab-icon">🗺️</span>
        Visual Graph
      </button>
      <div className="tab-indicator" style={{
        left: activeTab === 'analysis' ? '0' : '50%'
      }}></div>
    </div>
  )
}
