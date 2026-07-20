import React, { createContext, useContext, useState, useEffect } from 'react';
import { safeStorage } from '../utils/storage';

export interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  avatar?: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  apiUrl: string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Para simulador iOS en Mac, localhost:5001 funciona. Para Android emulador usar 10.0.2.2:5001.
// Si se despliega en producción, cambiar por la URL correspondiente.
export const API_URL = 'http://192.168.1.104:5001';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadStorageData = async () => {
      try {
        const jsonValue = await safeStorage.getItem('@cielo_user');
        if (jsonValue != null) {
          setUser(JSON.parse(jsonValue));
        }
      } catch (e) {
        console.error('Error al cargar datos del storage:', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadStorageData();
  }, []);

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return { success: false, error: errorData.error || 'Credenciales inválidas' };
      }

      const userData = await response.json();
      setUser(userData);
      await safeStorage.setItem('@cielo_user', JSON.stringify(userData));
      return { success: true };
    } catch (e: any) {
      console.error('Error en login request:', e);
      return { success: false, error: 'No se pudo conectar con el servidor' };
    }
  };

  const logout = async () => {
    try {
      setUser(null);
      await safeStorage.removeItem('@cielo_user');
    } catch (e) {
      console.error('Error al borrar sesión:', e);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, apiUrl: API_URL }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe usarse dentro de un AuthProvider');
  }
  return context;
};
