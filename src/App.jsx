import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Package, Activity,
  Wrench, LogOut, ShieldAlert, Calculator, Briefcase, Settings,
  Plus, RotateCcw, DollarSign, ArrowDownCircle, FileText
} from 'lucide-react';
import { AppProvider, useAppContext } from './context/AppContext';

// Pages
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Products from './pages/Products';
import Trazability from './pages/Trazability';
import Maintenance from './pages/Maintenance';
import Financiero from './pages/Financiero';
import Comercial from './pages/Comercial';
import Login from './pages/Login';
import SettingsPage from './pages/Settings';
import PublicCotizacionApproval from './pages/PublicCotizacionApproval';
import Invoices from './pages/Invoices';

// ─── Route Guard ──────────────────────────────────────────────────────────────
function ProtectedRoute({ children, requireDashboard }) {
  const { currentUser, canViewDashboard } = useAppContext();
  if (!currentUser) return <Navigate to="/login" replace />;
  if (requireDashboard && !canViewDashboard) return <AccessDenied />;
  return children;
}

function AccessDenied() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '1rem', textAlign: 'center' }}>
      <ShieldAlert size={56} style={{ color: '#ef4444', opacity: 0.7 }} />
      <h2 style={{ color: 'var(--text-primary)' }}>Acceso Restringido</h2>
      <p style={{ color: 'var(--text-muted)', maxWidth: 340 }}>
        El Panel de Control es de acceso exclusivo para los roles de <strong>Administrador</strong> y <strong>Gerente</strong>.
      </p>
    </div>
  );
}

// ─── Top Navigation Bar ───────────────────────────────────────────────────────
function Topbar() {
  const location = useLocation();
  const { currentUser, logout, canViewDashboard, settings } = useAppContext();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Panel de Control',      path: '/',            restricted: true  },
    { icon: Users,           label: 'Clientes',              path: '/clients',     restricted: false },
    { icon: Package,         label: 'Inventario / Equipos',  path: '/products',    restricted: false },
    { icon: Briefcase,       label: 'Comercial',             path: '/comercial',   restricted: false },
    { icon: FileText,        label: 'Facturación',           path: '/invoices',    restricted: false },
    { icon: Activity,        label: 'Trazabilidad',          path: '/trazability', restricted: false },
    { icon: Wrench,          label: 'Mantenimientos',        path: '/maintenance', restricted: false },
    { icon: Settings,        label: 'Configuración',         path: '/settings',    restricted: true  },
  ].filter(item => !item.restricted || canViewDashboard);

  const roleColors = { admin: '#2365AB', gerente: '#10b981', operativo: '#f97316' };

  const titleStyle = {
    color: 'white',
    fontWeight: 800,
    fontSize: '1.05rem',
    letterSpacing: '-0.02em',
    whiteSpace: 'nowrap',
    marginRight: '1rem',
    borderLeft: '1px solid rgba(255,255,255,0.15)',
    paddingLeft: '1rem',
    display: 'flex',
    alignItems: 'center',
    height: '30px'
  };

  const renderActionBtn = (btn) => (
    <button
      key={btn.event}
      onClick={() => window.dispatchEvent(new CustomEvent(btn.event))}
      style={{
        padding: '0.45rem 0.85rem',
        borderRadius: 8,
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)',
        color: 'white',
        fontSize: '0.72rem',
        fontWeight: 700,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        transition: 'all 0.15s',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
      }}
    >
      <btn.icon size={14} color={btn.color} />
      <span className="hide-on-mobile">{btn.label}</span>
    </button>
  );

  return (
    <header style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      height: 62,
      background: 'linear-gradient(90deg, #0d3554 0%, #104166 40%, #104166 60%, #0d3554 100%)',
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      padding: '0 1.25rem',
      boxShadow: '0 2px 24px rgba(0,0,0,0.35)',
      borderBottom: '1px solid rgba(255,255,255,0.08)',
    }}>

      {/* ── LEFT SECTION: Logo + Title (Flexible) ── */}
      <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginRight: '1rem' }}>
          {settings?.logoUI ? (
            <img src={settings.logoUI} alt="Logo" style={{ height: 38, width: 'auto', objectFit: 'contain' }} />
          ) : settings?.logo ? (
            <img src={settings.logo} alt="Logo" style={{ height: 38, width: 'auto', objectFit: 'contain' }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Package size={28} color="#76B1E0" />
              <span style={{ fontWeight: 900, color: 'white', fontSize: '0.95rem', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {settings?.shortName || 'ARQUILER'}
              </span>
            </div>
          )}
        </div>

        {/* ── Page Titles ── */}
        {location.pathname === '/comercial' && <div style={titleStyle}>Módulo Comercial</div>}
        {location.pathname === '/products' && <div style={titleStyle}>Inventario & Alquiler</div>}
        {location.pathname === '/clients' && <div style={titleStyle}>Gestión de Clientes</div>}
      </div>

      {/* ── CENTER SECTION: Nav Icons (Stable) ── */}
      <nav style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '0.2rem',
        padding: '0 1rem',
        flexShrink: 0,
      }}>
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link
              key={item.path}
              to={item.path}
              title={item.label}
              style={{
                width: 44,
                height: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 10,
                flexShrink: 0,
                textDecoration: 'none',
                background: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
                border: isActive ? '1px solid rgba(255,255,255,0.25)' : '1px solid transparent',
                color: isActive ? 'white' : 'rgba(255,255,255,0.55)',
                transition: 'all 0.15s ease',
                position: 'relative',
              }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                  e.currentTarget.style.color = 'white';
                  e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = 'rgba(255,255,255,0.55)';
                  e.currentTarget.style.borderColor = 'transparent';
                }
              }}
            >
              <Icon size={19} />
              {isActive && (
                <span style={{
                  position: 'absolute',
                  bottom: 5,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: 4,
                  height: 4,
                  borderRadius: '50%',
                  background: '#76B1E0',
                }} />
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── RIGHT SECTION: Actions + User (Flexible) ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1, minWidth: 0 }}>
        {/* Quick Actions */}
        <div style={{ display: 'flex', gap: '0.6rem', marginRight: '1rem' }}>
          {location.pathname === '/comercial' && [
            { label: 'Nueva Cotización', icon: Plus, event: 'trigger-nueva-cot', color: '#76B1E0' },
            { label: 'Devoluciones', icon: RotateCcw, event: 'trigger-devolucion', color: '#10b981' },
            { label: 'Corte de Obra', icon: DollarSign, event: 'trigger-corte', color: '#f97316' },
          ].map(renderActionBtn)}

          {location.pathname === '/products' && [
            { label: 'Ver Equipos en Campo', icon: ArrowDownCircle, event: 'trigger-field-inv', color: '#76B1E0' },
            { label: 'Nuevo Equipo', icon: Package, event: 'trigger-new-prod', color: '#10b981' },
          ].map(renderActionBtn)}

          {location.pathname === '/clients' && [
            { label: 'Nuevo Cliente', icon: Plus, event: 'trigger-new-client', color: '#10b981' },
          ].map(renderActionBtn)}
        </div>

        {/* User + Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
          <div style={{
            width: 34,
            height: 34,
            borderRadius: '50%',
            background: roleColors[currentUser?.role] || '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.82rem',
            fontWeight: 700,
            color: 'white',
            border: '2px solid rgba(255,255,255,0.2)',
            flexShrink: 0,
          }}
            title={currentUser?.name}
          >
            {currentUser?.avatar || '?'}
          </div>
          <button
            onClick={logout}
            title="Cerrar Sesión"
            style={{
              width: 34,
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 8,
              color: '#f87171',
              cursor: 'pointer',
              transition: 'all 0.15s',
              flexShrink: 0,
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.28)';
              e.currentTarget.style.color = '#fca5a5';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(239,68,68,0.12)';
              e.currentTarget.style.color = '#f87171';
            }}
          >
            <LogOut size={15} />
          </button>
        </div>
      </div>
    </header>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────
function Layout({ children }) {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--background)' }}>
      <Topbar />
      <main style={{
        paddingTop: '62px',
        minHeight: '100vh',
      }}>
        <div className="page-container" style={{ margin: '0 auto', padding: '0.75rem 0' }}>
          {children}
        </div>
      </main>
    </div>
  );
}

// ─── App shell ────────────────────────────────────────────────────────────────
function AppShell() {
  const { currentUser } = useAppContext();
  const location = useLocation();

  const isPublicRoute = location.pathname.startsWith('/public/');

  if (isPublicRoute) {
    return (
      <Routes>
        <Route path="/public/cotizacion/:id" element={<PublicCotizacionApproval />} />
      </Routes>
    );
  }

  if (!currentUser) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ProtectedRoute requireDashboard><Dashboard /></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
        <Route path="/comercial" element={<ProtectedRoute><Comercial /></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
        {/* Redirects para rutas antiguas */}
        <Route path="/cotizaciones" element={<Navigate to="/comercial" replace />} />
        <Route path="/remisiones" element={<Navigate to="/comercial" replace />} />
        <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
        <Route path="/financiero" element={<ProtectedRoute><Financiero /></ProtectedRoute>} />
        <Route path="/maintenance" element={<ProtectedRoute><Maintenance /></ProtectedRoute>} />
        <Route path="/trazability" element={<ProtectedRoute><Trazability /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute requireDashboard><SettingsPage /></ProtectedRoute>} />
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}

function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <AppShell />
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
