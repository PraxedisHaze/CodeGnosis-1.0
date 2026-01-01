// BOM-STRICT
import { useState, useEffect } from 'react'
import './SettingsModal.css'

interface Settings {
  theme: string;
  excluded: string;
  deepScan: boolean;
  autoSave: boolean;
}

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (settings: Settings) => void;
  initialSettings: Settings;
}

export function SettingsModal({ isOpen, onClose, onSave, initialSettings }: SettingsModalProps) {
  const [settings, setSettings] = useState<Settings>(initialSettings)

  useEffect(() => {
    if (isOpen) {
      setSettings(initialSettings)
    }
  }, [isOpen, initialSettings])

  if (!isOpen) return null

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Engine Configuration</h2>
          <button className="close-button" onClick={onClose}>&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="settings-group">
            <label>Visual Theme</label>
            <select 
              value={settings.theme} 
              onChange={e => setSettings({...settings, theme: e.target.value})}
            >
              <option value="Dark">Aothen Dark</option>
              <option value="Light">Luminous Light</option>
              <option value="System">System Default</option>
            </select>
          </div>

          <div className="settings-group">
            <label>Exclude Patterns (comma separated)</label>
            <input 
              type="text" 
              value={settings.excluded} 
              onChange={e => setSettings({...settings, excluded: e.target.value})}
              placeholder="node_modules, .git, dist..."
            />
            <p className="hint">These folders will be skipped during analysis.</p>
          </div>

          <div className="settings-group toggle-group">
            <label>
              <input 
                type="checkbox" 
                checked={settings.deepScan} 
                onChange={e => setSettings({...settings, deepScan: e.target.checked})}
              />
              Enable Deep Scan (Recursive Import Tracing)
            </label>
          </div>

          <div className="settings-group toggle-group">
            <label>
              <input 
                type="checkbox" 
                checked={settings.autoSave} 
                onChange={e => setSettings({...settings, autoSave: e.target.checked})}
              />
              Auto-save ai-bundle.json to project root
            </label>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(settings)}>Apply Settings</button>
        </div>
      </div>
    </div>
  )
}
