import React, { Component } from 'react';

import {
    Modal,
} from 'antd';

import itdp from './img/itdp.png';
import ucb from './img/ucb.png';

class AboutModal extends Component {
    render() {
        return (
            <Modal
                visible={this.props.visible}
                onOk={this.props.onClose}
                onCancel={this.props.onClose}
                showCancel={false}
                footer={null}
                centered={true}
                maskClosable={true}
            >
                <div className="text-base">
                    <div className="text-6xl uppercase text-green-300 mt-1" style={{
                        fontFamily: 'Teko, sans-serif',
                    }}>
                        CicloMapa
                    </div>

                    <p>
                        O CicloMapa é uma ferramenta que busca ampliar a visibilidade das infraestruturas cicloviárias (ou a falta delas) das cidades brasileiras, disponibilizando dados que auxiliem a incidência em políticas públicas para a ciclomobilidade.
                    </p>

                    <p>
                        Utilizando o <a className="underline" href="https://www.openstreetmap.org/" title="OpenStreetMap" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>, uma plataforma colaborativa de mapeamento de dados geo-espaciais abertos, também procura engajar a comunidade em sua atualização e na importância de dados abertos.
                    </p>

                    <div className="mt-16">
                        <div className="flex items-start justify-between">
                            <div className="w-8/12 flex h-10 flex-col sm:flex-row">
                                <a
                                    className="h-full mr-4"
                                    href="https://www.uniaodeciclistas.org.br/" 
                                    arget="_BLANK" rel="noopener noreferrer"
                                    >
                                        <img className="h-full" src={ucb} alt="Logo da UCB"/>
                                </a>

                                <a
                                    className="h-full"
                                    href="https://itdpbrasil.org/"
                                    target="_BLANK" rel="noopener noreferrer"
                                    >
                                        <img className="h-full" src={itdp} alt="Logo do ITDP"/>
                                </a>
                            </div>

                            <div className="w-4/12 flex flex-col">
                                <a className="underline" href="https://www.uniaodeciclistas.org.br/atuacao/ciclomapa/" title="CicloMapa | UCB - União de Ciclistas do Brasil" target="_blank" rel="noopener noreferrer">
                                    Tutoriais
                                </a>

                                <a className="underline" href="mailto:contato@ciclomapa.com.br" target="_blank" rel="noopener noreferrer">
                                    Contato
                                </a>
                                
                                <a className="underline" href="https://github.com/cmdalbem/ciclomapa/" title="GitHub" target="_blank" rel="noopener noreferrer">
                                    GitHub
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </Modal>
        )
    }
}

export default AboutModal;