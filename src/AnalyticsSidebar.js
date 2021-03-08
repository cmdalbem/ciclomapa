import React, { Component } from 'react';
import { Popover, Button } from 'antd';

import { PieChart, Pie, Cell } from 'recharts';

import {
    MdInfoOutline as IconInfo,
} from "react-icons/md";

import {
    IS_MOBILE,
} from './constants.js'

class AnalyticsSidebar extends Component {
    constructor(props) {
        super(props);

        this.state = {
        }
    }

    render() {
        const { lengths, layers } = this.props;
        
        if (!layers) {
            return;
        }

        let totalLength;
        if (lengths) {
            totalLength = lengths.ciclovia
                + lengths.ciclofaixa
                + lengths.ciclorrota
                + lengths['calcada-compartilhada'];
        }

        const chartsData = layers
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
            );

        return (
            <div
                className="background-black border-gray-600 border-l h-screen w-60"
                style={{background: '#211F1C'}}
            >
                <div className="pt-5 px-4">
                    <h2 className="font-bold">
                        Estatísticas
                    </h2>

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
                            19%
                        </BigNum>

                        <DataLine
                            name="Mulheres negras"
                            length={15}
                            unit="%"
                        />
                        <DataLine
                            name="Mulheres renda até 1 SM"
                            length={19}
                            unit="%"
                        />
                    </Section>

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
                            0,107
                        </BigNum>
                    </Section>

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
                                    data={chartsData} dataKey="value"
                                    cx={'50%'} cy={'50%'}
                                    innerRadius={90} outerRadius={100}
                                    paddingAngle={4} strokeWidth={0}
                                    startAngle={90} endAngle={-2700}
                                />
                            </PieChart>

                            {
                                totalLength &&
                                <div
                                    className="absolute top-0 w-full flex flex-col items-center justify-center text-xs"
                                    style={{height: '207px'}}
                                >
                                    TOTAL
                                    <div className="text-4xl font-regular tracking-tighter">
                                        { Math.round(totalLength)}
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
                                            percent={lengths && lengths[l.id] * 100 / totalLength}
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
                        <Button ghost size="small" target="_BLANK" href={props.link}>
                            Saiba mais
                        </Button> 
                    }
                </div>
            )}
        >
            <div className="flex w-full justify-between items-center cursor-pointer opacity-50">
                <h3 className="font-regular m-0">
                    { props.title }
                </h3>

                <IconInfo/>
            </div>
        </Popover>

        <div className="mt-2">
            { props.children }
        </div>
    </div>


export default AnalyticsSidebar;