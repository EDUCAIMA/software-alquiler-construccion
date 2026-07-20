import { useEffect } from 'react';
import { Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { useOfflineSync } from '../hooks/useOfflineSync';

function NavigationGuard() {
  useOfflineSync(); // Inicia el servicio de sincronización offline
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === 'login';

    if (!user && !inAuthGroup) {
      // Redirigir a login si no hay sesión
      router.replace('/login');
    } else if (user && inAuthGroup) {
      // Redirigir a inicio si ya inició sesión
      router.replace('/');
    }
  }, [user, isLoading, segments]);

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="login" />
    </Stack>
  );
}

export default function RootLayout() {
  useEffect(() => {
    if (Platform.OS === 'web' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch((error) => {
          console.log('ServiceWorker registration failed: ', error);
        });
      });
    }
  }, []);

  return (
    <AuthProvider>
      <NavigationGuard />
      <StatusBar style="light" />
    </AuthProvider>
  );
}
