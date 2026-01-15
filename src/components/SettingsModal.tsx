// BOM-STRICT
import { useState, useEffect } from 'react'
import './SettingsModal.css'
import { VerbosityLevel } from './TooltipContent'

interface Settings {
  theme: string;
  excluded: string;
  deepScan: boolean;
  autoSave: boolean;
  skipIntroAnimation: boolean;
  twinkleIntensity: number;
  starBrightness: number;
  skybox: string;
  tooltipLevel: VerbosityLevel;
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
          <div className="settings-section">
            <h3>Coders-First Mission</h3>
            <p className="mission-text">
              "This tool is meant to be good for you. We want to improve your life, not just your code. 
              If you have ideas for the next release, we are listening."
            </p>
          </div>


          <div className="settings-group">
            <label>Exclusion Filter</label>
            <input 
              type="text" 
              value={settings.excluded} 
              onChange={e => setSettings({...settings, excluded: e.target.value})}
              placeholder="node_modules, .git..."
            />
            <p className="hint">Keep the galaxy clean by skipping these folders.</p>
          </div>

          <div className="settings-group toggle-group">
            <label>
              <input
                type="checkbox"
                checked={settings.autoSave}
                onChange={e => setSettings({...settings, autoSave: e.target.checked})}
              />
              Auto-export AI Context
            </label>
            <p className="hint">Save a JSON file after analysis that you can paste into AI chats for instant codebase understanding.</p>
          </div>

          <div className="settings-group toggle-group">
            <label>
              <input
                type="checkbox"
                checked={settings.skipIntroAnimation}
                onChange={e => setSettings({...settings, skipIntroAnimation: e.target.checked})}
              />
              Skip intro animation (jump straight to galaxy)
            </label>
          </div>

          <div className="settings-group">
            <label>Visual Theme</label>
            <select
              value={settings.skybox}
              onChange={e => {
                const theme = e.target.value;
                setSettings({...settings, skybox: theme});
                // Apply theme to document for CSS variables
                if (theme === 'none') {
                  document.documentElement.removeAttribute('data-theme');
                } else {
                  document.documentElement.setAttribute('data-theme', theme);
                }
              }}
            >
              <option value="none">Deep Space (Black)</option>
              <option value="nebula">Nebula Purple</option>
              <option value="cosmos">Cosmic Blue</option>
              <option value="aurora">Aurora Green</option>
              <option value="ember">Ember Red</option>
              <option value="twilight">Twilight</option>
            </select>
            <p className="hint">Changes sidebar, skybox, and accent colors</p>
          </div>

          <div className="settings-group">
            <label>Tooltip Detail Level</label>
            <select
              value={settings.tooltipLevel}
              onChange={e => setSettings({...settings, tooltipLevel: e.target.value as VerbosityLevel})}
            >
              <option value="friendly">Friendly (casual, encouraging)</option>
              <option value="professional">Professional (clear, warm)</option>
              <option value="technical">Technical (precise, detailed)</option>
            </select>
            <p className="hint">How tooltips explain things when you hover</p>
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
