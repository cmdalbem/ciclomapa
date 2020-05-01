import React, { Component } from 'react';

import './CitySwitcherBackdrop.css'

import { Button } from 'antd';


class CitySwitcherBackdrop extends Component {
    onClose() {
        let body = document.querySelector('body');
        body.classList.remove('show-city-picker')
    }

    render() {
        return (
            <div id="backdrop" onClick={this.onClose}>
                <Button
                    id="closeBtn"
                    // ghost
                    // shape="circle"
                    // icon="close"
                    type="link"
                    size="large"
                    onClick={this.onClose}
                >
                    Cancelar
                </Button>
            </div>
        )
    }
}

export default CitySwitcherBackdrop;