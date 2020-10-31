import React, { Component } from 'react';
import { get, set } from 'idb-keyval';

import {
    Space,
    Modal,
    Button,
    Popover,
} from 'antd';

import {
    MdFileDownload as IconDownload,
    MdSync as IconUpdate,
    MdExpandMore as IconCaret,
    // MdInfo as IconInfo,
    // MdRateReview as IconComment,
} from "react-icons/md";
import { IconContext } from "react-icons";

import { timeSince } from './utils.js'
import { TOPBAR_HEIGHT, IS_MOBILE } from './constants'

import itdp from './img/itdp.png';
import ucb from './img/ucb.png';
import { ReactComponent as IconComment } from './img/icons/newcomment.svg';

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
            <IconContext.Provider value={{ className: 'react-icon' }}>
                <div
                    id="topbar"
                    className="w-full text-white z-10 absolute px-6 py-3 flex items-start justify-between"
                    style={{height: TOPBAR_HEIGHT}}
                >
                    <div className="text-2xl uppercase text-green-300 mt-1" style={{
                        fontFamily: 'Teko, sans-serif',
                    }}>
                        CicloMapa
                    </div>

                    <div className="city-picker">
                        <Space size={4} direction="vertical" align="center">
                            <Button
                                size={IS_MOBILE ? 'default' : 'large'}
                                onClick={this.showCityPicker}
                            >
                                <h3 className="text-lg">
                                    <span className="mr-3">
                                        <span className="font-bold">
                                            {city},
                                        </span>

                                        {state}
                                    </span>

                                    <IconCaret className="text-green-600"/>
                                </h3>
                            </Button>

                            {
                                this.props.lastUpdate &&
                                <Popover
                                    placement="bottom"
                                    content={(
                                        <div style={{ maxWidth: 250 }}>
                                            <Space size="small" direction="vertical" >
                                                <div>
                                                    O mapa que você está vendo é uma cópia dos dados obtidos do OpenStreetMap em <b>{updatedAtStr}</b>.
                                                </div> 

                                                <Button
                                                    size="small"
                                                    icon={<IconUpdate />}
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
                                    <span className="font-regular cursor-default text-xs opacity-25 hover:opacity-100 transition-opacity duration-300">
                                        Atualizado há <b>{timeSince(this.props.lastUpdate)}</b>.
                                    </span>
                                    {/* <IconInfo style={{ fontSize: '12px', marginLeft: '4px' }} /> */}
                                </Popover>

                            }
                        </Space>
                    </div>
                    
                    <div className="nav-links font-white">
                        <Button
                            size="large"
                            type="link"
                            onClick={this.info}
                        >
                            Sobre
                        </Button>

                        <Button ghost onClick={this.newComment}>
                            <IconComment className="react-icon" /> Comentário
                        </Button>

                        <Button
                            ghost
                            onClick={this.props.downloadData}
                        >
                            <IconDownload /> Dados
                        </Button>
                    </div>
                </div>
            </IconContext.Provider>
        );
    }
}

export default TopBar;