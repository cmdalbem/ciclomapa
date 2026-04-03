import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ConfigProvider, Table, Typography } from 'antd';
import { PLACE_TYPE_ICON_RULES } from '../GooglePlacesGeocoder.js';
import { getPlaceTypeDescription } from './placeTypeIconDescriptions.js';
import { getAntdTheme } from '../config/antdTheme.js';

const GEOCODING_TYPES_DOC =
  'https://developers.google.com/maps/documentation/javascript/geocoding#address-types';
const PLACE_TYPES_DOC =
  'https://developers.google.com/maps/documentation/places/web-service/place-types';

function iconDisplayName(Icon) {
  if (!Icon) return '—';
  return Icon.displayName || Icon.name || 'Component';
}

export default function PlaceTypeIconsReviewPage() {
  const dataSource = useMemo(
    () =>
      PLACE_TYPE_ICON_RULES.map(([type, Icon], i) => ({
        key: type,
        priority: i + 1,
        type,
        Icon,
        description: getPlaceTypeDescription(type),
        iconName: iconDisplayName(Icon),
      })),
    []
  );

  const columns = [
    {
      title: 'Priority',
      dataIndex: 'priority',
      width: 88,
      sorter: (a, b) => a.priority - b.priority,
      defaultSortOrder: 'ascend',
    },
    {
      title: 'Component',
      dataIndex: 'iconName',
      width: 200,
      render: (name) => <Typography.Text type="secondary">{name}</Typography.Text>,
    },
    {
      title: 'Icon',
      key: 'icon',
      width: 72,
      align: 'center',
      render: (_, row) => {
        const IconCmp = row.Icon;
        return IconCmp ? (
          <IconCmp style={{ fontSize: 22, verticalAlign: 'middle', color: '#555' }} />
        ) : (
          '—'
        );
      },
    },
    {
      title: 'Type',
      dataIndex: 'type',
      width: 220,
      render: (t) => <Typography.Text code>{t}</Typography.Text>,
    },
    {
      title: 'Description',
      dataIndex: 'description',
      render: (text) => (
        <Typography.Paragraph style={{ marginBottom: 0 }}>{text}</Typography.Paragraph>
      ),
    },
  ];

  return (
    <ConfigProvider theme={getAntdTheme(false)}>
      <div
        style={{
          // App.less sets overflow:hidden on html/body/#root for the map; scroll here instead.
          height: '100vh',
          maxHeight: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          WebkitOverflowScrolling: 'touch',
          boxSizing: 'border-box',
          padding: 24,
          background: '#f5f5f5',
          fontFamily: "'IBM Plex Sans', sans-serif",
        }}
      >
        <Typography.Title level={2} style={{ marginTop: 0 }}>
          Place type icons (review)
        </Typography.Title>
        <Typography.Paragraph>
          Rows follow <Typography.Text strong>PLACE_TYPE_ICON_RULES</Typography.Text> order (highest
          specificity first). Documentation blurbs for Geocoder types follow the official
          &ldquo;Address types and address component types&rdquo; section; see{' '}
          <Typography.Link href={GEOCODING_TYPES_DOC} target="_blank" rel="noreferrer">
            Geocoding Service · Address types
          </Typography.Link>
          . Place-only categories reference the{' '}
          <Typography.Link href={PLACE_TYPES_DOC} target="_blank" rel="noreferrer">
            Place types
          </Typography.Link>{' '}
          list instead.
        </Typography.Paragraph>
        <Typography.Paragraph>
          <Link to="/">← Back to map</Link>
        </Typography.Paragraph>
        <Table
          size="small"
          pagination={false}
          columns={columns}
          dataSource={dataSource}
          scroll={{ x: true }}
        />
      </div>
    </ConfigProvider>
  );
}
