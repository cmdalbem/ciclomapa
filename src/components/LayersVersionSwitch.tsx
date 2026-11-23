import React from 'react';
import { LAYERS_VERSION_LIST } from '../config/layersCatalog';

type LayersVersionSwitchProps = {
  value: string;
  onChange: (id: string) => void;
  className?: string;
};

export default function LayersVersionSwitch({
  value,
  onChange,
  className = '',
}: LayersVersionSwitchProps) {
  return (
    <div
      className={`cm-layers-version flex items-center gap-1 ${className}`}
      role="group"
      aria-label="Versão dos filtros OSM"
      onClick={(e) => e.stopPropagation()}
    >
      <span className="text-[10px] font-semibold uppercase tracking-wide opacity-70">OSM</span>
      <div className="flex overflow-hidden rounded-md border border-white/25">
        {LAYERS_VERSION_LIST.map((version) => {
          const active = value === version.id;
          return (
            <button
              key={version.id}
              type="button"
              aria-pressed={active}
              title={`${version.id}: ${version.description}`}
              className={`px-2 py-0.5 text-[11px] font-semibold leading-4 ${
                active ? 'bg-white text-black' : 'bg-transparent text-current hover:bg-white/15'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                onChange(version.id);
              }}
            >
              {version.id}
            </button>
          );
        })}
      </div>
    </div>
  );
}
