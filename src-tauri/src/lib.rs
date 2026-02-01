#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            commands::project::open_project,
            commands::images::get_thumbnail,
            commands::captions::read_caption,
            commands::captions::write_caption,
            commands::captions::add_tag,
            commands::captions::remove_tag,
            commands::captions::reorder_tags,
            commands::lm_studio::test_lm_studio_connection,
            commands::lm_studio::generate_caption_lm_studio,
            commands::lm_studio::generate_captions_batch,
            commands::joycaption::generate_caption_joycaption,
            commands::joycaption::generate_captions_joycaption_batch,
            commands::export::export_dataset,
            commands::ratings::set_rating,
            commands::ratings::get_ratings,
            commands::joycaption_installer::joycaption_install_status,
            commands::joycaption_installer::joycaption_install,
        ])
        .run(tauri::generate_context!())
        .expect("error while running LoRA Dataset Studio");
}
