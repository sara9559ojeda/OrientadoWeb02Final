import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getToken, isBackendAvailable, isTokenValid, login, register, removeToken, saveToken } from '../services/authService';

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true); // Iniciar en true para verificar backend primero
  const [backendAvailable, setBackendAvailable] = useState(false);
  const [checkingBackend, setCheckingBackend] = useState(true);

  // Verificar disponibilidad del backend al iniciar
  useEffect(() => {
    const checkBackend = async () => {
      try {
        const available = await isBackendAvailable();
        setBackendAvailable(available);
        console.log(available ? '✅ Backend disponible' : '⚠️ Backend no disponible');
      } catch (error) {
        console.error('Error verificando backend:', error);
        setBackendAvailable(false);
      } finally {
        setCheckingBackend(false);
      }
    };
    
    checkBackend();
  }, []);

  // Validar token al iniciar y periódicamente
  useEffect(() => {
    if (checkingBackend) return; // Esperar a que termine la verificación del backend
    
    const validateToken = async () => {
      const savedToken = getToken();
      
      if (!savedToken) {
        setLoading(false);
        return;
      }
      
      // Validar token (permitir tanto JWT como backdoor)
      const requireJWT = false; // Permitir backdoor siempre
      const isValid = isTokenValid(savedToken, requireJWT);
      
      if (!isValid) {
        console.warn('⚠️ Token inválido o expirado, limpiando...');
        removeToken();
        setToken(null);
        setUser(null);
        setLoading(false);
        return;
      }
      
      // Token válido, mantener sesión
      setToken(savedToken);
      setLoading(false);
    };
    
    validateToken();
    
    // Validar token periódicamente cada 5 minutos
    const interval = setInterval(() => {
      const savedToken = getToken();
      if (savedToken) {
        const requireJWT = false; // Permitir backdoor siempre
        const isValid = isTokenValid(savedToken, requireJWT);
        if (!isValid) {
          console.warn('⚠️ Token expirado durante la sesión');
          removeToken();
          setToken(null);
          setUser(null);
        }
      }
    }, 5 * 60 * 1000); // 5 minutos
    
    return () => clearInterval(interval);
  }, [backendAvailable, checkingBackend]);

  const handleLogin = async (email, password) => {
    try {
      const response = await login(email, password);
      // Guardar token primero
      saveToken(response.token);
      // Luego actualizar el estado
      setToken(response.token);
      setUser(response.user);
      console.log('✅ Login exitoso, token establecido:', response.token.substring(0, 20) + '...');
      return { success: true };
    } catch (error) {
      console.error('Error en login:', error);
      return { 
        success: false, 
        error: error.message || 'Error al iniciar sesión' 
      };
    }
  };

  const handleRegister = async (email, password, name = '') => {
    try {
      const response = await register(email, password, name);
      // Guardar token primero
      saveToken(response.token);
      // Luego actualizar el estado
      setToken(response.token);
      setUser(response.user);
      console.log('✅ Registro exitoso, token establecido:', response.token.substring(0, 20) + '...');
      return { success: true };
    } catch (error) {
      console.error('Error en registro:', error);
      return { 
        success: false, 
        error: error.message || 'Error al registrar usuario' 
      };
    }
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    removeToken();
  };

  // Calcular isAuthenticated de manera más confiable
  const isAuthenticated = useMemo(() => {
    if (!token) {
      return false;
    }
    // Permitir tanto JWT como backdoor
    return isTokenValid(token, false);
  }, [token]);

  const value = {
    user,
    token,
    isAuthenticated,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    loading: loading || checkingBackend,
    backendAvailable,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

