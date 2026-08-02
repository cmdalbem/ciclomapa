import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Button } from 'antd';
import { HiOutlineXMark } from 'react-icons/hi2';

import { IS_PROD } from './config/constants.js';
import { applyPendingUpdate, getPendingUpdate, subscribeToPwaUpdate } from './pwaUpdate.js';

import './PwaUpdateBanner.css';

const isPwaBannerPreview =
  !IS_PROD && new URLSearchParams(window.location.search).has('pwa-banner');

const TRANSITION_MS = 750;

function hasUpdateToShow() {
  return isPwaBannerPreview || Boolean(getPendingUpdate());
}

export default function PwaUpdateBanner({ isDarkMode }) {
  const [visible, setVisible] = useState(() => hasUpdateToShow());
  const [dismissed, setDismissed] = useState(false);
  const [mounted, setMounted] = useState(() => hasUpdateToShow());
  const [active, setActive] = useState(false);

  const shouldShow = visible && !dismissed && hasUpdateToShow();

  useEffect(() => {
    return subscribeToPwaUpdate(() => {
      if (getPendingUpdate()) {
        setDismissed(false);
        setVisible(true);
      }
    });
  }, []);

  useEffect(() => {
    if (shouldShow) {
      setMounted(true);
      const frame = requestAnimationFrame(() => {
        requestAnimationFrame(() => setActive(true));
      });
      return () => cancelAnimationFrame(frame);
    }

    setActive(false);
    return undefined;
  }, [shouldShow]);

  useEffect(() => {
    if (!shouldShow && mounted && !active) {
      const timer = window.setTimeout(() => setMounted(false), TRANSITION_MS);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [shouldShow, mounted, active]);

  if (!mounted) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
  };

  const handleApply = () => {
    if (isPwaBannerPreview) {
      window.location.reload();
      return;
    }
    applyPendingUpdate();
  };

  return (
    <div
      className={[
        'pwa-update-banner fixed bottom-2 left-2 right-2 z-[1000] flex min-h-12 items-center gap-2 rounded-lg border px-4 py-3 shadow-md sm:gap-3',
        active ? 'pwa-update-banner--visible' : '',
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
  );
}

PwaUpdateBanner.propTypes = {
  isDarkMode: PropTypes.bool.isRequired,
};
