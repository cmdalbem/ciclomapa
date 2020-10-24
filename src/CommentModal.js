import React, { Component } from 'react';

import {
    Input,
    Modal,
    Select,
    Typography,
    Space,
} from 'antd';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;


const DEFAULT_STATUS = 'Aberta';


class CommentModal extends Component {
    constructor(props) {
        super(props);

        this.handleOk = this.handleOk.bind(this);
        this.onTextChange = this.onTextChange.bind(this);
        this.onSelectChange = this.onSelectChange.bind(this);
        this.onEmailChange = this.onEmailChange.bind(this);

        this.state = {
            text: '',
            tags: [],
            email: undefined
        };
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
            this.props.afterCreate();
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

    onSelectChange(value) {
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
                width={360}
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

                        <Select
                            mode="multiple"
                            allowClear
                            style={{ width: '100%' }}
                            placeholder="Selecione uma ou mais tags..."
                            onChange={this.onSelectChange}
                        >
                            {
                                this.props.tagsList.map(t =>
                                    <Option key={t}>
                                        {t}
                                    </Option>
                                )
                            }
                        </Select>
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
                            Contato (opcional)
                        </Text>
                        <Input
                            placeholder="email@email.com"
                            onChange={this.onEmailChange}
                        />
                    </div>
                </Space>
            </Modal>
        )
    }
}

export default CommentModal;
