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
                        A plataforma CicloMapa é uma ferramenta que buscar ampliar a visibilidade das infraestruturas cicloviárias mapeadas no OpenStreetMap e engajar uma comunidade de mapeadores para atualização colaborativa de dados e incidência em políticas públicas de mobilidade urbana.
                    </p>

                    <p>
                        Este é um projeto Open Source, e seu código pode ser encontrado no <a href="https://github.com/cmdalbem/ciclomapa/">GitHub</a>.
                    </p>

                    <p>
                        Para mais informações sobre o projeto e tutoriais de como contribur com o mapeamento da sua cidade usando o OpenStreetMaps acesse nossos <a href="https://www.uniaodeciclistas.org.br/atuacao/ciclomapa/">tutoriais no site da UCB</a>.
                    </p>

                    <div>
                        Realização:

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

                <div>
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