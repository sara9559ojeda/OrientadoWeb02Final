import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthLayout from './AuthLayout';
import BackendStatus from './BackendStatus';

const Login = ({ onSwitchToRegister }) => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const { login, backendStatus } = useAuth();

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
    <AuthLayout
      title="Recoge las monedas, evita los enemigos"
      subtitle="Juego de Programación Multimedia e Ingeniería Web"
      below={
        // Credenciales del modo sin backend (puerta trasera local)
        <div className="auth-hint">
          <span className="auth-hint-label">Acceso sin backend</span>
          <span>Correo <code>admin@admin.com</code></span>
          <span>Contraseña <code>secret</code></span>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="auth-form">

        <div className="auth-field">
          <label htmlFor="email" className="sr-only">Correo electrónico</label>
          <svg className="auth-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
              d="M3 7.5A2.5 2.5 0 015.5 5h13A2.5 2.5 0 0121 7.5v9a2.5 2.5 0 01-2.5 2.5h-13A2.5 2.5 0 013 16.5v-9zm0 .5l9 6 9-6" />
          </svg>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Ingresa tu correo electrónico"
            autoComplete="email"
            required
            disabled={loading}
            className="auth-input"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password" className="sr-only">Contraseña</label>
          <svg className="auth-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
              d="M7 11V8a5 5 0 0110 0v3m-11 0h12a1 1 0 011 1v7a1 1 0 01-1 1H6a1 1 0 01-1-1v-7a1 1 0 011-1z" />
          </svg>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña"
            autoComplete="current-password"
            required
            disabled={loading}
            className="auth-input"
          />
        </div>

        {error && (
          <div className="auth-error" role="alert">
            <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        <button type="submit" className="auth-button" disabled={loading}>
          {loading ? (
            <>
              <span className="auth-spinner" aria-hidden="true" />
              {backendStatus === 'checking' ? 'Despertando servidor...' : 'Autenticando...'}
            </>
          ) : (
            'Iniciar sesión'
          )}
        </button>
      </form>

      {/* Estado del backend (con aviso de "despertando" mientras Render arranca) */}
      <BackendStatus variant="login" />

      <p className="auth-switch">
        ¿No tienes cuenta?{' '}
        <button
          type="button"
          onClick={onSwitchToRegister}
          className="auth-link"
          disabled={loading}
        >
          Regístrate
        </button>
      </p>
    </AuthLayout>
  );
};

export default Login;
