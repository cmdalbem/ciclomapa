import React, { Component } from 'react';

import {
    Button,
} from 'antd';

import itdp from './img/itdp.png';
import ucb from './img/ucb.png';
import premiobicicletabrasil from './img/premiobicicletabrasil.png';

class AboutModal extends Component {
    render() {
        const { visible, onClose } = this.props;
 
        return (
            <div 
                className={`
                    fixed top-0 bottom-0 left-0 right-0 z-10 flex justify-center items-center
                    ${visible ? 'opacity-100' : 'opacity-0 pointer-events-none'} transition-opacity duration-500
                `}
                style={{
                    background: 'rgba(37,32,29,0.9)',
                    color: 'white'
                }}
            >
                <div className="relative max-w-lg p-4 sm:p-0">
                    <div className="text-small md:text-lg tracking-wide">
                        <img className="h-12 mb-8" src="logo.svg" alt="CicloMapa"></img>

                        <div className="mb-8">
                            <p>
                                O CicloMapa é uma ferramenta que busca ampliar a visibilidade das infraestruturas cicloviárias (ou a falta delas) das cidades brasileiras, disponibilizando dados que auxiliem a incidência em políticas públicas para a ciclomobilidade.
                            </p>

                            <p>
                                Utilizando o <a className="underline" href="https://www.openstreetmap.org/" title="OpenStreetMap" target="_blank" rel="noopener noreferrer">OpenStreetMap (OSM)</a>, uma plataforma colaborativa de mapeamento de dados geoespaciais abertos, também procura engajar a comunidade em sua atualização e na importância de dados abertos.
                            </p>
                        </div>

                        <Button type="primary" size="large" onClick={onClose}>
                            Começar
                        </Button>

                        <div className="mt-16">
                            <div className="flex items-start justify-between opacity-80">
                                <div className="w-8/12">
                                    <div className='flex h-10 flex-row mb-6'>
                                        <a className="h-full mr-4"
                                            href="https://www.uniaodeciclistas.org.br/"
                                            arget="_BLANK" rel="noopener noreferrer"
                                        >
                                            <img className="h-full" src={ucb} alt="Logo da UCB" />
                                        </a>
                                        <a className="h-full mr-4"
                                            href="https://itdpbrasil.org/"
                                            target="_BLANK" rel="noopener noreferrer"
                                        >
                                            <img className="h-full" src={itdp} alt="Logo do ITDP" />
                                        </a>
                                    </div>

                                    <p className="text-xs font-semibold mb-6">
                                        Design & desenvolvimento por  <a className="underline" href="https://www.cristianodalbem.com/" target="_BLANK" rel="noopener noreferrer" > Cristiano Dalbem </a>
                                    </p>

                                    <div className='flex h-10 flex-row'>
                                        <a className="h-full"
                                            href="https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/mobilidade-urbana/programa-bicicleta-brasil/premio-bicicleta-brasil/"
                                            target="_BLANK" rel="noopener noreferrer"
                                        >
                                            <img className="h-full" src={premiobicicletabrasil} alt="Logo do premiobicicletabrasil" />
                                        </a>
                                    </div>
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