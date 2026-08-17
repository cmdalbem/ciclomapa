import React, { useEffect } from 'react';
import { App, ConfigProvider } from 'antd';
import ptBR from 'antd/locale/pt_BR';
import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';

import { bindAntdNotification } from '../antdNotification';
import { bindAntdModal } from '../antdModal';
import { getAntdConfigProviderProps } from '../config/antdTheme';

dayjs.locale('pt-br');

function AppApiBinder({ children }) {
  const { notification, modal } = App.useApp();

  useEffect(() => {
    bindAntdNotification(notification);
  }, [notification]);

  useEffect(() => {
    bindAntdModal(modal);
  }, [modal]);

  return children;
}

export default function AntdAppShell({ isDarkMode, children }) {
  return (
    <ConfigProvider locale={ptBR} {...getAntdConfigProviderProps(isDarkMode)}>
      <App>
        <AppApiBinder>{children}</AppApiBinder>
      </App>
    </ConfigProvider>
  );
}
