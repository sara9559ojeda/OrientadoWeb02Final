import ThemeToggle from './ThemeToggle';
import './Auth.css';

/**
 * Estructura común de las pantallas de acceso (login y registro):
 * marca arriba a la izquierda, selector de tema a la derecha, titular centrado,
 * tarjeta con el formulario y un bloque opcional debajo de la tarjeta.
 *
 * @param {{ title: string, subtitle?: string, below?: import('react').ReactNode, children: import('react').ReactNode }} props
 */
const AuthLayout = ({ title, subtitle, below, children }) => (
  <div className="auth-page">
    <header className="auth-header">
      <div className="auth-brand">
        <svg className="auth-brand-mark" viewBox="0 0 24 24" fill="none" stroke="currentColor"
          strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M12 2.5 20.5 7v10L12 21.5 3.5 17V7z" />
          <path d="M3.5 7 12 11.5 20.5 7M12 11.5v10" />
        </svg>
        <span className="auth-brand-name">Juego 3D</span>
      </div>
      <ThemeToggle />
    </header>

    <main className="auth-main">
      <div className="auth-hero">
        <h1 className="auth-title">{title}</h1>
        {subtitle && <p className="auth-subtitle">{subtitle}</p>}
      </div>

      <div className="auth-card">{children}</div>

      {below}
    </main>
  </div>
);

export default AuthLayout;
