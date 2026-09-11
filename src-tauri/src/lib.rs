use std::{fs::{create_dir_all, write}, io::{Read, Write}, net::{TcpListener, TcpStream}, process::{Child, Command}, sync::Mutex, thread, time::{Duration, Instant}};
use tauri::Manager;

mod export;

struct ServerProcess(Mutex<Child>);
struct BackendUrl(String);

#[tauri::command]
fn backend_url(state: tauri::State<'_, BackendUrl>) -> String {
  state.0.clone()
}

fn reserve_local_port() -> Result<u16, Box<dyn std::error::Error>> {
  let listener = TcpListener::bind("127.0.0.1:0")?;
  Ok(listener.local_addr()?.port())
}

fn wait_for_health(port: u16, child: &mut Child) -> Result<(), Box<dyn std::error::Error>> {
  let deadline = Instant::now() + Duration::from_secs(20);
  while Instant::now() < deadline {
    if let Some(status) = child.try_wait()? {
      return Err(format!("backend exited before becoming ready: {status}").into());
    }
    if let Ok(mut stream) = TcpStream::connect_timeout(&format!("127.0.0.1:{port}").parse()?, Duration::from_millis(300)) {
      stream.set_read_timeout(Some(Duration::from_millis(500)))?;
      stream.write_all(b"GET /health HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n")?;
      let mut response = String::new();
      stream.read_to_string(&mut response)?;
      if response.starts_with("HTTP/1.1 200") && response.contains("\"status\":\"ok\"") {
        return Ok(());
      }
    }
    thread::sleep(Duration::from_millis(150));
  }
  Err("backend health check timed out".into())
}

fn start_server(app: &tauri::App) -> Result<(Child, String), Box<dyn std::error::Error>> {
  let resource_dir = app.path().resource_dir()?;
  let data_dir = app.path().app_local_data_dir()?;
  create_dir_all(&data_dir)?;

  let node_name = if cfg!(target_os = "windows") { "node.exe" } else { "node" };
  let node = resource_dir.join("node").join(node_name);
  let server_dir = resource_dir.join("server");
  let server_entry = server_dir.join("dist").join("index.js");
  let db_path = data_dir.join("app.db");
  let key_path = data_dir.join("credentials.key");
  let port = reserve_local_port()?;

  let mut command = Command::new(node);
  command.arg(server_entry)
    .current_dir(server_dir)
    .env("HOST", "127.0.0.1")
    .env("PORT", port.to_string())
    .env("SCRAPELIUM_DB_PATH", db_path)
    .env("SCRAPELIUM_CREDENTIAL_KEY_PATH", key_path);
  #[cfg(target_os = "windows")]
  {
    use std::os::windows::process::CommandExt;
    command.creation_flags(0x08000000);
  }
  let mut child = command.spawn()?;
  if let Err(error) = wait_for_health(port, &mut child) {
    let _ = child.kill();
    return Err(error);
  }

  Ok((child, format!("http://127.0.0.1:{port}")))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      let (child, url) = match start_server(app) {
        Ok(server) => server,
        Err(error) => {
          if let Ok(data_dir) = app.path().app_local_data_dir() {
            let _ = create_dir_all(&data_dir);
            let _ = write(data_dir.join("startup-error.log"), error.to_string());
          }
          return Err(error);
        }
      };
      app.manage(ServerProcess(Mutex::new(child)));
      app.manage(BackendUrl(url));
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .invoke_handler(tauri::generate_handler![backend_url, export::save_export])
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
