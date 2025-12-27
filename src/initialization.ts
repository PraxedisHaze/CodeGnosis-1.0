/**
 * initialization.ts
 * =================
 * Initializes the window namespace for CodeGnosis (Project Analyzer)
 */

export interface AETHNamespace {
  version: string
  appId: string
  appName: string
  capabilities: string[]
  initialized: boolean
  register: (star: StarRegistration) => void
}

export interface StarRegistration {
  id: string
  version: string
  capabilities: string[]
  offers?: Record<string, (...args: any[]) => any>
  needs?: string[]
}

// Declare global window.AETH
declare global {
  interface Window {
    AETH: AETHNamespace
  }
}

// Initialize window.AETH namespace
if (typeof window !== 'undefined') {
  window.AETH = {
    version: '1.0.0',
    appId: 'codegnosis',
    appName: 'CodeGnosis - Project Analyzer',
    capabilities: [
      'analyze-project',
      'generate-diagram',
      'export-json',
      'export-markdown',
      'export-html',
      'detect-dependencies',
      'detect-conflicts'
    ],
    initialized: true,
    register: (star: StarRegistration) => {
      console.log('[AETH] Star registered:', star.id)
      // Future: Connect to Registry
    }
  }

  // Register self as a Star
  window.AETH.register({
    id: 'codegnosis',
    version: '1.0.0',
    capabilities: window.AETH.capabilities,
    offers: {
      analyzeProject: async (projectPath: string) => {
        console.log('[CodeGnosis] Analyzing project:', projectPath)
        // Will be implemented via Tauri bridge
      }
    }
  })

  console.log('[AETH] CodeGnosis Star initialized')
}
