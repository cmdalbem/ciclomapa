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
                                    <h1>
                                        Ops!
                                    </h1>

                                    <Space size="large" direction="vertical">
                                        <h3>
                                            O OSM está mal humorado neste momento e não conseguimos acessar os dados. Tente novamente mais tarde.
                                        </h3>

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
                                    <h1>
                                        Carregando mapa cicloviário de <b>{city}</b>.
                                    </h1>

                                    <h3>
                                        Estamos acessando diretamente os dados mais atualizados do OpenStreetMaps. Isso pode levar algumas dezenas segundos dependendo do tamanho da cidade.
                                    </h3>
                                </div>
                            </div>

                    }
                </div>

            </div>
        )
    }
}

export default Spinner;