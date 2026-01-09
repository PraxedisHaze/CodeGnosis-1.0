/**
 * SPDX-License-Identifier: MIT
 * Authors: Timothy Drake (Vision), Gemini (Unified Guide)
 * Source: Keystone Constellation
 * Glyphs: USER-TRUTH | RITUAL-VOW
 */

import React from 'react'
import './VaultOfValue.css'

export function VaultOfValue() {
  const resources = [
    {
      title: "Scale of the Universe",
      url: "https://scaleofuniverse.com/en",
      desc: "An incredible perspective on the vastness of existence, from the Planck length to the boundaries of the observable universe. (Note: Site may not function correctly on Microsoft Edge)."
    },
    {
      title: "Mistake Philosophy",
      desc: "Here we find a mistake, isn't that wonderful?! Because every bullseye is built out of mistakes. Never fear the fracture; it's where the light gets in."
    }
  ]

  return (
    <div className="vault-hall">
      <header className="vault-header">
        <h1>The Vault of Value</h1>
        <p className="vault-disclaimer">
          "This page is provided to you with a number of resources our team personally found valuable. 
          Any apparent association to our software is purely coincidental. 
          We just thought you might find value where we found it too."
        </p>
      </header>

      <main className="vault-grid">
        {resources.map((item, i) => (
          <div key={i} className="vault-card">
            <h3>{item.title}</h3>
            <p>{item.desc}</p>
            {item.url && (
              <a href={item.url} target="_blank" rel="noopener noreferrer" className="vault-link">
                Open Resource →
              </a>
            )}
          </div>
        ))}
      </main>

      <footer className="vault-footer">
        <p>Love first, in all things, at all times.</p>
      </footer>
    </div>
  )
}
