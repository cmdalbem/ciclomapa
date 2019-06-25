import React, { Component } from 'react';

import { Select } from 'antd';

const { Option } = Select;

class MapStyleSwitcher extends Component {

    onChange(layerId) {
        // console.log(`selected ${value}`);
        this.props.onMapStyleChange('mapbox://styles/mapbox/' + layerId)
    }

    render() {
        return (
            <Select
                defaultValue="light"
                placeholder="Estilo do mapa"
                optionFilterProp="children"
                onChange={this.onChange.bind(this)}
                style={{
                    position: 'fixed',
                    top: '10px',
                    right: '10px',
                    width: '200px'
                }}
            >
                <Option value='light-v10'>Light</Option>
                <Option value='streets-v11'>Streets</Option>
                <Option value='outdoors-v11'>Outdoors</Option>
                <Option value='satellite-v9'>Satellite</Option>
            </Select>
        )
    }
}

export default MapStyleSwitcher;