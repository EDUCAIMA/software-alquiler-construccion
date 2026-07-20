import React, { useEffect, useState, useCallback } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'expo-router';

// Premium Color Palette
const COLORS = {
  primary: '#1a3a5c',
  secondary: '#4A90D9',
  accent: '#8ab4d9',
  background: '#0f2640',
  card: '#163352',
  white: '#FFFFFF',
  text: '#E6F4FE',
  textSecondary: '#A1CEDC',
  success: '#4ADE80',
  warning: '#FBBF24',
  danger: '#EF4444',
  border: 'rgba(255, 255, 255, 0.05)',
};

interface Task {
  id: string;
  clientId: string;
  obraId: string;
  fecha: string;
  estado: string;
  items: any[];
  notes?: string;
}

export default function OperatorDashboard() {
  const { user, logout, apiUrl } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'pendientes' | 'completadas'>('pendientes');

  const fetchAsignaciones = useCallback(async (showLoading = true) => {
    if (!user) return;
    if (showLoading) setIsLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/remisiones/mis-asignaciones?operarioId=${user.id}`);
      if (response.ok) {
        const data = await response.json();
        setTasks(data);
      }
    } catch (error) {
      console.error('Error cargando asignaciones:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [user, apiUrl]);

  useEffect(() => {
    fetchAsignaciones();
  }, [fetchAsignaciones]);

  const onRefresh = () => {
    setIsRefreshing(true);
    fetchAsignaciones(false);
  };

  const getPendingTasks = () => {
    return tasks.filter(t => t.estado === 'Activa' || t.estado === 'Pendiente');
  };

  const getCompletedTasks = () => {
    return tasks.filter(t => t.estado === 'Retornada' || t.estado === 'Devuelta' || t.estado === 'Finalizada' || t.estado === 'Entregada');
  };

  const currentTasks = activeTab === 'pendientes' ? getPendingTasks() : getCompletedTasks();

  const handleTaskPress = (taskId: string) => {
    router.push({
      pathname: '/remision/[id]',
      params: { id: taskId }
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[COLORS.primary, COLORS.background]}
        style={StyleSheet.absoluteFill}
      />
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greetingText}>Bienvenido,</Text>
          <Text style={styles.nameText}>{user?.name || 'Operario'}</Text>
        </View>
        <TouchableOpacity style={styles.logoutButton} onPress={logout}>
          <Ionicons name="log-out-outline" size={24} color={COLORS.danger} />
        </TouchableOpacity>
      </View>

      {/* Quick Action Cards */}
      <View style={styles.quickActionsGrid}>
        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => router.push('/scan')}
        >
          <View style={[styles.actionIconContainer, { backgroundColor: COLORS.secondary + '20' }]}>
            <Ionicons name="qr-code-outline" size={26} color={COLORS.secondary} />
          </View>
          <Text style={styles.actionTitle}>Escanear QR</Text>
          <Text style={styles.actionSubtitle}>Identificar máquina</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={styles.actionCard}
          onPress={() => router.push('/mantenimiento')}
        >
          <View style={[styles.actionIconContainer, { backgroundColor: COLORS.warning + '20' }]}>
            <Ionicons name="build-outline" size={26} color={COLORS.warning} />
          </View>
          <Text style={styles.actionTitle}>Reportar Daño</Text>
          <Text style={styles.actionSubtitle}>Entrada a Taller</Text>
        </TouchableOpacity>
      </View>

      {/* Tab bar */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'pendientes' && styles.tabButtonActive]}
          onPress={() => setActiveTab('pendientes')}
        >
          <Text style={[styles.tabText, activeTab === 'pendientes' && styles.tabTextActive]}>
            Pendientes ({getPendingTasks().length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'completadas' && styles.tabButtonActive]}
          onPress={() => setActiveTab('completadas')}
        >
          <Text style={[styles.tabText, activeTab === 'completadas' && styles.tabTextActive]}>
            Completadas ({getCompletedTasks().length})
          </Text>
        </TouchableOpacity>
      </View>

      {/* Task List */}
      {isLoading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.secondary} />
          <Text style={styles.loadingText}>Cargando asignaciones...</Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              tintColor={COLORS.secondary}
              colors={[COLORS.secondary]}
            />
          }
        >
          {currentTasks.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="clipboard-outline" size={60} color="rgba(230,244,254,0.15)" />
              <Text style={styles.emptyText}>No tienes tareas {activeTab}</Text>
              <Text style={styles.emptySubText}>Tira hacia abajo para actualizar la lista</Text>
            </View>
          ) : (
            currentTasks.map((task) => {
              const isReturn = task.estado.includes('Retorno') || task.estado === 'Activa'; // En base al estado
              const itemsCount = task.items.reduce((acc, it) => acc + (it.qty || it.cantidad || 0), 0);
              
              return (
                <TouchableOpacity
                  key={task.id}
                  style={styles.taskCard}
                  onPress={() => handleTaskPress(task.id)}
                >
                  {Platform.OS === 'ios' && (
                    <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
                  )}
                  <View style={styles.taskCardHeader}>
                    <View style={[styles.typeBadge, { backgroundColor: isReturn ? COLORS.warning + '20' : COLORS.success + '20' }]}>
                      <Ionicons 
                        name={isReturn ? 'arrow-down-circle-outline' : 'arrow-up-circle-outline'} 
                        size={16} 
                        color={isReturn ? COLORS.warning : COLORS.success} 
                      />
                      <Text style={[styles.typeBadgeText, { color: isReturn ? COLORS.warning : COLORS.success }]}>
                        {isReturn ? 'RETORNO (ENTRADA)' : 'DESPACHO (SALIDA)'}
                      </Text>
                    </View>
                    <Text style={styles.taskIdText}>#{task.id}</Text>
                  </View>

                  <View style={styles.taskCardBody}>
                    <View style={styles.infoRow}>
                      <Ionicons name="business-outline" size={18} color={COLORS.accent} />
                      <Text style={styles.infoText} numberOfLines={1}>Obra: {task.obraId}</Text>
                    </View>
                    <View style={styles.infoRow}>
                      <Ionicons name="cube-outline" size={18} color={COLORS.accent} />
                      <Text style={styles.infoText}>{itemsCount} herramientas a verificar</Text>
                    </View>
                  </View>

                  <View style={styles.taskCardFooter}>
                    <Text style={styles.taskDateText}>Fecha: {task.fecha}</Text>
                    <View style={styles.arrowContainer}>
                      <Text style={styles.startText}>Comenzar</Text>
                      <Ionicons name="chevron-forward" size={16} color={COLORS.secondary} />
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Platform.OS === 'android' ? 40 : 16,
    marginBottom: 24,
  },
  greetingText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  nameText: {
    color: COLORS.white,
    fontSize: 24,
    fontWeight: 'bold',
  },
  logoutButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 24,
  },
  actionCard: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  actionIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionTitle: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: 'bold',
  },
  actionSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabButtonActive: {
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  tabTextActive: {
    color: COLORS.white,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: COLORS.textSecondary,
    marginTop: 12,
    fontSize: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 16,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubText: {
    color: 'rgba(230, 244, 254, 0.4)',
    fontSize: 14,
    marginTop: 4,
  },
  taskCard: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(255,255,255,0.02)' : COLORS.card,
    borderRadius: 20,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  taskCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  taskIdText: {
    color: COLORS.textSecondary,
    fontWeight: 'bold',
    fontSize: 14,
  },
  taskCardBody: {
    gap: 8,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoText: {
    color: COLORS.text,
    fontSize: 15,
  },
  taskCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingTop: 12,
  },
  taskDateText: {
    color: 'rgba(230, 244, 254, 0.4)',
    fontSize: 13,
  },
  arrowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  startText: {
    color: COLORS.secondary,
    fontWeight: 'bold',
    fontSize: 14,
  },
});
