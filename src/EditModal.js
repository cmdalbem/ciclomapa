import React, { Component } from 'react';

import {
    Modal,
    Checkbox,
    Button
} from 'antd';

class EditModal extends Component {
    render() {
        return (
            <Modal
                title="Editar no OSM"
                visible={this.props.visible}
                onCancel={this.props.onClose}
                showCancel={false}
                footer={[
                    <Button key="2" type="text">
                        <a
                            className="hover:text-white"
                            target="_BLANK" rel="noopener noreferrer"
                            href={'https://www.uniaodeciclistas.org.br/atuacao/ciclomapa/'}
                        >
                            Ver tutoriais
                        </a>
                    </Button>,
                    <Button key="3" type="primary">
                        <a
                            className="hover:text-white"
                            target="_BLANK" rel="noopener noreferrer"
                            href={this.props.getOsmUrl()}
                        >
                            Ir para OSM
                        </a>
                    </Button>
                ]}
                centered={true}
                maskClosable={true}
            >
                <div>
                    <p>
                        Obrigado por contribuir para melhorar os mapas cicloviários das cidades brasileiras!
                    </p>
                    <p className="mb-8">
                        O CicloMapa é integrado ao OpenStreetMap (OSM), o maior banco de dados abertos de mapas do mundo, cuja interface de edição pode parecer intimidadora na primeira vez. Para te ajudar preparamos uma <a className="underline" href="https://www.uniaodeciclistas.org.br/atuacao/ciclomapa/" title="CicloMapa | UCB - União de Ciclistas do Brasil" target="_blank" rel="noopener noreferrer">série de tutoriais</a>. Se mesmo assim tiver dúvidas <a className="underline" href="mailto:contato@ciclomapa.org.br">entre em contato</a>.
                    </p>

                    <Checkbox onChange={this.props.onCheckboxChange}>
                        Não mostrar esta mensagem novamente.
                    </Checkbox>
                </div>
            </Modal>
        )
    }
}

export default EditModal;