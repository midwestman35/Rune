use std::fs;
use std::path::Path;
use serde::Serialize;
use tauri::Manager;

#[derive(Serialize)]
struct LogEvent {
    time: String,
    level: String,
    message: String,
}

const KEYWORDS: &[&str] = &["ERROR", "ERR", "MEDIA_TIMEOUT", "AbandonedCall", "Warning"];

#[tauri::command]
fn get_events(file_path: String) -> Vec<LogEvent> {
    let mut content = String::new();
    let mut found = false;

    // 1. Try supplied path
    if !file_path.is_empty() {
        if let Ok(c) = fs::read_to_string(&file_path) {
            content = c;
            println!("Loaded logs from: {}", file_path);
            found = true;
        } else {
            println!("Failed to read provided path: {}", file_path);
        }
    }

    // 2. Fallback to dummy logs if no path provided or load failed
    if !found {
        let possible_paths = [
            "../dummy_logs/server_errors.log",
            "../../dummy_logs/server_errors.log",
            "dummy_logs/server_errors.log",
            "Rune/dummy_logs/server_errors.log"
        ];

        for p in possible_paths {
            if Path::new(p).exists() {
                if let Ok(c) = fs::read_to_string(p) {
                    content = c;
                    println!("Loaded logs from fallback: {}", p);
                    found = true;
                    break;
                }
            }
        }
    }

    if !found {
        println!("Could not find any logs.");
        return vec![
            LogEvent { time: "00:00:00".into(), level: "INFO".into(), message: "No log file loaded.".into() },
            LogEvent { time: "00:00:01".into(), level: "INFO".into(), message: "Click 'Open Log...' to select a file.".into() },
        ];
    }

    let mut events = Vec::new();

    for line in content.lines() {
        // Simple parsing: split by space, check for keywords
        // Format: Date Time Level Message...
        // e.g. "2023-10-27 10:00:01 ERROR Database connection..."
        
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 3 { continue; }

        let _date = parts[0];
        let time = parts[1];
        let _remainder = &parts[2..]; // Level and message
        let full_line = line;

        // Check for keywords
        let mut level = "INFO".to_string();
        let mut is_interesting = false;

        for &kw in KEYWORDS {
            if full_line.contains(kw) {
                level = kw.to_string();
                is_interesting = true;
                break;
            }
        }

        if is_interesting {
            // Reconstruct message from parts (skipping date and time)
            let message = parts[2..].join(" ");
            events.push(LogEvent {
                time: time.to_string(),
                level,
                message,
            });
        }
    }

    events
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![get_events])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
