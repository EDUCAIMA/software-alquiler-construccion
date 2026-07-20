import { useEffect } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { safeStorage } from '../utils/storage';
import { API_URL } from '../context/AuthContext';

export function useOfflineSync() {
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isInternetReachable puede ser nulo inicialmente en simuladores, por lo que usamos isConnected
      if (state.isConnected) {
        console.log('📶 Conexión detectada. Iniciando sincronización de datos locales...');
        syncOfflineData();
      }
    });

    return () => unsubscribe();
  }, []);

  const syncOfflineData = async () => {
    await syncRemisiones();
    await syncMantenimientos();
  };

  const syncRemisiones = async () => {
    try {
      const queueStr = await safeStorage.getItem('@offline_sync_queue');
      if (!queueStr) return;

      const queue = JSON.parse(queueStr);
      if (queue.length === 0) return;

      console.log(`📶 Sincronizando ${queue.length} remisiones pendientes offline...`);
      const failedItems = [];

      for (const item of queue) {
        try {
          const res = await fetch(`${API_URL}/api/remisiones/${item.id}/evidencia`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload),
          });

          if (!res.ok) {
            throw new Error('Fallo al subir evidencia');
          }
          console.log(`✅ Remisión ${item.id} sincronizada correctamente.`);
        } catch (e) {
          console.error(`❌ Error sincronizando remisión ${item.id}:`, e);
          failedItems.push(item);
        }
      }

      await safeStorage.setItem('@offline_sync_queue', JSON.stringify(failedItems));
    } catch (error) {
      console.error('Error sincronizando remisiones offline:', error);
    }
  };

  const syncMantenimientos = async () => {
    try {
      const queueStr = await safeStorage.getItem('@offline_maint_queue');
      if (!queueStr) return;

      const queue = JSON.parse(queueStr);
      if (queue.length === 0) return;

      console.log(`📶 Sincronizando ${queue.length} reportes de mantenimiento offline...`);
      const failedItems = [];

      for (const item of queue) {
        try {
          const res = await fetch(`${API_URL}/api/maintenances`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(item.payload),
          });

          if (!res.ok) {
            throw new Error('Fallo al reportar mantenimiento');
          }
          console.log(`✅ Reporte de mantenimiento ${item.id} sincronizado.`);
        } catch (e) {
          console.error(`❌ Error sincronizando reporte ${item.id}:`, e);
          failedItems.push(item);
        }
      }

      await safeStorage.setItem('@offline_maint_queue', JSON.stringify(failedItems));
    } catch (error) {
      console.error('Error sincronizando mantenimientos offline:', error);
    }
  };
}
