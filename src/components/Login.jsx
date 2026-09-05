import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login = ({ onSwitchToRegister }) => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { login, backendAvailable } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await login(email, password);
      if (!result.success) {
        setError(result.error || 'Error al iniciar sesión');
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión');
      setLoading(false);
    }
  };

  return (
    <div className="login-container">

      {/* Partículas flotantes */}
      <div className="particles">
        {[...Array(18)].map((_, i) => (
          <div
            key={i}
            className="particle"
            style={{
              left: `${(i * 5.5 + Math.random() * 5) % 100}%`,
              width:  `${1 + (i % 3)}px`,
              height: `${1 + (i % 3)}px`,
              animationDelay:    `${(i * 0.7) % 8}s`,
              animationDuration: `${8 + (i % 6)}s`,
            }}
          />
        ))}
      </div>

      {/* Tarjeta */}
      <div className="login-card">

        {/* Header */}
        <div className="card-header">
          <h2 className="user-name">
            Juego de Programación<br />Multimedia e Ingeniería Web
          </h2>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="login-form">

          <div className="form-group" data-label="CORREO">
            <div className="input-wrapper">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="usuario@correo.com"
                required
                disabled={loading}
                className="modern-input"
              />
              <svg className="input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207" />
              </svg>
            </div>
          </div>

          <div className="form-group" data-label="CONTRASEÑA">
            <div className="input-wrapper">
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                disabled={loading}
                className="modern-input"
              />
              <svg className="input-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>

          {error && (
            <div className="error-message">
              <svg className="error-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {error}
            </div>
          )}

          <button
            type="submit"
            className={`login-button ${loading ? 'loading' : ''}`}
            disabled={loading}
          >
            {loading ? (
              <>
                <span className="spinner" />
                Autenticando...
              </>
            ) : (
              <>
                <span>Iniciar Sesión</span>
                <svg className="button-arrow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </>
            )}
          </button>
        </form>

        {/* Estado del backend */}
        {backendAvailable !== undefined && (
          <div className={`backend-status ${backendAvailable ? 'online' : 'offline'}`}>
            {backendAvailable
              ? '◉ SERVIDOR EN LÍNEA'
              : '◎ SERVIDOR OFFLINE — MODO LOCAL ACTIVO'}
          </div>
        )}

        {/* Footer */}
        <div className="card-footer">

          {/* Credenciales sin backend */}
          <div className="credentials-hint">
            <div className="credentials-hint-label">Acceso sin backend</div>
            <div className="credentials-hint-row">
              <span>EMAIL</span>
              <code>admin@admin.com</code>
            </div>
            <div className="credentials-hint-row">
              <span>PASS</span>
              <code>secret</code>
            </div>
          </div>

          <div className="switch-form">
            <span>¿No tienes cuenta?</span>
            <button
              type="button"
              onClick={onSwitchToRegister}
              className="switch-button"
              disabled={loading}
            >
              Registrarse
            </button>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Login;