/**
 * Context for reactive mobile breakpoint detection.
 * Updates on resize/orientation change, fixing layout when viewport crosses the breakpoint.
 */
import React, { createContext, useContext, useState, useEffect } from 'react';
import { MOBILE_MAX_WIDTH } from '../config/constants.js';

const MobileContext = createContext(null);

const getIsMobile = () =>
  typeof window !== 'undefined' &&
  window.matchMedia &&
  window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH})`).matches;

export const useIsMobile = () => {
  const context = useContext(MobileContext);
  if (context === null) {
    return getIsMobile();
  }
  return context;
};

export const MobileProvider = ({ children }) => {
  const [isMobile, setIsMobile] = useState(getIsMobile);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH})`);
    const handler = () => setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return <MobileContext.Provider value={isMobile}>{children}</MobileContext.Provider>;
};

/** HOC for class components that need reactive isMobile */
export const withMobile = (Component) => {
  const WithMobile = (props) => {
    const isMobile = useIsMobile();
    return <Component {...props} isMobile={isMobile} />;
  };
  WithMobile.displayName = `WithMobile(${Component.displayName || Component.name || 'Component'})`;
  return WithMobile;
};
