import { Modal as staticModal } from 'antd';

let impl = staticModal;

/**
 * Binds App.useApp().modal so confirms/info dialogs respect ConfigProvider theme.
 * Falls back to static Modal until the shell mounts.
 */
export function bindAntdModal(api) {
  impl = api;
}

export const appModal = {
  confirm: (c) => impl.confirm(c),
  info: (c) => impl.info(c),
  success: (c) => impl.success(c),
  error: (c) => impl.error(c),
  warning: (c) => impl.warning(c),
  destroyAll: () => impl.destroyAll?.(),
};
