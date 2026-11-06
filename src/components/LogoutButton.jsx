import React from 'react';
import { useAuth } from '../context/AuthContext';
import './LogoutButton.css';

const LogoutButton = () => {
  const { logout, user } = useAuth();

  const handleLogout = () => {
    const ui = window.experience?.ui;
    if (ui) {
      ui.card({
        title: '¿Cerrar sesión?',
        text: 'Perderás el progreso de la partida en curso.',
        actions: [
          { label: 'Cerrar sesión', variant: 'danger', onClick: logout },
          { label: 'Seguir jugando', variant: 'ghost', onClick: () => {} },
        ],
      });
    } else if (window.confirm('¿Estás seguro de que quieres cerrar sesión?')) {
      logout();
    }
  };

  return (
    <div className="logout-container">
      {user && (
        <div className="user-info">
          <span className="user-email">{user.email}</span>
        </div>
      )}
      <button onClick={handleLogout} className="logout-button">
        Cerrar Sesión
      </button>
    </div>
  );
};

export default LogoutButton;

