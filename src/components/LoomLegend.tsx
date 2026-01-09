import React, { useState, useEffect, useRef } from 'react';
import './LoomLegend.css';

const FAMILIES = [
  { name: 'Logic', color: '#00BFFF' },
  { name: 'UI', color: '#FFD700' },
  { name: 'Data', color: '#FF4500' },
  { name: 'Config', color: '#32CD32' },
  { name: 'Assets', color: '#9370DB' },
  { name: 'Docs', color: '#86efac' }
];

interface LoomLegendProps {
  selectedFamilies: string[];
  soloFamily: string | null;
  onToggleFamily: (family: string) => void;
  onSoloFamily: (family: string) => void;
  style?: React.CSSProperties;
  onLegendMouseDown?: (event: React.MouseEvent<HTMLDivElement>) => void;
}

export const LoomLegend: React.FC<LoomLegendProps> = ({
  selectedFamilies,
  soloFamily,
  onToggleFamily,
  onSoloFamily,
  style,
  onLegendMouseDown
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const legendRef = useRef<HTMLDivElement>(null);

  // Window-safe: ensure legend stays within viewport bounds
  useEffect(() => {
    const handleResize = () => {
      if (!legendRef.current) return;
      const rect = legendRef.current.getBoundingClientRect();
      const maxX = window.innerWidth - rect.width - 16;
      const maxY = window.innerHeight - rect.height - 16;

      // If legend is out of bounds, it will be clamped by CSS
      if (rect.left > maxX || rect.top > maxY) {
        legendRef.current.style.left = `${Math.min(rect.left, maxX)}px`;
        legendRef.current.style.top = `${Math.min(rect.top, maxY)}px`;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div
      ref={legendRef}
      className={`loom-legend ${isCollapsed ? 'collapsed' : ''}`}
      style={style}
      onMouseDown={onLegendMouseDown}
    >
      <div className="legend-header">
        <span className="legend-title">Legend</span>
        <button
          className="legend-collapse-btn"
          onClick={(e) => {
            e.stopPropagation();
            setIsCollapsed(!isCollapsed);
          }}
          title={isCollapsed ? 'Expand legend' : 'Collapse legend'}
        >
          {isCollapsed ? '+' : '-'}
        </button>
      </div>
      {!isCollapsed && (
        <div className="legend-content">
          {FAMILIES.map(fam => {
            const isActive = soloFamily === fam.name;
            return (
              <div
                key={fam.name}
                className={`legend-item ${isActive ? 'legend-item-active' : ''}`}
                style={isActive ? {
                  background: `${fam.color}30`,
                  boxShadow: `0 0 12px ${fam.color}50, inset 0 0 8px ${fam.color}20`
                } : undefined}
              >
                <label className="legend-toggle">
                  <input
                    type="checkbox"
                    checked={selectedFamilies.includes(fam.name)}
                    onChange={() => onToggleFamily(fam.name)}
                  />
                </label>
                <button
                  type="button"
                  className={`legend-dot ${isActive ? 'legend-dot-active' : ''}`}
                  onClick={() => onSoloFamily(fam.name)}
                  title="Solo focus"
                  style={{ background: (soloFamily && !isActive) ? '#444444' : fam.color }}
                />
                <span
                  className="legend-label"
                  style={isActive ? { color: fam.color, textShadow: `0 0 8px ${fam.color}` } : undefined}
                >
                  {fam.name}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
