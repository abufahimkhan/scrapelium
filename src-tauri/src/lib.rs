use std::{fs::create_dir_all, process::{Child, Command}, sync::Mutex};
use tauri::Manager;

struct ServerProcess(Mutex<Child>);

fn start_server(app: &tauri::App) -> Result<(), Box<dyn std::error::Error>> {
  let resource_dir = app.path().resource_dir()?;
  let data_dir = app.path().app_local_data_dir()?;
  create_dir_all(&data_dir)?;

  let node_name = if cfg!(target_os = "windows") { "node.exe" } else { "node" };
  let node = resource_dir.join("node").join(node_name);
  let server_dir = resource_dir.join("server");
  let server_entry = server_dir.join("dist").join("index.js");
  let db_path = data_dir.join("app.db");

  let child = Command::new(node)
    .arg(server_entry)
    .current_dir(server_dir)
    .env("SCRAPELIUM_DB_PATH", db_path)
    .spawn()?;

  app.manage(ServerProcess(Mutex::new(child)));
  Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      start_server(app)?;
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .build(tauri::generate_context!())
    .expect("error while building Tauri application")
    .run(|app, event| {
      if matches!(event, tauri::RunEvent::ExitRequested { .. } | tauri::RunEvent::Exit) {
        if let Some(server) = app.try_state::<ServerProcess>() {
          let _ = server.0.lock().expect("server process lock").kill();
        }
      }
    });
}
