#!/usr/bin/env node

/**
 * build.cjs
 * =========
 * Build script for CodeGnosis (Project Analyzer Star)
 *
 * Purpose: Bundle the Python analyzer core + Graphviz into a standalone executable
 * Covenant: Zero Overhead - users need no external dependencies
 *
 * This script:
 * 1. Installs PyInstaller
 * 2. Downloads portable Graphviz binaries
 * 3. Bundles Python core + Graphviz into single executable
 * 4. Outputs to src-tauri/binaries/ for Tauri bundling
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

// ============================================================================
// Configuration
// ============================================================================

const CONFIG = {
  pythonScript: 'analyzer_core.py',
  outputDir: path.join('src-tauri', 'binaries'),
  outputName: 'analyzer_core',
  graphvizVersion: '12.2.1',
  graphvizUrl: 'https://gitlab.com/api/v4/projects/4207231/packages/generic/graphviz-releases/12.2.1/windows_10_cmake_Release_Graphviz-12.2.1-win64.zip'
};

// ============================================================================
// Utility Functions
// ============================================================================

function log(message) {
  console.log(`[build] ${message}`);
}

function error(message) {
  console.error(`[build] ERROR: ${message}`);
  process.exit(1);
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    log(`Created directory: ${dirPath}`);
  }
}

function checkPython() {
  log('Checking Python installation...');
  try {
    const pythonVersion = execSync('python --version', { encoding: 'utf-8' });
    log(`Found Python: ${pythonVersion.trim()}`);
    return 'python';
  } catch (e) {
    try {
      const python3Version = execSync('python3 --version', { encoding: 'utf-8' });
      log(`Found Python: ${python3Version.trim()}`);
      return 'python3';
    } catch (e2) {
      error('Python is not installed or not in PATH. Please install Python 3.8+');
    }
  }
}

function downloadFile(url, destPath) {
  return new Promise((resolve, reject) => {
    log(`Downloading from ${url}...`);
    const file = fs.createWriteStream(destPath);

    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Follow redirect
        return downloadFile(response.headers.location, destPath)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
        return;
      }

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        log(`Downloaded to ${destPath}`);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlinkSync(destPath);
      reject(err);
    });
  });
}

async function downloadGraphviz() {
  log('Preparing Graphviz bundle...');

  const graphvizDir = path.join('build', 'graphviz');
  const zipPath = path.join('build', 'graphviz.zip');

  ensureDir('build');

  // Download Graphviz portable
  if (!fs.existsSync(zipPath)) {
    try {
      await downloadFile(CONFIG.graphvizUrl, zipPath);
    } catch (err) {
      error(`Failed to download Graphviz: ${err.message}`);
    }
  } else {
    log('Graphviz zip already exists, skipping download');
  }

  // Extract if not already extracted
  if (!fs.existsSync(graphvizDir)) {
    log('Extracting Graphviz...');
    try {
      // Use PowerShell on Windows for extraction
      if (process.platform === 'win32') {
        execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${graphvizDir}' -Force"`, { stdio: 'inherit' });
      } else {
        execSync(`unzip -q "${zipPath}" -d "${graphvizDir}"`, { stdio: 'inherit' });
      }
      log('Graphviz extracted successfully');
    } catch (err) {
      error(`Failed to extract Graphviz: ${err.message}`);
    }
  } else {
    log('Graphviz already extracted');
  }

  return graphvizDir;
}

function installPyInstaller(pythonCmd) {
  log('Installing PyInstaller...');
  try {
    execSync(`${pythonCmd} -m pip install pyinstaller`, { stdio: 'inherit' });
    log('PyInstaller installed successfully');
  } catch (err) {
    error(`Failed to install PyInstaller: ${err.message}`);
  }
}

function buildPythonExecutable(pythonCmd, graphvizDir) {
  log('Building standalone Python executable...');

  ensureDir(CONFIG.outputDir);

  // Find the Graphviz bin directory
  let graphvizBinPath = '';
  if (fs.existsSync(graphvizDir)) {
    // The extracted structure might vary, look for bin directory
    const searchPaths = [
      path.join(graphvizDir, 'bin'),
      path.join(graphvizDir, 'Graphviz', 'bin'),
      path.join(graphvizDir, 'windows_10_cmake_Release_Graphviz-12.2.1-win64', 'bin'),
    ];

    for (const searchPath of searchPaths) {
      if (fs.existsSync(searchPath)) {
        graphvizBinPath = searchPath;
        log(`Found Graphviz binaries at: ${graphvizBinPath}`);
        break;
      }
    }
  }

  // Build PyInstaller command
  const pyinstallerArgs = [
    '-m', 'PyInstaller',
    '--onefile',
    '--clean',
    '--noconfirm',
    `--distpath=${CONFIG.outputDir}`,
    `--name=${CONFIG.outputName}`,
  ];

  // Add Graphviz binaries if found
  if (graphvizBinPath) {
    pyinstallerArgs.push(`--add-binary=${graphvizBinPath}${path.sep}*${path.delimiter}.`);
    log('Bundling Graphviz binaries with executable');
  } else {
    log('WARNING: Graphviz binaries not found, executable may require system Graphviz');
  }

  pyinstallerArgs.push(CONFIG.pythonScript);

  const command = `${pythonCmd} ${pyinstallerArgs.join(' ')}`;

  try {
    log('Running PyInstaller (this may take a few minutes)...');
    execSync(command, { stdio: 'inherit' });
    log('Python executable built successfully');
  } catch (err) {
    error(`Failed to build executable: ${err.message}`);
  }

  // Verify output and create platform-specific copies for Tauri
  const outputPath = path.join(CONFIG.outputDir, CONFIG.outputName + (process.platform === 'win32' ? '.exe' : ''));
  if (fs.existsSync(outputPath)) {
    const stats = fs.statSync(outputPath);
    log(`Output: ${outputPath} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

    // Create platform-specific copies for Tauri sidecar
    const platformTargets = {
      'win32': ['x86_64-pc-windows-msvc', 'i686-pc-windows-msvc'],
      'darwin': ['x86_64-apple-darwin', 'aarch64-apple-darwin'],
      'linux': ['x86_64-unknown-linux-gnu']
    };

    const targets = platformTargets[process.platform] || [];
    for (const target of targets) {
      const ext = process.platform === 'win32' ? '.exe' : '';
      const targetPath = path.join(CONFIG.outputDir, `${CONFIG.outputName}-${target}${ext}`);
      try {
        fs.copyFileSync(outputPath, targetPath);
        log(`Created platform-specific binary: ${targetPath}`);
      } catch (err) {
        log(`Warning: Failed to create ${targetPath}: ${err.message}`);
      }
    }
  } else {
    error(`Expected output not found: ${outputPath}`);
  }
}

// ============================================================================
// Main Build Process
// ============================================================================

async function main() {
  log('=== Alethari Analyzer Core Build ===');
  log('Building standalone executable (Zero Overhead Vow)');
  log('');

  // Check Python
  const pythonCmd = checkPython();

  // Download and extract Graphviz
  const graphvizDir = await downloadGraphviz();

  // Install PyInstaller
  installPyInstaller(pythonCmd);

  // Build executable
  buildPythonExecutable(pythonCmd, graphvizDir);

  log('');
  log('=== Build Complete ===');
  log(`Standalone executable: ${path.join(CONFIG.outputDir, CONFIG.outputName)}`);
  log('Ready for Tauri bundling');
}

// Run
main().catch(err => {
  error(`Build failed: ${err.message}`);
});
