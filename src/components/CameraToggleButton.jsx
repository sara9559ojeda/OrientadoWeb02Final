import { useCallback, useEffect, useState } from 'react';
import './CameraToggleButton.css';

const CameraToggleButton = ({ experience }) => {
  const [isThirdPerson, setIsThirdPerson] = useState(true);

  const toggleCamera = useCallback(() => {
    if (experience && experience.toggleWalkMode) {
      experience.toggleWalkMode();
      // Actualizar estado después de un pequeño delay para asegurar que se actualizó
      setTimeout(() => {
        if (experience.isThirdPerson !== undefined) {
          setIsThirdPerson(experience.isThirdPerson);
        }
      }, 100);
    }
  }, [experience]);

  useEffect(() => {
    if (!experience) return;

    // Actualizar estado cuando cambie la cámara
    const checkCameraMode = () => {
      if (experience.isThirdPerson !== undefined) {
        setIsThirdPerson(experience.isThirdPerson);
      }
    };

    // Verificar estado inicial
    checkCameraMode();

    // Listener para la tecla "5"
    const handleKeyPress = (event) => {
      // Solo activar si no está escribiendo en un input
      if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
        return;
      }
      
      if (event.key === '5' || event.code === 'Digit5') {
        event.preventDefault();
        toggleCamera();
      }
    };

    window.addEventListener('keydown', handleKeyPress);

    // Verificar periódicamente el estado (por si cambia desde otro lugar)
    const interval = setInterval(checkCameraMode, 500);

    return () => {
      window.removeEventListener('keydown', handleKeyPress);
      clearInterval(interval);
    };
  }, [experience, toggleCamera]);

  if (!experience) return null;

  return (
    <button
      className="camera-toggle-button"
      onClick={toggleCamera}
      title={`Cambiar cámara (Tecla 5)\n${isThirdPerson ? 'Tercera persona' : 'Vista global'}`}
      aria-label="Cambiar cámara"
    >
      <span className="camera-icon">
        {isThirdPerson ? '👁️' : '🌐'}
      </span>
      <span className="camera-text">
        {isThirdPerson ? '3ra Persona' : 'Vista Global'}
      </span>
      <span className="camera-hint">(5)</span>
    </button>
  );
};

export default CameraToggleButton;

