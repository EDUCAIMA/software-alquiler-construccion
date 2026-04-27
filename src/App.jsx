import React from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Package, FileText, Activity,
  Wrench, LogOut, ShieldAlert, Truck, Calculator, Briefcase, DollarSign, Settings, Menu, X,
  ChevronsLeft, ChevronsRight
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
import Financiero from './pages/Financiero';
import Cotizaciones from './pages/Cotizaciones';
import Comercial from './pages/Comercial';
import Login from './pages/Login';
import SettingsPage from './pages/Settings';
import PublicCotizacionApproval from './pages/PublicCotizacionApproval';

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
function Sidebar({ isOpen, onClose, isCollapsed, onToggleCollapse }) {
  const location = useLocation();
  const { currentUser, logout, canViewDashboard, settings } = useAppContext();
  console.log('Sidebar render. Settings:', settings);
  
  const menuItems = [
    { icon: LayoutDashboard, label: 'Panel de Control',      path: '/',           restricted: true  },
    { icon: Briefcase,       label: 'Comercial / Cobros',     path: '/comercial',  restricted: false },
    { icon: Truck,           label: 'Despacho (Remisiones)',  path: '/remisiones', restricted: false },
    { icon: Calculator,      label: 'Cortes de Obra',         path: '/cortes',     restricted: false },
    { icon: Package,         label: 'Inventario / Equipos',   path: '/products',   restricted: false },
    { icon: Users,           label: 'Clientes',               path: '/clients',    restricted: false },
    { icon: Activity,        label: 'Trazabilidad Logística', path: '/trazability', restricted: false },
    { icon: Wrench,          label: 'Mantenimientos',         path: '/maintenance', restricted: false },
    { icon: Settings,        label: 'Configuración',          path: '/settings',   restricted: true  },
  ].filter(item => !item.restricted || canViewDashboard);

  const roleColors = { admin: '#2365AB', gerente: '#10b981', operativo: '#f97316' };
  const roleLabels = { admin: 'Administrador', gerente: 'Gerente', operativo: 'Operativo' };

  return (
    <>
      {isOpen && (
        <div 
          onClick={onClose}
          style={{ 
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 45,
            backdropFilter: 'blur(4px)', animation: 'fadeIn 0.2s'
          }} 
        />
      )}
      <aside className={clsx("sidebar", isOpen && "open", isCollapsed && "collapsed")}>
        {/* Botón de Colapsar - Más visible y mejor ubicado */}
        <button 
          onClick={onToggleCollapse} 
          className="collapse-toggle desktop-only"
          title={isCollapsed ? "Expandir menú" : "Contraer menú"}
          style={{
            position: 'absolute',
            right: '14px',
            top: '25px',
            zIndex: 1000,
            background: '#ffffff',
            border: 'none',
            width: '36px',
            height: '36px',
            borderRadius: '12px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--primary)',
            cursor: 'pointer',
            boxShadow: '0 8px 20px rgba(0,0,0,0.2)',
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
          onMouseEnter={e => {
            e.currentTarget.style.transform = 'scale(1.1)';
            e.currentTarget.style.background = 'var(--primary)';
            e.currentTarget.style.color = 'white';
          }}
          onMouseLeave={e => {
            e.currentTarget.style.transform = 'scale(1)';
            e.currentTarget.style.background = '#ffffff';
            e.currentTarget.style.color = 'var(--primary)';
          }}
        >
          {isCollapsed ? <ChevronsRight size={20} /> : <ChevronsLeft size={20} />}
        </button>

        {/* Botón Cerrar (Mobile) */}
        <button 
          onClick={onClose} 
          className="mobile-only-btn" 
          style={{ 
            position: 'absolute', right: '10px', top: '10px',
            background: 'none', border: 'none', color: 'white', cursor: 'pointer', padding: '0.5rem', zIndex: 101 
          }}
        >
          <X size={24} />
        </button>

        <div className="sidebar-header" style={{ paddingTop: '1.5rem' }}>
          <div className="logo-icon">
            {settings?.logoUI ? (
              <img src={settings.logoUI} alt="Logo" className="sidebar-logo-img" />
            ) : settings?.logo ? (
              <img src={settings.logo} alt="Logo" className="sidebar-logo-img" />
            ) : (
              <Package size={54} color="#2365AB" />
            )}
          </div>
        </div>

      <nav className="nav-menu">
        {menuItems.map((item) => {
          const isActive = location.pathname === item.path;
          const Icon = item.icon;
          if (item.disabled) {
            return (
              <div 
                key={item.path} 
                className="nav-item disabled" 
                style={{ opacity: 0.4, cursor: 'not-allowed', filter: 'grayscale(1)' }}
                title={isCollapsed ? item.label : ''}
              >
                <Icon size={20} />
                {!isCollapsed && <span>{item.label}</span>}
              </div>
            );
          }
          return (
            <Link key={item.path} to={item.path} className={clsx('nav-item', isActive && 'active')} title={isCollapsed ? item.label : ''}>
              <Icon size={20} />
              {!isCollapsed && <span>{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="user-profile" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', width: '100%' }}>
          <div className="avatar" style={{ background: roleColors[currentUser?.role] || '#64748b', flexShrink: 0 }}>
            {currentUser?.avatar || '?'}
          </div>
          {!isCollapsed && (
            <div className="profile-details" style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 600, color: '#ffffff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {currentUser?.name || 'Usuario'}
              </p>
              <p style={{ fontSize: '0.7rem', color: 'rgba(255, 255, 255, 0.8)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {roleLabels[currentUser?.role] || currentUser?.role}
              </p>
            </div>
          )}
        </div>
        <button onClick={logout}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            width: '100%', padding: '0.45rem',
            background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
            borderRadius: 8, color: '#ef4444', fontSize: '0.8rem', fontWeight: 600,
            cursor: 'pointer', transition: 'background 0.2s', justifyContent: isCollapsed ? 'center' : 'flex-start'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.18)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
          title={isCollapsed ? 'Cerrar Sesión' : ''}
        >
          <LogOut size={14} /> {!isCollapsed && <span>Cerrar Sesión</span>}
        </button>
        {!isCollapsed && (
          <div className="version-text" style={{ marginTop: '0.75rem', textAlign: 'center', width: '100%', fontSize: '0.65rem', fontWeight: 700, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
            VERSIÓN 1.3.2-REFRESH
          </div>
        )}
      </div>
      </aside>
    </>
  );
}

function Layout({ children }) {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = React.useState(false);

  return (
    <div className="layout-container">
      <Sidebar 
        isOpen={isSidebarOpen} 
        onClose={() => setIsSidebarOpen(false)} 
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
      />
      <main className={clsx("main-content", isSidebarCollapsed && "collapsed-sidebar")}>
        <div className="mobile-header" style={{ display: 'none', padding: '1rem', borderBottom: '1px solid var(--surface-border)', background: 'white', marginBottom: '1rem', borderRadius: '12px' }}>
          <button onClick={() => setIsSidebarOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer' }}>
            <Menu size={24} />
          </button>
          <span style={{ fontWeight: 800, color: 'var(--primary)', marginLeft: '1rem' }}>CIELO ARQUILER</span>
        </div>
        <div className="page-container page-animate">
          {children}
        </div>
      </main>
      <style>{`
        @media (max-width: 1024px) {
          .mobile-header { display: flex !important; align-items: center; }
          .mobile-only { display: block !important; }
        }
      `}</style>
    </div>
  );
}

// ─── App shell – decides whether to show Login or main app ───────────────────
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
        {/* Redirects para rutas antiguas */}
        <Route path="/cotizaciones" element={<Navigate to="/comercial" replace />} />
        <Route path="/invoices" element={<Navigate to="/comercial" replace />} />
        <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
        <Route path="/remisiones" element={<ProtectedRoute><Remisiones /></ProtectedRoute>} />
        <Route path="/cortes" element={<ProtectedRoute><CortesObra /></ProtectedRoute>} />
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
// Force redeploy Mon Apr 27 10:22:26 -05 2026
