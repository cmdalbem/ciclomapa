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
                    bottom: '42px',
                    left: '8px',
                    width: '160px'
                }}
            >
                <Option value='mapbox://styles/cmdalbem/cjxseldep7c0a1doc7ezn6aeb'>Mapa light</Option>
                <Option value='mapbox://styles/mapbox/streets-v11'>Mapa normal</Option>
                <Option value='mapbox://styles/cmdalbem/cjgmxgkbw000n2rqtucat5zjz'>Dorsia</Option>
                {/* <Option value='mapbox://styles/mapbox/outdoors-v11'>Outdoors</Option> */}
                <Option value='mapbox://styles/cmdalbem/cjxsdwb907bfi1cqevxio2bst'>Mapa com satélite</Option>
            </Select>
        )
    }
}

export default MapStyleSwitcher;