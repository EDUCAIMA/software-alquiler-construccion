import React, { useEffect, useState, useRef } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
  PanResponder,
  GestureResponderEvent,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import Svg, { Path } from 'react-native-svg';
import { safeStorage } from '../../utils/storage';

const { width } = Dimensions.get('window');

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
  border: 'rgba(255, 255, 255, 0.08)',
};

interface RemisionItem {
  id?: string;
  productId?: string;
  name: string;
  qty: number;
  cantidad?: number;
  checked?: boolean;
  estadoRetorno?: 'bueno' | 'daniado' | 'sucio';
}

interface Remision {
  id: string;
  clientId: string;
  obraId: string;
  fecha: string;
  estado: string;
  items: RemisionItem[];
  fotosSalidaBodega?: string[];
  fotosEntregaCliente?: string[];
  fotosRetorno?: string[];
}

export default function RemisionDetail() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { apiUrl } = useAuth();
  
  const [remision, setRemision] = useState<Remision | null>(null);
  const [items, setItems] = useState<RemisionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Evidencias fotográficas (guardadas como Base64 para el prototipo/simulacion offline)
  const [fotosSalida, setFotosSalida] = useState<string[]>([]);
  const [fotosEntrega, setFotosEntrega] = useState<string[]>([]);
  const [fotosRetorno, setFotosRetorno] = useState<string[]>([]);

  // Firma Digital
  const [signaturePath, setSignaturePath] = useState<string>('');
  const [currentPath, setCurrentPath] = useState<string>('');
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    fetchDetail();
  }, [id]);

  const fetchDetail = async () => {
    setIsLoading(true);
    try {
      // Intentar obtener de la API
      const res = await fetch(`${apiUrl}/api/remisiones`);
      if (res.ok) {
        const data = await res.json();
        const found = data.find((r: any) => r.id === id);
        if (found) {
          setRemision(found);
          const mappedItems = (found.items || []).map((it: any) => ({
            ...it,
            checked: false,
            estadoRetorno: 'bueno',
          }));
          setItems(mappedItems);
          setFotosSalida(found.fotosSalidaBodega || []);
          setFotosEntrega(found.fotosEntregaCliente || []);
          setFotosRetorno(found.fotosRetorno || []);
        }
      }
    } catch (e) {
      console.error('Error al cargar detalle:', e);
      Alert.alert('Modo Offline', 'No se pudo conectar al servidor. Los datos se guardarán localmente al guardar.');
    } finally {
      setIsLoading(false);
    }
  };

  // --- Manejo de Cámara ---
  const takePhoto = async (type: 'salida' | 'entrega' | 'retorno') => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permiso Requerido', 'Necesitamos acceso a la cámara para tomar las fotos de evidencia.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets && result.assets[0].base64) {
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      if (type === 'salida') setFotosSalida([...fotosSalida, base64Image]);
      if (type === 'entrega') setFotosEntrega([...fotosEntrega, base64Image]);
      if (type === 'retorno') setFotosRetorno([...fotosRetorno, base64Image]);
    }
  };

  // --- Lienzo de Firma Digital ---
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt: GestureResponderEvent) => {
        setIsDrawing(true);
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath(`M ${locationX.toFixed(1)} ${locationY.toFixed(1)}`);
      },
      onPanResponderMove: (evt: GestureResponderEvent) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath((prev) => `${prev} L ${locationX.toFixed(1)} ${locationY.toFixed(1)}`);
      },
      onPanResponderRelease: () => {
        setIsDrawing(false);
        setSignaturePath((prev) => `${prev} ${currentPath}`);
        setCurrentPath('');
      },
    })
  ).current;

  const clearSignature = () => {
    setSignaturePath('');
    setCurrentPath('');
  };

  // --- Guardar Formulario ---
  const saveReport = async (nuevoEstado: string) => {
    if (!remision) return;

    // Validar fotos mínimas
    if (nuevoEstado === 'Entregada') {
      if (fotosSalida.length === 0) {
        Alert.alert('Falta Evidencia', 'Debes tomar al menos 1 foto del equipo saliendo de la bodega.');
        return;
      }
      if (fotosEntrega.length === 0) {
        Alert.alert('Falta Evidencia', 'Debes tomar al menos 1 foto de la entrega en la obra del cliente.');
        return;
      }
      if (!signaturePath) {
        Alert.alert('Falta Firma', 'El cliente debe firmar el recibido en el lienzo.');
        return;
      }
    } else if (nuevoEstado === 'Retornada') {
      if (fotosRetorno.length === 0) {
        Alert.alert('Falta Evidencia', 'Debes tomar al menos 1 foto del estado de las herramientas devueltas.');
        return;
      }
    }

    setIsLoading(true);

    const payload = {
      fotosSalidaBodega: fotosSalida,
      fotosEntregaCliente: fotosEntrega,
      fotosRetorno: fotosRetorno,
      fechaRetornoEfectiva: nuevoEstado === 'Retornada' ? new Date().toISOString() : null,
      estado: nuevoEstado,
      items: items.map(it => ({
        id: it.id || it.productId,
        name: it.name,
        qty: it.qty || it.cantidad || 0,
        estadoRetorno: it.estadoRetorno
      })),
      signature: signaturePath
    };

    try {
      // Intentar enviar a la API
      const res = await fetch(`${apiUrl}/api/remisiones/${id}/evidencia`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        Alert.alert('✅ Éxito', `Remisión marcada como ${nuevoEstado} correctamente.`);
        router.replace('/');
      } else {
        throw new Error('Error en el servidor');
      }
    } catch (e) {
      console.log('Fallo de red. Guardando en cola local...', e);
      // Guardar en cola offline
      try {
        const queueStr = await safeStorage.getItem('@offline_sync_queue');
        const queue = queueStr ? JSON.parse(queueStr) : [];
        queue.push({
          id,
          payload,
          timestamp: new Date().toISOString()
        });
        await safeStorage.setItem('@offline_sync_queue', JSON.stringify(queue));
        Alert.alert('📶 Modo Offline', 'Se guardó el reporte localmente. Se sincronizará automáticamente al detectar conexión.');
        router.replace('/');
      } catch (err) {
        Alert.alert('Error', 'No se pudo guardar localmente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const toggleItemChecked = (index: number) => {
    const updated = [...items];
    updated[index].checked = !updated[index].checked;
    setItems(updated);
  };

  const setItemEstadoRetorno = (index: number, val: 'bueno' | 'daniado' | 'sucio') => {
    const updated = [...items];
    updated[index].estadoRetorno = val;
    setItems(updated);
  };

  if (isLoading && !remision) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: COLORS.background }]}>
        <ActivityIndicator size="large" color={COLORS.secondary} />
      </View>
    );
  }

  if (!remision) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: COLORS.background }]}>
        <Text style={styles.errorText}>No se encontró la remisión.</Text>
      </View>
    );
  }

  const isPendingReturn = remision.estado === 'Activa' || remision.estado.includes('Retorno');

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={[COLORS.primary, COLORS.background]}
        style={StyleSheet.absoluteFill}
      />
      <StatusBar barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/')}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verificación de Remisión</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Info Card */}
        <View style={styles.infoCard}>
          <Text style={styles.remisionId}>Remisión #{remision.id}</Text>
          <Text style={styles.infoLabel}>Cliente: <Text style={styles.infoVal}>{remision.clientId}</Text></Text>
          <Text style={styles.infoLabel}>Obra: <Text style={styles.infoVal}>{remision.obraId}</Text></Text>
          <Text style={styles.infoLabel}>Estado: <Text style={[styles.statusText, { color: isPendingReturn ? COLORS.warning : COLORS.success }]}>{remision.estado}</Text></Text>
        </View>

        {/* Checklist */}
        <Text style={styles.sectionTitle}>Checklist de Equipos</Text>
        <View style={styles.cardContainer}>
          {items.map((item, idx) => (
            <View key={idx} style={styles.checkRow}>
              <TouchableOpacity
                style={[styles.checkbox, item.checked && styles.checkboxActive]}
                onPress={() => toggleItemChecked(idx)}
              >
                {item.checked && <Ionicons name="checkmark" size={16} color={COLORS.primary} />}
              </TouchableOpacity>
              
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={styles.itemName}>{item.name}</Text>
                <Text style={styles.itemQty}>Cantidad: {item.qty || item.cantidad || 0}</Text>

                {/* Si es retorno, permitir elegir estado de entrega */}
                {isPendingReturn && (
                  <View style={styles.estadoSelector}>
                    <TouchableOpacity
                      style={[styles.estadoBtn, item.estadoRetorno === 'bueno' && styles.estadoBtnActive]}
                      onPress={() => setItemEstadoRetorno(idx, 'bueno')}
                    >
                      <Text style={[styles.estadoBtnText, item.estadoRetorno === 'bueno' && styles.estadoBtnTextActive]}>Bueno</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.estadoBtn, item.estadoRetorno === 'daniado' && [styles.estadoBtnActive, { borderColor: COLORS.danger }]]}
                      onPress={() => setItemEstadoRetorno(idx, 'daniado')}
                    >
                      <Text style={[styles.estadoBtnText, item.estadoRetorno === 'daniado' && { color: COLORS.danger }]}>Dañado</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.estadoBtn, item.estadoRetorno === 'sucio' && [styles.estadoBtnActive, { borderColor: COLORS.warning }]]}
                      onPress={() => setItemEstadoRetorno(idx, 'sucio')}
                    >
                      <Text style={[styles.estadoBtnText, item.estadoRetorno === 'sucio' && { color: COLORS.warning }]}>Sucio</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            </View>
          ))}
        </View>

        {/* Módulo de Fotos */}
        <Text style={styles.sectionTitle}>Evidencias Fotográficas</Text>
        
        {!isPendingReturn ? (
          <>
            {/* Fotos Salida Bodega */}
            <View style={styles.evidenceSection}>
              <Text style={styles.evidenceLabel}>1. Salida de Bodega (Despacho)</Text>
              <View style={styles.photoGrid}>
                {fotosSalida.map((uri, idx) => (
                  <Image key={idx} source={{ uri }} style={styles.thumbnail} />
                ))}
                <TouchableOpacity style={styles.addPhotoBtn} onPress={() => takePhoto('salida')}>
                  <Ionicons name="camera-outline" size={28} color={COLORS.secondary} />
                  <Text style={styles.addPhotoText}>Tomar Foto</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Fotos Entrega Cliente */}
            <View style={styles.evidenceSection}>
              <Text style={styles.evidenceLabel}>2. Entrega en Obra (Firma de Recepción)</Text>
              <View style={styles.photoGrid}>
                {fotosEntrega.map((uri, idx) => (
                  <Image key={idx} source={{ uri }} style={styles.thumbnail} />
                ))}
                <TouchableOpacity style={styles.addPhotoBtn} onPress={() => takePhoto('entrega')}>
                  <Ionicons name="camera-outline" size={28} color={COLORS.secondary} />
                  <Text style={styles.addPhotoText}>Tomar Foto</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Firma del Cliente */}
            <Text style={styles.sectionTitle}>Firma del Cliente de Recibido</Text>
            <View style={styles.signatureContainer}>
              <View style={styles.signatureCanvas} {...panResponder.panHandlers}>
                <Svg style={StyleSheet.absoluteFill}>
                  <Path
                    d={signaturePath}
                    stroke={COLORS.white}
                    strokeWidth={3}
                    fill="none"
                  />
                  {currentPath ? (
                    <Path
                      d={currentPath}
                      stroke={COLORS.secondary}
                      strokeWidth={3}
                      fill="none"
                    />
                  ) : null}
                </Svg>
                {!signaturePath && !currentPath && (
                  <Text style={styles.canvasPlaceholder}>Firme aquí con el dedo</Text>
                )}
              </View>
              <TouchableOpacity style={styles.clearSignBtn} onPress={clearSignature}>
                <Ionicons name="trash-outline" size={16} color={COLORS.danger} />
                <Text style={styles.clearSignText}>Limpiar Firma</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          /* Fotos Retorno */
          <View style={styles.evidenceSection}>
            <Text style={styles.evidenceLabel}>Evidencia de Retorno / Estado de Equipos</Text>
            <View style={styles.photoGrid}>
              {fotosRetorno.map((uri, idx) => (
                <Image key={idx} source={{ uri }} style={styles.thumbnail} />
              ))}
              <TouchableOpacity style={styles.addPhotoBtn} onPress={() => takePhoto('retorno')}>
                <Ionicons name="camera-outline" size={28} color={COLORS.secondary} />
                <Text style={styles.addPhotoText}>Tomar Foto</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Botón de Acción Principal */}
        <TouchableOpacity
          style={styles.submitButton}
          onPress={() => saveReport(!isPendingReturn ? 'Entregada' : 'Retornada')}
        >
          <LinearGradient
            colors={!isPendingReturn ? [COLORS.success, '#10b981'] : [COLORS.warning, '#d97706']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <Text style={styles.submitButtonText}>
            {!isPendingReturn ? 'Confirmar Entrega (Despacho)' : 'Confirmar Retorno (Recepción)'}
          </Text>
        </TouchableOpacity>
      </ScrollView>
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
    marginBottom: 20,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: {
    paddingBottom: 60,
  },
  infoCard: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
  },
  remisionId: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  infoLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginBottom: 6,
  },
  infoVal: {
    color: COLORS.text,
    fontWeight: '600',
  },
  statusText: {
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  sectionTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  cardContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingVertical: 14,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: COLORS.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  checkboxActive: {
    backgroundColor: COLORS.secondary,
  },
  itemName: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  itemQty: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 2,
  },
  estadoSelector: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  estadoBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  estadoBtnActive: {
    borderColor: COLORS.secondary,
    backgroundColor: 'rgba(74, 144, 217, 0.15)',
  },
  estadoBtnText: {
    color: COLORS.textSecondary,
    fontSize: 12,
  },
  estadoBtnTextActive: {
    color: COLORS.secondary,
    fontWeight: 'bold',
  },
  evidenceSection: {
    marginBottom: 20,
  },
  evidenceLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  thumbnail: {
    width: (width - 64) / 3,
    height: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  addPhotoBtn: {
    width: (width - 64) / 3,
    height: 100,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.secondary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 144, 217, 0.05)',
  },
  addPhotoText: {
    color: COLORS.secondary,
    fontSize: 12,
    marginTop: 6,
    fontWeight: '600',
  },
  signatureContainer: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginBottom: 24,
  },
  signatureCanvas: {
    height: 180,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  canvasPlaceholder: {
    color: 'rgba(230, 244, 254, 0.25)',
    fontSize: 16,
    fontStyle: 'italic',
  },
  clearSignBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-end',
    marginTop: 10,
    padding: 6,
  },
  clearSignText: {
    color: COLORS.danger,
    fontSize: 13,
    marginLeft: 6,
    fontWeight: '600',
  },
  submitButton: {
    height: 54,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 16,
  },
});
