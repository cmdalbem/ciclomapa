import React, { useEffect } from 'react';
import { App, ConfigProvider } from 'antd';

import { bindAntdNotification } from '../antdNotification';
import { getAntdConfigProviderProps } from '../config/antdTheme';

function NotificationBinder({ children }) {
  const { notification } = App.useApp();

  useEffect(() => {
    bindAntdNotification(notification);
  }, [notification]);

  return children;
}

export default function AntdAppShell({ isDarkMode, children }) {
  return (
    <ConfigProvider {...getAntdConfigProviderProps(isDarkMode)}>
      <App>
        <NotificationBinder>{children}</NotificationBinder>
      </App>
    </ConfigProvider>
  );
}
