import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import AuthLayout from './AuthLayout';
import BackendStatus from './BackendStatus';

const Register = ({ onSwitchToLogin }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, backendStatus } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validar que las contraseñas coincidan
    if (password !== confirmPassword) {
      setError('Las contraseñas no coinciden');
      return;
    }

    // Validar longitud de contraseña
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }

    setLoading(true);

    try {
      const result = await register(email, password, name);

      if (!result.success) {
        setError(result.error || 'Error al registrar usuario');
        setLoading(false);
      }
    } catch (err) {
      setError(err.message || 'Error al registrar usuario');
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Crea tu cuenta" subtitle="Únete a la aventura">
      <form onSubmit={handleSubmit} className="auth-form">

        <div className="auth-field">
          <label htmlFor="name" className="sr-only">Nombre (opcional)</label>
          <svg className="auth-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
              d="M16 8a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Nombre (opcional)"
            autoComplete="name"
            disabled={loading}
            className="auth-input"
          />
        </div>

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
            placeholder="Correo electrónico"
            autoComplete="email"
            required
            disabled={loading}
            className="auth-input"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="password" className="sr-only">Contraseña (mínimo 6 caracteres)</label>
          <svg className="auth-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
              d="M7 11V8a5 5 0 0110 0v3m-11 0h12a1 1 0 011 1v7a1 1 0 01-1 1H6a1 1 0 01-1-1v-7a1 1 0 011-1z" />
          </svg>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Contraseña (mín. 6 caracteres)"
            autoComplete="new-password"
            required
            disabled={loading}
            className="auth-input"
          />
        </div>

        <div className="auth-field">
          <label htmlFor="confirmPassword" className="sr-only">Confirmar contraseña</label>
          <svg className="auth-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.6}
              d="M9 12l2 2 4-4m5-1.5c0 5.2-3.4 8.9-8 10-4.6-1.1-8-4.8-8-10V6l8-3 8 3v2.5z" />
          </svg>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirmar contraseña"
            autoComplete="new-password"
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
              {backendStatus === 'checking' ? 'Despertando servidor...' : 'Creando cuenta...'}
            </>
          ) : (
            'Crear cuenta'
          )}
        </button>
      </form>

      {/* Estado del backend (con aviso de "despertando" mientras Render arranca) */}
      <BackendStatus variant="register" />

      <p className="auth-switch">
        ¿Ya tienes una cuenta?{' '}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="auth-link"
          disabled={loading}
        >
          Inicia sesión
        </button>
      </p>
    </AuthLayout>
  );
};

export default Register;
