import React, { useState, useEffect } from 'react';
import './Modal.css';

const Modal = ({ isOpen, onClose, city }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [data, setData] = useState(null);

  useEffect(() => {
    if (isOpen && city) {
      setIsLoading(true);
      loadData(city)
        .then((data) => {
          setData(data);
          setIsLoading(false);
        })
        .catch((error) => {
          console.error(error);
          setIsLoading(false);
        });
    }
  }, [isOpen, city]);

  const handleCancel = () => {
    setCancelLoading(true);
    // Implement cancellation logic here
    onClose();
  };

  return (
    <div className="modal" style={{ display: isOpen ? 'block' : 'none' }}>
      <div className="modal-content">
        <div className="modal-header">
          <span className="close" onClick={onClose}>&times;</span>
          <h2>Carregando dados de {city}</h2>
        </div>
        <div className="modal-body">
          {isLoading ? (
            <p>Carregando...</p>
          ) : (
            <div>
              {data && (
                <div>
                  <h3>Dados carregados com sucesso!</h3>
                  <pre>{JSON.stringify(data, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="cancel-button" onClick={handleCancel} disabled={cancelLoading}>Cancelar</button>
        </div>
      </div>
    </div>
  );
};

export default Modal;