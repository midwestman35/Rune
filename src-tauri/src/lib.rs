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
fn get_events() -> Vec<LogEvent> {
    // Try to find the dummy_logs directory relative to where we are running
    // We expect to be in rune_v4 or rune_v4/src-tauri
    // Let's look for the file in a few probable locations
    let possible_paths = [
        "../dummy_logs/server_errors.log",
        "../../dummy_logs/server_errors.log",
        "dummy_logs/server_errors.log",
        "Rune/dummy_logs/server_errors.log"
    ];

    let mut content = String::new();
    let mut found = false;

    for p in possible_paths {
        if Path::new(p).exists() {
            if let Ok(c) = fs::read_to_string(p) {
                content = c;
                println!("Loaded logs from: {}", p);
                found = true;
                break;
            }
        }
    }

    if !found {
        println!("Could not find dummy logs in any expected path.");
        // Return mock data if file not found, so UI doesn't look broken
        return vec![
            LogEvent { time: "00:00:00".into(), level: "INFO".into(), message: "Dummy logs not found, using internal mock.".into() },
            LogEvent { time: "12:34:56".into(), level: "ERROR".into(), message: "Could not locate server_errors.log".into() },
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
        let remainder = &parts[2..]; // Level and message
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

    // Reverse to show newest first? Or sequential? 
    // User asked for "sequential order" in the right-hand timeline feature for V3, 
    // but often timelines are newest top. Let's keep file order (sequential) as requested.
    events
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![get_events])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
