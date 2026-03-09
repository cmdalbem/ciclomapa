import React, { Component } from 'react';

import { Modal, Checkbox, Button } from 'antd';

import { HiOutlineExternalLink } from 'react-icons/hi';

import { getOsmUrl } from './utils/utils.js';

class EditModal extends Component {
  render() {
    return (
      <Modal
        title="Editar mapa"
        open={this.props.open}
        onCancel={this.props.onClose}
        cancelText="Cancelar"
        footer={[
          <Button key="1" type="secondary" onClick={this.props.onClose}>
            Cancelar
          </Button>,
          <Button key="3" type="primary">
            <a
              className="hover:text-white"
              target="_BLANK"
              rel="noopener noreferrer"
              href={getOsmUrl(this.props.lat, this.props.lng, this.props.z)}
            >
              <HiOutlineExternalLink className="mr-1" />
              Abrir OpenStreetMap
            </a>
          </Button>,
        ]}
        centered={true}
        maskClosable={true}
      >
        <div className="text-white">
          <p>
            O CicloMapa é integrado ao OpenStreetMap (OSM), o maior banco de dados abertos de mapas
            do mundo.
          </p>

          <p>
            Sua interface de edição pode parecer intimidadora na primeira vez, mas para te ajudar
            preparamos uma{' '}
            <a
              className="underline"
              href="https://www.uniaodeciclistas.org.br/atuacao/ciclomapa/"
              title="CicloMapa | UCB - União de Ciclistas do Brasil"
              target="_blank"
              rel="noopener noreferrer"
            >
              série de tutoriais
            </a>
            . Se mesmo assim tiver dúvidas{' '}
            <a className="underline" href="mailto:contato@ciclomapa.org.br">
              entre em contato
            </a>{' '}
            com a nossa equipe.
          </p>

          <p className="mb-8">
            Obrigado por contribuir para melhorar os mapas cicloviários das cidades brasileiras!
          </p>

          <Checkbox onChange={this.props.onCheckboxChange}>
            Não mostrar esta mensagem novamente.
          </Checkbox>
        </div>
      </Modal>
    );
  }
}

export default EditModal;
