import React, { Component } from 'react';
import { Popover, Button } from 'antd';

import { PieChart, Pie } from 'recharts';

import { removeAccents } from './utils.js';
import AirtableDatabase from './AirtableDatabase.js'

import { 
    MdClose as IconClose,
    MdInfoOutline as IconInfo,
    MdDataUsage as IconAnalytics,
} from "react-icons/md";

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
            if (search) {
                this.setState({cityMetadata: search.fields});
            }
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

        return (
            <div
                className={`
                    background-black border-l border-opacity-10 border-white h-screen ${this.state.open ? 'w-60' : ''}
                    transform transition-transform duration-500 ${this.state.open ? '' : 'translate-x-full'}`}
                style={{background: '#211F1C'}}
            >
                <div className="px-4">
                    <div className="flex w-full justify-between items-center pt-2 mt-1">
                        <div className="flex items-center">
                            <IconAnalytics/>

                            <h2 className="my-0 pl-1">
                                Estatísticas
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
                        this.state.cityMetadata && this.state.cityMetadata.pnb_total &&
                        <Section
                            title="People Near Bike (PNB)"
                            link={"https://itdpbrasil.org/pnb/"}
                            description={<>
                                <p>
                                    Para avaliar as políticas de ciclomobilidade com maior efetividade, o ITDP Brasil apura anualmente um indicador percentual de pessoas que vivem próximas da infraestrutura cicloviária (PNB sigla em inglês para People Near Bike).
                                </p>
                                <p>
                                    A partir da rede cicloviária disponível no CicloMapa, o indicador mostra quantas pessoas moram a menos de 300 metros de uma ciclovia, ciclofaixa, ciclorrota ou calçada compartilhada.
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
                        this.state.cityMetadata && this.state.cityMetadata.ideciclo &&
                        <Section
                            title="IDECiclo"
                            link="https://ideciclo.ameciclo.org/"
                            description={<>
                                <p>
                                    O Índice de Desenvolvimento Cicloviário é uma metodologia para avaliar a malha cicloviária de uma cidade de forma objetiva e replicável, que permite acompanhar a evolução dos parâmetros de qualidade ao longo de uma gestão para uma comparação temporal e intermunicipal. 
                                </p>
                                <p>
                                    O índice, desenvolvido pela Ameciclo, assemelha-se ao Copenhagenize Index, iniciativa do escritório dinamarquês Copenheganize, que tenta avaliar e monitorar ao longo do tempo várias cidades do mundo quanto à promoção do uso da bicicleta nestas cidades.
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
                        <div className="relative">
                            <PieChart width={207} height={207}>
                                <Pie
                                    data={this.state.chartsData} dataKey="value"
                                    cx={'50%'} cy={'50%'}
                                    innerRadius={90} outerRadius={100}
                                    paddingAngle={4} strokeWidth={0}
                                    startAngle={90} endAngle={-2700}
                                />
                            </PieChart>

                            {
                                this.state.totalLength &&
                                <div
                                    className="absolute top-0 w-full flex flex-col items-center justify-center text-xs"
                                    style={{height: '207px'}}
                                >
                                    TOTAL
                                    <div className="text-4xl font-regular tracking-tighter">
                                        { Math.round(this.state.totalLength)}
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
                                .filter(l => l.type === 'poi')
                                .map(l => lengths && lengths[l.id] > 0 && 
                                    <DataLine
                                        name={l.name}
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
            { props.length && Math.round(props.length) }
            { props.unit && ' ' + props.unit }
        </span>
    </div>

const Section = (props) =>
    <div className="mt-7">
        <div className="flex w-full justify-between items-center">
            <h3 className="font-regular m-0 opacity-50">
                { props.title }
            </h3>

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

        <div className="mt-2">
            { props.children }
        </div>
    </div>


export default AnalyticsSidebar;