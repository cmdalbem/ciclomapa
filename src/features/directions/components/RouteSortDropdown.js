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
      <Button type="text" className="opacity-80 hover:opacity-100 sm:-ml-3 -mr-3 md:my-1">
        <div className="flex items-center gap-1">
          <span className="opacity-75">Ordenar por:</span>
          <span className="font-medium">{current.label}</span>
          <IconCaretDown className="inline-block text-white opacity-60" />
        </div>
      </Button>
    </Dropdown>
  );
}
