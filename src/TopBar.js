import React, { Component } from 'react';
import { get, set } from 'idb-keyval';

import {
    Space,
    Button,
    Popover,
    Menu,
    Dropdown,
} from 'antd';

import {
    MdFileDownload as IconDownload,
    MdSync as IconUpdate,
    MdExpandMore as IconCaret,
    MdModeEdit as IconEdit,
} from "react-icons/md";
import { IconContext } from "react-icons";

import { timeSince } from './utils.js'
import {
    TOPBAR_HEIGHT,
    IS_MOBILE,
    ENABLE_COMMENTS,
} from './constants'

import AboutModal from './AboutModal.js'

import { ReactComponent as IconComment } from './img/icons/newcomment.svg';

import './TopBar.css'


class TopBar extends Component {
    constructor(props) {
        super(props);

        this.openAboutModal = this.openAboutModal.bind(this);
        this.closeAboutModal = this.closeAboutModal.bind(this);

        this.state = {
            aboutModal: false
        };
    }

    openAboutModal() {
        this.setState({ aboutModal: true });
    }

    closeAboutModal() {
        this.setState({ aboutModal: false });
    }

    showCityPicker() {
        let body = document.querySelector('body');
        body.classList.add('show-city-picker');
        body.querySelector('.mapboxgl-ctrl-top-left .mapboxgl-ctrl-geocoder input').focus();
    }

    componentDidMount() {
        get('hasSeenWelcomeMsg')
                .then(data => {
                    if (!data) {
                        this.openAboutModal();
                        set('hasSeenWelcomeMsg', true);
                    }
                });
    }

    newComment() {
        document.dispatchEvent(new Event('newComment'));
    }

    handleMenuClick(e) {
        // message.info('Click on menu item.');
        console.log('click', e);
      }

    render() {
        const isProd = window.location.hostname === 'ciclomapa.org.br';

        let {
            title,
            lastUpdate,
            forceUpdate,
            downloadData,
            lat,
            lng,
            z,
        } = this.props;
        
        const parts = title.split(',');
        const city = parts[0], 
            state = parts[1];
            // country = parts[2];
        let updatedAtStr;

        if (lastUpdate) {
            updatedAtStr = lastUpdate.toLocaleString('pt-BR');
        }

        // Compensate different zoom levels from Mapbox to OSM Editor
        z = Math.ceil(z) + 1;

        const menu = (
            <Menu onClick={this.handleMenuClick}>
                <Menu.Item key="1" icon={<IconDownload />}>
                    Download
              </Menu.Item>
                <Menu.Item key="2" icon={<IconEdit />}>
                    Edit
              </Menu.Item>
            </Menu>
        );

        return (
            <IconContext.Provider value={{ className: 'react-icon' }}>
                <div
                    id="topbar"
                    className="w-full z-10 absolute flex flex-col"
                    style={{height: TOPBAR_HEIGHT}}
                >
                    {
                        !isProd &&
                        <div className="flex w-full bg-yellow-400 text-black items-center justify-center text-center text-xs mb-2 py-1">
                            Você está em um <b className="ml-1">ambiente de teste</b>. Pode futricar à vontade! ;)
                        </div>
                    }

                    <div className="flex items-start justify-between px-6 py-3 text-white">
                        <div className="text-2xl uppercase text-green-300 mt-1 hidden sm:block" style={{
                            fontFamily: 'Teko, sans-serif',
                        }}>
                            CicloMapa
                        </div>

                        <div className="city-picker">
                            <Space size={4} direction="vertical" align="center">
                                <Button
                                    size={IS_MOBILE ? 'default' : 'large'}
                                    onClick={this.showCityPicker}
                                >
                                    <h3 className="text-lg">
                                        <span className="mr-3">
                                            <span className="font-bold">
                                                {city},
                                            </span>

                                            {state}
                                        </span>

                                        <IconCaret className="text-green-600"/>
                                    </h3>
                                </Button>

                                {
                                    lastUpdate &&
                                    <Popover
                                        className="hidden sm:block"
                                        placement="bottom"
                                        content={(
                                            <div style={{ maxWidth: 250 }}>
                                                <Space size="small" direction="vertical" >
                                                    <div>
                                                        O mapa que você está vendo é uma cópia dos dados obtidos do OpenStreetMap em <b>{updatedAtStr}</b>.
                                                    </div> 

                                                    <Button
                                                        size="small"
                                                        icon={<IconUpdate />}
                                                        ghost
                                                        onClick={forceUpdate}
                                                    >
                                                        Atualizar
                                                    </Button>
                                                </Space>
                                            </div>
                                        )}
                                        arrowPointAtCenter={true}
                                    >
                                        <span className="font-regular cursor-default text-xs opacity-25 hover:opacity-100 transition-opacity duration-300">
                                            Atualizado há <b>{timeSince(lastUpdate)}</b>.
                                        </span>
                                        {/* <IconInfo style={{ fontSize: '12px', marginLeft: '4px' }} /> */}
                                    </Popover>

                                }
                            </Space>
                        </div>
                        
                        <div className="nav-links font-white hidden sm:block">
                            <Button
                                size="large"
                                type="link"
                                onClick={this.openAboutModal}
                            >
                                Sobre
                            </Button>

                            {
                                ENABLE_COMMENTS &&
                                <Button ghost onClick={this.newComment}>
                                    <IconComment className="react-icon" /> Comentar
                                </Button>
                            }

                            <Button ghost > 
                                <a target="_BLANK" rel="noopener noreferrer"
                                    href={`https://www.openstreetmap.org/edit#map=${z}/${lat}/${lng}`}
                                >
                                    <IconEdit /> Editar
                                </a>
                            </Button>

                            <Button
                                ghost
                                onClick={downloadData}
                            >
                                <IconDownload /> Dados
                            </Button>

                            {/* <Dropdown overlay={menu}>
                                <Button ghost>
                                    <span className="mr-2"> Dados </span>
                                    <IconCaret className="text-green-600"/>
                                </Button>
                            </Dropdown> */}
                            
                        </div>
                    </div>

                </div>

                <AboutModal
                    visible={this.state.aboutModal}
                    onClose={this.closeAboutModal}
                />
            </IconContext.Provider>
        );
    }
}

export default TopBar;