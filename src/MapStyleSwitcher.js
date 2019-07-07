import React, { Component } from 'react';

import { Select } from 'antd';

const { Option } = Select;

class MapStyleSwitcher extends Component {

    onChange(url) {
        this.props.onMapStyleChange(url)
    }

    render() {
        return (
            <Select
                defaultValue="Mapa light"
                optionFilterProp="children"
                onChange={this.onChange.bind(this)}
                style={{
                    position: 'fixed',
                    top: '10px',
                    right: '10px',
                    width: '200px'
                }}
            >
                <Option value='mapbox://styles/mapbox/light-v10'>Mapa light</Option>
                <Option value='mapbox://styles/mapbox/streets-v11'>Mapa normal</Option>
                {/* <Option value='mapbox://styles/mapbox/outdoors-v11'>Outdoors</Option> */}
                <Option value='mapbox://styles/cmdalbem/cjxsdwb907bfi1cqevxio2bst'>Mapa com satélite</Option>
            </Select>
        )
    }
}

export default MapStyleSwitcher;