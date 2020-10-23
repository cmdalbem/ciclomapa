import React, { Component } from 'react';

import { TOPBAR_HEIGHT, IS_MOBILE } from './constants'

import {
    DownloadOutlined,
    InfoCircleOutlined,
    RedoOutlined,
    CaretDownFilled,
    EditOutlined,
} from '@ant-design/icons';

import {
    Space,
    Modal,
    Button,
    Popover,
} from 'antd';

import { timeSince } from './utils.js'

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

    newComment() {
        document.dispatchEvent(new Event('newComment'));
    }

    render() {
        const parts = this.props.title.split(',');
        const city = parts[0], 
            state = parts[1];
            // country = parts[2];
        let updatedAtStr;

        if (this.props.lastUpdate) {
            updatedAtStr = this.props.lastUpdate.toLocaleString('pt-BR');
        }
        
        return (
            <div className="topbar" style={{height: TOPBAR_HEIGHT}}>
                <div id="logo" className="logo">
                    {/* <img src={logo} alt="CicloMapa"></img> */}
                    Ciclomapa
                </div>

                <div className="city-picker">
                    <Space size={4} direction="vertical" align="center">
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

                                <CaretDownFilled style={{ fontSize: '16px', color: '#4ba96e' }} />
                            </h3>
                        </Button>

                        {
                            this.props.lastUpdate &&
                            <span className="data-tooltip">
                                Atualizado há <b>{timeSince(this.props.lastUpdate)}</b>.
                                <Popover
                                    placement="bottom"
                                    content={(
                                        <div style={{ maxWidth: 250 }}>
                                            <Space size="small" direction="vertical" >
                                                <div>
                                                    O mapa que você está vendo é uma cópia dos dados obtidos do OpenStreetMaps em <b>{updatedAtStr}</b>.
                                                </div> 

                                                <Button
                                                    size="small"
                                                    icon={<RedoOutlined />}
                                                    ghost
                                                    onClick={this.props.forceUpdate}
                                                >
                                                    Atualizar
                                                </Button>
                                            </Space>
                                        </div>
                                    )}
                                    arrowPointAtCenter={true}
                                >
                                    <InfoCircleOutlined style={{ fontSize: '12px', marginLeft: '4px' }} />
                                </Popover>
                            </span>

                        }
                    </Space>
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
                        <DownloadOutlined /> Dados
                    </Button>

                    <Button ghost onClick={this.newComment}>
                        <EditOutlined /> Comentário
                    </Button>
                </div>
            </div>
        );
    }
}

export default TopBar;