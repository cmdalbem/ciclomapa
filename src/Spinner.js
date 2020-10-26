import React, { Component } from 'react';
import { Button, Space } from 'antd';

import './Spinner.css'

class Spinner extends Component {
    render() {
        const parts = this.props.area.split(',');
        const city = parts[0];
            // state = parts[1],
            // country = parts[2];

        return (
            <div id="spinner" className="loader-container">
                <div className="loader">
                    {
                        this.props.error ?
                            <div>
                                <div style={{fontSize: '42px'}}>
                                    <span role="img" aria-label="Emoji triste">😓</span>
                                </div>

                                <div className="content">
                                    <div className="text-6xl">
                                        Ops!
                                    </div>

                                    <Space size="large" direction="vertical">
                                        <div className="text-lg">
                                            O OSM está mal humorado neste momento e não conseguimos acessar os dados. Tente novamente mais tarde.
                                        </div>

                                        <Button 
                                            type="primary"
                                            onClick={this.props.onClose}>
                                            OK
                                        </Button>
                                    </Space>
                                </div>
                            </div>
                            :
                            <div>
                                <svg className="spinnersvg" viewBox='25 25 50 50'>
                                    <circle className="path" cx='50' cy='50' r='20' fill='none' strokeWidth='6' strokeMiterlimit='10'
                                    />
                                </svg>

                                <div className="content">
                                    <div className="text-4xl">
                                        Carregando mapa cicloviário de <b>{city}</b>.
                                    </div>

                                    <div className="text-lg">
                                        Estamos acessando diretamente os dados mais atualizados do OpenStreetMap. Isso pode levar algumas dezenas de segundos, a depender do tamanho da cidade.
                                    </div>
                                </div>
                            </div>

                    }
                </div>

            </div>
        )
    }
}

export default Spinner;
