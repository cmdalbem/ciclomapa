import { notification as staticNotification } from 'antd';

let impl = staticNotification;

/**
 * Binds App.useApp().notification so notices respect ConfigProvider theme (dark/light).
 * Falls back to static notification until the shell mounts.
 */
export function bindAntdNotification(api) {
  impl = api;
}

/** Prefer `title` (antd v6). Maps legacy `message` → `title` if needed. */
function normalizeNotice(config) {
  if (!config || typeof config !== 'object') return config;
  if (config.message != null && config.title == null) {
    const { message, ...rest } = config;
    return { ...rest, title: message };
  }
  return config;
}

export const appNotification = {
  success: (c) => impl.success(normalizeNotice(c)),
  error: (c) => impl.error(normalizeNotice(c)),
  warning: (c) => impl.warning(normalizeNotice(c)),
  info: (c) => impl.info(normalizeNotice(c)),
  open: (c) => impl.open(normalizeNotice(c)),
  destroy: (key) => impl.destroy(key),
};
