import React, { useEffect } from 'react';
import { App, ConfigProvider } from 'antd';
import ptBR from 'antd/locale/pt_BR';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

import { bindAntdNotification } from '../antdNotification';
import { getAntdConfigProviderProps } from '../config/antdTheme';

dayjs.locale('pt-br');

function NotificationBinder({ children }) {
  const { notification } = App.useApp();

  useEffect(() => {
    bindAntdNotification(notification);
  }, [notification]);

  return children;
}

export default function AntdAppShell({ isDarkMode, children }) {
  return (
    <ConfigProvider locale={ptBR} {...getAntdConfigProviderProps(isDarkMode)}>
      <App>
        <NotificationBinder>{children}</NotificationBinder>
      </App>
    </ConfigProvider>
  );
}
