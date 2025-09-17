import React, { Component } from 'react';

import {
    Space,
    Button,
    Popover,
    Menu,
    Dropdown,
} from 'antd';

import {
    // MdFileDownload as IconDownload,
    // MdSync as IconUpdate,
    // MdExpandMore as IconCaret,
    // MdModeEdit as IconEdit,
    // MdAccessTime as IconInfo,
    MdDataUsage as IconAnalytics,
    // MdMap as IconMap,
} from "react-icons/md";
import {
    HiOutlineMap as IconMap,
    HiDownload as IconDownload,
    HiOutlineRefresh as IconUpdate,
    HiOutlineChevronDown as IconCaret,
    HiPencil as IconEdit,
    HiOutlineInformationCircle as IconInfo,
    // HiChartPie as IconAnalytics,
    HiOutlineOfficeBuilding as IconCity,
    HiChatAlt as IconComment,
    HiSun as IconSun,
    HiMoon as IconMoon,
} from "react-icons/hi"

import { IconContext } from "react-icons";

import {
    timeSince,
    getOsmUrl
} from './utils.js'

import {
    TOPBAR_HEIGHT,
    IS_MOBILE,
    ENABLE_COMMENTS,
} from './constants'

import EditModal from './EditModal.js'
import Logo from './Logo.js'

import './TopBar.css'


class TopBar extends Component {
    constructor(props) {
        super(props);

        this.openEditModal = this.openEditModal.bind(this);
        this.closeEditModal = this.closeEditModal.bind(this);
        this.onEditModalCheckboxChange = this.onEditModalCheckboxChange.bind(this);
        
        this.handleMenuClick = this.handleMenuClick.bind(this);

        this.state = {
            editModal: false,
            hasDismissedEditModal: false
        };
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


    render() {
        let {
            title,
            lastUpdate,
            forceUpdate,
            downloadData,
            embedMode,
            isDarkMode,
            toggleTheme
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
                    // ENABLE_COMMENTS &&
                    <Menu.Item key="comment" icon={<IconComment/>}>
                        Comentar
                    </Menu.Item>
                }
                <Menu.Item key="edit" icon={<IconEdit />}>
                    {
                        this.state.hasDismissedEditModal ?
                            <a
                                className="inline-block w-full hover:text-white"
                                target="_BLANK" rel="noopener noreferrer"
                                href={getOsmUrl(this.props.lat, this.props.lng, this.props.z)}
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
                    className="w-full absolute flex items-center px-2 sm:px-6 py-3"
                    style={{height: TOPBAR_HEIGHT, zIndex: 1}}
                >
                    <div className="flex items-center justify-between text-white w-full">
                        {
                            !IS_MOBILE &&
                            <a href="/" className={embedMode ? 'opacity-25' : ''}>
                                <Logo />
                            </a>
                        }

                        {
                            !embedMode && 
                            <div className={`city-picker sm:text-center ${IS_MOBILE && 'w-full'}`}>
                                <div className={`mb-1 sm:mb-1 ${IS_MOBILE && 'w-full'}`}>
                                    <Button
                                        block={IS_MOBILE}
                                        size={IS_MOBILE ? "large" : "middle"}
                                        onClick={this.showCityPicker}
                                    >
                                        <h3 className="flex items-center justify-between">
                                            <span className="mr-3">
                                                <span className="font-bold">
                                                    {city},
                                                </span>

                                                {state}
                                            </span>

                                            <IconCaret className="text-green-300"/>
                                        </h3>
                                    </Button>

                                    {
                                        !IS_MOBILE &&
                                        <Popover
                                            trigger={IS_MOBILE ? 'click' : 'hover'}
                                            placement="bottom"
                                            arrowPointAtCenter={true}
                                            content={(
                                                <div style={{ maxWidth: 250 }}>
                                                    <Space size="small" direction="vertical" >
                                                        {
                                                            lastUpdate &&
                                                            <div>
                                                                O mapa que você está vendo é uma cópia dos dados obtidos do OpenStreetMap há <b>{timeSince(lastUpdate)}</b> ({updatedAtStr}).
                                                            </div> 
                                                        }

                                                        <Button
                                                            size="small"
                                                            icon={<IconUpdate />}
                                                            type="primary"
                                                            block
                                                            onClick={forceUpdate}
                                                        >
                                                            Atualizar
                                                        </Button>
                                                    </Space>
                                                </div>
                                            )}
                                        >
                                            <span className="font-regular cursor text-xl pl-2 opacity-50 hover:opacity-100 transition-opacity duration-300">
                                                <IconInfo/>
                                            </span>
                                        </Popover>

                                    }
                                </div>
                            </div>
                        }

                        <div className="nav-links font-white">
                            {
                                !embedMode ? <div className="hidden sm:block">
                                    <Button type="link" className="" shape="circle" onClick={() => toggleTheme()}>
                                        {isDarkMode ? <IconSun /> : <IconMoon />}
                                    </Button>

                                    <Button className="ml-2"
                                        type="link"
                                        onClick={this.props.openAboutModal}
                                    >
                                        Sobre
                                    </Button>

                                    <Dropdown overlay={collaborateMenu}>
                                        <Button className="ml-2">
                                            <span className="mr-2"> Colaborar </span>
                                            <IconCaret className="text-green-300" />
                                        </Button>
                                    </Dropdown>
                                    
                                    <Button className="ml-2" onClick={downloadData}>
                                        <IconDownload /> Dados
                                    </Button>

                                    {
                                        !this.props.isSidebarOpen &&
                                        <Button className="ml-2" onClick={() => this.props.toggleSidebar(true)}>
                                            <IconAnalytics/> Métricas
                                        </Button>
                                    }
                                </div>
                                :
                                <Button target="_BLANK" href={window.location.href.replace(/&embed=true/g,'')}>
                                    <IconMap/> Ver mapa completo
                                </Button> 
                            }
                        </div>
                    </div>
                </div>

                <EditModal
                    visible={this.state.editModal}
                    lat={this.props.lat}
                    lng={this.props.lng}
                    z={this.props.z}
                    onClose={this.closeEditModal}
                    onCheckboxChange={this.onEditModalCheckboxChange}
                />
            </IconContext.Provider>
        );
    }
}

export default TopBar;