import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { Popover, Button, Tooltip } from 'antd';

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

import {
  HiMiniCheckBadge as IconVerified,
  HiOutlineCheckBadge as IconVerifiedOutline,
} from 'react-icons/hi2';

import AirtableDatabase from './AirtableDatabase.js';
import { removeAccents } from './utils/utils.js';

import { LENGTH_CALCULATE_STRATEGIES } from './config/constants.js';

const PIE_CHART_WIDTH_PX = 207;
const nullableNumber = PropTypes.oneOfType([PropTypes.number, PropTypes.oneOf([null])]);

const INFRA_LAYER_IDS = ['ciclovia', 'ciclofaixa', 'ciclorrota', 'calcada-compartilhada'];

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

    this.airtableDatabase = new AirtableDatabase();

    this.state = {
      open: this.props.open,
      lengthsInclude: readLengthsIncludeFromStorage() || DEFAULT_LENGTHS_INCLUDE(),
    };
  }

  componentDidMount() {
    this.loadMetadata();
  }

  async loadMetadata() {
    const allMetadata = await this.airtableDatabase.getMetadata();
    this.setState(
      {
        allMetadata: allMetadata,
      },
      () => {
        this.updateLocation();
      }
    );
  }

  updateLocation() {
    let search;
    if (this.state.allMetadata && this.state.allMetadata.length > 0 && this.props.location) {
      search = this.state.allMetadata.find((v) =>
        removeAccents(this.props.location.toLowerCase()).includes(
          removeAccents(v.fields.location.toLowerCase())
        )
      );
      this.setState({
        cityMetadata: search && search.fields,
      });
    }
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

  componentDidUpdate(prevProps) {
    if (prevProps.location !== this.props.location) {
      this.updateLocation();
    }
  }

  getInfraLayersSorted() {
    const { lengths, layers } = this.props;
    if (!layers) return [];
    return layers
      .filter((l) => INFRA_LAYER_IDS.includes(l.id))
      .sort((a, b) => {
        const lenA = lengths && lengths[a.id] ? lengths[a.id] : 0;
        const lenB = lengths && lengths[b.id] ? lengths[b.id] : 0;
        return lenB - lenA;
      });
  }

  getViasMetrics() {
    const { lengths, layers, isDarkMode } = this.props;
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
        const value = this.state.cityMetadata && this.state.cityMetadata[`pnb_${year}`];
        return value !== undefined && value !== null
          ? { year: String(year), value: Number(value) }
          : null;
      })
      .filter((item) => item !== null && !Number.isNaN(item.value));

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
        <select
          name="strategy"
          className="text-green-200 capitalize rounded px-1 bg-white bg-opacity-10"
          onChange={this.props.onChangeStrategy}
          defaultValue={this.props.lengthCalculationStrategy}
        >
          {LENGTH_CALCULATE_STRATEGIES.map((s) => (
            <option value={s}> {translateStrategy[s]} </option>
          ))}
        </select>
      </div>
    );

    return (
      <div
        id="analyticsSidebar"
        className={`
                    border-l border-opacity-10 border-white h-screen ${this.state.open ? 'w-60 overflow-y-auto flex-none' : ''}
                    transform transition-transform duration-500 ${this.state.open ? '' : 'translate-x-full'}`}
      >
        <div className="px-4 pb-10">
          <div className="flex w-full justify-between items-center pt-2 mt-1">
            <div className="flex items-center">
              <h2 className="my-0">Métricas</h2>
            </div>

            <div
              className="text-xl cursor-pointer p-2 -mr-2 hover:bg-white hover:bg-opacity-10 rounded"
              onClick={() => this.props.toggle(false)}
            >
              <IconClose />
            </div>
          </div>

          {this.props.location && (
            <>
              <div className="mt-3 text-3xl tracking-tighter leading-none">
                {this.props.location.split(',')[0]}
              </div>
              <div className="mb-2 mt-0 text-xl tracking-tight opacity-50">
                {this.props.location.split(',')[1] && `${this.props.location.split(',')[1]}`}
              </div>
            </>
          )}

          {this.state.cityMetadata && this.state.cityMetadata.pnb_total !== undefined && (
            <Section
              title="PNB"
              link={'https://itdpbrasil.org/pnb/'}
              year={this.state.cityMetadata.pnb_year}
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
              <BigNum>{this.state.cityMetadata.pnb_total + '%'}</BigNum>

              {this.state.cityMetadata.pnb_black_women !== undefined && (
                <DataLine
                  name="Mulheres negras"
                  length={this.state.cityMetadata.pnb_black_women}
                  unit="%"
                />
              )}
              {this.state.cityMetadata.pnb_women_less_one_salary !== undefined && (
                <DataLine
                  name="Mulheres renda até 1 SM"
                  length={this.state.cityMetadata.pnb_women_less_one_salary}
                  unit="%"
                />
              )}
              {/* {
                                this.state.cityMetadata.pnb_2024!==undefined &&
                                <DataLine
                                    name="2024"
                                    length={this.state.cityMetadata.pnb_2024}
                                    unit="%"
                                />
                            }
                            {
                                this.state.cityMetadata.pnb_2023!==undefined &&
                                <DataLine
                                    name="2023"
                                    length={this.state.cityMetadata.pnb_2023}
                                    unit="%"
                                />
                            }
                            {
                                this.state.cityMetadata.pnb_2022!==undefined &&
                                <DataLine
                                    name="2022"
                                    length={this.state.cityMetadata.pnb_2022}
                                    unit="%"
                                />
                            }
                            {
                                this.state.cityMetadata.pnb_2021!==undefined &&
                                <DataLine
                                    name="2021"
                                    length={this.state.cityMetadata.pnb_2021}
                                    unit="%"
                                />
                            }
                            {
                                this.state.cityMetadata.pnb_2020!==undefined &&
                                <DataLine
                                    name="2020"
                                    length={this.state.cityMetadata.pnb_2020}
                                    unit="%"
                                />
                            }
                            {
                                this.state.cityMetadata.pnb_2019!==undefined &&
                                <DataLine
                                    name="2019"
                                    length={this.state.cityMetadata.pnb_2019}
                                    unit="%"
                                />
                            }
                            {
                                this.state.cityMetadata.pnb_2018!==undefined &&
                                <DataLine
                                    name="2018"
                                    length={this.state.cityMetadata.pnb_2018}
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
                        <RechartsTooltip />
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

          {this.state.cityMetadata && this.state.cityMetadata.ideciclo !== undefined && (
            <Section
              title="IDECiclo"
              link="https://www.ideciclo.org/"
              year={this.state.cityMetadata.ideciclo_year}
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
              <BigNum>{this.state.cityMetadata.ideciclo}</BigNum>
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
                        </span>{' '}
                        <span className="text-sm">km</span>
                      </span>
                    </span>
                    {this.state.cityMetadata &&
                      this.state.cityMetadata.alianca_2025 !== undefined &&
                      this.state.cityMetadata.alianca_2025 !== null && (
                        <>
                          {/* <span className="tracking-widest mt-2">OFICIAL</span> */}
                          <Popover
                            placement="left"
                            arrowPointAtCenter={true}
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
                                {Number(this.state.cityMetadata.alianca_2025).toFixed(1)}km
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

          <Section
            title="Pontos de interesse"
            description={
              <>
                <OpenStreetMapDisclaimer />
              </>
            }
          >
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
              <Button ghost onClick={this.props.downloadData} block>
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
                {km.toFixed(1)} km
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
      <div className="pt-2 mt-2 border-t border-black border-opacity-10 border-solid">
        <label className="flex items-center gap-2 cursor-pointer select-none m-0 font-normal">
          <input
            type="checkbox"
            className="m-0 flex-shrink-0 cursor-pointer"
            checked={included}
            onChange={onToggleInclude}
            aria-label={`Incluir ${layer.displayName || layer.name} no total de vias`}
          />
          <span>Incluir no total e no gráfico</span>
        </label>
      </div>
    </div>
  );

  const barPercent = included && effectiveTotal > 0 ? Math.floor((km * 100) / effectiveTotal) : 0;

  return (
    <div className={`analytics-via-row rounded -mx-1 px-1 ${included ? '' : 'opacity-50'}`}>
      <Popover
        content={popoverContent}
        placement="left"
        trigger={['hover', 'focus']}
        mouseEnterDelay={0.12}
        mouseLeaveDelay={0.4}
        overlayClassName="analytics-via-detail-popover"
      >
        <div
          className="cursor-default rounded outline-none focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-2 focus-visible:outline-current focus-visible:outline-opacity-40"
          tabIndex={0}
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
        {props.length !== undefined && Math.round(props.length)}
        {props.length !== undefined && props.unit}
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

        <Popover
          placement="left"
          arrowPointAtCenter={true}
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
          <div className="opacity-50 hover:opacity-100 p-2 -mr-2 hover:bg-white hover:bg-opacity-10 rounded">
            <IconInfo />
          </div>
        </Popover>
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
