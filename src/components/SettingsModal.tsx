// BOM-STRICT
import { useState, useEffect } from 'react'
import './SettingsModal.css'

interface Settings {
  theme: string;
  excluded: string;
  deepScan: boolean;
  autoSave: boolean;
  skipIntroAnimation: boolean;
  twinkleIntensity: number;
  starBrightness: number;
  skybox: string;
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
            <h3>Human-First Mission</h3>
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

          <div className="settings-section partnership-card">
            <h3>Join the Constellation</h3>
            <p>Design mods for our apps and keep **75% of the net profit.**</p>
            <ul className="partnership-list">
              <li>• Submit your unique mods or mini-apps for approval.</li>
              <li>• Profits are calculated after caring for project needs, expenses, and reinvestment in websites and advertising.</li>
              <li>• We track your sales individually and pay you 75% of the remaining profit.</li>
            </ul>
            <button className="btn btn-outline" onClick={() => window.open('mailto:timothy@aletheari.com?subject=Constellation Mod Submission')}>
              Become a Partner
            </button>
          </div>

          <div className="settings-group toggle-group">
            <label>
              <input
                type="checkbox"
                checked={settings.autoSave}
                onChange={e => setSettings({...settings, autoSave: e.target.checked})}
              />
              Prepare AI Bundle (Auto-save context)
            </label>
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
            <label>Star Twinkle Intensity</label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={settings.twinkleIntensity}
              onChange={e => setSettings({...settings, twinkleIntensity: parseFloat(e.target.value)})}
            />
            <p className="hint">{settings.twinkleIntensity === 0 ? 'Off' : `${Math.round(settings.twinkleIntensity * 100)}%`}</p>
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
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn btn-primary" onClick={() => onSave(settings)}>Apply Settings</button>
        </div>
      </div>
    </div>
  )
}
