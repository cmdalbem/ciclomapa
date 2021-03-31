import React, { Component } from 'react';
import { Popover, Button } from 'antd';

import { PieChart, Pie } from 'recharts';

import { 
    HiX as IconClose,
    HiInformationCircle as IconInfo
} from "react-icons/hi";

import {
    MdDataUsage as IconAnalytics,
} from "react-icons/md";

import { removeAccents } from './utils.js';
import AirtableDatabase from './AirtableDatabase.js'

import {
    LENGTH_CALCULATE_STRATEGIES
} from "./constants.js"

const PIE_CHART_WIDTH_PX = 207;

class AnalyticsSidebar extends Component {
    constructor(props) {
        super(props);

        this.airtableDatabase = new AirtableDatabase();

        this.state = {
            open: this.props.open
        }
    }

    componentDidMount() {
        this.loadMetadata();
        this.updateData();
    }

    async loadMetadata() {
        this.setState({
            allMetadata: await this.airtableDatabase.getMetadata()
        });

        this.updateLocation();
    }

    updateLocation() {
        let search;
        if (this.state.allMetadata && this.state.allMetadata.length > 0) {
            search = this.state.allMetadata.find(
                v => this.props.location
                    .toLowerCase()
                    .removeAccents()
                    .includes(
                        v.fields.location
                            .toLowerCase()
                            .removeAccents()
                    )
            );
            this.setState({
                cityMetadata: search && search.fields
            });
        }
    }

    updateData() {
        const { lengths, layers } = this.props;

        if (lengths && layers) {
            this.setState({
                totalLength: lengths['ciclovia']
                    + lengths['ciclofaixa']
                    + lengths['ciclorrota']
                    + lengths['calcada-compartilhada'],
                chartsData: layers
                    .filter(l => 
                        l.id === 'ciclovia' ||
                        l.id === 'ciclofaixa' ||
                        l.id === 'ciclorrota' ||
                        l.id === 'calcada-compartilhada')
                    .map(l => lengths && 
                        {
                            value: lengths[l.id],
                            fill: l.style.lineColor
                        }
                    )
            });
        }
    }

    componentDidUpdate(prevProps) {
        if (prevProps.location !== this.props.location) {
            this.updateLocation();
        }

        if (prevProps.layers !== this.props.layers ||
            prevProps.lengths !== this.props.lengths) {
            this.updateData();
        }
    }

    render() {
        const { lengths, layers } = this.props;
        
        if (!layers) {
            return;
        }

        const translateStrategy = {
            random: 'Aleatório',
            optimistic: 'Otimista',
            pessimistic: 'Pessimista',
            average: 'Média'
        }
        const strategiesDropdown =
            <div className="w-full flex justify-center mb-2">
                <select
                    name="strategy"
                    className="text-green-200 capitalize rounded px-1 bg-white bg-opacity-10"
                    onChange={this.props.onChangeStrategy}
                    defaultValue={this.props.lengthCalculationStrategy}
                >
                    {
                        LENGTH_CALCULATE_STRATEGIES.map(s =>
                            <option value={s}> {translateStrategy[s]} </option>        
                        )
                    }
                </select>
            </div>

        return (
            <div
                id="analyticsSidebar"
                className={`
                    background-black border-l border-opacity-10 border-white h-screen ${this.state.open ? 'w-60 overflow-y-auto flex-none' : ''}
                    transform transition-transform duration-500 ${this.state.open ? '' : 'translate-x-full'}`}
                style={{background: '#211F1C'}}
            >
                <div className="px-4">
                    <div className="flex w-full justify-between items-center pt-2 mt-1">
                        <div className="flex items-center">
                            <IconAnalytics/>

                            <h2 className="my-0 pl-1">
                                Métricas
                            </h2>
                        </div>

                        <div
                            className="text-xl cursor-pointer p-2 -mr-2 hover:bg-white hover:bg-opacity-10 rounded"
                            onClick={() => this.props.toggle(false)}
                            >
                            <IconClose/>
                        </div>
                    </div>

                    {
                        this.state.cityMetadata && this.state.cityMetadata.pnb_total!==undefined &&
                        <Section
                            title="PNB"
                            link={"https://itdpbrasil.org/pnb/"}
                            year={this.state.cityMetadata.pnb_year}
                            description={<>
                                <p>
                                    O People Near Bike (pessoas próximas a bicicleta) é apurado anualmente pelo ITDP Brasil para avaliar as políticas de ciclomobilidade com maior efetividade e indica o percentual de pessoas que moram a até 300 metros de ciclovias e ciclofaixas.
                                </p>
                            </>}
                        >
                            <BigNum>
                                {this.state.cityMetadata.pnb_total + '%'}
                            </BigNum>

                            <DataLine
                                name="Mulheres negras"
                                length={this.state.cityMetadata.pnb_black_women}
                                unit="%"
                            />
                            <DataLine
                                name="Mulheres renda até 1 SM"
                                length={this.state.cityMetadata.pnb_women_less_one_salary}
                                unit="%"
                            />
                        </Section>
                    }

                    {
                        this.state.cityMetadata && this.state.cityMetadata.ideciclo!==undefined &&
                        <Section
                            title="IDECiclo"
                            link="https://plataformadedados.netlify.app/ideciclo/"
                            year={this.state.cityMetadata.ideciclo_year}
                            description={<>
                                <p>
                                    O Índice de Desenvolvimento Cicloviário (IDECICLO) tem como objetivo avaliar qualitativamente a infraestrutura cicloviária da cidade de forma objetiva e replicável de modo que haja acompanhamento da evolução dos parâmetros para uma comparação entre infraestruturas e entre cidades, de maneira a construir uma séria histórica.
                                </p>
                                <p>
                                    O IDECICLO faz uma avaliação local de cada estrutura e pondera esta sob a malha total da cidade e com as velocidades máximas das vias que estão sendo inseridas, podendo ser um índice comparativo entre cidades e entre estruturas.
                                </p>
                                <p>
                                    Escala: de 0 a 1.
                                </p>
                            </>}
                        >
                            <BigNum>
                                { this.state.cityMetadata.ideciclo }
                            </BigNum>
                        </Section>
                    }

                    <Section
                        title="Vias"
                        beta={true}
                        description={<>
                            <p>
                                As extensões totais das vias são calculadas automaticamente com base nos dados do OpenStreetMap. 
                            </p>
                            <p>
                                Para vias que tem estrutura dos dois lados nós desenvolvemos um método que automaticamente detecta estes casos e remove esta contagem dupla do total.
                            </p>
                            <p className="italic opacity-50 text-xs">
                                Estes números podem não corresponder à realidade. Eles não são dados oficiais e dependem do estado atual do mapeamento da infraestrutura da cidade no OpenStreetMap e da precisão do nosso método de detecção automática de contagens duplas.
                            </p>
                        </>}
                    >
                        {
                            this.props.debugMode &&
                            strategiesDropdown
                        }

                        <div className="relative">
                            <PieChart width={PIE_CHART_WIDTH_PX} height={PIE_CHART_WIDTH_PX}>
                                <Pie
                                    data={this.state.chartsData} dataKey="value"
                                    cx={'50%'} cy={'50%'}
                                    innerRadius={90} outerRadius={100}
                                    paddingAngle={4} strokeWidth={0}
                                    startAngle={90} endAngle={-2700}
                                />
                            </PieChart>

                            {
                                this.state.totalLength && this.state.totalLength >= 0 &&
                                <div
                                    className="absolute top-0 w-full flex flex-col items-center justify-center text-xs"
                                    style={{height: PIE_CHART_WIDTH_PX+'px'}}
                                >
                                    TOTAL
                                    <div className="text-4xl font-regular tracking-tighter">
                                        { this.state.totalLength.toFixed(1)}
                                    </div> 
                                    km
                                </div>
                            }
                        </div>
                        
                        <div className="mt-2">
                            {
                                layers
                                    .filter(l => 
                                        l.id === 'ciclovia' ||
                                        l.id === 'ciclofaixa' ||
                                        l.id === 'ciclorrota' ||
                                        l.id === 'calcada-compartilhada')
                                    .map(l => 
                                        <DataLineWithBarChart
                                            name={l.name}
                                            key={l.name}
                                            length={lengths && lengths[l.id]}
                                            percent={lengths && lengths[l.id] * 100 / this.state.totalLength}
                                            color={l.style.lineColor}
                                            unit="km"
                                        />
                                    )
                            }
                        </div>
                    </Section>

                    <Section
                        title="Pontos de interesse"
                        description={<>
                            <p>
                                Contagem total dos pontos de interesse do ciclista de cada um dos tipos com que o CicloMapa trabalha.
                            </p>
                            <p className="italic opacity-50 text-xs">
                                Estes números podem não corresponder à realidade. Eles não são dados oficiais e dependem do estado atual do mapeamento da infraestrutura da cidade no OpenStreetMap.
                            </p>
                        </>}
                    >
                        {
                            layers
                                .filter(l => l.type === 'poi' && l.name !== 'Comentários')
                                .map(l => lengths && lengths[l.id] >= 0 && 
                                    <DataLine
                                        name={l.name}
                                        key={l.name}
                                        length={lengths[l.id]}
                                    />
                                )
                        }
                    </Section>
                </div>

            </div>
        )
    }
}

const BigNum = ({children}) =>
    <div className="text-5xl font-regular tracking-tighter -mt-2 mb-1">
        { children }
    </div>

const DataLineWithBarChart = (props) =>
    <div className="mb-2"> 
        <DataLine {...props}/>

        <div className="w-full h-1 relative bg-white bg-opacity-10 mt-1">
            <div 
                className="h-1"
                style={{ 
                    transition: 'width 1500ms ease',
                    background: props.color,
                    width: (props.percent || 0) + '%'
                }}> 
            </div>
        </div>
    </div>

const DataLine = (props) =>
    <div className="flex items-center justify-between px-0 py-0 text-xs font-semibold leading-5">
        <span>
            { props.name } 
        </span>

        <span>
            { props.length !== undefined && Math.round(props.length) }
            { props.length !== undefined && props.unit && ' ' + props.unit }
        </span>
    </div>

const Section = (props) =>
    <div className="mt-7">
        <div className="flex w-full justify-between items-center">
            <h3 className="font-regular m-0 opacity-50">
                { props.title }

                {
                    props.beta &&
                    <span 
                        className="bg-white opacity-75 ml-2 px-1 py-0 rounded-full text-black text-xs"
                        style={{fontSize: 10}}
                    >
                        BETA
                    </span>
                }
            </h3>

            <div className="flex items-center">
                {
                    props.year &&
                    <span className="opacity-50 text-xs">
                        { props.year }
                    </span>
                }

                <Popover
                    placement="left"
                    arrowPointAtCenter={true} key={props.title}
                    content={(
                        <div style={{width: 320}}>
                            <h3 className="text-lg">
                                { props.title }
                            </h3>
                            
                            { props.description }

                            {
                                props.link &&
                                <Button ghost target="_BLANK" href={props.link}>
                                    Saiba mais
                                </Button> 
                            }
                        </div>
                    )}
                >
                    <div className="opacity-50 hover:opacity-100 p-2 -mr-2 hover:bg-white hover:bg-opacity-10 rounded">
                        <IconInfo/>
                    </div>
                </Popover>
            </div>
        </div>

        <div className="mt-2">
            { props.children }
        </div>
    </div>


export default AnalyticsSidebar;