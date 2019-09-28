import React, { Component } from 'react';

import { TOPBAR_HEIGHT } from './constants'

import { Modal, Button, Divider, Icon } from 'antd';

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
        body.classList.add('show-city-picker')
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

        // const updatedAt = this.props.lastUpdate;// && this.props.lastUpdate.format();

        // const citySelector = <Select
        //     showSearch
        //     style={{ width: 200 }}
        //     onChange={this.onChange.bind(this)}
        // >
        //     <Option value="Porto Alegre, Rio Grande Do Sul, Brazil">
        //         Porto Alegre
        //                 </Option>
        //     <Option value="Rio De Janeiro, Rio De Janeiro, Brazil"	>
        //         Rio de Janeiro
        //                 </Option>
        //     <Option value="São Paulo, São Paulo, Brazil">
        //         São Paulo
        //                 </Option>
        //     <Option value="Fortaleza, Ceará">
        //         Fortaleza
        //                 </Option>
        // </Select>
        
        return (
            <div className="topbar" style={{height: TOPBAR_HEIGHT}}>
                <div>
                    <h1 className="logo">
                        CicloMapa
                    </h1>
                </div>

                <Button 
                    ghost
                    size="large"
                    onClick={this.showCityPicker}
                >
                    <h2 className="areaname">
                        <span className="state">
                            {state}
                        </span>
                        <span className="city">
                            {city}
                        </span> 

                        {/* {citySelector} */}

                        {/* <span className="lastUpdate">
                            atualizado em {updatedAt}
                        </span>  */}
                        
                        <Icon type="edit"></Icon>
                    </h2>
                </Button>
                
                <div>
                    <Button size="large" type="link" onClick={this.info}>Sobre</Button>

                    <Divider type="vertical" />

                    <Button size="large" type="link" onClick={this.props.downloadData}>
                        <Icon type="download" /> Baixar dados
                    </Button>
                </div>
            </div>
        )
    }
}

export default TopBar;