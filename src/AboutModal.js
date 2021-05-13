import React, { Component } from 'react';

import {
    Button,
} from 'antd';

import itdp from './img/itdp.png';
import ucb from './img/ucb.png';

class AboutModal extends Component {
    render() {
        const { visible, onClose } = this.props;
 
        return (
            <div 
                className={`
                    fixed top-0 bottom-0 left-0 right-0 z-10 flex justify-center items-center
                    ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity duration-500
                `}
                style={{ background: 'rgba(37,32,29,0.9)' }}
            >
                <div className="relative max-w-lg p-4 sm:p-0">
                    <div className="text-lg tracking-wide">
                        <img className="h-12 mb-8" src="logo.svg" alt="CicloMapa"></img>

                        <div className="mb-8">
                            <p>
                                O CicloMapa é uma ferramenta que busca ampliar a visibilidade das infraestruturas cicloviárias (ou a falta delas) das cidades brasileiras, disponibilizando dados que auxiliem a incidência em políticas públicas para a ciclomobilidade.
                            </p>

                            <p>
                                Utilizando o <a className="underline" href="https://www.openstreetmap.org/" title="OpenStreetMap" target="_blank" rel="noopener noreferrer">OpenStreetMap (OSM)</a>, uma plataforma colaborativa de mapeamento de dados geo-espaciais abertos, também procura engajar a comunidade em sua atualização e na importância de dados abertos.
                            </p>
                        </div>

                        <Button type="primary" size="large" onClick={onClose}>
                            Começar
                        </Button>

                        <div className="mt-16">
                            <div className="flex items-start justify-between">
                                <div className="w-8/12 flex h-10 flex-col sm:flex-row">
                                    <a
                                        className="h-full mr-4"
                                        href="https://www.uniaodeciclistas.org.br/"
                                        arget="_BLANK" rel="noopener noreferrer"
                                    >
                                        <img className="h-full" src={ucb} alt="Logo da UCB" />
                                    </a>
                                    <a
                                        className="h-full"
                                        href="https://itdpbrasil.org/"
                                        target="_BLANK" rel="noopener noreferrer"
                                    >
                                        <img className="h-full" src={itdp} alt="Logo do ITDP" />
                                    </a>
                                </div>
                                <div className="w-4/12 flex flex-col">
                                    <a className="underline" href="https://www.uniaodeciclistas.org.br/atuacao/ciclomapa/" title="CicloMapa | UCB - União de Ciclistas do Brasil" target="_blank" rel="noopener noreferrer">
                                        Tutoriais
                                    </a>
                                    <a className="underline" href="mailto:contato@ciclomapa.org.br" target="_blank" rel="noopener noreferrer">
                                        Contato
                                    </a>

                                    <a className="underline" href="https://github.com/cmdalbem/ciclomapa/" title="GitHub" target="_blank" rel="noopener noreferrer">
                                        GitHub
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}

export default AboutModal;