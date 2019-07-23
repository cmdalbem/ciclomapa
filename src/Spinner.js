import React, { Component } from 'react';

import './Spinner.css'

class Spinner extends Component {
    render() {
        const parts = this.props.area.split(',');
        const city = parts[0],
            state = parts[1],
            country = parts[2];

        return (
            <div id="spinner" className="loader-container">
                <div className="loader">
                    {
                        this.props.error ?
                            <div>
                                <div style={{fontSize: '42px'}}>
                                    😓
                                </div>

                                <div className="content">
                                    <h2>
                                        Ops!
                                    </h2>

                                    <div>
                                        O OSM está mal humorado neste momento. Atualize a página para tentar denovo.
                                    </div>
                                </div>
                            </div>
                            :
                            <div>
                                <svg className="spinnersvg" viewBox='25 25 50 50'>
                                    <circle className="path" cx='50' cy='50' r='20' fill='none' strokeWidth='6' strokeMiterlimit='10'
                                    />
                                </svg>

                                <div className="content">
                                    <h2>
                                        Carregando mapa cicloviário de <b>{city}</b>.
                                    </h2>

                                    <div>
                                        Como é a primeira vez que você carrega esta cidade pode demorar um pouquinho :)
                                    </div>
                                </div>
                            </div>

                    }
                </div>

            </div>
        )
    }
}

export default Spinner;