import React, { Component } from 'react';

import { notification } from 'antd';

import {
    Input,
    Modal,
    Typography,
    Space,
    Checkbox, Row, Col
} from 'antd';

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
        return (
            <Modal
                visible={this.props.visible}
                onOk={this.handleOk}
                onCancel={this.props.onCancel}
                destroyOnClose={true}
                // width={360}
                centered={true}
                okButtonProps={{
                    disabled: this.state.text.length === 0 || this.state.tags.length === 0
                }}
            >
                <Space direction="vertical" size="large" style={{width: '100%'}}>
                    <div>
                        <Text strong>
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
                        <Text strong>
                            Comentário
                        </Text>
                        <TextArea
                            autoSize={{ minRows: 3 }}
                            style={{ width: '100%' }}
                            onChange={this.onTextChange}
                        />
                    </div>

                    <div>
                        <Text strong type="secondary">
                            Seu contato (opcional, somente visível para a equipe)
                        </Text>
                        <Input
                            onChange={this.onEmailChange}
                        />
                    </div>
                </Space>
            </Modal>
        )
    }
}

export default CommentModal;
