import React, { Component } from 'react';

import './Spinner.css'

class Spinner extends Component {
    render() {
        return (
            <div id="spinner" className="loader-container">
                <div className="loader">
                    <svg className="circular" viewBox='25 25 50 50'>
                        <circle className="path" cx='50' cy='50' r='20' fill='none' strokeWidth='6' strokeMiterlimit='10'
                        />
                    </svg>
                </div>
            </div>
        )
    }
}

export default Spinner;