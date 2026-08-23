import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'antd';
import { HiOutlineXMark } from 'react-icons/hi2';

import { IS_PROD } from './config/constants.js';
import { applyPendingUpdate, getPendingUpdate, subscribeToPwaUpdate } from './pwaUpdate.js';

import './PwaUpdateBanner.css';

const isPwaBannerPreview =
  !IS_PROD && new URLSearchParams(window.location.search).has('pwa-banner');

function hasUpdateToShow() {
  return isPwaBannerPreview || Boolean(getPendingUpdate());
}

export default function PwaUpdateBanner({ isDarkMode }) {
  const [open, setOpen] = useState(() => hasUpdateToShow());

  useEffect(() => {
    return subscribeToPwaUpdate(() => {
      if (getPendingUpdate()) setOpen(true);
    });
  }, []);

  if (!open) {
    return null;
  }

  const handleDismiss = () => {
    setOpen(false);
  };

  const handleApply = () => {
    if (isPwaBannerPreview) {
      window.location.reload();
      return;
    }
    applyPendingUpdate();
  };

  return (
    <div className="pointer-events-none fixed bottom-2 left-2 right-2 z-[1000] flex justify-center sm:bottom-4">
      <div
        className={[
          'pwa-update-banner pointer-events-auto flex min-h-12 w-full max-w-md items-center gap-2 rounded-lg border py-3 pl-4 pr-2 shadow-md sm:w-auto sm:gap-3',
          isDarkMode ? 'pwa-update-banner--dark' : 'pwa-update-banner--light',
        ].join(' ')}
        role="status"
        aria-live="polite"
      >
        <span
          className={[
            'pwa-update-banner__label min-w-0 flex-1 truncate text-sm',
            isDarkMode ? 'pwa-update-banner__label--dark' : 'pwa-update-banner__label--light',
          ].join(' ')}
        >
          Tem nova versão do app!
        </span>
        <div className="flex shrink-0 items-center gap-1">
          <Button type="primary" size="small" onClick={handleApply}>
            Atualizar
          </Button>
          <Button
            type="text"
            size="small"
            className="pwa-update-banner__close !min-w-0 !px-2"
            onClick={handleDismiss}
            aria-label="Fechar"
            icon={<HiOutlineXMark className="text-lg opacity-70" aria-hidden />}
          />
        </div>
      </div>
    </div>
  );
}

PwaUpdateBanner.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};
