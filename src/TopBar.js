import React, { Component } from 'react';

import { TOPBAR_HEIGHT } from './constants'

import { Modal, Button, Divider, Popover, Icon } from 'antd';

import { get, set } from 'idb-keyval';

import itdp from './img/itdp.png';
import ucb from './img/ucb.png';

import './TopBar.css'

class TopBar extends Component {
    info() {
        Modal.info({
            title: 'Sobre',
            className: 'about-modal',
            content: (
                <div>
                    <p>
                        A plataforma CicloMapa é uma ferramenta que buscar ampliar a visibilidade das infraestruturas cicloviárias mapeadas no OpenStreetMap e engajar uma comunidade de mapeadores para atualização colaborativa de dados e incidência em políticas públicas de mobilidade urbana.
                    </p>

                    <p>
                        Este é um projeto Open Source, e seu código pode ser encontrado no <a href="https://github.com/cmdalbem/ciclomapa/">GitHub</a>.
                    </p>

                    <div>
                        Apoio:

                        <div className="logos">
                            <a href="http://itdpbrasil.org" target="_BLANK" rel="noopener noreferrer">
                                <img src={itdp} alt="Logo do ITDP"></img>
                            </a>
                            <a href="https://www.uniaodeciclistas.org.br/" target="_BLANK" rel="noopener noreferrer">
                                <img src={ucb} alt="Logo da UCB"></img>
                            </a>
                        </div>
                    </div>
                </div>
            ),
            onOk() { },
        });
    }

    showCityPicker() {
        let body = document.querySelector('body');
        body.classList.add('show-city-picker');
        body.querySelector('.mapboxgl-ctrl-top-left .mapboxgl-ctrl-geocoder input').focus();
    }

    onChange(value) {
        console.log(`selected ${value}`);
        this.props.onMapMoved({ area: value });
    }

    componentDidMount() {
        get('hasSeenWelcomeMsg')
                .then(data => {
                    if (!data) {
                        this.info();
                        set('hasSeenWelcomeMsg', true);
                    }
                });
    }

    render() {
        const parts = this.props.title.split(',');
        const city = parts[0], 
            state = parts[1];
            // country = parts[2];
        let updatedAt;

        // Super special case for Brasilia because it's so damn big and we're not loading the data into memory
        const isDownloadUnavailable = city === 'Brasília';
        
        if (this.props.lastUpdate) {
            updatedAt = this.props.lastUpdate.toLocaleString('pt-BR');
        }
        
        return (
            <div className="topbar" style={{height: TOPBAR_HEIGHT}}>
                <div>
                    <h1 className="logo">
                        CicloMapa
                    </h1>
                </div>

                <div>
                    <Button 
                        size="large"
                        onClick={this.showCityPicker}
                    >
                        <h3 className="areaname">
                            <span className="state">
                                {state}
                            </span>
                            <span className="city">
                                {city}
                            </span> 

                            <Icon
                                type="down"
                                size="small"
                                style={{ fontSize: '16px', color: '#4ba96e' }}
                            >
                            </Icon>
                        </h3>
                    </Button>

                    {
                        updatedAt &&
                        <Popover
                            placement="bottom"
                            content={(
                                <div>
                                    Dados obtidos do OpenStreetMaps em <b>{updatedAt}</b>.
                                    <Button
                                        size="small"
                                        icon="redo"
                                        onClick={this.props.forceUpdate}
                                        style={{marginLeft: '0.25em'}}
                                    >
                                    </Button>
                                </div>
                            )}
                            arrowPointAtCenter={true}
                        >
                            <Icon type="info-circle" style={{ marginLeft: '8px' }}/>
                        </Popover>
                    }
                </div>
                
                <div>
                    <Button
                        size="large"
                        type="link"
                        onClick={this.info}
                    >
                        Sobre
                    </Button>

                    <Divider type="vertical" />

                    <Button
                        size="large"
                        type="link"
                        onClick={this.props.downloadData}
                        disabled={isDownloadUnavailable}
                        style={{ opacity: isDownloadUnavailable ? .5 : 1}}
                    >
                        <Icon type="download" /> Baixar dados
                    </Button>
                </div>
            </div>
        )
    }
}

export default TopBar;