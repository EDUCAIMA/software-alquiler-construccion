import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  StatusBar,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useAuth } from '../context/AuthContext';

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
  border: 'rgba(255, 255, 255, 0.08)',
};

interface ScannedProduct {
  id: string;
  name: string;
  category: string;
  value: number;
  availableStock: number;
  totalStock: number;
}

export default function QRScanner() {
  const router = useRouter();
  const { apiUrl } = useAuth();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [product, setProduct] = useState<ScannedProduct | null>(null);

  useEffect(() => {
    if (!permission) {
      requestPermission();
    }
  }, [permission]);

  const handleBarcodeScanned = async ({ data }: { data: string }) => {
    if (scanned || isLoading) return;
    setScanned(true);
    setIsLoading(true);

    try {
      // data contiene el ID del producto (ej: 'P-101')
      const cleanId = data.trim();
      const res = await fetch(`${apiUrl}/api/products`);
      if (res.ok) {
        const productsList = await res.json();
        const found = productsList.find((p: any) => p.id === cleanId);
        
        if (found) {
          setProduct({
            id: found.id,
            name: found.name,
            category: found.category,
            value: Number(found.value),
            availableStock: found.availableStock,
            totalStock: found.totalStock,
          });
        } else {
          Alert.alert(
            'Código Desconocido',
            `El código QR escaneado (${cleanId}) no coincide con ningún producto registrado.`,
            [{ text: 'Escanear de nuevo', onPress: () => setScanned(false) }]
          );
        }
      } else {
        throw new Error('Error de conexión');
      }
    } catch (e) {
      console.error(e);
      Alert.alert(
        'Error',
        'No se pudo consultar el producto en el servidor.',
        [{ text: 'Aceptar', onPress: () => setScanned(false) }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!permission) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: COLORS.background }]}>
        <ActivityIndicator size="large" color={COLORS.secondary} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: COLORS.background, padding: 24 }]}>
        <TouchableOpacity 
          style={{ position: 'absolute', top: Platform.OS === 'ios' ? 60 : 40, left: 24, zIndex: 10 }} 
          onPress={() => router.replace('/')}
        >
          <Ionicons name="arrow-back" size={28} color={COLORS.white} />
        </TouchableOpacity>
        <Ionicons name="camera-reverse-outline" size={60} color={COLORS.accent} />
        <Text style={styles.permissionText}>Requerimos permisos de cámara para escanear los códigos QR de la maquinaria.</Text>
        <TouchableOpacity style={styles.permissionButton} onPress={requestPermission}>
          <Text style={styles.permissionButtonText}>Habilitar Cámara</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Header flotante */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.replace('/')}>
          <Ionicons name="arrow-back" size={24} color={COLORS.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Escáner de Bodega</Text>
        <View style={{ width: 44 }} />
      </View>

      {!product ? (
        <View style={styles.scannerWrapper}>
          <CameraView
            style={StyleSheet.absoluteFillObject}
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
          />
          {/* Capa de enfoque */}
          <View style={styles.overlay}>
            <Text style={styles.scanInstruction}>Apunta la cámara al código QR de la herramienta</Text>
            <View style={styles.scanTarget}>
              <View style={[styles.corner, styles.topLeft]} />
              <View style={[styles.corner, styles.topRight]} />
              <View style={[styles.corner, styles.bottomLeft]} />
              <View style={[styles.corner, styles.bottomRight]} />
              {isLoading && <ActivityIndicator size="large" color={COLORS.secondary} />}
            </View>
            <Text style={styles.scanTip}>Foco automático activo</Text>
          </View>
        </View>
      ) : (
        /* Detalle del Producto Encontrado */
        <View style={styles.resultContainer}>
          <LinearGradient
            colors={[COLORS.primary, COLORS.background]}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.productCard}>
            <View style={styles.iconWrapper}>
              <Ionicons name="cube-outline" size={40} color={COLORS.secondary} />
            </View>
            <Text style={styles.productName}>{product.name}</Text>
            <Text style={styles.productId}>ID: {product.id}</Text>
            
            <View style={styles.divider} />
            
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Categoría:</Text>
              <Text style={styles.detailVal}>{product.category}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Valor Alquiler:</Text>
              <Text style={styles.detailVal}>${product.value.toLocaleString()}/día</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Stock Disponible:</Text>
              <Text style={[styles.detailVal, { color: product.availableStock > 0 ? COLORS.success : '#EF4444' }]}>
                {product.availableStock} de {product.totalStock} unidades
              </Text>
            </View>

            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.maintenanceButton}
                onPress={() => {
                  router.push({
                    pathname: '/mantenimiento',
                    params: { productId: product.id }
                  });
                }}
              >
                <Ionicons name="build-outline" size={20} color={COLORS.white} />
                <Text style={styles.buttonText}>Reportar Daño / Taller</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.scanAgainButton}
                onPress={() => {
                  setProduct(null);
                  setScanned(false);
                }}
              >
                <Ionicons name="qr-code-outline" size={20} color={COLORS.secondary} />
                <Text style={[styles.buttonText, { color: COLORS.secondary }]}>Escanear Otro</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 60 : 40,
    left: 20,
    right: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: 'bold',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  scannerWrapper: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  scanInstruction: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 40,
    marginBottom: 40,
  },
  scanTarget: {
    width: width * 0.65,
    height: width * 0.65,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  scanTip: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 40,
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: COLORS.secondary,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 4,
    borderLeftWidth: 4,
    borderTopLeftRadius: 12,
  },
  topRight: {
    top: 0,
    right: 0,
    borderTopWidth: 4,
    borderRightWidth: 4,
    borderTopRightRadius: 12,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 4,
    borderLeftWidth: 4,
    borderBottomLeftRadius: 12,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 4,
    borderRightWidth: 4,
    borderBottomRightRadius: 12,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  permissionText: {
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontSize: 15,
    marginVertical: 20,
    lineHeight: 22,
  },
  permissionButton: {
    backgroundColor: COLORS.secondary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
  },
  permissionButtonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 16,
  },
  resultContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  productCard: {
    backgroundColor: COLORS.card,
    borderRadius: 24,
    padding: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
  },
  iconWrapper: {
    width: 72,
    height: 72,
    borderRadius: 18,
    backgroundColor: 'rgba(74, 144, 217, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(74, 144, 217, 0.3)',
  },
  productName: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  productId: {
    color: COLORS.textSecondary,
    fontSize: 14,
    marginTop: 4,
    fontWeight: '500',
  },
  divider: {
    width: '100%',
    height: 1,
    backgroundColor: COLORS.border,
    marginVertical: 20,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 12,
  },
  detailLabel: {
    color: COLORS.textSecondary,
    fontSize: 15,
  },
  detailVal: {
    color: COLORS.text,
    fontSize: 15,
    fontWeight: '600',
  },
  actionButtons: {
    width: '100%',
    gap: 12,
    marginTop: 20,
  },
  maintenanceButton: {
    height: 50,
    backgroundColor: COLORS.secondary,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  scanAgainButton: {
    height: 50,
    backgroundColor: 'rgba(74, 144, 217, 0.1)',
    borderWidth: 1.5,
    borderColor: COLORS.secondary,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  buttonText: {
    color: COLORS.white,
    fontWeight: 'bold',
    fontSize: 15,
  },
});
