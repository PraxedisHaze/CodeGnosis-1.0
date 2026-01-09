import React, { useState, useRef, useEffect } from 'react';
import './LoomControls.css';

interface LoomControlsProps {
  bloomIntensity: number;
  setBloomIntensity: (val: number) => void;
  starSize: number;
  setStarSize: (val: number) => void;
  linkOpacity: number;
  setLinkOpacity: (val: number) => void;
  starBrightness: number;
  setStarBrightness: (val: number) => void;
}

export const LoomControls: React.FC<LoomControlsProps> = ({
  bloomIntensity, setBloomIntensity,
  starSize, setStarSize,
  linkOpacity, setLinkOpacity,
  starBrightness, setStarBrightness
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pos, setPos] = useState({ x: 120, y: 300 });
  const [isDragging, setIsDragging] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).classList.contains('controls-toggle')) {
      setIsDragging(true);
      dragOffset.current = {
        x: e.clientX - pos.x,
        y: e.clientY - pos.y
      };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      setPos({
        x: e.clientX - dragOffset.current.x,
        y: e.clientY - dragOffset.current.y
      });
    };
    const handleMouseUp = () => setIsDragging(false);

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  return (
    <div 
      className={`loom-controls ${isOpen ? 'open' : 'closed'}`}
      style={{ left: pos.x, top: pos.y, transform: 'translate(-50%, -50%)', position: 'absolute' }}
      onMouseDown={handleMouseDown}
    >
      <button 
        className="controls-toggle"
        onClick={(e) => {
          if (!isDragging) setIsOpen(!isOpen);
        }}
        onDoubleClick={() => setPos({ x: 120, y: 300 })}
        title="Visual Calibration (Drag to move, Double-click to reset)"
      >
        {isOpen ? 'Close' : 'o Calibration'}
      </button>

      {isOpen && (
        <div className="controls-panel">
          <div className="control-group">
            <label>
              <span className="control-label">Atmosphere</span>
              <span className="control-sublabel">(Bloom)</span>
            </label>
            <input
              type="range" min="0" max="2" step="0.05"
              value={bloomIntensity}
              onChange={(e) => setBloomIntensity(parseFloat(e.target.value))}
            />
            <span>{Math.round(bloomIntensity * 100)}%</span>
          </div>

          <div className="control-group">
            <label>
              <span className="control-label">Star Mass</span>
              <span className="control-sublabel">(SIZE)</span>
            </label>
            <input
              type="range" min="0" max="2" step="0.05"
              value={starSize}
              onChange={(e) => setStarSize(parseFloat(e.target.value))}
            />
            <span>{Math.round(starSize * 100)}%</span>
          </div>

          <div className="control-group">
            <label>
              <span className="control-label">Cable Links</span>
              <span className="control-sublabel">(CONNECTING LINES)</span>
            </label>
            <input
              type="range" min="0" max="2" step="0.05"
              value={linkOpacity}
              onChange={(e) => setLinkOpacity(parseFloat(e.target.value))}
            />
            <span>{Math.round(linkOpacity * 100)}%</span>
          </div>

          <div className="control-group">
            <label>
              <span className="control-label">Background Stars</span>
              <span className="control-sublabel">(BRIGHTNESS)</span>
            </label>
            <input
              type="range" min="0" max="2" step="0.05"
              value={starBrightness}
              onChange={(e) => setStarBrightness(parseFloat(e.target.value))}
            />
            <span>{Math.round(starBrightness * 100)}%</span>
          </div>
        </div>
      )}
    </div>
  );
};
