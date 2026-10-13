import React, { Component } from 'react';

import { appNotification } from './antdNotification';

import { Input, Modal, Typography, Space, Checkbox, Row, Col } from 'antd';
import { HiOutlineExternalLink } from 'react-icons/hi';
import { getOsmUrl } from './utils/utils.js';

const { TextArea } = Input;
const { Text } = Typography;

class CommentModal extends Component {
  defaultState = {
    text: '',
    tags: [],
    email: undefined,
    website: '',
    submitting: false,
  };

  constructor(props) {
    super(props);

    this.handleOk = this.handleOk.bind(this);
    this.onTextChange = this.onTextChange.bind(this);
    this.onTagsChange = this.onTagsChange.bind(this);
    this.onEmailChange = this.onEmailChange.bind(this);
    this.onWebsiteChange = this.onWebsiteChange.bind(this);

    this.state = this.defaultState;
  }

  reset() {
    this.setState(this.defaultState);
  }

  handleOk = async () => {
    if (this.state.submitting) return;

    const { coords, location } = this.props;
    this.setState({ submitting: true });

    try {
      await this.props.airtableDatabase.create({
        latlong: `${coords.lat},${coords.lng}`,
        location: location,
        text: this.state.text,
        tags: this.state.tags,
        email: this.state.email,
        website: this.state.website,
      });

      appNotification.success({
        title: 'Novo comentário criado.',
      });

      this.props.afterCreate();
      this.reset();
    } catch {
      appNotification.error({
        title: 'Não foi possível enviar o comentário.',
        description: 'Tente novamente em alguns instantes.',
      });
      this.setState({ submitting: false });
    }
  };

  onTextChange = ({ target: { value } }) => {
    this.setState({
      text: value,
    });
  };

  onEmailChange = ({ target: { value } }) => {
    this.setState({
      email: value,
    });
  };

  onWebsiteChange = ({ target: { value } }) => {
    this.setState({
      website: value,
    });
  };

  onTagsChange(value) {
    this.setState({
      tags: value,
    });
  }

  render() {
    const { coords, z } = this.props;
    const osmEditUrl = coords
      ? getOsmUrl(coords.lat, coords.lng, z)
      : 'https://www.openstreetmap.org/';

    return (
      <Modal
        title="Adicionar comentário no mapa"
        open={this.props.open}
        onOk={this.handleOk}
        onCancel={this.props.onCancel}
        destroyOnHidden
        centered={true}
        okButtonProps={{
          disabled:
            this.state.submitting || this.state.text.length === 0 || this.state.tags.length === 0,
          loading: this.state.submitting,
        }}
        okText="Adicionar comentário"
        cancelText="Cancelar"
      >
        <Space orientation="vertical" size="large" style={{ width: '100%' }}>
          <Text type="secondary" className="text-white" style={{ opacity: 0.7 }}>
            Deixe um comentário para ajudar a melhorar o mapeamento da infraestrutura cicloviária da
            sua cidade. Se preferir, você também pode fazer a edição diretamente no{' '}
            <a
              className="text-whiteunderline inline-flex items-center gap-1"
              style={{ opacity: 0.9 }}
              href={osmEditUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenStreetMap <HiOutlineExternalLink />
            </a>
            .
          </Text>

          <div>
            <Text className="text-white">Assunto</Text>
            <Checkbox.Group style={{ width: '100%' }} onChange={this.onTagsChange}>
              <Row>
                {this.props.tagsList.map((t) => (
                  <Col span={12} key={t}>
                    <Checkbox value={t}>
                      <div className="inline-block py-1 px-3 rounded-full mt-2 text-xs bg-white bg-opacity-10">
                        {t}
                      </div>
                    </Checkbox>
                  </Col>
                ))}
              </Row>
            </Checkbox.Group>
          </div>

          <div>
            <Text className="text-white">Comentário</Text>
            <TextArea
              autoSize={{ minRows: 3 }}
              style={{ width: '100%' }}
              onChange={this.onTextChange}
              placeholder="Explique em mais detalhes o problema que você identificou."
            />
          </div>

          <div>
            <Text className="text-white">Email</Text>
            <Input
              onChange={this.onEmailChange}
              placeholder="Opcional, somente visível para a equipe CicloMapa"
            />
          </div>

          <div aria-hidden="true" className="absolute overflow-hidden" style={{ left: '-9999px' }}>
            <label htmlFor="comment-website">Website</label>
            <input
              id="comment-website"
              name="website"
              type="text"
              tabIndex={-1}
              autoComplete="off"
              value={this.state.website}
              onChange={this.onWebsiteChange}
            />
          </div>
        </Space>
      </Modal>
    );
  }
}

export default CommentModal;
