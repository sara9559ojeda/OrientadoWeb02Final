import './LoadingScreen.css';

const LoadingScreen = ({ progress = 0 }) => {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-logo">
          <div className="spinner"></div>
        </div>
        <h2 className="loading-title">Cargando juego...</h2>
        <p className="loading-subtitle">Preparando el mundo 3D</p>
        <div className="loading-bar-container">
          <div className="loading-bar" style={{ width: `${progress}%` }}></div>
        </div>
        <p className="loading-percentage">{Math.round(progress)}%</p>
      </div>
    </div>
  );
};

export default LoadingScreen;

