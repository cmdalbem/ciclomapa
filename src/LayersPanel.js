import React, { Component } from 'react';
import { Popover, Collapse, Tag, List, Flex, Space, Typography } from 'antd';

import {
  HiEye as IconVisible,
  HiEyeOff as IconHidden,
  HiInformationCircle as IconInfoCircle,
} from 'react-icons/hi';

import { slugify } from './utils/utils.js';
import InfrastructureBadge from './components/InfrastructureBadge';
import { IconSignal1, IconSignal2, IconSignal3 } from './components/ProtectionSignalIcons';

import './LayersPanel.css';

import { IS_MOBILE } from './config/constants.js';

import commentIcon from './img/icons/poi-comment-flat.png';
import bikeparkingIcon from './img/icons/poi-bikeparking@2x.png';
import bikeshopIcon from './img/icons/poi-bikeshop@2x.png';
import bikerentalIcon from './img/icons/poi-bikerental@2x.png';

const { Text, Title } = Typography;

const getInfrastructureFromLayerName = (layerName) => {
  const name = layerName.toLowerCase();
  if (name.includes('ciclovia')) return 'ciclovia';
  if (name.includes('calçada')) return 'calçada';
  if (name.includes('ciclofaixa')) return 'ciclofaixa';
  if (name.includes('ciclorrota')) return 'ciclorrota';
  return null;
};

/** @returns {Array<[string, string]>} Pairs for one OR-branch (see Map.convertFilterToMapboxFilter). */
const getOsmFilterPairs = (branch) => {
  if (!branch || !branch.length) return [];
  if (typeof branch[0] === 'string') {
    return [[branch[0], String(branch[1])]];
  }
  return branch.map((pair) => [pair[0], String(pair[1])]);
};

const codeFont = {
  fontFamily: 'var(--ant-font-family-code)',
  fontSize: 12,
  wordBreak: 'break-all',
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

const iconsMap = {
  'poi-comment': commentIcon,
  'poi-bikeparking': bikeparkingIcon,
  'poi-bikeshop': bikeshopIcon,
  'poi-rental': bikerentalIcon,
};

class LayersPanel extends Component {
  constructor(props) {
    super(props);

    this.toggleMobileCollapse = this.toggleMobileCollapse.bind(this);

    this.state = {
      hover: false,
      collapsed: IS_MOBILE,
    };
  }

  onChange(id, newVal) {
    this.props.onLayersChange(id, newVal);
  }

  toggleMobileCollapse() {
    this.setState({
      collapsed: !this.state.collapsed,
    });
  }

  render() {
    const { layers, embedMode } = this.props;

    if (!layers || (embedMode && IS_MOBILE)) {
      return null;
    }

    return (
      <>
        {/* {
                    IS_MOBILE &&
                        <div
                            id="layersPanelMobileButton"
                            className={`
                                p-4 border border-white border-opacity-20 rounded-full text-lg fixed
                                ${this.state.collapsed ? 'collapsed' : 'expanded'}`}
                            onClick={this.toggleMobileCollapse}
                            style={{
                                bottom: 30,
                                left: 8,
                            }}
                        >
                            <IconLayers/>
                        </div>
                } */}
        <div
          id="layersPanel"
          className={`
                        fixed text-white p-2 rounded-xl
                        ${IS_MOBILE && 'bg-black rounded-xl border border-white border-opacity-20 shadow-lg divide-y divide-white divide-opacity-10'}
                        ${IS_MOBILE && this.state.collapsed ? 'hidden ' : ''}
                        ${embedMode ? 'pointer-events-none ' : 'cursor-pointer '}
                    `}
          style={{
            bottom: IS_MOBILE ? 100 : 16,
            left: 8,
            zIndex: IS_MOBILE ? 1000 : 1,
          }}
          onMouseEnter={() => this.setState({ hover: true })}
          onMouseLeave={() => this.setState({ hover: false })}
        >
          {layers
            .filter((l) => (embedMode ? l.isActive : true))
            .map((l) => (
              <Popover
                placement="left"
                key={l.name}
                styles={{
                  container: { maxHeight: 'min(85vh, 560px)', overflow: 'auto' },
                  content: { maxWidth: 'min(360px, calc(100vw - 24px))' },
                }}
                content={
                  <div style={{ maxWidth: '100%', boxSizing: 'border-box' }}>
                    <div
                      style={{
                        marginBottom: 12,
                        borderRadius: 8,
                        overflow: 'hidden',
                        background: 'var(--ant-color-fill-tertiary)',
                      }}
                    >
                      <img
                        style={{ display: 'block', width: '100%', height: 'auto' }}
                        alt=""
                        src={'/' + slugify(l.name) + '.jpg'}
                      />
                    </div>

                    <Flex align="center" gap="small" wrap="wrap" style={{ marginBottom: 4 }}>
                      <Title level={4} style={{ margin: 0, fontSize: 22, lineHeight: 1.25 }}>
                        {l.displayName || l.name}
                      </Title>
                      {l.protectionLevel && l.style && (
                        <InfrastructureBadge
                          infrastructure={getInfrastructureFromLayerName(l.name)}
                          isDarkMode={this.props.isDarkMode}
                        >
                          {l.protectionLevel === 'Alta' && <IconSignal3 />}
                          {l.protectionLevel === 'Média' && <IconSignal2 />}
                          {l.protectionLevel === 'Baixa' && <IconSignal1 />}
                          {l.protectionLevel} proteção
                        </InfrastructureBadge>
                      )}
                    </Flex>

                    <Text>{l.description}</Text>

                    {l.filters && l.filters.length > 0 && (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        style={{ marginTop: 12 }}
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
                              label: 'Ver tags OSM',
                              children: (
                                <Space direction="vertical" size="small" style={{ width: '100%' }}>
                                  <List
                                    size="small"
                                    dataSource={l.filters}
                                    rowKey={(_, index) => `osm-f-${l.id}-${index}`}
                                    split={false}
                                    renderItem={(branch, index) => (
                                      <OsmFilterBranch
                                        branch={branch}
                                        relationLabel={index < l.filters.length - 1 ? 'ou' : null}
                                      />
                                    )}
                                    style={{ margin: 0, padding: 0 }}
                                  />
                                  <Text type="secondary" style={{ fontSize: 12 }}>
                                    <IconInfoCircle
                                      aria-hidden="true"
                                      style={{ marginRight: 4, display: 'inline-block' }}
                                    />
                                    Esta camada é construída a partir de dados colaborativos do
                                    OpenStreetMap. As tags acima mostram os critérios que usamos
                                    para reconhecer esta categoria no mapa.
                                  </Text>
                                </Space>
                              ),
                            },
                          ]}
                        />
                      </div>
                    )}
                  </div>
                }
              >
                <div
                  className="flex rounded-md items-center justify-between px-2 py-1 hover:bg-black hover:bg-opacity-70"
                  onClick={this.onChange.bind(this, l.id, !l.isActive)}
                  style={{ opacity: l.isActive ? 1 : 0.5 }}
                >
                  <div className="layer-panel-name flex items-center">
                    <span className="w-6 mr-2 inline-block flex justify-center">
                      {l.type === 'way' ? (
                        <span
                          className="w-full"
                          style={{
                            height: 6,
                            background:
                              l.style.lineStyle === 'solid'
                                ? l.style.lineColor
                                : `repeating-linear-gradient(90deg, ${l.style.lineColor}, ${l.style.lineColor} 3px, transparent 3px, transparent 6px)`,
                            borderColor: l.style.borderColor,
                            borderStyle: l.style.borderStyle,
                            borderWidth: l.style.borderWidth ? 1 : 0,
                            borderRadius: '2px',
                            borderLeft: 'none',
                            borderRight: 'none',
                          }}
                        ></span>
                      ) : (
                        <img className="h-4" src={iconsMap[l.icon]} alt="" />
                      )}
                    </span>

                    <span className={`font-semibold ${embedMode ? 'text-xs' : ''}`}>
                      {l.displayName || l.name}
                    </span>
                  </div>

                  <div className="flex items-center">
                    <div
                      className={`ml-2 transition-opacity duration-300 ${this.state.hover || IS_MOBILE ? 'opacity-100' : 'opacity-0'}`}
                    >
                      {l.isActive ? <IconVisible /> : <IconHidden />}
                    </div>
                  </div>
                </div>
              </Popover>
            ))}
        </div>
      </>
    );
  }
}

export default LayersPanel;
