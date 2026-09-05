// src/App.jsx
import { useEffect, useRef, useState } from 'react';
import CameraToggleButton from './components/CameraToggleButton';
import LoadingScreen from './components/LoadingScreen';
import Login from './components/Login';
import LogoutButton from './components/LogoutButton';
import Register from './components/Register';
import { useAuth } from './context/AuthContext';
import Experience from './Experience/Experience';

const App = () => {
  const canvasRef = useRef();
  const experienceRef = useRef(null);
  const { isAuthenticated, loading } = useAuth();
  const [showRegister, setShowRegister] = useState(false);
  const [experienceLoading, setExperienceLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [experienceReady, setExperienceReady] = useState(false);


  useEffect(() => {
    // Resetear showRegister cuando el usuario se desautentica
    if (!isAuthenticated) {
      setShowRegister(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    // Solo inicializar el juego si está autenticado Y el canvas está disponible
    if (isAuthenticated && canvasRef.current && !experienceRef.current) {
      // Pequeño delay para asegurar que el canvas esté completamente renderizado
      const timer = setTimeout(() => {
        if (canvasRef.current && !experienceRef.current) {
          console.log('🎮 Inicializando Experience - Usuario autenticado');
          setExperienceLoading(true);
          setLoadingProgress(0);
          
          try {
            experienceRef.current = new Experience(canvasRef.current);
            console.log('✅ Experience inicializado correctamente');
            setExperienceReady(true);
            
            // Escuchar el progreso de carga de recursos
            if (experienceRef.current?.resources) {
              const resources = experienceRef.current.resources;
              
              // Calcular progreso inicial
              const updateProgress = (loaded, toLoad) => {
                if (toLoad > 0) {
                  const progress = (loaded / toLoad) * 100;
                  setLoadingProgress(progress);
                }
              };
              
              // Escuchar cuando se carga un recurso (evento progress)
              resources.on('progress', (...args) => {
                const [loaded, toLoad] = args;
                updateProgress(loaded, toLoad);
              });
              
              // Escuchar cuando todos los recursos están listos
              resources.on('ready', () => {
                console.log('✅ Todos los recursos cargados');
                setLoadingProgress(100);
                // Pequeño delay para mostrar el 100% antes de ocultar
                setTimeout(() => {
                  setExperienceLoading(false);
                }, 500);
              });
              
              // Si ya están cargados, ocultar inmediatamente
              if (resources.loaded === resources.toLoad) {
                setLoadingProgress(100);
                setTimeout(() => {
                  setExperienceLoading(false);
                }, 500);
              } else {
                updateProgress(resources.loaded, resources.toLoad);
              }
            } else {
              // Si no hay recursos, ocultar después de un breve delay
              setTimeout(() => {
                setExperienceLoading(false);
              }, 1000);
            }
          } catch (error) {
            console.error('❌ Error al inicializar Experience:', error);
            experienceRef.current = null;
            setExperienceLoading(false);
          }
        }
      }, 100);

      return () => clearTimeout(timer);
    }

    // Si el usuario se desautentica, destruir el Experience
    if (!isAuthenticated && experienceRef.current) {
      console.log('🚪 Usuario desautenticado, limpiando Experience');
      setExperienceLoading(false);
      setExperienceReady(false);
      // Limpiar el Experience si tiene método de destrucción
      if (experienceRef.current.destroy) {
        try {
          experienceRef.current.destroy();
        } catch (error) {
          console.error('Error al destruir Experience:', error);
        }
      }
      experienceRef.current = null;
    }
  }, [isAuthenticated]);

  // Mostrar loading mientras se verifica la autenticación
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        background: 'linear-gradient(135deg, #0ea5e9 0%, #10b981 100%)',
        color: 'white',
        fontSize: '1.2rem'
      }}>
        Cargando...
      </div>
    );
  }

  // SIEMPRE mostrar login primero si no está autenticado
  // El juego SOLO se muestra si el usuario está autenticado
  if (!isAuthenticated) {
    // Si el usuario quiere ver el registro, mostrarlo
    if (showRegister) {
      return <Register onSwitchToLogin={() => setShowRegister(false)} />;
    }
    // Por defecto, siempre mostrar Login primero
    return <Login onSwitchToRegister={() => setShowRegister(true)} />;
  }

  // SOLO mostrar el juego si el usuario está autenticado
  // Si llegamos aquí, el usuario está autenticado
  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {experienceLoading && <LoadingScreen progress={loadingProgress} />}
      <LogoutButton />
      {experienceReady && <CameraToggleButton experience={experienceRef.current} />}
      <canvas 
        ref={canvasRef} 
        className="webgl" 
        style={{ 
          display: 'block', 
          width: '100%', 
          height: '100%',
          position: 'fixed',
          top: 0,
          left: 0,
          zIndex: 1
        }} 
      />
    </div>
  );
};

export default App;
