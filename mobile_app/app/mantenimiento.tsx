import React, { useState, useEffect } from 'react';
import {
  SafeAreaView,
  StatusBar,
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  Image,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { safeStorage } from '../utils/storage';

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

interface Product {
  id: string;
  name: string;
  category: string;
}

export default function MantenimientoForm() {
  const { productId } = useLocalSearchParams();
  const router = useRouter();
  const { apiUrl } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [type, setType] = useState<'Correctivo' | 'Preventivo'>('Correctivo');
  const [description, setDescription] = useState('');
  const [fotoDano, setFotoDano] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    try {
      const res = await fetch(`${apiUrl}/api/products`);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
        if (productId) {
          setSelectedProductId(productId as string);
        } else if (data.length > 0) {
          setSelectedProductId(data[0].id);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsPageLoading(false);
    }
  };

  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert('Permiso Requerido', 'Necesitamos acceso a la cámara para registrar el daño.');
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
      setFotoDano(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSubmit = async () => {
    if (!selectedProductId) {
      Alert.alert('Error', 'Por favor selecciona un producto.');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Por favor ingresa la descripción del fallo.');
      return;
    }

    setIsLoading(true);

    const mId = 'M-' + Math.floor(1000 + Math.random() * 9000);
    const maintenanceData = {
      id: mId,
      productId: selectedProductId,
      type,
      description,
      status: 'Pendiente',
      date: new Date().toISOString().split('T')[0],
      cost: 0,
      foto: fotoDano
    };

    try {
      // Registrar mantenimiento en el backend
      const res = await fetch(`${apiUrl}/api/maintenances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(maintenanceData),
      });

      if (res.ok) {
        // Opcional: reducir 1 en disponible en la DB local si queremos bloquearlo
        const selectedProd = products.find(p => p.id === selectedProductId);
        if (selectedProd) {
          // Podemos llamar a PUT /api/products/:id para decrementar el disponible
          // await fetch(`${apiUrl}/api/products/${selectedProductId}`, { ... })
        }
        
        Alert.alert('✅ Reportado', 'El equipo ingresó a taller correctamente.');
        router.replace('/');
      } else {
        throw new Error('Error de servidor');
      }
    } catch (e) {
      console.log('Error de red. Guardando mantenimiento en cola local...', e);
      try {
        const queueStr = await safeStorage.getItem('@offline_maint_queue');
        const queue = queueStr ? JSON.parse(queueStr) : [];
        queue.push({
          id: mId,
          payload: maintenanceData,
          timestamp: new Date().toISOString()
        });
        await safeStorage.setItem('@offline_maint_queue', JSON.stringify(queue));
        Alert.alert('📶 Modo Offline', 'El reporte de taller se guardó localmente. Se sincronizará automáticamente.');
        router.replace('/');
      } catch (err) {
        Alert.alert('Error', 'No se pudo guardar localmente.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  if (isPageLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: COLORS.background }]}>
        <ActivityIndicator size="large" color={COLORS.secondary} />
      </View>
    );
  }

  const selectedProduct = products.find(p => p.id === selectedProductId);

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
        <Text style={styles.headerTitle}>Reportar Daño / Taller</Text>
        <View style={{ width: 44 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.formCard}>
          {/* Producto seleccionado */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Equipo / Máquina</Text>
            {productId ? (
              <View style={styles.preSelectedBox}>
                <Ionicons name="cube" size={20} color={COLORS.secondary} />
                <View style={{ marginLeft: 12 }}>
                  <Text style={styles.preSelectedText}>{selectedProduct?.name}</Text>
                  <Text style={styles.preSelectedId}>ID: {selectedProduct?.id}</Text>
                </View>
              </View>
            ) : (
              <View style={styles.pickerWrapper}>
                <Text style={styles.pickerPlaceholder}>Selecciona el equipo</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerScroll}>
                  {products.map(p => (
                    <TouchableOpacity
                      key={p.id}
                      style={[styles.pickerItem, selectedProductId === p.id && styles.pickerItemActive]}
                      onPress={() => setSelectedProductId(p.id)}
                    >
                      <Text style={[styles.pickerItemText, selectedProductId === p.id && styles.pickerItemTextActive]}>
                        {p.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            )}
          </View>

          {/* Tipo de Mantenimiento */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Tipo de Reporte</Text>
            <View style={styles.tabContainer}>
              <TouchableOpacity
                style={[styles.tabButton, type === 'Correctivo' && styles.tabButtonActive]}
                onPress={() => setType('Correctivo')}
              >
                <Ionicons name="alert-circle-outline" size={18} color={type === 'Correctivo' ? COLORS.white : COLORS.textSecondary} />
                <Text style={[styles.tabText, type === 'Correctivo' && styles.tabTextActive]}>Correctivo (Fallo)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tabButton, type === 'Preventivo' && styles.tabButtonActive]}
                onPress={() => setType('Preventivo')}
              >
                <Ionicons name="build-outline" size={18} color={type === 'Preventivo' ? COLORS.white : COLORS.textSecondary} />
                <Text style={[styles.tabText, type === 'Preventivo' && styles.tabTextActive]}>Preventivo (Ajuste)</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Descripción del Fallo */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Descripción del fallo / avería</Text>
            <TextInput
              style={styles.textArea}
              placeholder="Explica qué problema presenta la máquina (ej: motor no enciende, fuga de aceite, cables sueltos...)"
              placeholderTextColor="rgba(230, 244, 254, 0.3)"
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* Evidencia Fotográfica del Daño */}
          <View style={styles.inputContainer}>
            <Text style={styles.inputLabel}>Evidencia Fotográfica (Opcional)</Text>
            {fotoDano ? (
              <View style={styles.photoContainer}>
                <Image source={{ uri: fotoDano }} style={styles.photo} />
                <TouchableOpacity style={styles.removePhotoBtn} onPress={() => setFotoDano(null)}>
                  <Ionicons name="close-circle" size={26} color={COLORS.danger} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.addPhotoBtn} onPress={takePhoto}>
                <Ionicons name="camera-outline" size={32} color={COLORS.secondary} />
                <Text style={styles.addPhotoText}>Tomar Foto del Daño</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Botón de Envío */}
          <TouchableOpacity
            style={styles.submitButton}
            onPress={handleSubmit}
            disabled={isLoading}
          >
            <LinearGradient
              colors={[COLORS.secondary, '#3A7BC8']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={StyleSheet.absoluteFill}
            />
            {isLoading ? (
              <ActivityIndicator color={COLORS.white} />
            ) : (
              <View style={styles.buttonContent}>
                <Text style={styles.submitButtonText}>Reportar a Taller</Text>
                <Ionicons name="checkmark-circle-outline" size={20} color={COLORS.white} style={{ marginLeft: 8 }} />
              </View>
            )}
          </TouchableOpacity>
        </View>
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
    paddingBottom: 40,
  },
  formCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  inputContainer: {
    marginBottom: 24,
  },
  inputLabel: {
    color: COLORS.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  preSelectedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 14,
  },
  preSelectedText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  preSelectedId: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  pickerWrapper: {
    gap: 8,
  },
  pickerPlaceholder: {
    color: 'rgba(230, 244, 254, 0.4)',
    fontSize: 12,
  },
  pickerScroll: {
    gap: 10,
    paddingVertical: 4,
  },
  pickerItem: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickerItemActive: {
    borderColor: COLORS.secondary,
    backgroundColor: 'rgba(74, 144, 217, 0.15)',
  },
  pickerItemText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  pickerItemTextActive: {
    color: COLORS.secondary,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    padding: 4,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  tabButtonActive: {
    backgroundColor: COLORS.secondary,
  },
  tabText: {
    color: COLORS.textSecondary,
    fontWeight: '600',
    fontSize: 14,
  },
  tabTextActive: {
    color: COLORS.white,
  },
  textArea: {
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    color: COLORS.text,
    fontSize: 15,
    height: 120,
    textAlignVertical: 'top',
  },
  photoContainer: {
    position: 'relative',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  photo: {
    width: '100%',
    height: 200,
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 13,
  },
  addPhotoBtn: {
    height: 140,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: COLORS.secondary,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 144, 217, 0.05)',
  },
  addPhotoText: {
    color: COLORS.secondary,
    fontSize: 14,
    marginTop: 8,
    fontWeight: '600',
  },
  submitButton: {
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 12,
    overflow: 'hidden',
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
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
});
