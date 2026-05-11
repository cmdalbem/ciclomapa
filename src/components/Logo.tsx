import React from 'react';

export interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = '' }) => {
  return <h1 className={`logo-wordmark font-heading-display ${className}`}>CICLOMAPA</h1>;
};

export default Logo;
