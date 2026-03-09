import React, { Component } from 'react';
import { Popover, Button } from 'antd';

import './AnalyticsSidebar.css';

import {
  PieChart,
  Pie,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
  CartesianGrid,
} from 'recharts';

import {
  HiX as IconClose,
  HiInformationCircle as IconInfo,
  HiDownload as IconDownload,
} from 'react-icons/hi';

import AirtableDatabase from './AirtableDatabase.js';
import { removeAccents } from './utils/utils.js';

import { LENGTH_CALCULATE_STRATEGIES } from './config/constants.js';

const PIE_CHART_WIDTH_PX = 207;

class AnalyticsSidebar extends Component {
  constructor(props) {
    super(props);

    this.airtableDatabase = new AirtableDatabase();

    this.state = {
      open: this.props.open,
    };
  }

  componentDidMount() {
    this.loadMetadata();
    this.updateData();
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

  updateData() {
    const { lengths, layers } = this.props;

    if (lengths && layers) {
      this.setState({
        totalLength:
          lengths['ciclovia'] +
          lengths['ciclofaixa'] +
          lengths['ciclorrota'] +
          lengths['calcada-compartilhada'],
        chartsData: layers
          .filter(
            (l) =>
              l.id === 'ciclovia' ||
              l.id === 'ciclofaixa' ||
              l.id === 'ciclorrota' ||
              l.id === 'calcada-compartilhada'
          )
          .filter((l) => lengths && Math.floor(lengths[l.id]) > 0)
          .sort((a, b) => {
            const lenA = lengths && lengths[a.id] ? lengths[a.id] : 0;
            const lenB = lengths && lengths[b.id] ? lengths[b.id] : 0;
            return lenB - lenA; // Sort descending by length
          })
          .map(
            (l) =>
              lengths && {
                value: lengths[l.id],
                fill: l.style.lineStyle === 'solid' ? l.style.lineColor : `url(#pattern-${l.id})`,
              }
          ),
      });
    }
  }

  componentDidUpdate(prevProps) {
    if (prevProps.location !== this.props.location) {
      this.updateLocation();
    }

    if (prevProps.layers !== this.props.layers || prevProps.lengths !== this.props.lengths) {
      this.updateData();
    }
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
                        <Tooltip />
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
                <p className="italic opacity-50">
                  Estes números se baseiam no estado atual do mapeamento da infraestrutura da cidade
                  no OpenStreetMap e não são dados oficiais, podendo não refletir a realidade com
                  precisão.
                </p>
              </>
            }
          >
            {this.props.debugMode && strategiesDropdown}

            <div className="relative">
              <PieChart width={PIE_CHART_WIDTH_PX} height={PIE_CHART_WIDTH_PX}>
                <defs>{this.generatePatterns(layers)}</defs>
                <Pie
                  data={
                    this.state.chartsData && this.state.totalLength && this.state.totalLength > 0
                      ? this.state.chartsData
                      : [
                          {
                            value: 1,
                            fill: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
                          },
                        ]
                  }
                  dataKey="value"
                  cx={'50%'}
                  cy={'50%'}
                  innerRadius={90}
                  outerRadius={100}
                  paddingAngle={
                    this.state.chartsData && this.state.totalLength && this.state.totalLength > 0
                      ? 4
                      : 0
                  }
                  strokeWidth={0}
                  startAngle={90}
                  endAngle={-2700}
                />
              </PieChart>

              <div
                className="absolute top-0 w-full flex flex-col items-center justify-center text-xs"
                style={{ height: PIE_CHART_WIDTH_PX + 'px' }}
              >
                {this.state.totalLength && this.state.totalLength >= 0 ? (
                  <>
                    TOTAL
                    <div className="text-4xl font-regular tracking-tighter">
                      {this.state.totalLength.toFixed(1)}
                    </div>
                    km
                  </>
                ) : (
                  <span className="opacity-50">Sem dados</span>
                )}
              </div>
            </div>

            <div className="mt-2">
              {layers
                .filter(
                  (l) =>
                    l.id === 'ciclovia' ||
                    l.id === 'ciclofaixa' ||
                    l.id === 'ciclorrota' ||
                    l.id === 'calcada-compartilhada'
                )
                .sort((a, b) => {
                  const lenA = lengths && lengths[a.id] ? lengths[a.id] : 0;
                  const lenB = lengths && lengths[b.id] ? lengths[b.id] : 0;
                  return lenB - lenA; // Sort descending by length
                })
                .map((l) => (
                  <DataLineWithBarChart
                    name={l.shortName || l.displayName}
                    key={l.name}
                    length={lengths && lengths[l.id]}
                    percent={
                      (lengths && Math.floor((lengths[l.id] * 100) / this.state.totalLength)) || 0
                    }
                    lineStyle={l.style.lineStyle}
                    lineColor={l.style.lineColor}
                    unit="km"
                  />
                ))}
            </div>
          </Section>

          <Section
            title="Pontos de interesse"
            description={
              <>
                <p className="italic opacity-50">
                  Estes números se baseiam no estado atual do mapeamento da infraestrutura da cidade
                  no OpenStreetMap e não são dados oficiais, podendo não refletir a realidade com
                  precisão.
                </p>
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
            <Section
              title="Dados"
              description={
                <>
                  <p>
                    Baixe os dados da infraestrutura cicloviária desta cidade em formato GeoJSON
                    para uso em seus próprios projetos e análises.
                  </p>
                </>
              }
            >
              <Button className="glass-bg" onClick={this.props.downloadData} block>
                <IconDownload className="inline-block mr-1" /> Baixar dados
              </Button>
            </Section>
          )}
        </div>
      </div>
    );
  }
}

const BigNum = ({ children }) => (
  <div className="text-3xl font-regular tracking-tighter -mt-2 mb-1">{children}</div>
);

const DataLineWithBarChart = (props) => (
  <div className="mb-2">
    <DataLine {...props} />

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
  </div>
);

const DataLine = (props) => (
  <div className="flex items-center justify-between px-0 py-0 text-xs font-semibold leading-5">
    <span>{props.name}</span>

    <div className="flex items-center gap-2">
      <span className="opacity-50">{props.percent !== undefined && props.percent + '%'}</span>
      <span>
        {props.length !== undefined && Math.round(props.length)}
        {props.length !== undefined && props.unit}
      </span>
    </div>
  </div>
);

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
                <Button className="glass-bg" target="_BLANK" href={props.link}>
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

export default AnalyticsSidebar;
