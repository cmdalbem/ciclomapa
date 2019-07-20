import React, { Component } from 'react';

import { TOPBAR_HEIGHT } from './constants'

import { Modal, Button, Divider, Icon } from 'antd';

import './TopBar.css'

class TopBar extends Component {
    info() {
        Modal.info({
            title: 'Sobre',
            content: (
                <p>
                    A plataforma BICIMAPA é uma ferramenta que buscar ampliar a visibilidade das infraestruturas cicloviárias mapeadas no OpenStreetMap e engajar uma comunidade de mapeadores para atualização colaborativa de dados e incidência em políticas públicas de mobilidade urbana.
                </p>
            ),
            onOk() { },
        });
    }

    render() {
        return (
            <div>
                <div className="topbar" style={{height: TOPBAR_HEIGHT}}>
                    <div>
                        <h1>
                            BICIMAPA
                        </h1>
                    </div>

                    <h2 className="title">
                        {this.props.title}
                    </h2>
                    
                    <div>
                        <Button type="link" onClick={this.info}>Sobre</Button>

                        <Divider type="vertical" />

                        <Button type="link" onClick={this.props.downloadData}>
                            <Icon type="download" /> Baixar dados
                        </Button>
                    </div>
                </div>
            </div>
        )
    }
}

export default TopBar;