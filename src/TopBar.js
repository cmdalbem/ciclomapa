import React, { Component } from 'react';

import { TOPBAR_HEIGHT, IS_MOBILE } from './constants'

import { Modal, Button, Divider, Popover, Icon } from 'antd';

import { get, set } from 'idb-keyval';

import itdp from './img/itdp.png';
import ucb from './img/ucb.png';
import logo from './img/logo_green.svg';

import './TopBar.css'

class TopBar extends Component {
    info() {
        Modal.info({
            title: 'Sobre',
            className: 'about-modal',
            content: (
                <div>
                    <p>
                        O <b>CicloMapa</b> é uma ferramenta que busca ampliar a visibilidade das infraestruturas cicloviárias (ou a falta delas), disponibilizando dados que auxiliem a incidência em políticas públicas para a ciclomobilidade.
                    </p>

                    <p>
                        Utilizando o <a href="https://www.openstreetmap.org/" title="OpenStreetMap" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>, uma plataforma colaborativa de mapeamento de dados geo-espaciais abertos, também procura engajar a comunidade em sua atualização.
                    </p>

                    <p>
                        Para saber mais sobre a iniciativa e como contribuir com o mapeamento de sua cidade, acesse a <a href="https://www.uniaodeciclistas.org.br/atuacao/ciclomapa/" title="CicloMapa | UCB - União de Ciclistas do Brasil" target="_blank" rel="noopener noreferrer">página do projeto no site da UCB</a>.
                    </p>

                    <p>
                        Este é um projeto de código aberto (<i>Open Source</i>) e pode ser encontrado no <a href="https://github.com/cmdalbem/ciclomapa/" title="GitHub" target="_blank" rel="noopener noreferrer">GitHub</a>.
                    </p>

                    <div>
                        Realização:

                        <div className="logos">
                            <a href="https://itdpbrasil.org/" target="_BLANK" rel="noopener noreferrer">
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

        if (this.props.lastUpdate) {
            updatedAt = this.props.lastUpdate.toLocaleString('pt-BR');
        }
        
        return (
            <div className="topbar" style={{height: TOPBAR_HEIGHT}}>
                <div id="logo">
                    <img src={logo} alt="CicloMapa"></img>
                </div>

                <div className="city-picker">
                    <Button 
                        size={IS_MOBILE ? 'default' : 'large'}
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
                        <span className="data-tooltip">
                            <Popover
                                placement="bottom"
                                content={(
                                    <div style={{maxWidth: 300}}>
                                        <span>
                                            Dados obtidos do OpenStreetMaps em <b>{updatedAt}</b>.
                                        </span>

                                        <Button
                                            size="small"
                                            icon="redo"
                                            ghost
                                            onClick={this.props.forceUpdate}
                                        >
                                            Atualizar
                                        </Button>
                                    </div>
                                )}
                                arrowPointAtCenter={true}
                            >
                                <Icon type="info-circle" style={{ marginLeft: '8px' }}/>
                            </Popover>
                        </span>
                            
                    }
                </div>
                
                <div className="nav-links">
                    <Button
                        size="large"
                        type="link"
                        onClick={this.info}
                    >
                        Sobre
                    </Button>

                    <Button
                        ghost
                        onClick={this.props.downloadData}
                    >
                        <Icon type="download" /> Dados
                    </Button>
                </div>
            </div>
        )
    }
}

export default TopBar;