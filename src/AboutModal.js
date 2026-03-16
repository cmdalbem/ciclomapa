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
                    background: 'rgba(37,32,29,0.95)',
                    color: 'white'
                }}
            >
                <div className="relative max-w-lg p-4 sm:p-0">
                    <div className="mt-12">
                        <img className="h-10 mb-8" src="logo.svg" alt="CicloMapa"></img>

                        <div className="mb-8 text-sm md:text-lg">
                            <p>
                                O CicloMapa é uma plataforma colaborativa gratuita que mostra onde existem (e onde faltam) ciclovias, ciclofaixas, ciclorrotas e outros equipamentos para bicicletas nas cidades brasileiras. 
                            </p>

                            <p>
                                Usando os dados do <a className="underline" href="https://www.openstreetmap.org/" title="OpenStreetMap" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>  (a Wikipedia dos mapas) ela permite que cidadãos, pesquisadores e gestores públicos visualizem, baixem e usem essas informações para melhorar a mobilidade por bicicleta no Brasil.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <Button type="primary" size="large" onClick={onClose}>
                                Começar
                            </Button>
                            <Button size="large" onClick={this.props.openLayersLegendModal}>
                                <span style={{color: 'white'}}>
                                    Legenda do mapa
                                </span>
                            </Button>
                        </div>

                        <div className="mt-16">
                            <hr style={{opacity: .2}}/>

                            <div className='flex h-10 mt-6 mb-6 gap-4 justify-between'>
                                <a className="h-full b-and-w"
                                    href="https://itdpbrasil.org/"
                                    target="_BLANK" rel="noopener noreferrer"
                                >
                                    <img className="h-full" src={itdp} alt="Logo do ITDP" />
                                </a>
                                <a className="h-full b-and-w"
                                    href="https://www.gov.br/cidades/pt-br/acesso-a-informacao/acoes-e-programas/mobilidade-urbana/programa-bicicleta-brasil/premio-bicicleta-brasil/"
                                    target="_BLANK" rel="noopener noreferrer"
                                >
                                    <img className="h-full" src={premiobicicletabrasil} alt="Logo do premiobicicletabrasil" />
                                </a>
                                <a className="h-full b-and-w"
                                    href="https://www.uniaodeciclistas.org.br/"
                                    target="_BLANK" rel="noopener noreferrer"
                                >
                                    <img className="h-full" src={ucb} alt="Logo da UCB" />
                                </a>
                            </div>

                            <hr style={{opacity: .2}}/>

                            <p className="flex gap-8 mt-6 mb-6 justify-center">
                                <a className="underline" href="https://www.uniaodeciclistas.org.br/atuacao/ciclomapa/" title="CicloMapa | UCB - União de Ciclistas do Brasil" target="_blank" rel="noopener noreferrer">
                                    Tutoriais
                                </a>
                                <a className="underline" href="mailto:contato@ciclomapa.org.br" target="_blank" rel="noopener noreferrer">
                                    Contato
                                </a>
                                <a className="underline" href="https://github.com/cmdalbem/ciclomapa/" title="GitHub" target="_blank" rel="noopener noreferrer">
                                    GitHub
                                </a>
                            </p>

                            <p className="text-xs mt-6 mb-6 opacity-50 text-center">
                                Design & desenvolvimento por  <a className="underline" href="https://www.cristianodalbem.com/" target="_BLANK" rel="noopener noreferrer" > Cristiano Dalbem </a> e  <a className="underline" href="https://github.com/cmdalbem/ciclomapa/graphs/contributors/" target="_BLANK" rel="noopener noreferrer" > colaboradores</a>.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        )
    }
}

export default AboutModal;