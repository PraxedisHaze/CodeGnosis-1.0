// BOM-STRICT
// MissionInfoBox.tsx - Displays mission context when a mission is active
// The palm reader explaining what the stars reveal

import React from 'react'
import './MissionInfoBox.css'

interface MissionInfoBoxProps {
  mission: string
  onClose: () => void
}

const MISSION_CONTENT: Record<string, { title: string; content: React.ReactNode }> = {
  risk: {
    title: 'Risk',
    content: (
      <>
        <p>The <strong>Risk Mission</strong> identifies "Fragile Sovereigns"—files that have become too important for their own safety.</p>
        <ul>
          <li><strong>High Inbound:</strong> Many files depend on this one.</li>
          <li><strong>High Outbound:</strong> This file depends on many others.</li>
          <li><strong>Deep Chains:</strong> Sits at the end of long logic paths.</li>
        </ul>
        <p className="mission-insight">Large, bright red stars indicate high blast radius. If they break, the damage ripples far. Prioritize these for testing and refactoring.</p>
      </>
    )
  },
  rot: {
    title: 'Rot',
    content: (
      <>
        <p>The <strong>Rot Mission</strong> reveals the "Silent Weight" of your project—files that are physically present but logically isolated.</p>
        <p><strong>What we highlight:</strong> Nodes with 0 inbound connections. If nothing imports a file, it is a "Ghost."</p>
        <p className="mission-insight">These files clutter your context, slow down AI analysis, and confuse new developers. Consider archiving or removing them.</p>
        <p className="mission-note"><em>Note:</em> Entry points like <code>main.ts</code> or <code>index.html</code> may appear isolated because they start the chain. Use judgment before deleting.</p>
      </>
    )
  },
  onboard: {
    title: 'Onboard',
    content: (
      <>
        <p>The <strong>Onboarding Mission</strong> highlights the "Gateway Stars"—entry points and primary hubs where the most significant logic resides.</p>
        <p>For a new developer, the galaxy can be overwhelming. This mission dims the noise and illuminates the 10-15 files they should read first.</p>
        <p className="mission-insight">Start here to understand the soul of the codebase. These are the doors into the architecture.</p>
      </>
    )
  },
  incident: {
    title: 'Incident',
    content: (
      <>
        <p>The <strong>Incident Mission</strong> is your tactical map during a crisis. It correlates <strong>Recency</strong> with <strong>Complexity</strong>.</p>
        <p>Stars are colored based on their last modified date. Brightest stars were touched most recently.</p>
        <p className="mission-insight">If a bug just appeared, start your search at the brightest, most connected stars. Recent changes in high-gravity zones are the likely culprits.</p>
      </>
    )
  }
}

export function MissionInfoBox({ mission, onClose }: MissionInfoBoxProps) {
  const missionData = MISSION_CONTENT[mission]

  if (!missionData) return null

  return (
    <div className="mission-info-box">
      <div className="mission-info-header">
        <h3 className="mission-info-title">{missionData.title}</h3>
        <button className="mission-info-close" onClick={onClose} title="Close">✕</button>
      </div>
      <div className="mission-info-content">
        {missionData.content}
      </div>
      <div className="mission-info-footer">
        Reading the stars...
      </div>
    </div>
  )
}
