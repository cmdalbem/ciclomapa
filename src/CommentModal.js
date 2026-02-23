import React, { Component } from 'react';

import { notification } from 'antd';

import {
    Input,
    Modal,
    Typography,
    Space,
    Checkbox, Row, Col
} from 'antd';
import { HiOutlineExternalLink } from 'react-icons/hi';
import { getOsmUrl } from './utils.js';

const { TextArea } = Input;
const { Text } = Typography;


const DEFAULT_STATUS = 'Aberta';


class CommentModal extends Component {
    defaultState = {
        text: '',
        tags: [],
        email: undefined
    };

    constructor(props) {
        super(props);

        this.handleOk = this.handleOk.bind(this);
        this.onTextChange = this.onTextChange.bind(this);
        this.onTagsChange = this.onTagsChange.bind(this);
        this.onEmailChange = this.onEmailChange.bind(this);

        this.state = this.defaultState;
    }

    reset() {
        this.setState(this.defaultState);
    }
    
    handleOk = e => {
        const { coords, location } = this.props;

        this.props.airtableDatabase.create({
            status: DEFAULT_STATUS,
            latlong: `${coords.lat},${coords.lng}`,
            location: location,
            text: this.state.text,
            tags: this.state.tags,
            email: this.state.email,
        }).then( () => {
            notification.success({
                message: 'Novo comentário criado.'
            });

            this.props.afterCreate();
            this.reset();
        })
    };

    onTextChange = ({ target: { value } }) => {
        this.setState({
            text: value
        });
    };

    onEmailChange = ({ target: { value } }) => {
        this.setState({
            email: value
        });
    };

    onTagsChange(value) {
        this.setState({
            tags: value
        })
    }

    render() {
        const { coords, z } = this.props;
        const osmEditUrl = coords ? getOsmUrl(coords.lat, coords.lng, z) : 'https://www.openstreetmap.org/';

        return (
            <Modal
                title="Adicionar comentário no mapa"
                open={this.props.open}
                onOk={this.handleOk}
                onCancel={this.props.onCancel}
                destroyOnClose={true}
                // width={360}
                centered={true}
                okButtonProps={{
                    disabled: this.state.text.length === 0 || this.state.tags.length === 0
                }}
                okText="Adicionar comentário"
                cancelText="Cancelar"
            >
                <Space direction="vertical" size="large" style={{width: '100%'}}>
                    <Text type="secondary" className="text-white" style={{ opacity: 0.7 }}>
                        Deixe um comentário para ajudar a melhorar o mapeamento da infraestrutura cicloviária da sua cidade. Se preferir, você também pode fazer a edição diretamente no{' '}
                        <a
                            className="text-whiteunderline inline-flex items-center gap-1"
                            style={{ opacity: 0.9 }}
                            href={osmEditUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            OpenStreetMap <HiOutlineExternalLink />
                        </a>.
                    </Text>

                    <div>
                        <Text className="text-white">
                            Assunto
                        </Text>

                        {/* <Select
                            mode="multiple"
                            allowClear
                            style={{ width: '100%' }}
                            placeholder="Selecione uma ou mais tags..."
                            onChange={this.onTagsChange}
                        >
                            {
                                this.props.tagsList.map(t =>
                                    <Option key={t}>
                                        {t}
                                    </Option>
                                )
                            }
                        </Select> */}
                        <Checkbox.Group style={{ width: '100%' }} onChange={this.onTagsChange}>
                            <Row>
                                {
                                    this.props.tagsList.map(t =>
                                        <Col span={12} key={t}>
                                            <Checkbox value={t}>
                                                <div className="inline-block py-1 px-3 rounded-full mt-2 text-xs bg-white bg-opacity-10" >
                                                    {t}
                                                </div>
                                            </Checkbox>
                                        </Col>
                                    )
                                }
                            </Row>
                        </Checkbox.Group>
                    </div>

                    <div>
                        <Text className="text-white">
                            Comentário
                        </Text>
                        <TextArea
                            autoSize={{ minRows: 3 }}
                            style={{ width: '100%' }}
                            onChange={this.onTextChange}
                            placeholder="Explique em mais detalhes o problema que você identificou."
                        />
                    </div>

                    <div>
                        <Text className="text-white">
                            Email
                        </Text>
                        <Input
                            onChange={this.onEmailChange}
                            placeholder="Opcional, somente visível para a equipe CicloMapa"
                        />
                    </div>
                </Space>
            </Modal>
        )
    }
}

export default CommentModal;
