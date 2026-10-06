use std::path::Path;

fn main() {
    println!("cargo:rerun-if-env-changed=SPOTIFY_CLIENT_ID");
    println!("cargo:rerun-if-changed=../.env");
    let client_id = std::env::var("SPOTIFY_CLIENT_ID")
        .ok()
        .or_else(|| {
            std::fs::read_to_string("../.env")
                .ok()?
                .lines()
                .find_map(|line| {
                    line.trim()
                        .strip_prefix("SPOTIFY_CLIENT_ID=")
                        .map(|id| id.trim().trim_matches('"').to_owned())
                })
        })
        .filter(|id| !id.is_empty())
        .expect("Cannot find SPOTIFY_CLIENT_ID: set it in the environment or in the repo-root .env");
    let out_dir = std::env::var("OUT_DIR").expect("cargo sets OUT_DIR");
    std::fs::write(Path::new(&out_dir).join("spotify_client_id"), client_id)
        .expect("write client id");
    tauri_build::build()
}
