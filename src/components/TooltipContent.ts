/**
 * SPDX-License-Identifier: MIT
 * Tooltip Content System - Three verbosity levels for all UI elements
 * Keystone Constellation
 */

export type VerbosityLevel = 'friendly' | 'professional' | 'technical';

interface TooltipText {
  friendly: string;
  professional: string;
  technical: string;
}

// Helper to get tooltip text by level
export function getTooltip(tooltip: TooltipText, level: VerbosityLevel): string {
  return tooltip[level];
}

export const tooltips = {
  // ============ SIDEBAR BUTTONS ============
  sidebar: {
    settings: {
      friendly: "Tweak how the app looks and works!",
      professional: "Configure analysis options, themes, and filters.",
      technical: "Modify runtime parameters: exclusions, themes, scan depth."
    } as TooltipText,

    toggleSide: {
      friendly: "Flip the sidebar to the other side!",
      professional: "Move control panel to opposite side of screen.",
      technical: "Toggle sidebar DOM position: left/right flex order."
    } as TooltipText,

    selectDirectory: {
      friendly: "Pick a folder to explore!",
      professional: "Choose the project folder to analyze.",
      technical: "Set root path for recursive file system traversal."
    } as TooltipText,

    analyze: {
      friendly: "Let's see what's inside!",
      professional: "Scan project and build the dependency graph.",
      technical: "Execute AST parsing, dependency resolution, graph generation."
    } as TooltipText,

    reset: {
      friendly: "Start fresh with a new project!",
      professional: "Clear analysis and select a different project.",
      technical: "Reset state: clear analysisResult, projectPath, cached data."
    } as TooltipText
  },

  // ============ QUICK STATS ============
  stats: {
    files: {
      friendly: "All the code files we found!",
      professional: "Total code and asset files in your project.",
      technical: "File count post-exclusion filter application."
    } as TooltipText,

    links: {
      friendly: "How connected everything is!",
      professional: "Import/dependency connections between files.",
      technical: "Edge count in directed dependency graph."
    } as TooltipText,

    health: {
      friendly: "Your code's wellness score!",
      professional: "Architecture health score (0-100). Higher is better.",
      technical: "Composite metric: cyclicality, orphans, coupling, depth."
    } as TooltipText
  },

  // ============ TAB INTERFACE ============
  tabs: {
    analysis: {
      friendly: "The full report card!",
      professional: "Detailed metrics, health scores, and AI readiness.",
      technical: "Aggregated statistics: complexity, debt, entry points, hubs."
    } as TooltipText,

    graph: {
      friendly: "Your code as a galaxy!",
      professional: "Interactive 3D dependency visualization.",
      technical: "Force-directed graph with Three.js/WebGL rendering."
    } as TooltipText,

    theConstruct: {
      friendly: "Step into the blueprint of your creation!",
      professional: "A structured ledger of every star in the galaxy.",
      technical: "Tabular representation of project entities, metadata, and topology."
    } as TooltipText,

    vault: {
      friendly: "Wisdom from the team!",
      professional: "Curated perspectives and philosophical resources.",
      technical: "Static content: team philosophy and documentation."
    } as TooltipText
  },

  // ============ CONTROL PANEL SLIDERS ============
  controls: {
    atmosphere: {
      friendly: "Make it glow more or less!",
      professional: "Adjust bloom/glow effect around nodes.",
      technical: "WebGL bloom pass intensity (0.0-1.0)."
    } as TooltipText,

    starMass: {
      friendly: "Bigger = more important!",
      professional: "Node size based on dependency count.",
      technical: "Vertex scale factor proportional to in/out degree."
    } as TooltipText,

    cableLinks: {
      friendly: "Show or hide the connections!",
      professional: "Opacity of dependency lines between files.",
      technical: "Edge geometry alpha channel (0.0-1.0)."
    } as TooltipText,

    background: {
      friendly: "Brighten or dim the stars!",
      professional: "Background star brightness for contrast.",
      technical: "Particle system luminosity multiplier."
    } as TooltipText,

    spread: {
      friendly: "How far apart things float!",
      professional: "Node spacing - tighter or more spread out.",
      technical: "Force simulation repulsion coefficient."
    } as TooltipText,

    skybox: {
      friendly: "Pick your favorite colors!",
      professional: "Visual theme for background and accents.",
      technical: "CSS theme variables and WebGL environment map."
    } as TooltipText
  },

  // ============ LEGEND CATEGORIES ============
  legend: {
    components: {
      friendly: "UI building blocks!",
      professional: "React/Vue/Svelte components.",
      technical: "Files with JSX/TSX or component-pattern exports."
    } as TooltipText,

    logic: {
      friendly: "The brains of the operation!",
      professional: "Business logic, utilities, and helpers.",
      technical: "Non-component .ts/.js with algorithmic content."
    } as TooltipText,

    config: {
      friendly: "Settings and setup files!",
      professional: "Configuration and environment files.",
      technical: "JSON, YAML, .env, and *config.* pattern matches."
    } as TooltipText,

    styles: {
      friendly: "Colors and layouts!",
      professional: "CSS, SCSS, and styling files.",
      technical: "Stylesheet assets: .css, .scss, .less, .styl."
    } as TooltipText,

    assets: {
      friendly: "Images, fonts, and media!",
      professional: "Static assets and resources.",
      technical: "Binary/media: images, fonts, audio, video."
    } as TooltipText,

    tests: {
      friendly: "Quality assurance files!",
      professional: "Test files and specs.",
      technical: "Files matching *.test.*, *.spec.*, __tests__/*."
    } as TooltipText,

    soloMode: {
      friendly: "Focus on just this type!",
      professional: "Click to isolate this category, dimming others.",
      technical: "Toggle solo filter: opacity mask on non-matching nodes."
    } as TooltipText
  },

  // ============ SETTINGS MODAL ============
  settings: {
    exclusionFilter: {
      friendly: "Skip these folders - they're not important!",
      professional: "Comma-separated folders to exclude from analysis.",
      technical: "Glob patterns applied during recursive directory traversal."
    } as TooltipText,

    autoExport: {
      friendly: "Save a file you can share with AI!",
      professional: "Auto-save JSON context for AI chat understanding.",
      technical: "Serialize analysisResult to ai-bundle.json post-scan."
    } as TooltipText,

    skipIntro: {
      friendly: "Jump straight to the galaxy!",
      professional: "Skip intro animation for faster access.",
      technical: "Bypass ThreeJS camera animation sequence on load."
    } as TooltipText,

    twinkle: {
      friendly: "How much the stars sparkle!",
      professional: "Background star twinkling animation intensity.",
      technical: "Shader uniform for star alpha oscillation amplitude."
    } as TooltipText,

    theme: {
      friendly: "Pick your favorite look!",
      professional: "Visual theme affecting colors and atmosphere.",
      technical: "CSS custom properties and WebGL environment preset."
    } as TooltipText,

    tooltipLevel: {
      friendly: "How we explain things to you!",
      professional: "Choose tooltip detail level: casual to technical.",
      technical: "Select verbosity tier for contextual help strings."
    } as TooltipText
  },

  // ============ MISSION BUTTONS ============
  missions: {
    risk: {
      friendly: "Find the danger zones!",
      professional: "Identify high-risk areas with complex dependencies.",
      technical: "Highlight nodes with high cyclomatic complexity and coupling."
    } as TooltipText,

    rot: {
      friendly: "Spot the stale stuff!",
      professional: "Find unused or outdated code that may need cleanup.",
      technical: "Detect orphan nodes and files with no inbound references."
    } as TooltipText,

    onboard: {
      friendly: "Where should new folks start?",
      professional: "Entry points and core files for onboarding new developers.",
      technical: "Identify hub files and critical path dependencies."
    } as TooltipText,

    incident: {
      friendly: "What could break things?",
      professional: "High-impact files that could cause widespread issues.",
      technical: "Calculate blast radius based on downstream dependency count."
    } as TooltipText
  },

  // ============ VIEW CONTROLS ============
  view: {
    formation: {
      friendly: "Line things up neatly!",
      professional: "Toggle between galaxy view and structured grid layout.",
      technical: "Switch force simulation to fixed-position grid layout."
    } as TooltipText,

    external: {
      friendly: "Show outside libraries!",
      professional: "Toggle visibility of external dependencies.",
      technical: "Filter nodes matching node_modules or external patterns."
    } as TooltipText,

    restoreHorizon: {
      friendly: "Get back to the good view!",
      professional: "Reset camera orientation while keeping position.",
      technical: "Animate camera lookAt to origin without position reset."
    } as TooltipText,

    resetView: {
      friendly: "Start from scratch!",
      professional: "Reset camera to default starting position.",
      technical: "Reset camera position, rotation, and controls to initial state."
    } as TooltipText
  }
};
