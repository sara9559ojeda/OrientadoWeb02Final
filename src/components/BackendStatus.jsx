import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Indicador del estado del backend para las pantallas de login y registro.
 * - checking: el servidor (Render free) puede estar despertando, se reintenta hasta ~60 s.
 * - online / offline: resultado final de la comprobación.
 * Los estilos (.backend-status*) viven en Login.css y Register.css.
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
      <div className="backend-status checking" role="status" aria-live="polite">
        <div className="backend-status-line">
          <span className="backend-status-spinner" aria-hidden="true" />
          <span>Despertando el servidor… puede tardar hasta un minuto</span>
        </div>
        <div className="backend-status-sub">Esperando respuesta · {elapsed} s</div>
        {variant === 'login' && (
          <button type="button" className="backend-status-action" onClick={skipBackendWait}>
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
      ? '◉ BACKEND CONECTADO — REGISTRO DISPONIBLE'
      : '◎ BACKEND NO DISPONIBLE — REGISTRO NO DISPONIBLE';
  } else {
    text = online
      ? '◉ SERVIDOR EN LÍNEA'
      : '◎ SERVIDOR OFFLINE — MODO LOCAL ACTIVO';
  }

  return (
    <div className={`backend-status ${online ? 'online' : 'offline'}`} role="status" aria-live="polite">
      <div>{text}</div>
      {!online && (
        <button type="button" className="backend-status-action" onClick={retryBackendCheck}>
          Reintentar conexión
        </button>
      )}
    </div>
  );
};

export default BackendStatus;
