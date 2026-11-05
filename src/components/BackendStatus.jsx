import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Indicador del estado del backend para las pantallas de login y registro.
 * - checking: el servidor (Render free) puede estar despertando, se reintenta hasta ~60 s.
 * - online / offline: resultado final de la comprobación.
 * Los estilos (.auth-status*) viven en Auth.css.
 *
 * @param {{ variant: 'login' | 'register' }} props
 */
const BackendStatus = ({ variant = 'login' }) => {
  const { backendStatus, checkStartedAt, skipBackendWait, retryBackendCheck } = useAuth();
  const [elapsed, setElapsed] = useState(0);

  // Segundos transcurridos mientras se espera al servidor
  useEffect(() => {
    if (backendStatus !== 'checking') return undefined;
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - checkStartedAt) / 1000)));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [backendStatus, checkStartedAt]);

  if (backendStatus === 'checking') {
    return (
      <div className="auth-status checking" role="status" aria-live="polite">
        <div className="auth-status-line">
          <span className="auth-status-spinner" aria-hidden="true" />
          <span>Despertando el servidor… puede tardar hasta un minuto</span>
        </div>
        <div className="auth-status-sub">Esperando respuesta · {elapsed} s</div>
        {variant === 'login' && (
          <button type="button" className="auth-status-action" onClick={skipBackendWait}>
            Omitir espera y usar modo offline
          </button>
        )}
      </div>
    );
  }

  const online = backendStatus === 'online';
  let text;
  if (variant === 'register') {
    text = online
      ? 'Backend conectado: registro disponible'
      : 'Backend no disponible: registro no disponible';
  } else {
    text = online
      ? 'Servidor en línea'
      : 'Servidor sin conexión: modo local activo';
  }

  return (
    <div className={`auth-status ${online ? 'online' : 'offline'}`} role="status" aria-live="polite">
      <div className="auth-status-line">
        <span className="auth-status-dot" aria-hidden="true" />
        <span>{text}</span>
      </div>
      {!online && (
        <button type="button" className="auth-status-action" onClick={retryBackendCheck}>
          Reintentar conexión
        </button>
      )}
    </div>
  );
};

export default BackendStatus;
