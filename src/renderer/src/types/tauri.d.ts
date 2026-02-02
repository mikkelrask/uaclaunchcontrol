declare global {
  interface Window {
    __TAURI__?: any;
    __TAURI_PLUGINS__?: Record<string, any>;
  }
}