import React, { useState } from 'react';
import { Button, Dropdown } from 'antd';
import { HiChevronDown as IconCaretDown } from 'react-icons/hi';

export default function RouteSortDropdown({
  currentKey,
  onChange,
  items,
  label = 'Ordenar por:',
  placement = 'bottomRight',
}) {
  const [open, setOpen] = useState(false);

  const defaultItems = [
    { key: 'score', label: 'Proteção' },
    { key: 'fastest', label: 'Tempo' },
    { key: 'shortest', label: 'Distância' },
  ];

  const effectiveItems = items && items.length ? items : defaultItems;
  const current =
    effectiveItems.find((i) => String(i.key) === String(currentKey)) || effectiveItems[0];

  return (
    <Dropdown
      open={open}
      onOpenChange={setOpen}
      trigger={['click']}
      menu={{
        items: effectiveItems,
        selectedKeys: [String(current.key)],
        onClick: ({ key }) => {
          onChange(key);
          setOpen(false);
        },
      }}
      placement={placement}
    >
      <div className="cm-panel-mini-dd flex items-center md:text-sm text-xs">
        {label ? <span className="opacity-50">{label}</span> : null}
        <Button
          type="text"
          size="small"
          className="opacity-80 hover:opacity-100 md:text-sm text-xs"
        >
          <span className="font-medium">{current.label}</span>
          <IconCaretDown className="inline-block opacity-60" />
        </Button>
      </div>
    </Dropdown>
  );
}
