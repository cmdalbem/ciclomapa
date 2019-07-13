import React, { Component } from 'react';

import { TOPBAR_HEIGHT } from './constants'

import { Button } from 'antd';

import './TopBar.css'

class TopBar extends Component {
    render() {
        return (
            <div className="topbar" style={{height: TOPBAR_HEIGHT}}>
                <h1>
                    BICIMAPA
                </h1>

                <h2 className="title">
                    {this.props.title}
                </h2>
                
                <div>
                    <Button>Download</Button>
                </div>
            </div>
        )
    }
}

export default TopBar;