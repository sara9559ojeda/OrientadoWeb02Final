import './LoadingScreen.css';

const LoadingScreen = ({ progress = 0 }) => {
  return (
    <div className="loading-screen">
      <div className="loading-content">
        <div className="loading-logo">
          <div className="spinner"></div>
        </div>
        <h2 className="loading-title">Núcleo Perdido</h2>
        <p className="loading-subtitle">Preparando los mundos…</p>
        <div className="loading-bar-container">
          <div className="loading-bar" style={{ width: `${progress}%` }}></div>
        </div>
        <p className="loading-percentage">{Math.round(progress)}%</p>
      </div>
    </div>
  );
};

export default LoadingScreen;

