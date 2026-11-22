import React, { Component, useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { Popover, Button, Select, Checkbox, Dropdown, Switch, Modal, Tooltip } from 'antd';
import { Link } from 'react-router-dom';

import './AnalyticsSidebar.css';
import './components/MapperBox.css';

import {
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  CartesianGrid,
} from 'recharts';

import {
  HiX as IconClose,
  HiInformationCircle as IconInfo,
  HiOutlineRefresh as IconUpdate,
  HiOutlineChevronDown as IconCaret,
  HiDownload as IconDownload,
  HiDotsVertical as IconMore,
  HiOutlineDatabase as IconDatabase,
  HiTable as IconCitiesCompare,
} from 'react-icons/hi';

import { MdAccountBalance as IconOfficial } from 'react-icons/md';

import {
  CITY_SWITCHER_MINI_CHART_LAYER_IDS,
  ENABLE_OFFICIAL_CITY_HALL_METRICS_COMPARISON,
  LENGTH_CALCULATE_STRATEGIES,
  LENGTH_COUNTED_LAYER_IDS,
} from './config/constants.js';
import { PARALLEL_DEDUPE_ENGINES } from './utils/parallelDedupeEngines/engineTypes.js';
import { THIN_SPACE, appendKmUnit } from './utils/routeUtils.js';
import { slugify, timeSince } from './utils/utils.js';
import Storage from './Storage.js';
import { appModal } from './antdModal.js';
import {
  listCitiesWithMetric,
  citySlugFromLocationLabel,
  metricHistoryYears,
} from './AirtableDatabase.js';
import {
  getCanonicalCitySlug,
  getPredefinedCitySlugDefinition,
  getPredefinedCityStaticLocation,
} from './config/citySlugCatalog.js';
import {
  CityInfraMiniRing,
  CityInfraMiniRingPlaceholder,
  miniChartSliceTotalKm,
} from './components/CityInfraMiniRing';

const PIE_CHART_WIDTH_PX = 207;
const nullableNumber = PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])]);

const INFRA_LAYER_IDS = LENGTH_COUNTED_LAYER_IDS;

const DEFAULT_LENGTHS_INCLUDE = () =>
  INFRA_LAYER_IDS.reduce((acc, id) => {
    acc[id] = true;
    return acc;
  }, {});

const STORAGE_KEY_LENGTHS_INCLUDE = 'analyticsViasLengthsInclude';

function formatCitiesMetricValue(value, kind) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '';
  if (kind === 'percent') {
    return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`;
  }
  if (kind === 'index') {
    return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  if (kind === 'km') {
    return appendKmUnit(n.toFixed(1));
  }
  return String(n);
}

function rankingCityCopy(slug, cityName) {
  const areaLabel = getPredefinedCityStaticLocation(slug)?.areaLabel;
  const parts = String(areaLabel || cityName)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  return {
    name: parts[0] || cityName,
    meta: parts[1] || '',
  };
}

/** Same localStorage key as CitySwitcherModal. Ranking peeks cached OSM lengths for the mini ring. */
const CITY_SWITCHER_STATS_KM_CACHE_KEY = 'ciclomapa_city_switcher_stats_km_v3';

function peekCachedLengthsKmByLayer(slug) {
  if (!slug || typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CITY_SWITCHER_STATS_KM_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const row = parsed && typeof parsed === 'object' ? parsed[slug] : null;
    const lengths = row?.lengthsKmByLayer;
    return lengths && typeof lengths === 'object' ? lengths : null;
  } catch {
    return null;
  }
}

function lengthsKmByLayerFromStatsDoc(lengths) {
  if (!lengths || typeof lengths !== 'object') return null;
  const out = {};
  for (const id of LENGTH_COUNTED_LAYER_IDS) {
    const v = Number(lengths[id]);
    if (Number.isFinite(v) && v >= 0) out[id] = v;
  }
  return miniChartSliceTotalKm(out) > 0 ? out : null;
}

function statsDocIdsForRankingSlug(slug) {
  const ids = [];
  const seen = new Set();
  const push = (value) => {
    const id = slugify(String(value || ''));
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };
  const canonical = getCanonicalCitySlug(slug) || slug;
  const def = getPredefinedCitySlugDefinition(canonical);
  push(canonical);
  push(slug);
  push(def?.staticLocation?.areaLabel);
  push(getPredefinedCityStaticLocation(slug)?.areaLabel);
  push(def?.query);
  return ids;
}

async function fetchRankingLengthsBySlug(slugs) {
  const unique = [...new Set((slugs || []).filter(Boolean))];
  if (unique.length === 0) return {};
  const storage = new Storage();
  const out = {};
  let nextIndex = 0;
  const concurrency = Math.min(10, unique.length);

  async function worker() {
    for (;;) {
      const i = nextIndex++;
      if (i >= unique.length) return;
      const slug = unique[i];
      const cached = lengthsKmByLayerFromStatsDoc(peekCachedLengthsKmByLayer(slug));
      if (cached) {
        out[slug] = cached;
        continue;
      }
      for (const docId of statsDocIdsForRankingSlug(slug)) {
        try {
          const doc = await storage.getCityStatsDoc(docId);
          const lengths = lengthsKmByLayerFromStatsDoc(doc?.lengths);
          if (lengths) {
            out[slug] = lengths;
            break;
          }
        } catch {
          // Keep trying the other doc ids for this city.
        }
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return out;
}

function readLengthsIncludeFromStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LENGTHS_INCLUDE);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const next = DEFAULT_LENGTHS_INCLUDE();
    for (const id of INFRA_LAYER_IDS) {
      if (typeof parsed[id] === 'boolean') next[id] = parsed[id];
    }
    return next;
  } catch {
    return null;
  }
}

const layerShape = PropTypes.shape({
  id: PropTypes.string.isRequired,
  name: PropTypes.string.isRequired,
  shortName: PropTypes.string,
  displayName: PropTypes.string,
  type: PropTypes.string,
  style: PropTypes.shape({
    lineStyle: PropTypes.string,
    lineColor: PropTypes.string,
  }),
});

const OpenStreetMapDisclaimer = () => (
  <p className="italic opacity-50">
    Estes números se baseiam no estado atual do mapeamento colaborativo no OpenStreetMap e podem não
    refletir a realidade com precisão.
  </p>
);

const OfficialDisclaimer = () => (
  <p className="italic opacity-50">
    Estes números são dados da prefeitura mas podem não refletir a realidade com precisão.
  </p>
);

function comparableAliancaKm(lengths) {
  return CITY_SWITCHER_MINI_CHART_LAYER_IDS.reduce(
    (sum, id) => sum + (lengths && lengths[id] ? Number(lengths[id]) || 0 : 0),
    0
  );
}

/** OSM ciclovia+ciclofaixa vs Aliança. Green / yellow / red, no in-between hues. */
const OFFICIAL_KM_CLOSE = 0.8;
const OFFICIAL_KM_MID = 0.5;

export function officialKmMatch(oursKm, officialKm) {
  const ours = Number(oursKm);
  const official = Number(officialKm);
  if (!Number.isFinite(ours) || !Number.isFinite(official) || official <= 0 || ours < 0) {
    return null;
  }
  const closeness = Math.min(ours, official) / Math.max(ours, official);
  const grade =
    closeness >= OFFICIAL_KM_CLOSE ? 'close' : closeness >= OFFICIAL_KM_MID ? 'mid' : 'far';
  return { ours, official, grade };
}

const OFFICIAL_KM_GRADE_TEXT = {
  close: { dark: 'text-green-400', light: 'text-green-800' },
  mid: { dark: 'text-amber-400', light: 'text-amber-700' },
  far: { dark: 'text-red-400', light: 'text-red-700' },
};

const RANKING_ROW_CLASS = 'flex items-center gap-3 box-border w-full px-3.5';
const RANKING_VALUE_CLASS =
  'w-20 flex-shrink-0 box-border text-right text-xs leading-tight whitespace-nowrap tabular-nums';

const LENGTH_STRATEGY_OPTION_HINTS = {
  pessimistic: 'Usa sempre o lado mais curto',
  optimistic: 'Usa sempre o lado mais longo',
  average: 'Ignora os lados e divide o comprimento bruto por dois',
  random: 'Pega um lado ao acaso',
};

const PARALLEL_DEDUPE_OPTION_HINTS = {
  geometry_first: 'Pareia pelo traçado (distância e direção)',
  topology_first: 'Pareia pelas pontas / nós da via',
  hybrid_tag_geometry: 'Mistura tags OSM com a geometria',
  corridor_merge: 'Agrupa trechos que correm juntos no mesmo corredor',
};

const MapperSelectField = ({ label, infoLabel, hint, children }) => (
  <div className="cm-mapper-box__field">
    <div className="cm-mapper-box__field-head">
      <span className="cm-mapper-box__field-label">{label}</span>
      <Tooltip
        placement="left"
        trigger={['hover', 'click']}
        align={{ offset: [-10, 0] }}
        classNames={{ root: 'cm-mapper-box-tip' }}
        mouseEnterDelay={0.15}
        title={<div className="cm-mapper-box-tip__body">{hint}</div>}
      >
        <button type="button" className="cm-mapper-box__field-info" aria-label={infoLabel}>
          <IconInfo />
        </button>
      </Tooltip>
    </div>
    {children}
  </div>
);

MapperSelectField.propTypes = {
  label: PropTypes.string.isRequired,
  infoLabel: PropTypes.string.isRequired,
  hint: PropTypes.node.isRequired,
  children: PropTypes.node.isRequired,
};

const ANALYTICS_SKEL_SIZE = {
  lg: 'w-[5.5rem] h-7 mt-1',
  md: 'w-10 h-3 flex-shrink-0',
  bar: 'block w-full h-1 mt-1',
};

const AnalyticsSkeleton = ({ variant = 'md', isDarkMode }) => (
  <span
    data-testid={`analytics-skel-${variant}`}
    className={[
      'inline-block rounded-full animate-pulse-2x',
      ANALYTICS_SKEL_SIZE[variant],
      isDarkMode ? 'bg-white bg-opacity-20' : 'bg-black bg-opacity-10',
    ].join(' ')}
    aria-hidden
  />
);

AnalyticsSkeleton.propTypes = {
  variant: PropTypes.oneOf(['lg', 'md', 'bar']),
  isDarkMode: PropTypes.bool,
};

class AnalyticsSidebar extends Component {
  constructor(props) {
    super(props);

    this.state = {
      lengthsInclude: readLengthsIncludeFromStorage() || DEFAULT_LENGTHS_INCLUDE(),
      citiesRanking: null,
    };
  }

  openCitiesRanking(spec) {
    this.setState({ citiesRanking: spec });
  }

  closeCitiesRanking() {
    this.setState({ citiesRanking: null });
  }

  generatePatterns(layers) {
    return layers
      .filter((l) => l.style && l.style.lineStyle === 'dashed')
      .map((l) => (
        <pattern
          key={`pattern-${l.id}`}
          id={`pattern-${l.id}`}
          width="4"
          height="4"
          patternUnits="userSpaceOnUse"
        >
          <circle cx="2" cy="2" r="1.5" fill={l.style.lineColor} />
        </pattern>
      ));
  }

  toggleLengthsInclude(layerId) {
    this.setState((prev) => {
      const next = { ...prev.lengthsInclude, [layerId]: !prev.lengthsInclude[layerId] };
      if (!INFRA_LAYER_IDS.some((id) => next[id])) {
        return null;
      }
      try {
        localStorage.setItem(STORAGE_KEY_LENGTHS_INCLUDE, JSON.stringify(next));
      } catch {
        /* ignore quota / private mode */
      }
      return { lengthsInclude: next };
    });
  }

  confirmForceUpdate() {
    appModal.confirm({
      title: 'Sincronizar dados?',
      content:
        'Vamos sincronizar esta cidade com os dados mais recentes do OpenStreetMap. Dependendo do tamanho isso pode levar alguns minutos.',
      okText: 'Sincronizar',
      cancelText: 'Cancelar',
      onOk: () => {
        this.props.forceUpdate?.();
      },
    });
  }

  getInfraLayersSorted() {
    const { layers } = this.props;
    if (!layers) return [];
    const layersById = layers.reduce((acc, layer) => {
      acc[layer.id] = layer;
      return acc;
    }, {});

    return INFRA_LAYER_IDS.map((id) => layersById[id]).filter(Boolean);
  }

  getViasMetrics() {
    const { lengths, isDarkMode } = this.props;
    const { lengthsInclude } = this.state;
    const infraLayers = this.getInfraLayersSorted();

    const rawTotal = INFRA_LAYER_IDS.reduce(
      (sum, id) => sum + (lengths && lengths[id] ? lengths[id] : 0),
      0
    );

    const effectiveTotal = INFRA_LAYER_IDS.reduce((sum, id) => {
      if (!lengthsInclude[id]) return sum;
      return sum + (lengths && lengths[id] ? lengths[id] : 0);
    }, 0);

    const chartsData =
      lengths &&
      infraLayers
        .filter((l) => lengthsInclude[l.id] && Math.floor(lengths[l.id]) > 0)
        .map((l) => ({
          value: lengths[l.id],
          fill: l.style.lineStyle === 'solid' ? l.style.lineColor : `url(#pattern-${l.id})`,
        }));

    const placeholderFill = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const pieSlices =
      chartsData && chartsData.length > 0 && effectiveTotal > 0
        ? chartsData
        : [{ value: 1, fill: placeholderFill }];

    const hasPieBreakdown = Boolean(chartsData && chartsData.length > 0 && effectiveTotal > 0);

    return { infraLayers, rawTotal, effectiveTotal, pieSlices, hasPieBreakdown };
  }

  render() {
    const { lengths, layers, isDarkMode, cityMetadataRecords } = this.props;
    const pnbCities = listCitiesWithMetric(cityMetadataRecords, 'pnb_total', {
      yearPrefix: 'pnb_',
    });
    const idecicloCities = listCitiesWithMetric(cityMetadataRecords, 'ideciclo');
    const officialCities = listCitiesWithMetric(cityMetadataRecords, 'alianca_2026', {
      yearPrefix: 'alianca_',
    });
    const currentCitySlug = citySlugFromLocationLabel(this.props.location);
    const pnbEvolutionData = [2018, 2019, 2020, 2021, 2022, 2023, 2024]
      .map((year) => {
        const value = this.props.cityMetadata && this.props.cityMetadata[`pnb_${year}`];
        return value !== undefined && value !== null
          ? { year: String(year), value: Number(value) }
          : null;
      })
      .filter((item) => item !== null && !Number.isNaN(item.value));

    /** Recharts Tooltip defaults are light-themed only; no native dark mode. */
    const pnbLineChartTooltipProps = isDarkMode
      ? {
          contentStyle: {
            backgroundColor: '#262626',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: 6,
          },
          labelStyle: { color: 'rgba(255, 255, 255, 0.65)' },
          itemStyle: { color: 'rgba(255, 255, 255, 0.9)' },
        }
      : {};

    if (!layers) {
      return;
    }

    const vias = this.getViasMetrics();
    const hasLengthTotals = Boolean(lengths && Object.keys(lengths).length > 0);
    const showLengthsSkeleton = Boolean(this.props.loading) && !hasLengthTotals;
    const poiLayers = layers.filter((l) => l.type === 'poi' && l.name !== 'Comentários');
    const cityNameParts = (this.props.location || '').split(',')[0].trim().split(/\s+/);
    const cityNameLast = cityNameParts.pop();
    const cityNameLead = cityNameParts.join(' ');
    const sourceMenuItems = [
      this.props.forceUpdate &&
        this.props.lastUpdate &&
        !this.props.loading && {
          key: 'refresh',
          icon: <IconUpdate className="mt-0.5 self-start" />,
          label: (
            <div className="max-w-[220px] py-0.5 leading-snug">
              <div>Sincronizar</div>
              <div className="mt-0.5 text-xs font-normal opacity-60 whitespace-normal">
                Traz as atualizações do OpenStreetMap para esta cidade.
              </div>
            </div>
          ),
        },
      this.props.downloadData && {
        key: 'download',
        icon: <IconDownload className="mt-0.5 self-start" />,
        label: (
          <div className="max-w-[220px] py-0.5 leading-snug">
            <div>Baixar GeoJSON</div>
            <div className="mt-0.5 text-xs font-normal opacity-60 whitespace-normal">
              Dados da infraestrutura cicloviária desta cidade para uso em seus próprios projetos e
              análises.
            </div>
          </div>
        ),
      },
    ].filter(Boolean);

    const translateStrategy = {
      random: 'Aleatório',
      optimistic: 'Otimista',
      pessimistic: 'Pessimista',
      average: 'Média',
    };
    const translateParallelDedupeEngine = {
      hybrid_tag_geometry: 'Híbrido',
      geometry_first: 'Geometria-first',
      topology_first: 'Topologia-first',
      corridor_merge: 'Corredor',
    };
    const strategiesDropdown = (
      <MapperSelectField
        label="Extensão"
        infoLabel="Sobre o cálculo da extensão"
        hint={
          <>
            <p>Quando a via tem estrutura dos dois lados, escolhe o que entra no total.</p>
            <ul>
              <li>
                <strong>Pessimista:</strong> lado mais curto
              </li>
              <li>
                <strong>Otimista:</strong> lado mais longo
              </li>
              <li>
                <strong>Média:</strong> metade do comprimento bruto
              </li>
              <li>
                <strong>Aleatório:</strong> um lado ao acaso
              </li>
            </ul>
          </>
        }
      >
        <Select
          size="small"
          className="w-full"
          value={this.props.lengthCalculationStrategy}
          onChange={this.props.onChangeStrategy}
          options={LENGTH_CALCULATE_STRATEGIES.map((s) => ({
            value: s,
            label: translateStrategy[s],
            title: LENGTH_STRATEGY_OPTION_HINTS[s],
          }))}
          aria-label="Estratégia de cálculo de extensão"
        />
      </MapperSelectField>
    );

    const parallelDedupeEnginesDropdown = (
      <MapperSelectField
        label="Pareamento"
        infoLabel="Sobre o pareamento de vias"
        hint={
          <>
            <p>Como achar as duas geometrias da mesma via, pra não contar o km duas vezes.</p>
            <ul>
              <li>
                <strong>Geometria-first:</strong> compara o traçado
              </li>
              <li>
                <strong>Topologia-first:</strong> compara as pontas / nós
              </li>
              <li>
                <strong>Híbrido:</strong> tags OSM + geometria
              </li>
              <li>
                <strong>Corredor:</strong> agrupa trechos que correm juntos
              </li>
            </ul>
          </>
        }
      >
        <Select
          size="small"
          className="w-full"
          value={this.props.parallelDedupeEngine}
          onChange={this.props.onChangeParallelDedupeEngine}
          options={PARALLEL_DEDUPE_ENGINES.map((engineId) => ({
            value: engineId,
            label: translateParallelDedupeEngine[engineId] || engineId,
            title: PARALLEL_DEDUPE_OPTION_HINTS[engineId],
          }))}
          aria-label="Motor de detecção de vias paralelas"
        />
      </MapperSelectField>
    );

    return (
      <div
        id="analyticsSidebar"
        className={`analytics-sidebar relative w-64 border-l border-opacity-10 border-white h-screen overflow-y-auto glass-bg flex flex-col ${
          this.props.open ? 'analytics-sidebar--open' : 'analytics-sidebar--closed'
        }`}
      >
        <div className="px-5 pb-5 flex-1" aria-busy={showLengthsSkeleton || undefined}>
          <div className="flex w-full justify-between items-center pt-2 mt-1">
            <div className="flex items-center">
              <h2 className="my-0">Métricas</h2>
            </div>

            <div className="flex items-center -mr-2">
              <Button
                type="text"
                shape="circle"
                className="text-xl text-inherit"
                icon={<IconClose />}
                onClick={() => this.props.toggle(false)}
                aria-label="Fechar painel de métricas"
              />
            </div>
          </div>

          {this.props.location && (
            <button
              type="button"
              className="mt-3 mb-2 text-left bg-transparent border-0 p-0 cursor-pointer text-inherit hover:opacity-80 transition-opacity duration-200"
              onClick={this.props.openCityPicker}
              aria-label={`Trocar cidade. Cidade atual: ${this.props.location}`}
            >
              <div className="text-3xl leading-snug uppercase font-heading-display">
                {cityNameLead ? `${cityNameLead} ` : ''}
                <span className="whitespace-nowrap">
                  {cityNameLast}
                  <IconCaret
                    className="inline-block opacity-60 ml-[0.15em] align-[-0.08em]"
                    size="0.55em"
                    aria-hidden
                  />
                </span>
              </div>
              <div className="mt-2 text-lg tracking-tight opacity-50 leading-tight">
                {this.props.location.split(',')[1] && `${this.props.location.split(',')[1]}`}
              </div>
            </button>
          )}

          {(this.props.debugMode || this.props.mapperMode) &&
            this.props.onFollowViewportCityChange && (
              <div className="cm-mapper-box mt-4 mb-1" data-mapper-box data-mapper-follow>
                <div className="cm-mapper-box__label">Modo mapeador</div>
                <div className="flex items-center gap-2">
                  <Switch
                    size="small"
                    checked={!!this.props.followViewportCity}
                    onChange={this.props.onFollowViewportCityChange}
                    title="Troca as métricas quando o mapa vai para outro município"
                    aria-label="Mudar de cidade automaticamente com o mapa"
                  />
                  <span
                    className="text-xs font-normal opacity-60 leading-snug cursor-pointer"
                    onClick={() =>
                      this.props.onFollowViewportCityChange(!this.props.followViewportCity)
                    }
                  >
                    Mudar de cidade automaticamente com o mapa
                  </span>
                </div>
              </div>
            )}

          {this.props.cityMetadata && this.props.cityMetadata.pnb_total !== undefined && (
            <Section
              title="PNB"
              link={'https://itdpbrasil.org/pnb/'}
              year={this.props.cityMetadata.pnb_year}
              onCompare={
                pnbCities.length >= 2
                  ? () =>
                      this.openCitiesRanking({
                        title: 'PNB',
                        valueLabel: 'PNB',
                        valueKind: 'percent',
                        rows: pnbCities,
                        years: metricHistoryYears(pnbCities),
                      })
                  : undefined
              }
              description={
                <>
                  <p>
                    O People Near Bike (pessoas próximas a bicicleta) é apurado anualmente pelo ITDP
                    Brasil para avaliar as políticas de ciclomobilidade com maior efetividade e
                    indica o percentual de pessoas que moram a até 300 metros de ciclovias e
                    ciclofaixas.
                  </p>
                </>
              }
            >
              <BigNum>{this.props.cityMetadata.pnb_total + '%'}</BigNum>

              {this.props.cityMetadata.pnb_black_women !== undefined && (
                <DataLine
                  name="Mulheres negras"
                  length={this.props.cityMetadata.pnb_black_women}
                  unit="%"
                />
              )}
              {this.props.cityMetadata.pnb_women_less_one_salary !== undefined && (
                <DataLine
                  name="Mulheres renda até 1 SM"
                  length={this.props.cityMetadata.pnb_women_less_one_salary}
                  unit="%"
                />
              )}
              {/* {
                                this.props.cityMetadata.pnb_2024!==undefined &&
                                <DataLine
                                    name="2024"
                                    length={this.props.cityMetadata.pnb_2024}
                                    unit="%"
                                />
                            }
                            {
                                this.props.cityMetadata.pnb_2023!==undefined &&
                                <DataLine
                                    name="2023"
                                    length={this.props.cityMetadata.pnb_2023}
                                    unit="%"
                                />
                            }
                            {
                                this.props.cityMetadata.pnb_2022!==undefined &&
                                <DataLine
                                    name="2022"
                                    length={this.props.cityMetadata.pnb_2022}
                                    unit="%"
                                />
                            }
                            {
                                this.props.cityMetadata.pnb_2021!==undefined &&
                                <DataLine
                                    name="2021"
                                    length={this.props.cityMetadata.pnb_2021}
                                    unit="%"
                                />
                            }
                            {
                                this.props.cityMetadata.pnb_2020!==undefined &&
                                <DataLine
                                    name="2020"
                                    length={this.props.cityMetadata.pnb_2020}
                                    unit="%"
                                />
                            }
                            {
                                this.props.cityMetadata.pnb_2019!==undefined &&
                                <DataLine
                                    name="2019"
                                    length={this.props.cityMetadata.pnb_2019}
                                    unit="%"
                                />
                            }
                            {
                                this.props.cityMetadata.pnb_2018!==undefined &&
                                <DataLine
                                    name="2018"
                                    length={this.props.cityMetadata.pnb_2018}
                                    unit="%"
                                />
                            } */}

              {pnbEvolutionData.length >= 2 && (
                <div>
                  <div className="w-full mt-3" style={{ height: 124, marginBottom: -24 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={pnbEvolutionData}
                        margin={{
                          right: 12,
                          left: 12,
                          top: 1,
                        }}
                      >
                        <XAxis
                          dataKey="year"
                          tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 10 }}
                          ticks={['2018', '2020', '2022', '2024']}
                          interval={'preserveStartEnd'}
                          margin={{ left: 8, right: 8 }}
                          axisLine={false}
                          tickLine={false}
                        />
                        <YAxis
                          // domain={['dataMin', 'dataMax']}
                          domain={[0, 50]}
                          ticks={[15, 30, 50]}
                          interval={'preserveEnd'}
                          tick={{ fill: 'currentColor', opacity: 0.5, fontSize: 10 }}
                          axisLine={false}
                          tickLine={false}
                          mirror={true}
                        />
                        <CartesianGrid
                          stroke="currentColor"
                          strokeOpacity={0.2}
                          strokeWidth={0.5}
                        />
                        <RechartsTooltip {...pnbLineChartTooltipProps} />
                        <Line
                          type="monotone"
                          dataKey="value"
                          stroke={isDarkMode ? '#a8c957' : '#386641'}
                          strokeWidth={2}
                          dot={{ r: 1 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}
            </Section>
          )}

          {this.props.cityMetadata && this.props.cityMetadata.ideciclo !== undefined && (
            <Section
              title="IDECiclo"
              link="https://www.ideciclo.org/"
              year={this.props.cityMetadata.ideciclo_year}
              onCompare={
                idecicloCities.length >= 2
                  ? () =>
                      this.openCitiesRanking({
                        title: 'IDECiclo',
                        valueLabel: 'IDECiclo',
                        valueKind: 'index',
                        rows: idecicloCities,
                        years: metricHistoryYears(idecicloCities),
                      })
                  : undefined
              }
              description={
                <>
                  <p>
                    O Índice de Desenvolvimento Cicloviário (IDECICLO) tem como objetivo avaliar
                    qualitativamente a infraestrutura cicloviária da cidade de forma objetiva e
                    replicável de modo que haja acompanhamento da evolução dos parâmetros para uma
                    comparação entre infraestruturas e entre cidades, de maneira a construir uma
                    séria histórica.
                  </p>
                  <p>
                    O IDECICLO faz uma avaliação local de cada estrutura e pondera esta sob a malha
                    total da cidade e com as velocidades máximas das vias que estão sendo inseridas,
                    podendo ser um índice comparativo entre cidades e entre estruturas.
                  </p>
                  <p>Escala: de 0 a 1.</p>
                </>
              }
            >
              <BigNum>{this.props.cityMetadata.ideciclo}</BigNum>
            </Section>
          )}

          <Section
            title="Vias"
            description={
              <>
                <p>
                  As extensões totais das vias são calculadas automaticamente com base nos dados do
                  OpenStreetMap.
                </p>
                <p>
                  Vias com estrutura dos dois lados são automaticamente detectadas para evitar
                  contagem dupla do total.
                </p>
                <OpenStreetMapDisclaimer />
              </>
            }
          >
            {(this.props.debugMode || this.props.mapperMode) && (
              <div className="cm-mapper-box mb-4" data-mapper-box>
                <div className="cm-mapper-box__label">Modo mapeador</div>
                <div className="flex flex-col gap-2">
                  {strategiesDropdown}
                  {parallelDedupeEnginesDropdown}
                </div>
              </div>
            )}

            <div className={`relative${showLengthsSkeleton ? ' animate-pulse-2x' : ''}`}>
              <PieChart width={PIE_CHART_WIDTH_PX} height={PIE_CHART_WIDTH_PX}>
                <defs>{this.generatePatterns(layers)}</defs>
                <Pie
                  data={vias.pieSlices}
                  dataKey="value"
                  cx={'50%'}
                  cy={'50%'}
                  innerRadius={90}
                  outerRadius={100}
                  paddingAngle={vias.hasPieBreakdown ? 4 : 0}
                  strokeWidth={0}
                  startAngle={90}
                  endAngle={450}
                  cornerRadius="50%"
                />
              </PieChart>

              <div
                className="absolute top-0 w-full flex flex-col items-center justify-center"
                style={{ height: `${PIE_CHART_WIDTH_PX}px`, width: `${PIE_CHART_WIDTH_PX}px` }}
              >
                {showLengthsSkeleton ? (
                  <span className="inline-flex flex-col items-center" aria-hidden>
                    <span className="tracking-wides text-xs opacity-40">TOTAL</span>
                    <AnalyticsSkeleton variant="lg" isDarkMode={this.props.isDarkMode} />
                  </span>
                ) : hasLengthTotals ? (
                  <>
                    <span className="inline-flex flex-col items-center cursor-default">
                      <span className="tracking-wides text-xs">TOTAL</span>
                      <span className="font-regular">
                        <span className="text-4xl tracking-tighter">
                          {vias.effectiveTotal.toFixed(1)}
                        </span>
                        <span className="text-sm">{`${THIN_SPACE}km`}</span>
                      </span>
                    </span>
                    {ENABLE_OFFICIAL_CITY_HALL_METRICS_COMPARISON &&
                      this.props.cityMetadata &&
                      this.props.cityMetadata.alianca_2026 !== undefined &&
                      this.props.cityMetadata.alianca_2026 !== null && (
                        <OfficialKmInfo
                          kmLabel={appendKmUnit(
                            Number(this.props.cityMetadata.alianca_2026).toFixed(1)
                          )}
                          isDarkMode={this.props.isDarkMode}
                          match={officialKmMatch(
                            comparableAliancaKm(lengths),
                            this.props.cityMetadata.alianca_2026
                          )}
                          onCompare={
                            officialCities.length >= 2
                              ? () =>
                                  this.openCitiesRanking({
                                    title: 'Dado oficial da Prefeitura',
                                    valueLabel: 'km',
                                    valueKind: 'km',
                                    rows: officialCities,
                                    years: metricHistoryYears(officialCities),
                                  })
                              : undefined
                          }
                        />
                      )}
                  </>
                ) : (
                  <span className="opacity-50">Sem dados</span>
                )}
              </div>
            </div>

            <div className="mt-2">
              {showLengthsSkeleton
                ? vias.infraLayers.map((l) => (
                    <div key={l.id} className="mb-2" aria-hidden>
                      <div className="flex items-center justify-between px-0 py-0 text-xs font-semibold leading-5">
                        <span>{l.shortName || l.displayName || l.name}</span>
                        <AnalyticsSkeleton variant="md" isDarkMode={this.props.isDarkMode} />
                      </div>
                      <AnalyticsSkeleton variant="bar" isDarkMode={this.props.isDarkMode} />
                    </div>
                  ))
                : vias.infraLayers.map((l) => (
                    <ViaDataRow
                      key={l.id}
                      layer={l}
                      length={lengths && lengths[l.id]}
                      rawTotal={vias.rawTotal}
                      effectiveTotal={vias.effectiveTotal}
                      included={this.state.lengthsInclude[l.id]}
                      onToggleInclude={() => this.toggleLengthsInclude(l.id)}
                    />
                  ))}
            </div>
          </Section>

          <Section title="Pontos de interesse">
            {showLengthsSkeleton
              ? poiLayers.map((l) => (
                  <div
                    key={l.id}
                    className="flex items-center justify-between px-0 py-0 mb-2 text-xs font-semibold leading-5"
                    aria-hidden
                  >
                    <span>{l.name}</span>
                    <AnalyticsSkeleton variant="md" isDarkMode={this.props.isDarkMode} />
                  </div>
                ))
              : poiLayers.map(
                  (l) =>
                    lengths &&
                    lengths[l.id] >= 0 && (
                      <DataLine name={l.name} key={l.name} length={lengths[l.id]} />
                    )
                )}
          </Section>
        </div>

        <CitiesRankingModal
          spec={this.state.citiesRanking}
          currentSlug={currentCitySlug}
          currentLengths={lengths}
          infraLayers={this.getInfraLayersSorted()}
          isDarkMode={this.props.isDarkMode}
          onClose={() => this.closeCitiesRanking()}
        />

        {(this.props.loading || this.props.lastUpdate || this.props.downloadData) && (
          <div className="mt-auto">
            <div className="flex items-start gap-2 px-5 py-3">
              <IconDatabase
                className="flex-shrink-0 w-[1.05em] h-[1.05em] mt-0.5 opacity-50"
                aria-hidden
              />
              <p className="flex-1 min-w-0 m-0 text-xs leading-snug opacity-50">
                {this.props.lastUpdate
                  ? `Dados obtidos do OpenStreetMap há ${timeSince(this.props.lastUpdate)}.`
                  : this.props.loading
                    ? 'Carregando dados desta cidade...'
                    : ''}
              </p>
              <div className="flex items-center flex-shrink-0 -my-1.5 -mr-2">
                {this.props.loading && (
                  <Button
                    type="text"
                    size="small"
                    className="!text-inherit opacity-70 hover:opacity-100 !text-xs !h-auto !px-1"
                    onClick={this.props.cancelDataLoad}
                  >
                    Cancelar
                  </Button>
                )}
                {sourceMenuItems.length > 0 && (
                  <Dropdown
                    trigger={['click']}
                    placement="topRight"
                    menu={{
                      items: sourceMenuItems,
                      onClick: ({ key }) => {
                        if (key === 'refresh') this.confirmForceUpdate();
                        if (key === 'download') this.props.downloadData();
                      },
                    }}
                  >
                    <Button
                      type="text"
                      shape="circle"
                      className="!text-inherit opacity-70 hover:opacity-100"
                      icon={<IconMore />}
                      aria-label="Mais opções"
                    />
                  </Dropdown>
                )}
              </div>
            </div>
            {this.props.loading && (
              <div className="loader-container h-1">
                <div className="progress-materializecss">
                  <div className="indeterminate"></div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }
}

AnalyticsSidebar.propTypes = {
  open: PropTypes.bool,
  toggle: PropTypes.func.isRequired,
  location: PropTypes.string,
  cityMetadata: PropTypes.object,
  cityMetadataRecords: PropTypes.array,
  lengths: PropTypes.objectOf(nullableNumber),
  layers: PropTypes.arrayOf(layerShape),
  isDarkMode: PropTypes.bool,
  debugMode: PropTypes.bool,
  mapperMode: PropTypes.bool,
  onChangeStrategy: PropTypes.func,
  lengthCalculationStrategy: PropTypes.string,
  parallelDedupeEngine: PropTypes.string,
  onChangeParallelDedupeEngine: PropTypes.func,
  downloadData: PropTypes.func,
  lastUpdate: PropTypes.oneOfType([PropTypes.instanceOf(Date), PropTypes.string]),
  loading: PropTypes.bool,
  forceUpdate: PropTypes.func,
  cancelDataLoad: PropTypes.func,
  openCityPicker: PropTypes.func,
  followViewportCity: PropTypes.bool,
  onFollowViewportCityChange: PropTypes.func,
};

const BigNum = ({ children }) => (
  <div className="text-3xl font-regular tracking-tighter -mt-2 mb-1">{children}</div>
);

BigNum.propTypes = {
  children: PropTypes.node,
};

const DataLineWithBarChart = (props) => (
  <div className="mb-2">
    <DataLine {...props} />

    {!props.hideBar && (
      <div className="w-full h-1 relative bg-white bg-opacity-10 mt-1 rounded-full">
        {props.percent > 0 && (
          <div
            className="h-1 rounded-full"
            style={{
              transition: 'width 1500ms ease',
              background:
                props.lineStyle === 'solid'
                  ? props.lineColor
                  : `repeating-linear-gradient(90deg, ${props.lineColor}, ${props.lineColor} 4px, transparent 4px, transparent 6px)`,
              width: (props.percent || 0) + '%',
            }}
          ></div>
        )}
      </div>
    )}
  </div>
);

DataLineWithBarChart.propTypes = {
  name: PropTypes.string.isRequired,
  length: nullableNumber,
  percent: PropTypes.number,
  lineStyle: PropTypes.string,
  lineColor: PropTypes.string,
  unit: PropTypes.string,
  hideBar: PropTypes.bool,
};

DataLineWithBarChart.defaultProps = {
  hideBar: false,
};

const ViaDataRow = ({ layer, length, rawTotal, effectiveTotal, included, onToggleInclude }) => {
  const km =
    length !== undefined && length !== null && !Number.isNaN(Number(length)) ? Number(length) : 0;
  const pctOfRaw = rawTotal > 0 ? (km / rawTotal) * 100 : 0;
  const pctOfEffective = included && effectiveTotal > 0 ? (km / effectiveTotal) * 100 : null;
  const showPctOfEffective =
    pctOfEffective !== null && (rawTotal <= 0 || Math.abs(pctOfRaw - pctOfEffective) >= 0.05);

  const popoverContent = (
    <div className="flex flex-col gap-2 leading-normal">
      {/* <div className="font-semibold mb-1"></div> */}
      <h3 className="text-lg">{layer.displayName || layer.name}</h3>
      <div>
        <table className="w-full border-collapse text-xs">
          <tbody>
            <tr>
              <td className="py-1.5 pr-3 opacity-70 align-top">Extensão</td>
              <td className="py-1.5 text-right whitespace-nowrap font-semibold align-top">
                {appendKmUnit(km.toFixed(1))}
              </td>
            </tr>

            {rawTotal > 0 && (
              <tr>
                <td className="py-1 pr-3 opacity-70 align-top">Pct. do mapeamento completo</td>
                <td className="py-1 text-right whitespace-nowrap align-top">
                  {pctOfRaw.toFixed(1)}%
                </td>
              </tr>
            )}

            {showPctOfEffective && (
              <tr>
                <td className="py-1 pr-3 opacity-70 align-top">Pct. do total exibido</td>
                <td className="py-1 text-right whitespace-nowrap align-top">
                  {pctOfEffective.toFixed(1)}%
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div
        className="pt-2 mt-2 border-t border-black border-opacity-10 border-solid"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <Checkbox
          checked={included}
          onChange={() => onToggleInclude()}
          className="select-none m-0 font-normal"
          aria-label={`Incluir ${layer.displayName || layer.name} no total de vias`}
        >
          Incluir no total e no gráfico
        </Checkbox>
      </div>
    </div>
  );

  const barPercent = included && effectiveTotal > 0 ? Math.floor((km * 100) / effectiveTotal) : 0;
  const handleRowToggle = () => onToggleInclude();
  const handleRowKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onToggleInclude();
    }
  };

  return (
    <div className={`analytics-via-row rounded -mx-1 px-1 ${included ? '' : 'opacity-50'}`}>
      <Popover
        content={popoverContent}
        placement="left"
        trigger={['hover', 'focus']}
        mouseEnterDelay={0.2}
        classNames={{ root: 'analytics-via-detail-popover' }}
      >
        <div
          className="analytics-via-row__content cursor-pointer rounded outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-current focus-visible:outline-opacity-40"
          tabIndex={0}
          role="button"
          aria-pressed={included}
          aria-label={`Alternar inclusão de ${layer.displayName || layer.name} no total de vias`}
          onClick={handleRowToggle}
          onKeyDown={handleRowKeyDown}
        >
          <DataLineWithBarChart
            name={layer.shortName || layer.displayName}
            length={length}
            percent={barPercent}
            lineStyle={layer.style.lineStyle}
            lineColor={layer.style.lineColor}
            unit="km"
            hideBar={!included}
          />
        </div>
      </Popover>
    </div>
  );
};

ViaDataRow.propTypes = {
  layer: layerShape.isRequired,
  length: nullableNumber,
  rawTotal: PropTypes.number.isRequired,
  effectiveTotal: PropTypes.number.isRequired,
  included: PropTypes.bool.isRequired,
  onToggleInclude: PropTypes.func.isRequired,
};

const DataLine = (props) => (
  <div className="flex items-center justify-between px-0 py-0 text-xs font-semibold leading-5">
    <span>{props.name}</span>

    <div className="flex items-center gap-2">
      {/* <span className="opacity-50">{props.percent !== undefined && props.percent + '%'}</span> */}
      <span>
        {props.length !== undefined &&
          (props.unit === 'km'
            ? appendKmUnit(String(Math.round(props.length)))
            : `${Math.round(props.length)}${props.unit || ''}`)}
      </span>
    </div>
  </div>
);

DataLine.propTypes = {
  name: PropTypes.string.isRequired,
  length: nullableNumber,
  percent: PropTypes.number,
  unit: PropTypes.string,
};

const MetricInfoActions = ({ compareLabel, onCompare, link }) => {
  if (!onCompare && !link) return null;
  return (
    <div className="flex flex-col gap-2">
      {onCompare && (
        <Button
          type="primary"
          block
          icon={<IconCitiesCompare />}
          onClick={onCompare}
          aria-label={compareLabel}
        >
          Comparar cidades
        </Button>
      )}
      {link && (
        <Button target="_blank" rel="noopener noreferrer" href={link} block>
          Saiba mais
        </Button>
      )}
    </div>
  );
};

MetricInfoActions.propTypes = {
  compareLabel: PropTypes.string,
  onCompare: PropTypes.func,
  link: PropTypes.string,
};

const OfficialKmInfo = ({ kmLabel, onCompare, match, isDarkMode }) => {
  const [infoOpen, setInfoOpen] = React.useState(false);
  const osmSharePct =
    match && match.official > 0 ? Math.round((match.ours / match.official) * 100) : null;
  const gradeClass =
    OFFICIAL_KM_GRADE_TEXT[match?.grade]?.[isDarkMode ? 'dark' : 'light'] || 'text-inherit';
  return (
    <Popover
      placement="left"
      arrow={{ pointAtCenter: true }}
      trigger={['hover', 'click']}
      mouseEnterDelay={0.1}
      mouseLeaveDelay={0.3}
      open={infoOpen}
      onOpenChange={setInfoOpen}
      content={
        <div className="flex flex-col gap-3 w-80 leading-normal">
          <h3 className="text-lg flex items-center gap-1">
            <IconOfficial className="inline-block text-xl opacity-70" /> Dado Oficial da Prefeitura
          </h3>
          <p className="m-0">
            Quilometragem total de ciclovias e ciclofaixas divulgada como dado oficial da Prefeitura
            com base no levantamento anual da Aliança Bike. Última atualização: outubro de 2026.
          </p>
          <OfficialDisclaimer />
          <MetricInfoActions
            compareLabel="Comparar dado oficial entre cidades"
            onCompare={
              onCompare
                ? () => {
                    setInfoOpen(false);
                    onCompare();
                  }
                : undefined
            }
            link="https://aliancabike.org.br/dados-do-setor/ciclovias-e-ciclofaixas/"
          />
        </div>
      }
    >
      <button
        type="button"
        data-km-grade={match?.grade || undefined}
        className={`flex items-center gap-0.5 m-0 p-0 border-0 bg-transparent cursor-pointer tracking-tight font-inherit ${gradeClass}`}
        aria-label={
          osmSharePct === null
            ? 'Informações: Dado oficial da Prefeitura'
            : `Informações: Dado oficial da Prefeitura. OSM em ${osmSharePct}% desse valor`
        }
      >
        <IconOfficial className="flex-shrink-0 opacity-90" />
        <span className="flex items-baseline">{kmLabel}</span>
      </button>
    </Popover>
  );
};

OfficialKmInfo.propTypes = {
  kmLabel: PropTypes.string.isRequired,
  onCompare: PropTypes.func,
  isDarkMode: PropTypes.bool,
  match: PropTypes.shape({
    ours: PropTypes.number.isRequired,
    official: PropTypes.number.isRequired,
    grade: PropTypes.oneOf(['close', 'mid', 'far']).isRequired,
  }),
};

const Section = (props) => {
  const [infoOpen, setInfoOpen] = React.useState(false);
  return (
    <div className="mt-7">
      <div className="flex w-full justify-between items-center">
        <h3 className="font-regular m-0 opacity-50">
          {props.title}

          {props.beta && (
            <span
              className="bg-white opacity-75 ml-2 px-1 py-0 rounded-full text-black text-xs"
              style={{ fontSize: 10 }}
            >
              BETA
            </span>
          )}
        </h3>

        <div className="flex items-center -mr-2">
          {props.year && <span className="text-xs leading-none opacity-50">{props.year}</span>}

          {props.description && (
            <Popover
              placement="left"
              arrow={{ pointAtCenter: true }}
              trigger={['hover', 'click']}
              mouseEnterDelay={0.1}
              mouseLeaveDelay={0.3}
              open={infoOpen}
              onOpenChange={setInfoOpen}
              key={props.title}
              content={
                <div className="flex flex-col gap-3 w-80 leading-normal">
                  <h3 className="text-lg">{props.title}</h3>
                  {props.description}
                  <MetricInfoActions
                    compareLabel={`Comparar ${props.title} entre cidades`}
                    onCompare={
                      props.onCompare
                        ? () => {
                            setInfoOpen(false);
                            props.onCompare();
                          }
                        : undefined
                    }
                    link={props.link}
                  />
                </div>
              }
            >
              <Button
                type="text"
                shape="circle"
                className="!text-inherit opacity-50 hover:opacity-100"
                icon={<IconInfo />}
                aria-label={`Informações: ${props.title}`}
              />
            </Popover>
          )}
        </div>
      </div>

      <div className="mt-2">{props.children}</div>
    </div>
  );
};

Section.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.node,
  children: PropTypes.node,
  link: PropTypes.string,
  year: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  beta: PropTypes.bool,
  onCompare: PropTypes.func,
};

const CitiesRankingModal = ({
  spec,
  currentSlug,
  currentLengths,
  infraLayers,
  isDarkMode,
  onClose,
}) => {
  const open = Boolean(spec);
  const rows = spec?.rows || [];
  const title = spec?.title || '';
  const years = Array.isArray(spec?.years) ? spec.years : [];
  const showHistory = years.length >= 2;
  const latestYear = showHistory ? years[years.length - 1] : null;
  const yearCols = showHistory
    ? [...years, spec?.valueLabel || title]
    : [spec?.valueLabel || title];
  const showOsmKm = spec?.valueKind === 'km';
  const valueCols = showOsmKm ? [...yearCols, 'OSM'] : yearCols;
  const [lengthsBySlug, setLengthsBySlug] = useState({});

  useEffect(() => {
    if (!open) {
      setLengthsBySlug({});
      return undefined;
    }
    const seed = {};
    for (const row of rows) {
      const cached = lengthsKmByLayerFromStatsDoc(peekCachedLengthsKmByLayer(row.slug));
      if (cached) seed[row.slug] = cached;
    }
    setLengthsBySlug(seed);
    const missing = rows.map((row) => row.slug).filter((slug) => slug && !seed[slug]);
    if (missing.length === 0) return undefined;
    let cancelled = false;
    void fetchRankingLengthsBySlug(missing)
      .then((map) => {
        if (!cancelled) setLengthsBySlug((prev) => ({ ...prev, ...map }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, spec]);

  return (
    <Modal
      title={title}
      open={open}
      onCancel={onClose}
      footer={null}
      centered
      destroyOnHidden
      width={showHistory || showOsmKm ? Math.min(880, 280 + valueCols.length * 76) : 440}
    >
      {open && (
        <div className="overflow-auto -mx-2 flex flex-col gap-2" style={{ maxHeight: '60vh' }}>
          <div
            className={`${RANKING_ROW_CLASS} pt-0 pb-0.5 sticky top-0 z-10 text-xs leading-tight text-current text-opacity-50`}
            style={{ background: 'var(--ant-color-bg-container)' }}
          >
            <span className="min-w-0 flex-1">Cidade</span>
            <div className="flex items-center justify-end">
              {valueCols.map((year) => (
                <span
                  key={year}
                  className={`${RANKING_VALUE_CLASS}${
                    year === latestYear ? ' text-current opacity-100' : ''
                  }`}
                >
                  {year}
                </span>
              ))}
            </div>
          </div>
          <ul className="list-none m-0 p-0 flex flex-col gap-2" aria-label={`${title} por cidade`}>
            {rows.map((row) => {
              const isCurrent = Boolean(currentSlug && row.slug === currentSlug);
              const { name, meta } = rankingCityCopy(row.slug, row.cityName);
              const lengthsKmByLayer =
                isCurrent && currentLengths && typeof currentLengths === 'object'
                  ? currentLengths
                  : lengthsBySlug[row.slug] ||
                    lengthsKmByLayerFromStatsDoc(peekCachedLengthsKmByLayer(row.slug));
              const hasRingData = miniChartSliceTotalKm(lengthsKmByLayer) > 0;
              const osmKm = miniChartSliceTotalKm(lengthsKmByLayer);
              const values = [
                ...(showHistory
                  ? years.map((year) => ({
                      key: year,
                      text:
                        row.history?.[year] == null
                          ? ''
                          : formatCitiesMetricValue(row.history[year], spec.valueKind),
                      latest: false,
                    }))
                  : []),
                {
                  key: 'value',
                  text: formatCitiesMetricValue(row.value, spec.valueKind),
                  latest: true,
                },
              ];
              if (showOsmKm) {
                const match = officialKmMatch(osmKm, row.value);
                values.push({
                  key: 'osm',
                  text: osmKm > 0 ? formatCitiesMetricValue(osmKm, 'km') : '',
                  latest: false,
                  grade: match?.grade,
                });
              }

              return (
                <li key={row.slug}>
                  <Link
                    className={[
                      RANKING_ROW_CLASS,
                      'rounded-2xl no-underline cursor-pointer text-inherit py-3.5',
                      'bg-white bg-opacity-5 hover:bg-opacity-10 hover:text-inherit hover:no-underline',
                      'motion-safe:transition motion-safe:hover:-translate-y-px',
                      isCurrent ? 'bg-opacity-10' : '',
                    ].join(' ')}
                    to={`/${encodeURIComponent(row.slug)}`}
                    aria-label={meta ? `${name}, ${meta}` : name}
                    aria-current={isCurrent ? 'page' : undefined}
                    onClick={onClose}
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-3">
                      {hasRingData ? (
                        <CityInfraMiniRing
                          lengthsKmByLayer={lengthsKmByLayer}
                          infraLayers={infraLayers || []}
                        />
                      ) : (
                        <CityInfraMiniRingPlaceholder />
                      )}
                      <div className="flex-1 min-w-0 flex flex-col items-stretch justify-center gap-1">
                        <div className="text-xs leading-tight min-w-0 overflow-hidden overflow-ellipsis whitespace-nowrap">
                          {name}
                        </div>
                        {meta ? (
                          <div className="text-xs leading-tight opacity-50 min-w-0 overflow-hidden overflow-ellipsis whitespace-nowrap">
                            {meta}
                          </div>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center justify-end">
                      {values.map((cell) => {
                        const gradeClass = cell.grade
                          ? OFFICIAL_KM_GRADE_TEXT[cell.grade]?.[isDarkMode ? 'dark' : 'light']
                          : '';
                        return (
                          <span
                            key={cell.key}
                            data-km-grade={cell.grade || undefined}
                            className={[
                              RANKING_VALUE_CLASS,
                              cell.latest || cell.grade ? 'opacity-100 font-medium' : 'opacity-50',
                              gradeClass || (cell.latest ? 'text-current' : ''),
                            ]
                              .filter(Boolean)
                              .join(' ')}
                          >
                            {cell.text}
                          </span>
                        );
                      })}
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Modal>
  );
};

CitiesRankingModal.propTypes = {
  spec: PropTypes.shape({
    title: PropTypes.string.isRequired,
    valueLabel: PropTypes.string,
    valueKind: PropTypes.oneOf(['percent', 'index', 'km']).isRequired,
    years: PropTypes.arrayOf(PropTypes.number),
    rows: PropTypes.arrayOf(
      PropTypes.shape({
        cityName: PropTypes.string.isRequired,
        slug: PropTypes.string.isRequired,
        value: PropTypes.number.isRequired,
        history: PropTypes.object,
      })
    ).isRequired,
  }),
  currentSlug: PropTypes.string,
  currentLengths: PropTypes.object,
  infraLayers: PropTypes.array,
  isDarkMode: PropTypes.bool,
  onClose: PropTypes.func.isRequired,
};

export default AnalyticsSidebar;
