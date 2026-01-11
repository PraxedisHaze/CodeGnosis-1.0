use std::fs;
use std::time::{SystemTime, UNIX_EPOCH};
use std::path::PathBuf;
use std::process::Command;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};
use tauri::{Manager, State, WebviewUrl, WebviewWindowBuilder};

#[allow(dead_code)]
#[derive(Debug, Deserialize)]
struct AnalyzerOutput {
    #[serde(rename = "resultFile")]
    result_file: Option<String>,
    // Fallback for direct result (backwards compat)
    #[serde(flatten)]
    direct_result: Option<AnalysisResult>,
}

#[derive(Debug, Serialize, Deserialize)]
struct AnalysisResult {
    #[serde(rename = "projectName")]
    project_name: String,
    #[serde(rename = "generatedAt")]
    generated_at: String,
    summary: serde_json::Value,
    #[serde(rename = "entryPoints")]
    entry_points: Vec<serde_json::Value>,
    #[serde(rename = "hubFiles")]
    hub_files: Vec<serde_json::Value>,
    #[serde(rename = "healthWarnings")]
    health_warnings: Vec<serde_json::Value>,
    statistics: serde_json::Value,
    files: serde_json::Value,
    #[serde(rename = "dependencyGraph")]
    dependency_graph: serde_json::Value,
    #[serde(rename = "graphImagePath")]
    graph_image_path: Option<String>,
    #[serde(rename = "graphImageFormat")]
    graph_image_format: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
struct ProgressSnapshot {
    stage: String,
    percent: u8,
    message: String,
    timestamp: String,
}

struct ProgressFileState(Mutex<Option<PathBuf>>);

impl ProgressFileState {
    fn new() -> Self {
        ProgressFileState(Mutex::new(None))
    }

    fn set_path(&self, path: Option<PathBuf>) {
        let mut guard = self.0.lock().unwrap();
        *guard = path;
    }

    fn current_path(&self) -> Option<PathBuf> {
        let guard = self.0.lock().unwrap();
        guard.clone()
    }

    fn take_path(&self) -> Option<PathBuf> {
        let mut guard = self.0.lock().unwrap();
        guard.take()
    }
}

fn find_bundled_analyzer(app_handle: &tauri::AppHandle) -> Result<PathBuf, String> {
    // In production: use the bundled executable from externalBin
    // In development: fall back to Python script execution

    // Try to resolve the bundled binary (Tauri automatically adds .exe on Windows)
    if let Ok(resource_path) = app_handle.path().resolve(
        "binaries/analyzer_core",
        tauri::path::BaseDirectory::Resource
    ) {
        // Check with platform extension
        #[cfg(target_os = "windows")]
        let exe_path = resource_path.with_extension("exe");

        #[cfg(not(target_os = "windows"))]
        let exe_path = resource_path;

        if exe_path.exists() {
            log::info!("Found bundled analyzer: {}", exe_path.display());
            return Ok(exe_path);
        }
    }

    Err("Could not find bundled analyzer_core executable. Build may have failed.".to_string())
}

fn run_with_timeout(mut cmd: Command, timeout_secs: u64) -> Result<std::process::Output, String> {
    use std::io::Read;
    use std::process::Stdio;
    use std::thread;
    use std::time::{Duration, Instant};

    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());
    let mut child = cmd.spawn().map_err(|e| format!("Failed to spawn analyzer: {}", e))?;

    let deadline = Instant::now() + Duration::from_secs(timeout_secs);
    let status = loop {
        if let Ok(Some(status)) = child.try_wait() {
            break status;
        }
        if Instant::now() > deadline {
            let _ = child.kill();
            return Err(format!("Analyzer timed out after {}s", timeout_secs));
        }
        thread::sleep(Duration::from_millis(100));
    };

    let mut stdout_buf = Vec::new();
    let mut stderr_buf = Vec::new();

    if let Some(mut out) = child.stdout.take() {
        let _ = out.read_to_end(&mut stdout_buf);
    }
    if let Some(mut err) = child.stderr.take() {
        let _ = err.read_to_end(&mut stderr_buf);
    }

    Ok(std::process::Output {
        status,
        stdout: stdout_buf,
        stderr: stderr_buf,
    })
}

fn find_python_script_dev() -> Result<PathBuf, String> {
    // Development fallback: try to find the Python script
    let mut possible_paths: Vec<PathBuf> = vec![
        PathBuf::from("analyzer_core.py"),
        PathBuf::from("../analyzer_core.py"),
    ];

    if let Ok(cwd) = std::env::current_dir() {
        possible_paths.push(cwd.join("analyzer_core.py"));
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            possible_paths.push(parent.join("analyzer_core.py"));
        }
    }

    for path in possible_paths {
        if path.exists() {
            return Ok(path);
        }
    }

    Err("Could not find analyzer_core.py for development mode.".to_string())
}

fn find_python_executable() -> Result<String, String> {
    // Try different Python executable names
    let python_names = vec!["python3", "python", "py"];

    for name in python_names {
        if Command::new(name)
            .arg("--version")
            .output()
            .is_ok()
        {
            return Ok(name.to_string());
        }
    }

    Err("Python is not installed or not in PATH. Please install Python 3.8 or higher from python.org".to_string())
}

#[tauri::command]
fn get_analysis_progress(state: State<'_, ProgressFileState>) -> Result<Option<ProgressSnapshot>, String> {
    if let Some(path) = state.current_path() {
        match fs::read_to_string(&path) {
            Ok(contents) => {
                let snapshot: ProgressSnapshot = serde_json::from_str(&contents)
                    .map_err(|e| format!("Failed to parse progress JSON: {}", e))?;
                Ok(Some(snapshot))
            }
            Err(_) => Ok(None),
        }
    } else {
        Ok(None)
    }
}

fn cleanup_progress_file(state: &State<'_, ProgressFileState>, path: &PathBuf) {
    state.take_path();
    if let Err(e) = fs::remove_file(path) {
        log::warn!("Failed to remove progress file: {}", e);
    }
}

#[tauri::command]
async fn analyze(
    app_handle: tauri::AppHandle,
    state: State<'_, ProgressFileState>,
    project_path: String,
    extensions: Option<String>,
    excluded: Option<String>,
    theme: Option<String>,
) -> Result<AnalysisResult, String> {
    let extensions_str = extensions.unwrap_or_default();
    let excluded_str = excluded.unwrap_or_default();
    let theme_str = theme.unwrap_or_else(|| "Dark".to_string());

    let project_path_cloned = project_path.clone();
    let extensions_cloned = extensions_str.clone();
    let excluded_cloned = excluded_str.clone();
    let theme_cloned = theme_str.clone();

    let progress_path = {
        let timestamp = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|d| d.as_micros())
            .unwrap_or(0);
        std::env::temp_dir().join(format!("codegnosis_progress_{}.json", timestamp))
    };
    if let Err(e) = fs::File::create(&progress_path) {
        log::warn!("Failed to create progress file: {}", e);
    }
    state.set_path(Some(progress_path.clone()));
    let progress_arg = progress_path.to_string_lossy().to_string();

    let output = tauri::async_runtime::spawn_blocking(move || {
        // In dev, prefer Python script so changes take effect immediately.
        if cfg!(debug_assertions) {
            log::info!("Dev mode: using Python analyzer_core.py");
            let python_exe = find_python_executable()?;
            let script_path = find_python_script_dev()?;
            log::info!("Using Python: {}", python_exe);
            log::info!("Using script: {}", script_path.display());
            return run_with_timeout(
                {
                    let mut cmd = Command::new(&python_exe);
                    cmd.arg(script_path)
                        .arg(&project_path_cloned)
                        .arg(&extensions_cloned)
                        .arg(&excluded_cloned)
                        .arg(&theme_cloned)
                        .arg("json");
                    cmd.arg("--progress-file").arg(&progress_arg);
                    cmd
                },
                240,
            );
        }

        if let Ok(exe_path) = find_bundled_analyzer(&app_handle) {
            log::info!("Running bundled analyzer: {}", exe_path.display());
            return run_with_timeout(
                {
                    let mut cmd = Command::new(&exe_path);
                    cmd.arg(&project_path_cloned)
                        .arg(&extensions_cloned)
                        .arg(&excluded_cloned)
                        .arg(&theme_cloned)
                        .arg("json");
                    cmd.arg("--progress-file").arg(&progress_arg);
                    cmd
                },
                240,
            );
        }

        log::info!("Bundled analyzer not found, using Python fallback");
        let python_exe = find_python_executable()?;
        let script_path = find_python_script_dev()?;
        log::info!("Using Python: {}", python_exe);
        log::info!("Using script: {}", script_path.display());
        run_with_timeout(
            {
                let mut cmd = Command::new(&python_exe);
                cmd.arg(script_path)
                    .arg(&project_path_cloned)
                    .arg(&extensions_cloned)
                    .arg(&excluded_cloned)
                    .arg(&theme_cloned)
                    .arg("json");
                cmd.arg("--progress-file").arg(&progress_arg);
                cmd
            },
            240,
        )
    })
    .await
    .map_err(|e| format!("Analyzer task join error: {}", e))??;

    cleanup_progress_file(&state, &progress_path);
    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Analysis failed: {}", error_msg));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);

    // First try to parse as AnalyzerOutput (may contain resultFile path)
    let analyzer_output: serde_json::Value = serde_json::from_str(&stdout)
        .map_err(|e| {
            log::error!("Failed to parse JSON: {}", e);
            log::error!("Raw output: {}", stdout);
            format!("Failed to parse analysis result: {}", e)
        })?;

    // Check if result is in a file
    let result: AnalysisResult = if let Some(result_file) = analyzer_output.get("resultFile").and_then(|v| v.as_str()) {
        log::info!("Reading result from file: {}", result_file);
        let file_content = std::fs::read_to_string(result_file)
            .map_err(|e| format!("Failed to read result file: {}", e))?;
        serde_json::from_str(&file_content)
            .map_err(|e| format!("Failed to parse result file: {}", e))?
    } else {
        // Direct result in stdout (backwards compat)
        serde_json::from_value(analyzer_output)
            .map_err(|e| format!("Failed to parse direct result: {}", e))?
    };

    Ok(result)
}

#[tauri::command]
async fn open_in_editor(file_path: String) -> Result<(), String> {
    use std::process::Command;

    log::info!("Opening file in editor: {}", file_path);

    // Try VS Code first (most common)
    let vscode_result = Command::new("code")
        .arg(&file_path)
        .spawn();

    if vscode_result.is_ok() {
        log::info!("Opened in VS Code");
        return Ok(());
    }

    // Fallback to system default
    #[cfg(target_os = "windows")]
    let result = Command::new("cmd")
        .args(["/C", "start", "", &file_path])
        .spawn();

    #[cfg(target_os = "macos")]
    let result = Command::new("open")
        .arg(&file_path)
        .spawn();

    #[cfg(target_os = "linux")]
    let result = Command::new("xdg-open")
        .arg(&file_path)
        .spawn();

    result
        .map(|_| ())
        .map_err(|e| format!("Failed to open file: {}", e))
}

#[tauri::command]
async fn close_splash(app_handle: tauri::AppHandle) -> Result<(), String> {
    if let Some(splash) = app_handle.get_webview_window("splash") {
        let _ = splash.close();
    }
    Ok(())
}

#[tauri::command]
async fn open_folder(path: String) -> Result<(), String> {
    log::info!("Opening folder: {}", path);

    #[cfg(target_os = "windows")]
    let result = Command::new("explorer")
        .arg(&path)
        .spawn();

    #[cfg(target_os = "macos")]
    let result = Command::new("open")
        .arg(&path)
        .spawn();

    #[cfg(target_os = "linux")]
    let result = Command::new("xdg-open")
        .arg(&path)
        .spawn();

    result
        .map(|_| ())
        .map_err(|e| format!("Failed to open folder: {}", e))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(ProgressFileState::new())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_sql::Builder::default().build())
    .invoke_handler(tauri::generate_handler![analyze, get_analysis_progress, open_in_editor, open_folder, close_splash])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Splash: Shows CODEGNOSIS LOADING text only (image handled in main window's index.html)
      let splash_html = "data:text/html,%3C!doctype%20html%3E%3Chtml%3E%3Chead%3E%3Cstyle%3E\
*%7Bmargin:0;padding:0%7D\
html,body%7Bwidth:100%25;height:100%25;background:%23000;font-family:system-ui,sans-serif;overflow:hidden%7D\
.c%7Bposition:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1.5rem%7D\
.t%7Bfont-size:2.5rem;font-weight:700;letter-spacing:0.3em;color:%23fff;text-shadow:0%200%2020px%20rgba(100,180,255,0.8)%7D\
.l%7Bfont-size:0.9rem;letter-spacing:0.4em;color:rgba(150,200,255,0.7);animation:p%201.5s%20ease-in-out%20infinite%7D\
@keyframes%20p%7B0%25,100%25%7Bopacity:0.4%7D50%25%7Bopacity:1%7D%7D\
%3C/style%3E%3C/head%3E%3Cbody%3E\
%3Cdiv%20class=%22c%22%3E%3Cdiv%20class=%22t%22%3ECODEGNOSIS%3C/div%3E%3Cdiv%20class=%22l%22%3ELOADING%3C/div%3E%3C/div%3E\
%3C/body%3E%3C/html%3E";

      let _splash = WebviewWindowBuilder::new(
        app,
        "splash",
        WebviewUrl::External(splash_html.parse().unwrap())
      )
      .title("CodeGnosis")
      .maximized(true)
      .decorations(false)
      .always_on_top(true)
      .skip_taskbar(true)
      .build()?;

      Ok(())
    })
    .on_window_event(|window, event| {
      // Exit entire application only when MAIN window is closed (not splash)
      if let tauri::WindowEvent::CloseRequested { .. } = event {
        if window.label() == "main" {
          log::info!("Main window closed, exiting application");
          std::process::exit(0);
        }
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
