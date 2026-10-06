mod auth;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(auth::Auth::default())
        .invoke_handler(tauri::generate_handler![
            auth::restore_session,
            auth::sign_in,
            auth::cancel_sign_in,
            auth::sign_out,
            auth::access_token,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
