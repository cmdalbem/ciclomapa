import React from 'react';
import { Button, Dropdown } from 'antd';
import { HiChevronDown as IconCaretDown } from 'react-icons/hi';

export default function RouteSortDropdown({ currentKey, onChange, items }) {
  const defaultItems = [
    { key: 'score', label: 'Proteção' },
    { key: 'fastest', label: 'Tempo' },
    { key: 'shortest', label: 'Distância' },
  ];

  const effectiveItems = items && items.length ? items : defaultItems;
  const current = effectiveItems.find((i) => i.key === currentKey) || effectiveItems[0];

  return (
    <Dropdown
      menu={{
        items: effectiveItems,
        onClick: ({ key }) => onChange(key),
      }}
      placement="bottomRight"
    >
      <div className="flex items-center md:mb-1 mb-0 md:text-sm text-xs">
        <span className="opacity-50">Ordenar por:</span>
        <Button
          type="text"
          size="small"
          className="opacity-80 hover:opacity-100 md:my-1 md:text-sm text-xs"
        >
          <span className="font-medium">{current.label}</span>
          <IconCaretDown className="inline-block text-white opacity-60" />
        </Button>
      </div>
    </Dropdown>
  );
}
