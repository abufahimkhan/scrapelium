use std::fs::write;

#[tauri::command]
pub async fn save_export(filename: String, bytes: Vec<u8>) -> Result<bool, String> {
  let destination = rfd::AsyncFileDialog::new()
    .set_file_name(filename)
    .save_file()
    .await;

  let Some(destination) = destination else {
    return Ok(false);
  };

  write(destination.path(), bytes).map_err(|error| error.to_string())?;
  Ok(true)
}
