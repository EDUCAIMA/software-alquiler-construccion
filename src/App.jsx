import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Package, FileText, Activity,
  Wrench, LogOut, ShieldAlert, Truck, Calculator, FileSignature, DollarSign
} from 'lucide-react';
import clsx from 'clsx';
import { AppProvider, useAppContext } from './context/AppContext';

// Pages
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Products from './pages/Products';
import Invoices from './pages/Invoices';
import Trazability from './pages/Trazability';
import Maintenance from './pages/Maintenance';
import Remisiones from './pages/Remisiones';
import CortesObra from './pages/CortesObra';
import Cotizaciones from './pages/Cotizaciones';
import Financiero from './pages/Financiero';
import Login from './pages/Login';

// ─── Route Guard – only admin/gerente can see Dashboard ──────────────────────
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

// ─── Sidebar ─────────────────────────────────────────────────────────────────
function Sidebar() {
  const location = useLocation();
  const { currentUser, logout, canViewDashboard } = useAppContext();

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/', restricted: true },
    { icon: Package, label: 'Inventario & Alquiler', path: '/products', restricted: false },
    { icon: Users, label: 'Clientes', path: '/clients', restricted: false },
    { icon: FileSignature, label: 'Cotizaciones', path: '/cotizaciones', restricted: false },
    { icon: Truck, label: 'Remisiones', path: '/remisiones', restricted: false },
    { icon: Calculator, label: 'Cortes de Obra', path: '/cortes', restricted: false },
    { icon: FileText, label: 'Facturación', path: '/invoices', restricted: false },
    { icon: DollarSign, label: 'Financiero', path: '/financiero', restricted: false },
    { icon: Wrench, label: 'Mantenimientos', path: '/maintenance', restricted: false },
    { icon: Activity, label: 'Trazabilidad', path: '/trazability', restricted: false },
  ].filter(item => !item.restricted || canViewDashboard);

  const roleColors = { admin: '#3b82f6', gerente: '#10b981', operativo: '#f97316' };
  const roleLabels = { admin: 'Administrador', gerente: 'Gerente', operativo: 'Operativo' };

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="logo-icon" style={{ background: 'transparent', boxShadow: 'none', padding: 0 }}>
          <svg width="38" height="38" viewBox="0 0 38 38" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="19" cy="19" r="17" stroke="white" strokeWidth="1.5" fill="none" />
            <circle cx="19" cy="19" r="12" stroke="white" strokeWidth="1.5" fill="none" />
            <circle cx="19" cy="19" r="7" stroke="white" strokeWidth="1.5" fill="none" />
            <circle cx="19" cy="19" r="2.5" fill="white" />
          </svg>
        </div>
        <div>
          <h1 className="logo-title">CIELO</h1>
          <p className="logo-subtitle">ALQUILER DE EQUIPOS</p>
        </div>
      </div>

      <nav className="nav-menu">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          return (
            <Link key={item.path} to={item.path} className={clsx('nav-item', isActive && 'active')}>
              <Icon size={20} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="user-profile" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
          <div className="avatar" style={{ background: roleColors[currentUser?.role] || '#64748b' }}>
            {currentUser?.avatar || '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentUser?.name || 'Usuario'}
            </p>
            <p style={{ fontSize: '0.7rem', color: roleColors[currentUser?.role] || '#94a3b8', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {roleLabels[currentUser?.role] || currentUser?.role}
            </p>
          </div>
        </div>
        <button onClick={logout}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            width: '100%', padding: '0.45rem 0.75rem',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8, color: '#ef4444', fontSize: '0.8rem', fontWeight: 600,
            cursor: 'pointer', transition: 'background 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.18)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
        >
          <LogOut size={14} /> Cerrar Sesión
        </button>
      </div>
    </aside>
  );
}

function Layout({ children }) {
  return (
    <div className="layout-container">
      <Sidebar />
      <main className="main-content">
        <div className="page-container page-animate">
          {children}
        </div>
      </main>
    </div>
  );
}

// ─── App shell – decides whether to show Login or main app ───────────────────
function AppShell() {
  const { currentUser } = useAppContext();

  if (!currentUser) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ProtectedRoute requireDashboard><Dashboard /></ProtectedRoute>} />
        <Route path="/clients" element={<ProtectedRoute><Clients /></ProtectedRoute>} />
        <Route path="/cotizaciones" element={<ProtectedRoute><Cotizaciones /></ProtectedRoute>} />
        <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
        <Route path="/remisiones" element={<ProtectedRoute><Remisiones /></ProtectedRoute>} />
        <Route path="/cortes" element={<ProtectedRoute><CortesObra /></ProtectedRoute>} />
        <Route path="/invoices" element={<ProtectedRoute><Invoices /></ProtectedRoute>} />
        <Route path="/financiero" element={<ProtectedRoute><Financiero /></ProtectedRoute>} />
        <Route path="/maintenance" element={<ProtectedRoute><Maintenance /></ProtectedRoute>} />
        <Route path="/trazability" element={<ProtectedRoute><Trazability /></ProtectedRoute>} />
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
