const observe = new Set([
  'browser_snapshot','browser_take_screenshot','browser_network_requests','browser_console_messages',
  'get_screen_size','get_cursor_position','list_root_windows','get_active_window',
  'get_installed_apps','list_visible_apps','screenshot','system_screenshot','get_metrics',
]);
const interactive = new Set([
  ...observe, 'browser_navigate','browser_navigate_back','browser_tabs','browser_close','browser_resize',
  'browser_click','browser_hover','browser_drag','browser_type','browser_press_key','browser_fill_form',
  'browser_select_option','browser_handle_dialog','browser_wait_for',
  'move_mouse','click_mouse','drag_mouse','scroll','input_text','press_keys','release_keys',
  'activate_window','resize_window','maximize_window','minimize_window','fullscreen_window','restore_window','start_app',
]);
export function allowed(name, config) {
  return config.allowTools ? config.allowTools.includes(name) : (config.profile === 'interactive' ? interactive : observe).has(name);
}
export function describeTool(tool) {
  return { ...tool, annotations: {
    title: tool.annotations?.title || tool.name,
    readOnlyHint: observe.has(tool.name),
    destructiveHint: !observe.has(tool.name),
    idempotentHint: false,
    openWorldHint: true,
  }};
}
