import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Popover, Button, Select, Checkbox } from 'antd';

import './AnalyticsSidebar.css';

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
  HiDownload as IconDownload,
} from 'react-icons/hi';

import { HiMiniCheckBadge as IconVerified } from 'react-icons/hi2';

import { LENGTH_CALCULATE_STRATEGIES, LENGTH_COUNTED_LAYER_IDS } from './config/constants.js';
import { THIN_SPACE, appendKmUnit } from './utils/routeUtils.js';

const PIE_CHART_WIDTH_PX = 207;
const nullableNumber = PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])]);

const INFRA_LAYER_IDS = LENGTH_COUNTED_LAYER_IDS;

const DEFAULT_LENGTHS_INCLUDE = () =>
  INFRA_LAYER_IDS.reduce((acc, id) => {
    acc[id] = true;
    return acc;
  }, {});

const STORAGE_KEY_LENGTHS_INCLUDE = 'analyticsViasLengthsInclude';

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
    Estes números se baseiam no estado atual do mapeamento colaborativo no OpenStreetMap e não são
    dados oficiais, podendo não refletir a realidade com precisão.
  </p>
);

const OfficialDisclaimer = () => (
  <p className="italic opacity-50">
    Estes números são dados oficiais da prefeitura mas podem não refletir a realidade com precisão.
  </p>
);

class AnalyticsSidebar extends Component {
  constructor(props) {
    super(props);

    this.state = {
      lengthsInclude: readLengthsIncludeFromStorage() || DEFAULT_LENGTHS_INCLUDE(),
    };
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
    const { lengths, layers, isDarkMode } = this.props;
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

    const translateStrategy = {
      random: 'Aleatório',
      optimistic: 'Otimista',
      pessimistic: 'Pessimista',
      average: 'Média',
    };
    const strategiesDropdown = (
      <div className="w-full flex justify-center mb-2">
        <Select
          size="small"
          className="w-full max-w-[200px]"
          value={this.props.lengthCalculationStrategy}
          onChange={this.props.onChangeStrategy}
          options={LENGTH_CALCULATE_STRATEGIES.map((s) => ({
            value: s,
            label: translateStrategy[s],
          }))}
          aria-label="Estratégia de cálculo de extensão"
        />
      </div>
    );

    return (
      <div
        id="analyticsSidebar"
        className={`analytics-sidebar w-64 border-l border-opacity-10 border-white h-screen overflow-y-auto glass-bg ${
          this.props.open ? 'analytics-sidebar--open' : 'analytics-sidebar--closed'
        }`}
      >
        <div className="px-5 pb-10">
          <div className="flex w-full justify-between items-center pt-2 mt-1">
            <div className="flex items-center">
              <h2 className="my-0">Métricas</h2>
            </div>

            <Button
              type="text"
              shape="circle"
              className="text-xl -mr-2 text-inherit"
              icon={<IconClose />}
              onClick={() => this.props.toggle(false)}
              aria-label="Fechar painel de métricas"
            />
          </div>

          {this.props.location && (
            <>
              <div className="mt-3 text-3xl tracking-tighter leading-tight">
                {this.props.location.split(',')[0]}
              </div>
              <div className="mb-2 mt-0 text-xl tracking-tight opacity-50 leading-tight">
                {this.props.location.split(',')[1] && `${this.props.location.split(',')[1]}`}
              </div>
            </>
          )}

          {this.props.cityMetadata && this.props.cityMetadata.pnb_total !== undefined && (
            <Section
              title="PNB"
              link={'https://itdpbrasil.org/pnb/'}
              year={this.props.cityMetadata.pnb_year}
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
                  Para vias que tem estrutura dos dois lados nós desenvolvemos um método que
                  automaticamente detecta estes casos e remove esta contagem dupla do total.
                </p>
                <OpenStreetMapDisclaimer />
              </>
            }
          >
            {this.props.debugMode && strategiesDropdown}

            <div className="relative">
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
                  endAngle={-2700}
                  cornerRadius="50%"
                />
              </PieChart>

              <div
                className="absolute top-0 w-full flex flex-col items-center justify-center"
                style={{ height: `${PIE_CHART_WIDTH_PX}px`, width: `${PIE_CHART_WIDTH_PX}px` }}
              >
                {lengths && vias.rawTotal > 0 ? (
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
                    {this.props.cityMetadata &&
                      this.props.cityMetadata.alianca_2025 !== undefined &&
                      this.props.cityMetadata.alianca_2025 !== null && (
                        <>
                          {/* <span className="tracking-widest mt-2">OFICIAL</span> */}
                          <Popover
                            placement="left"
                            arrow={{ pointAtCenter: true }}
                            content={
                              <div style={{ width: 320 }}>
                                <h3 className="text-lg flex items-center gap-1">
                                  <IconVerified className="inline-block text-green-300 text-xl" />{' '}
                                  Dado Oficial da Prefeitura
                                </h3>
                                <p>
                                  Quilometragem total de ciclovias e ciclofaixas divulgada como dado
                                  oficial da Prefeitura com base no levantamento anual da Aliança
                                  Bike. Última atualização: julho de 2025.
                                </p>
                                <OfficialDisclaimer />
                                <Button
                                  type="primary"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  href="https://aliancabike.org.br/dados-do-setor/ciclovias-e-ciclofaixas/"
                                >
                                  Saiba mais
                                </Button>
                              </div>
                            }
                          >
                            <span className="flex items-center decoration-dotted tracking-tight gap-0.5">
                              <IconVerified className="inline-block opacity-50" />
                              <div className="flex items-center items-baseline opacity-70">
                                {appendKmUnit(
                                  Number(this.props.cityMetadata.alianca_2025).toFixed(1)
                                )}
                              </div>
                              {/* <IconInfo /> */}
                            </span>
                          </Popover>
                        </>
                      )}
                  </>
                ) : (
                  <span className="opacity-50">Sem dados</span>
                )}
              </div>
            </div>

            <div className="mt-2">
              {vias.infraLayers.map((l) => (
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
            {layers
              .filter((l) => l.type === 'poi' && l.name !== 'Comentários')
              .map(
                (l) =>
                  lengths &&
                  lengths[l.id] >= 0 && (
                    <DataLine name={l.name} key={l.name} length={lengths[l.id]} />
                  )
              )}
          </Section>

          {this.props.downloadData && (
            <Section title="Download dados">
              <p className="text-xs opacity-50">
                Baixe os dados da infraestrutura cicloviária desta cidade em formato GeoJSON para
                uso em seus próprios projetos e análises.
              </p>
              <Button onClick={this.props.downloadData} block>
                <IconDownload className="inline-block mr-1" />
                <span className="font-mono text-xs">
                  {this.props.location.split(',')[0]}.geojson
                </span>
              </Button>
            </Section>
          )}
        </div>
      </div>
    );
  }
}

AnalyticsSidebar.propTypes = {
  open: PropTypes.bool,
  toggle: PropTypes.func.isRequired,
  location: PropTypes.string,
  cityMetadata: PropTypes.object,
  lengths: PropTypes.objectOf(nullableNumber),
  layers: PropTypes.arrayOf(layerShape),
  isDarkMode: PropTypes.bool,
  debugMode: PropTypes.bool,
  onChangeStrategy: PropTypes.func,
  lengthCalculationStrategy: PropTypes.string,
  downloadData: PropTypes.func,
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
    <div>
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

const Section = (props) => (
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

      <div className="flex items-center">
        {props.year && <span className="opacity-50 text-xs">{props.year}</span>}

        {props.description && (
          <Popover
            placement="left"
            arrow={{ pointAtCenter: true }}
            key={props.title}
            content={
              <div style={{ width: 320 }}>
                <h3 className="text-lg">{props.title}</h3>

                {props.description}

                {props.link && (
                  <Button type="primary" target="_blank" href={props.link}>
                    Saiba mais
                  </Button>
                )}
              </div>
            }
          >
            <Button
              type="text"
              shape="circle"
              className="opacity-50 hover:opacity-100 -mr-2 text-inherit"
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

Section.propTypes = {
  title: PropTypes.string.isRequired,
  description: PropTypes.node,
  children: PropTypes.node,
  link: PropTypes.string,
  year: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
  beta: PropTypes.bool,
};

export default AnalyticsSidebar;
