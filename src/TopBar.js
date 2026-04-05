import React, { useState, useCallback } from 'react';

import { Space, Button, Popover, Dropdown } from 'antd';

import {
  HiOutlineMap as IconMap,
  HiOutlineRefresh as IconUpdate,
  HiOutlineChevronDown as IconCaret,
  HiPencil as IconEdit,
  HiChatAlt as IconComment,
  HiSun as IconSun,
  HiMoon as IconMoon,
} from 'react-icons/hi';

import { IconContext } from 'react-icons';

import { useNavigate } from 'react-router-dom';

import { timeSince, getOsmUrl } from './utils/utils.js';

import { TOPBAR_HEIGHT, IS_MOBILE } from './config/constants.js';

import EditModal from './EditModal.js';
import Logo from './components/Logo';

import './TopBar.css';

function TopBar(props) {
  const {
    title,
    lastUpdate,
    forceUpdate,
    embedMode,
    isDarkMode,
    toggleTheme,
    loading,
    lat,
    lng,
    z,
    openAboutModal,
    isSidebarOpen,
    toggleSidebar,
  } = props;

  const navigate = useNavigate();

  const [editModal, setEditModal] = useState(false);
  const [hasDismissedEditModal, setHasDismissedEditModal] = useState(false);

  const openEditModal = useCallback(() => setEditModal(true), []);
  const closeEditModal = useCallback(() => setEditModal(false), []);
  const onEditModalCheckboxChange = useCallback((e) => {
    setHasDismissedEditModal(e.target.checked);
  }, []);

  const showCityPicker = useCallback(() => {
    navigate({ search: '?buscar' });
  }, [navigate]);

  const newComment = useCallback(() => {
    document.dispatchEvent(new Event('newComment'));
  }, []);

  const handleMenuClick = useCallback(
    (e) => {
      if (e.key === 'comment') {
        newComment();
      }
      if (!hasDismissedEditModal && e.key === 'edit') {
        openEditModal();
      }
    },
    [hasDismissedEditModal, newComment, openEditModal]
  );

  const parts = title.split(',');
  const city = parts[0];
  const state = parts[1];
  let updatedAtStr;
  if (lastUpdate) {
    updatedAtStr = lastUpdate.toLocaleString('pt-BR');
  }

  const collaborateMenu = {
    items: [
      {
        key: 'comment',
        icon: <IconComment />,
        label: 'Adicionar comentário',
      },
      {
        key: 'edit',
        icon: <IconEdit />,
        label: hasDismissedEditModal ? (
          <a
            className="inline-block w-full hover:text-white"
            target="_blank"
            rel="noopener noreferrer"
            href={getOsmUrl(lat, lng, z)}
          >
            Editar mapa
          </a>
        ) : (
          'Editar mapa'
        ),
      },
    ],
    onClick: handleMenuClick,
  };

  return (
    <IconContext.Provider value={{ className: 'react-icon' }}>
      <div
        id="topbar"
        className="w-full absolute flex px-2 sm:px-6 py-3"
        style={{ height: TOPBAR_HEIGHT, zIndex: 1 }}
      >
        <div className="flex items-start justify-between text-white w-full">
          {!IS_MOBILE && (
            <a href="/" className={'mt-2'}>
              <Logo className={embedMode ? 'text-white opacity-20' : 'text-xl'} />
            </a>
          )}

          {!embedMode && (
            <div className={`city-picker sm:text-center ${IS_MOBILE && 'w-full'}`}>
              <div className={`flex flex-col items-center sm:mb-1`}>
                <div className={`relative ${IS_MOBILE && 'w-full'} rounded-full overflow-hidden`}>
                  <Button
                    className="glass-bg"
                    block={IS_MOBILE}
                    size={IS_MOBILE ? 'large' : 'middle'}
                    onClick={showCityPicker}
                  >
                    <h2 className="flex items-center justify-between gap-1 m-0 sm:w-auto w-full">
                      <span>
                        <span className="font-bold">{city},</span>

                        {state}
                      </span>

                      <IconCaret className="text-green-300" style={{ marginRight: '-2px' }} />
                    </h2>
                  </Button>
                  {loading && (
                    <div className="loader-container h-1 absolute bottom-0 left-0 right-0">
                      <div className="progress-materializecss">
                        <div className="indeterminate"></div>
                      </div>
                    </div>
                  )}
                </div>

                {!IS_MOBILE &&
                  (!loading ? (
                    lastUpdate && (
                      <Popover
                        trigger={IS_MOBILE ? 'click' : 'hover'}
                        placement="bottom"
                        arrow={{ pointAtCenter: true }}
                        content={
                          <div style={{ maxWidth: 250 }}>
                            <Space size="small" orientation="vertical">
                              {lastUpdate && (
                                <div>
                                  O mapa de {city} que você está vendo é uma cópia dos dados obtidos
                                  do OpenStreetMap há <b>{timeSince(lastUpdate)}</b> ({updatedAtStr}
                                  ).
                                </div>
                              )}

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
                        }
                      >
                        <div className="flex flex-center items-center gap-1 font-regular cursor text-xs mt-1 opacity-50 hover:opacity-100 transition-opacity duration-300">
                          Atualizado há {timeSince(lastUpdate)}
                        </div>
                      </Popover>
                    )
                  ) : (
                    <div className="flex flex-center items-center gap-1 font-regular cursor text-xs mt-1 opacity-50 hover:opacity-100 transition-opacity duration-300">
                      Acessando dados do OpenStreetMap...
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="nav-links font-white">
            {!embedMode ? (
              <div className="hidden sm:flex gap-2 items-center">
                <Space.Compact className="glass-bg rounded-full overflow-hidden">
                  <Button
                    type={!isDarkMode ? 'default' : 'text'}
                    className={!isDarkMode ? 'border border-opacity-10 border-white' : 'opacity-50'}
                    shape="circle"
                    onClick={() => toggleTheme()}
                    aria-label="Usar tema claro"
                  >
                    <IconSun />
                  </Button>
                  <Button
                    type={isDarkMode ? 'default' : 'text'}
                    className={isDarkMode ? 'border border-opacity-10 border-white' : 'opacity-50'}
                    shape="circle"
                    onClick={() => toggleTheme()}
                    aria-label="Usar tema escuro"
                  >
                    <IconMoon />
                  </Button>
                </Space.Compact>

                <Button className="glass-bg" onClick={openAboutModal}>
                  Sobre
                </Button>

                <Dropdown menu={collaborateMenu}>
                  <Button className="glass-bg">
                    <span> Colaborar </span>
                    <IconCaret className="text-green-300" style={{ marginRight: '-3px' }} />
                  </Button>
                </Dropdown>

                {!isSidebarOpen && (
                  <Button className="glass-bg" onClick={() => toggleSidebar(true)}>
                    Métricas
                  </Button>
                )}
              </div>
            ) : (
              <Button target="_blank" href={window.location.href.replace(/&embed=true/g, '')}>
                <IconMap /> Ver mapa completo
              </Button>
            )}
          </div>
        </div>
      </div>

      <EditModal
        open={editModal}
        lat={lat}
        lng={lng}
        z={z}
        onClose={closeEditModal}
        onCheckboxChange={onEditModalCheckboxChange}
      />
    </IconContext.Provider>
  );
}

export default TopBar;
