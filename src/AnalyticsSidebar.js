import React, { Component } from 'react';
import { Popover } from 'antd';

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

        return (
            <div
                className="background-black border-gray-600 border-l bottom-0 fixed h-screen right-0 top-0 w-60 z-10"
                style={{background: '#211F1C'}}
            >
                <div className="pt-5 px-4">
                    <h2 className="">
                        Estatísticas
                    </h2>

                    <Section
                        title="PNB"
                        description="People near bike"
                    >
                        <BigNum>
                            19%
                        </BigNum>
                    </Section>

                    <Section
                        title="IDECiclo"
                        description="IDECiclo"
                    >
                        <BigNum>
                            0,107
                        </BigNum>
                    </Section>

                    <Section
                        title="Vias"
                        description="Vias"
                    >
                        <BigNum>
                            { totalLength ? Math.round(totalLength) + ' km' : '' }
                        </BigNum>
                        
                        <div className="mt-2">
                            {
                                layers
                                    .filter(l => 
                                        l.id === 'ciclovia' ||
                                        l.id === 'ciclofaixa' ||
                                        l.id === 'ciclorrota' ||
                                        l.id === 'calcada-compartilhada')
                                    .map(l => lengths && lengths[l.id] > 0 && 
                                        <DataLine
                                            name={l.name}
                                            length={lengths[l.id]}
                                            unit="km"
                                        />
                                    )
                            }
                        </div>
                    </Section>

                    <Section
                        title="Pontos de interesse"
                        description="Pontos de interesse"
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
    <div className="text-5xl font-regular tracking-tighter">
        { children }
    </div>

const DataLine = (props) =>
    <div className="flex items-center justify-between px-0 py-0 text-xs font-semibold leading-5">
        <span>
            { props.name } 
        </span>

        <span>
            { Math.round(props.length) }
            { props.unit && ' ' + props.unit }
        </span>
    </div>

const Section = (props) =>
    <div className="mt-7">
        <Popover
            placement="left"
            arrowPointAtCenter={true} key={props.title}
            content={(
                <div style={{width: 300}}>
                    { props.description }
                </div>
            )}
        >
            <div className="flex w-100 justify-between items-center cursor-pointer opacity-50">
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