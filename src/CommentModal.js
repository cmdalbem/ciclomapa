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


const TAGS = [
    'Via mapeada no lugar errado',
    'Buraco na via',
    'Início ou fim mal mapeados',
    'Categoria errada',
    'Essa via não existe',
    'Outros'
];

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
        const coords = this.props.coords;
        const location = encodeURIComponent(this.props.location);

        this.props.airtableDatabase.create({
            status: DEFAULT_STATUS,
            latlong: `${coords.lat},${coords.lng}`,
            location: this.props.location,
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
            >
                <Space direction="vertical" size="large">
                    <div>
                        <div><Text strong>
                            Comentário
                        </Text></div>
                        <TextArea
                            autoSize={{ minRows: 2 }}
                            style={{ width: '100%' }}
                            onChange={this.onTextChange}
                        />
                    </div>

                    <div>
                        <div><Text strong>
                            Tags
                        </Text></div>
                        <Text type="secondary">
                            Selecione quantas quiser que se encaixe com o seu tipo de comentário.
                        </Text>

                        <Select
                            mode="multiple"
                            allowClear
                            style={{ width: '100%' }}
                            placeholder="Selecione..."
                            onChange={this.onSelectChange}
                        >
                            {
                                TAGS.map(t =>
                                    <Option key={t}>
                                        {t}
                                    </Option>
                                )
                            }
                        </Select>
                    </div>

                    <div>
                        <div><Text strong>
                            Email (opcional)
                        </Text></div>
                        <Text type="secondary">
                            Deixe seu contato para pegarmos mais detalhes com você ou se quiser ter um retorno quando o problema for resolvido.
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
