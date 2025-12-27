use std::process::Command;
use std::path::PathBuf;
use serde::{Deserialize, Serialize};
use tauri::Manager;

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
async fn analyze(
    app_handle: tauri::AppHandle,
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

    let output = tauri::async_runtime::spawn_blocking(move || {
        // Prefer bundled analyzer even in dev; fallback to Python only if missing.
        if let Ok(exe_path) = find_bundled_analyzer(&app_handle) {
            log::info!("Running bundled analyzer: {}", exe_path.display());
            run_with_timeout(
                {
                    let mut cmd = Command::new(&exe_path);
                    cmd.arg(&project_path_cloned)
                        .arg(&extensions_cloned)
                        .arg(&excluded_cloned)
                        .arg(&theme_cloned)
                        .arg("json");
                    cmd
                },
                240,
            )
        } else {
            log::info!("Bundled analyzer not found, using development mode");
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
                    cmd
                },
                240,
            )
        }
    })
    .await
    .map_err(|e| format!("Analyzer task join error: {}", e))??;

    if !output.status.success() {
        let error_msg = String::from_utf8_lossy(&output.stderr);
        return Err(format!("Analysis failed: {}", error_msg));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let result: AnalysisResult = serde_json::from_str(&stdout)
        .map_err(|e| {
            log::error!("Failed to parse JSON: {}", e);
            log::error!("Raw output: {}", stdout);
            format!("Failed to parse analysis result: {}", e)
        })?;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![analyze, open_in_editor])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .on_window_event(|window, event| {
      // Exit entire application when main window is closed
      if let tauri::WindowEvent::CloseRequested { .. } = event {
        log::info!("Window closed, exiting application");
        std::process::exit(0);
      }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
