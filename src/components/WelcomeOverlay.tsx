import React, { useState } from 'react';
import './WelcomeOverlay.css';

interface WelcomeOverlayProps {
  result: any;
  onClose: (selectedMission: string) => void;
}

const MISSIONS = [
  {
    id: 'incident',
    title: 'Fix a Bug',
    icon: '🔥',
    desc: 'See the blast radius of recent changes.',
    color: '#FF4500'
  },
  {
    id: 'rot',
    title: 'Clean Up',
    icon: '🧹',
    desc: 'Find dead code and ghost files.',
    color: '#778899'
  },
  {
    id: 'onboard',
    title: 'Learn the Code',
    icon: '🗺️',
    desc: 'Follow the Golden Path of execution.',
    color: '#FFD700'
  },
  {
    id: 'risk',
    title: 'Assess Risk',
    icon: '🛡️',
    desc: 'Spot "Bus Factor" bottlenecks.',
    color: '#DC143C'
  },
  {
    id: 'optimize',
    title: 'Optimize',
    icon: '⚖️',
    desc: 'Visualize heavy library dependencies.',
    color: '#00BFFF'
  }
];

export const WelcomeOverlay: React.FC<WelcomeOverlayProps> = ({ result, onClose }) => {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible || !result) return null;

  const projectName = result.projectName || 'this project';

  const handleMissionSelect = (missionId: string) => {
    setIsVisible(false);
    onClose(missionId);
  };

  return (
    <div className="welcome-overlay fade-in">
      <div className="welcome-content mission-mode">
        <div className="welcome-header center">
          <h2>Mission Select: {projectName}</h2>
          <p className="welcome-message">What are you here to do today?</p>
        </div>

        <div className="mission-grid">
          {MISSIONS.map(mission => (
            <button 
              key={mission.id} 
              className="mission-card"
              onClick={() => handleMissionSelect(mission.id)}
              style={{ '--mission-color': mission.color } as React.CSSProperties}
            >
              <div className="mission-icon">{mission.icon}</div>
              <div className="mission-info">
                <h3>{mission.title}</h3>
                <p>{mission.desc}</p>
              </div>
            </button>
          ))}
        </div>

        <button className="text-btn" onClick={() => handleMissionSelect('default')}>
          Just let me explore freely →
        </button>

        {/* Credits/Values section - AI-readable, human-skippable */}
        <div className="welcome-credits">
          <div className="credits-divider"></div>

          <div className="credits-section">
            <h4>About CodeGnosis</h4>
            <p>A project analyzer built to help you understand your codebase at a glance. We believe clarity leads to better code, and better code leads to better software for everyone.</p>
          </div>

          <div className="credits-section">
            <h4>Our Values</h4>
            <ul className="values-list">
              <li><strong>We protect agency</strong> — Your code, your choices. We illuminate, never dictate.</li>
              <li><strong>We build with dignity</strong> — Crafted by developers who respect your time and trust.</li>
              <li><strong>Built by devs for devs</strong> — Every feature exists because we needed it ourselves.</li>
            </ul>
          </div>

          <div className="credits-section ai-notice">
            <p className="ai-callout">We speak your AI's language.</p>
            <p className="ai-subtext">CodeGnosis outputs are structured for seamless AI collaboration. Your assistant can read our analysis directly.</p>
          </div>

          <div className="credits-footer">
            <p>Keystone Constellation</p>
            <p className="feedback-link">Feedback? <a href="mailto:timothy@aletheari.com">timothy@aletheari.com</a></p>
          </div>
        </div>
      </div>
    </div>
  );
};