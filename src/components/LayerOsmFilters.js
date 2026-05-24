import React from 'react';
import PropTypes from 'prop-types';
import { Collapse, Tag, List, Flex, Space, Typography } from 'antd';
import { HiInformationCircle as IconInfoCircle } from 'react-icons/hi';

const { Text } = Typography;

const codeFont = {
  fontFamily: 'var(--ant-font-family-code)',
  fontSize: 12,
  wordBreak: 'break-all',
};

/** @returns {Array<[string, string]>} Pairs for one OR-branch (see Map.convertFilterToMapboxFilter). */
const getOsmFilterPairs = (branch) => {
  if (!branch || !branch.length) return [];
  if (typeof branch[0] === 'string') {
    return [[branch[0], String(branch[1])]];
  }
  return branch.map((pair) => [pair[0], String(pair[1])]);
};

const OsmFilterBranch = ({ branch, relationLabel }) => {
  const pairs = getOsmFilterPairs(branch);
  if (pairs.length === 0) return null;
  return (
    <List.Item style={{ border: 'none', padding: '4px 0' }}>
      <Flex wrap="wrap" gap={4} align="center" style={{ width: '100%' }}>
        {pairs.map(([k, v], j) => (
          <span key={`${k}-${j}-${v}`} style={{ display: 'inline-flex', alignItems: 'center' }}>
            {j > 0 && (
              <Text type="secondary" style={{ fontSize: 12, marginRight: 4, userSelect: 'none' }}>
                e
              </Text>
            )}
            <Tag
              variant="outlined"
              style={{ maxWidth: '100%', marginInlineEnd: 0 }}
              title={`${k}=${v}`}
            >
              <Space
                size={4}
                wrap
                split={
                  <Text type="secondary" style={{ ...codeFont, flexShrink: 0 }} aria-hidden>
                    =
                  </Text>
                }
              >
                <Text type="secondary" style={codeFont}>
                  {k}
                </Text>
                <Text style={codeFont}>{v}</Text>
              </Space>
            </Tag>
          </span>
        ))}
        {relationLabel && (
          <Text type="secondary" style={{ fontSize: 12, userSelect: 'none' }}>
            {relationLabel}
          </Text>
        )}
      </Flex>
    </List.Item>
  );
};

OsmFilterBranch.propTypes = {
  branch: PropTypes.array,
  relationLabel: PropTypes.string,
};

export default function LayerOsmFilters({ layer, className = '' }) {
  if (!layer?.filters?.length) return null;

  return (
    <div
      className={className}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <Collapse
        bordered={false}
        size="small"
        styles={{
          header: {
            padding: '4px 0',
            minHeight: 'auto',
          },
          body: {
            overflowY: 'auto',
            padding: '4px 8px 8px 8px',
          },
        }}
        items={[
          {
            key: 'osm',
            label: 'Tags OSM',
            children: (
              <Space direction="vertical" size="small" style={{ width: '100%' }}>
                <List
                  size="small"
                  dataSource={layer.filters}
                  rowKey={(_, index) => `osm-f-${layer.id}-${index}`}
                  split={false}
                  renderItem={(branch, index) => (
                    <OsmFilterBranch
                      branch={branch}
                      relationLabel={index < layer.filters.length - 1 ? 'ou' : null}
                    />
                  )}
                  style={{ margin: 0, padding: 0 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  <IconInfoCircle
                    aria-hidden="true"
                    style={{ marginRight: 4, display: 'inline-block' }}
                  />
                  Esta camada é construída a partir de dados colaborativos do OpenStreetMap. As tags
                  acima mostram os critérios que usamos para reconhecer esta categoria no mapa.
                </Text>
              </Space>
            ),
          },
        ]}
      />
    </div>
  );
}

LayerOsmFilters.propTypes = {
  layer: PropTypes.shape({
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    filters: PropTypes.array,
  }).isRequired,
  className: PropTypes.string,
};
