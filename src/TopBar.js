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
    MdInfo as IconInfo,
} from "react-icons/md";
import { IconContext } from "react-icons";

import {
    timeSince
} from './utils.js'

import {
    TOPBAR_HEIGHT,
    IS_MOBILE,
    ENABLE_COMMENTS,
} from './constants'

import AboutModal from './AboutModal.js'
import EditModal from './EditModal.js'

import { ReactComponent as IconComment } from './img/icons/newcomment.svg';

import './TopBar.css'


class TopBar extends Component {
    constructor(props) {
        super(props);

        this.openAboutModal = this.openAboutModal.bind(this);
        this.closeAboutModal = this.closeAboutModal.bind(this);
        
        this.openEditModal = this.openEditModal.bind(this);
        this.closeEditModal = this.closeEditModal.bind(this);
        this.onEditModalCheckboxChange = this.onEditModalCheckboxChange.bind(this);
        
        this.handleMenuClick = this.handleMenuClick.bind(this);
        this.getOsmUrl = this.getOsmUrl.bind(this);

        this.state = {
            aboutModal: false,
            editModal: false,
            hasDismissedEditModal: false
        };
    }

    openAboutModal() {
        this.setState({ aboutModal: true });
    }

    closeAboutModal() {
        this.setState({ aboutModal: false });
    }

    openEditModal() {
        this.setState({ editModal: true });
    }

    closeEditModal() {
        this.setState({ editModal: false });
    }

    onEditModalCheckboxChange(e) {
        this.setState({
            hasDismissedEditModal: e.target.checked
        });
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
        if (e.key === 'comment') {
            this.newComment();
        }
        
        if (!this.state.hasDismissedEditModal && e.key === 'edit') {
            this.openEditModal();
        }
    }

    getOsmUrl() {
        let { lat, lng, z } = this.props;

        // Compensate different zoom levels from Mapbox to OSM Editor
        z = Math.ceil(z) + 1;

        return `https://www.openstreetmap.org/edit#map=${z}/${lat}/${lng}`;
    }

    render() {
        const isProd = window.location.hostname === 'ciclomapa.org.br';

        let {
            title,
            lastUpdate,
            forceUpdate,
            downloadData
        } = this.props;

        const parts = title.split(',');
        const city = parts[0], 
            state = parts[1];
            // country = parts[2];
        let updatedAtStr;

        if (lastUpdate) {
            updatedAtStr = lastUpdate.toLocaleString('pt-BR');
        }

        const collaborateMenu = (
            <Menu onClick={this.handleMenuClick}>
                {
                    ENABLE_COMMENTS &&
                    <Menu.Item key="comment" icon={<IconComment className="react-icon" />}>
                        Comentar
                    </Menu.Item>
                }
                <Menu.Item key="edit" icon={<IconEdit />}>
                    {
                        this.state.hasDismissedEditModal ?
                            <a
                                className="inline-block w-full hover:text-white"
                                target="_BLANK" rel="noopener noreferrer"
                                href={this.getOsmUrl()}
                            >
                                Editar no OSM
                            </a>
                            :
                            "Editar no OSM"
                    }
                </Menu.Item>
            </Menu>
        )

        return (
            <IconContext.Provider value={{ className: 'react-icon' }}>
                <div
                    id="topbar"
                    className="w-full absolute flex flex-col"
                    style={{height: TOPBAR_HEIGHT, zIndex: 1}}
                >
                    {
                        !isProd &&
                        <div className="flex w-full bg-yellow-400 text-black items-center justify-center text-center text-xs mb-2 py-1">
                            Você está em um <b className="ml-1">ambiente de teste</b>. Pode futricar à vontade! ;)
                        </div>
                    }

                    <div className="flex items-start justify-between px-6 py-3 text-white">
                        <div className="text-2xl uppercase text-green-300 hidden sm:block" style={{
                            fontFamily: 'Teko, sans-serif',
                        }}>
                            CicloMapa
                        </div>

                        <div className="city-picker sm:text-center">
                            <div className="mb-1 sm:mb-1">
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
                            </div>

                            <div>
                                {
                                    lastUpdate &&
                                    <Popover
                                        trigger={IS_MOBILE ? 'click' : 'hover'}
                                        placement="bottom"
                                        arrowPointAtCenter={true}
                                        content={(
                                            <div style={{ maxWidth: 250 }}>
                                                <Space size="small" direction="vertical" >
                                                    <div>
                                                        O mapa que você está vendo é uma cópia dos dados obtidos do OpenStreetMap em <b>{updatedAtStr}</b>.
                                                    </div> 

                                                    <Button
                                                        size="small"
                                                        icon={<IconUpdate />}
                                                        block
                                                        ghost
                                                        onClick={forceUpdate}
                                                    >
                                                        Atualizar
                                                    </Button>
                                                </Space>
                                            </div>
                                        )}
                                    >
                                        <span className="font-regular cursor-default text-xs opacity-25 hover:opacity-100 transition-opacity duration-300">
                                            Atualizado há <b>{timeSince(lastUpdate)}</b> <IconInfo/>
                                        </span>
                                    </Popover>

                                }
                            </div>
                        </div>
                        
                        <div className="nav-links font-white hidden sm:block">
                            <Button
                                type="link"
                                onClick={this.openAboutModal}
                            >
                                Sobre
                            </Button>

                            <Button
                                ghost
                                onClick={downloadData}
                            >
                                <IconDownload /> Dados
                            </Button>

                            <Dropdown overlay={collaborateMenu}>
                                <Button ghost>
                                    <span className="mr-2"> Colaborar </span>
                                    <IconCaret className="text-green-600" />
                                </Button>
                            </Dropdown>

                        </div>
                    </div>

                </div>

                <AboutModal
                    visible={this.state.aboutModal}
                    onClose={this.closeAboutModal}
                />

                <EditModal
                    visible={this.state.editModal}
                    getOsmUrl={this.getOsmUrl}
                    onClose={this.closeEditModal}
                    onCheckboxChange={this.onEditModalCheckboxChange}
                />
            </IconContext.Provider>
        );
    }
}

export default TopBar;