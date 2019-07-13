import React, { Component } from 'react';

import { TOPBAR_HEIGHT } from './constants'

import { Modal, Button, Divider } from 'antd';

import './TopBar.css'

class TopBar extends Component {
    state = { visible: false };

    showModal = () => {
        this.setState({
            visible: true,
        });
    };

    handleOk = e => {
        console.log(e);
        this.setState({
            visible: false,
        });
    };


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
                        <Button type="link" onClick={this.showModal}>Sobre</Button>

                        <Divider type="vertical" />

                        <Button type="link" onClick={this.props.downloadData}>Baixar dados</Button>
                    </div>
                </div>

                <Modal
                    title="Sobre"
                    visible={this.state.visible}
                    onOk={this.handleOk}
                >
                    <p>
                        A plataforma BICIMAPA é uma ferramenta que buscar ampliar a visibilidade das infraestruturas cicloviárias mapeadas no OpenStreetMap e engajar uma comunidade de mapeadores para atualização colaborativa de dados e incidência em políticas públicas de mobilidade urbana.
                    </p>
                </Modal>
            </div>
        )
    }
}

export default TopBar;