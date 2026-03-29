import React, { useEffect, useState } from 'react';
import {
    SafeAreaView,
    StatusBar,
    StyleSheet,
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Dimensions,
    Platform,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

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
};

export default function AppScreen() {
    const [greeting, setGreeting] = useState('Buenos días');

    useEffect(() => {
        const hour = new Date().getHours();
        if (hour >= 12 && hour < 18) setGreeting('Buenas tardes');
        if (hour >= 18 || hour < 6) setGreeting('Buenas noches');
    }, []);

    const MetricCard = ({ title, value, icon, color, trend }: any) => (
        <TouchableOpacity style={styles.card}>
            {Platform.OS === 'ios' || Platform.OS === 'web' ? (
                <BlurView intensity={20} tint="light" style={StyleSheet.absoluteFill} />
            ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(255,255,255,0.05)' }]} />
            )}
            <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
                <Ionicons name={icon} size={24} color={color} />
            </View>
            <View style={styles.cardContent}>
                <Text style={styles.cardTitle}>{title}</Text>
                <Text style={styles.cardValue}>{value}</Text>
                {trend && (
                    <View style={styles.trendBadge}>
                        <Ionicons name="trending-up" size={12} color={COLORS.success} />
                        <Text style={styles.trendText}>{trend}</Text>
                    </View>
                )}
            </View>
        </TouchableOpacity>
    );

    const ProjectItem = ({ name, progress, type }: any) => (
        <TouchableOpacity style={styles.projectItem}>
            <View style={styles.projectImagePlaceholder}>
                <Ionicons name="home" size={32} color={COLORS.accent} />
            </View>
            <View style={styles.projectInfo}>
                <Text style={styles.projectName}>{name}</Text>
                <Text style={styles.projectType}>{type}</Text>
                <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBar, { width: (`${progress}%` as any) }]} />
                </View>
                <Text style={styles.projectProgressText}>{progress}% Completado</Text>
            </View>
        </TouchableOpacity>
    );

    return (
        <SafeAreaView style={styles.container}>
            <LinearGradient
                colors={[COLORS.primary, COLORS.background]}
                style={StyleSheet.absoluteFill}
            />
            <StatusBar barStyle="light-content" />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.greetingText}>{greeting},</Text>
                        <Text style={styles.titleText}>Cielo Constructores</Text>
                    </View>
                    <TouchableOpacity style={styles.profileButton}>
                        <Ionicons name="person-circle" size={42} color={COLORS.secondary} />
                    </TouchableOpacity>
                </View>

                {/* Banner PWA / Principal */}
                <View style={styles.heroContainer}>
                    <LinearGradient
                        colors={[COLORS.secondary, '#3A7BC8']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.heroGradient}
                    >
                        <View style={styles.heroContent}>
                            <View style={styles.pwaBadge}>
                                <Text style={styles.pwaBadgeText}>PWA ACTIVADA</Text>
                            </View>
                            <Text style={styles.heroTitle}>Proyectos Activos</Text>
                            <Text style={styles.heroSubtitle}>Gestiona el progreso de tus obras en tiempo real con nuestra plataforma universal.</Text>
                            <TouchableOpacity style={styles.heroButton}>
                                <Text style={styles.heroButtonText}>Ver Obras</Text>
                                <Ionicons name="arrow-forward" size={18} color={COLORS.primary} />
                            </TouchableOpacity>
                        </View>
                        <Ionicons name="construct" size={100} color="rgba(255,255,255,0.15)" style={styles.heroIcon} />
                    </LinearGradient>
                </View>

                {/* Métricas Rápidas */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Resumen Financiero</Text>
                </View>
                <View style={styles.metricsGrid}>
                    <MetricCard 
                        title="Presupuesto" 
                        value="$124M" 
                        icon="cash-outline" 
                        color={COLORS.success} 
                        trend="+12%"
                    />
                    <MetricCard 
                        title="Materiales" 
                        value="85%" 
                        icon="cube-outline" 
                        color={COLORS.secondary} 
                    />
                    <MetricCard 
                        title="Personal" 
                        value="24" 
                        icon="people-outline" 
                        color={COLORS.warning} 
                    />
                    <MetricCard 
                        title="Entregas" 
                        value="3" 
                        icon="calendar-outline" 
                        color={COLORS.accent} 
                    />
                </View>

                {/* Lista de Proyectos */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Tus Obras</Text>
                    <TouchableOpacity>
                        <Text style={styles.seeAllText}>Ver todo</Text>
                    </TouchableOpacity>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.horizontalScroll}>
                    <ProjectItem name="Edificio Nubes" progress={75} type="Residencial" />
                    <ProjectItem name="Plaza Cielo" progress={40} type="Comercial" />
                    <ProjectItem name="Torre Viento" progress={90} type="Oficinas" />
                </ScrollView>

                {/* Actividad Reciente */}
                <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Actividad Reciente</Text>
                </View>

                <View style={styles.activityCard}>
                    {Platform.OS === 'web' && (
                        <BlurView intensity={10} tint="light" style={StyleSheet.absoluteFill} />
                    )}
                    {[1, 2, 3].map((item) => (
                        <View key={item} style={[styles.activityItem, item === 3 && { borderBottomWidth: 0 }]}>
                            <View style={styles.activityMarker} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.activityText}>Inspección completada en "Plaza Cielo"</Text>
                                <Text style={styles.activityTime}>Hace {item * 5} horas</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={16} color={COLORS.textSecondary} />
                        </View>
                    ))}
                </View>

                {/* Footer / Nota PWA */}
                <View style={styles.footer}>
                    <Text style={styles.footerText}>Versión 1.1.2 - Desarrollado por Antigravity</Text>
                    <Text style={styles.footerBrand}>Cielo Constructores S.A.S. - 2026</Text>
                    <View style={styles.socialIcons}>
                        <Ionicons name="logo-instagram" size={20} color={COLORS.textSecondary} />
                        <Ionicons name="logo-linkedin" size={20} color={COLORS.textSecondary} />
                        <Ionicons name="globe-outline" size={20} color={COLORS.textSecondary} />
                    </View>
                </View>
            </ScrollView>

            {/* Floating Action Button */}
            <TouchableOpacity style={styles.fab}>
                <LinearGradient
                    colors={[COLORS.secondary, COLORS.accent]}
                    style={styles.fabGradient}
                >
                    <Ionicons name="add" size={32} color={COLORS.white} />
                </LinearGradient>
            </TouchableOpacity>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.background,
    },
    scrollContent: {
        padding: 20,
        paddingTop: Platform.OS === 'web' ? 40 : 20,
        paddingBottom: 100,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30,
    },
    greetingText: {
        color: COLORS.textSecondary,
        fontSize: 16,
        fontFamily: Platform.OS === 'web' ? 'Inter' : undefined,
    },
    titleText: {
        color: COLORS.white,
        fontSize: 28,
        fontWeight: '800',
        fontFamily: Platform.OS === 'web' ? 'Montserrat' : undefined,
    },
    profileButton: {
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 25,
        padding: 2,
    },
    heroContainer: {
        marginBottom: 30,
        borderRadius: 24,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: COLORS.secondary,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
    },
    heroGradient: {
        padding: 24,
        flexDirection: 'row',
        overflow: 'hidden',
    },
    heroContent: {
        flex: 1,
        zIndex: 1,
    },
    heroTitle: {
        color: COLORS.white,
        fontSize: 22,
        fontWeight: 'bold',
        marginBottom: 8,
    },
    heroSubtitle: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: 14,
        lineHeight: 20,
        marginBottom: 20,
    },
    heroButton: {
        backgroundColor: COLORS.white,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        alignSelf: 'flex-start',
    },
    heroButtonText: {
        color: COLORS.primary,
        fontWeight: '700',
        fontSize: 14,
    },
    heroIcon: {
        position: 'absolute',
        right: -20,
        bottom: -20,
    },
    pwaBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    pwaBadgeText: {
        color: COLORS.white,
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    sectionTitle: {
        color: COLORS.white,
        fontSize: 20,
        fontWeight: '700',
    },
    seeAllText: {
        color: COLORS.secondary,
        fontSize: 14,
    },
    metricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 16,
        marginBottom: 30,
    },
    card: {
        width: (width - 56) / 2,
        backgroundColor: COLORS.card,
        padding: 16,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
        zIndex: 1,
    },
    cardContent: {
        gap: 4,
        zIndex: 1,
    },
    cardTitle: {
        color: COLORS.textSecondary,
        fontSize: 13,
    },
    cardValue: {
        color: COLORS.white,
        fontSize: 22,
        fontWeight: 'bold',
    },
    trendBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    trendText: {
        color: COLORS.success,
        fontSize: 12,
        fontWeight: '600',
    },
    horizontalScroll: {
        paddingRight: 20,
        gap: 16,
        marginBottom: 30,
    },
    projectItem: {
        width: 220,
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    projectImagePlaceholder: {
        height: 100,
        backgroundColor: 'rgba(255,255,255,0.03)',
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    projectInfo: {
        gap: 4,
    },
    projectName: {
        color: COLORS.white,
        fontSize: 16,
        fontWeight: '700',
    },
    projectType: {
        color: COLORS.textSecondary,
        fontSize: 12,
        marginBottom: 8,
    },
    progressBarContainer: {
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 3,
        marginBottom: 6,
    },
    progressBar: {
        height: '100%',
        backgroundColor: COLORS.secondary,
        borderRadius: 3,
    },
    projectProgressText: {
        color: COLORS.accent,
        fontSize: 11,
        fontWeight: '600',
    },
    activityCard: {
        backgroundColor: COLORS.card,
        borderRadius: 20,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        gap: 12,
        zIndex: 1,
    },
    activityMarker: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: COLORS.secondary,
    },
    activityText: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: '500',
    },
    activityTime: {
        color: COLORS.textSecondary,
        fontSize: 12,
        marginTop: 2,
    },
    footer: {
        marginTop: 40,
        alignItems: 'center',
        gap: 12,
    },
    footerText: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 12,
    },
    footerBrand: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 13,
        fontWeight: '600',
    },
    socialIcons: {
        flexDirection: 'row',
        gap: 20,
        marginTop: 8,
    },
    fab: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        borderRadius: 30,
        elevation: 8,
        shadowColor: COLORS.secondary,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
    fabGradient: {
        width: 60,
        height: 60,
        borderRadius: 30,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
