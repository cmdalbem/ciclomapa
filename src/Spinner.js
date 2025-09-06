import React, { Component } from 'react';
import { Button } from 'antd';

import './Spinner.css'

class Spinner extends Component {
    render() {
        const parts = this.props.area.split(',');
        const city = parts[0];
            // state = parts[1],
            // country = parts[2];

        return (
            <div
                className="loader-container fixed top-0 bottom-0 left-0 right-0 z-10 flex justify-center items-center"
                style={{
                    background: 'rgba(37,32,29,0.9)',
                    color: 'white'
                }}
            >
                <div className="relative max-w-lg p-4 sm:p-0">
                    {
                        this.props.error ?
                            <div>
                                <div style={{fontSize: '42px'}}>
                                    <span role="img" aria-label="Emoji triste">😓</span>
                                </div>

                                <div>
                                    <div className="text-6xl mb-3">
                                        Ops
                                    </div>

                                    <div className="text-lg mb-2">
                                        O OSM está mal humorado neste momento e não conseguimos acessar os dados. Tente novamente mais tarde.
                                    </div>

                                    <Button 
                                        type="primary"
                                        onClick={this.props.onClose}>
                                        OK
                                    </Button>
                                </div>
                            </div>
                            :
                            <div>
                                {/* <svg id="spinnersvg" className="mb-3" viewBox='25 25 50 50'>
                                    <circle className="path" cx='50' cy='50' r='20' fill='none' strokeWidth='4' strokeMiterlimit='10'/>
                                </svg> */}

                                <div className="progress-materializecss">
                                    <div className="indeterminate"></div>
                                </div>

                                <div className="text-4xl leading-tight mb-3">
                                    Carregando mapa cicloviário de <b>{city}</b>
                                </div>

                                <div className="text-base text-gray-200">
                                    Baixando dados atualizados do OpenStreetMap. Dependendo do tamanho da cidade, isso pode levar alguns segundos ou até mais de um minuto.
                                </div>
                            </div>

                    }
                </div>

            </div>
        )
    }
}

export default Spinner;
