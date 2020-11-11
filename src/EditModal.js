import React, { Component } from 'react';

import {
    Modal,
    Checkbox,
    Button
} from 'antd';

import {
    MdModeEdit as IconEdit,
} from "react-icons/md";


class EditModal extends Component {
    render() {
        return (
            <Modal
                title="Editar dados"
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
                    <p>
                        O CicloMapa usa dados do OpenStreetMap (OSM), o maior banco de dados abertos de mapas do mundo. Sua interface de edição e nomenclatures podem parecer um pouco amendotradoras na primeira vez, e para te ajudar preparamos uma série de <a className="underline" href="https://www.uniaodeciclistas.org.br/atuacao/ciclomapa/" title="CicloMapa | UCB - União de Ciclistas do Brasil" target="_blank" rel="noopener noreferrer">tutoriais</a>. Se mesmo assim tiver dúvidas, não hesite em nos <a className="underline" mailto="contato@ciclomapa.com.br">contactar</a>!
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