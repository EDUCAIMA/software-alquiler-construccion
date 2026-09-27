import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation, Navigate } from 'react-router-dom';
import {
  LayoutDashboard, Users, Package, Activity,
  Wrench, LogOut, ShieldAlert, Calculator, Briefcase, Settings,
  Plus, RotateCcw, DollarSign, ArrowDownCircle, FileText,
  Sun, Moon, Monitor, Wallet, BarChart2, Palette
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
import GastosMantenimiento from './pages/GastosMantenimiento';
import CajaMenor from './pages/CajaMenor';

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

// Unifica el cierre de todas las ventanas emergentes, incluso las más antiguas.
function GlobalModalDismiss() {
  useEffect(() => {
    const isVisible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };

    const getModalOverlays = () => {
      const overlays = new Set(document.querySelectorAll('.modal-overlay, .modal-backdrop, [data-modal-overlay="true"]'));

      document.querySelectorAll('body div').forEach((element) => {
        const style = window.getComputedStyle(element);
        if (style.position !== 'fixed') return;
        const rect = element.getBoundingClientRect();
        const coversViewport = rect.width >= window.innerWidth * 0.9 && rect.height >= window.innerHeight * 0.9;
        const hasBackdrop = style.backgroundColor !== 'rgba(0, 0, 0, 0)' || style.backdropFilter !== 'none';
        if (coversViewport && hasBackdrop) overlays.add(element);
      });

      return [...overlays].filter(isVisible).sort((a, b) => {
        const zA = Number.parseInt(window.getComputedStyle(a).zIndex, 10) || 0;
        const zB = Number.parseInt(window.getComputedStyle(b).zIndex, 10) || 0;
        if (zA !== zB) return zA - zB;
        return a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
      });
    };

    const findCloseButton = (overlay) => [...overlay.querySelectorAll('button')].find((button) => {
      const label = `${button.getAttribute('aria-label') || ''} ${button.getAttribute('title') || ''} ${button.textContent || ''}`.toLowerCase();
      return button.hasAttribute('data-modal-close') || button.querySelector('.lucide-x') || /\bcerrar\b/.test(label);
    });

    const closeTopModal = () => {
      const overlays = getModalOverlays();
      const overlay = overlays.at(-1);
      if (!overlay) return false;
      const closeButton = findCloseButton(overlay);
      if (closeButton) closeButton.click();
      else overlay.click();
      return true;
    };

    const handleKeyDown = (event) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return;
      // SweetAlert gestiona su propio Escape y puede estar encima de otro modal.
      if ([...document.querySelectorAll('.swal2-container')].some(isVisible)) return;
      if (closeTopModal()) event.preventDefault();
    };

    const handleBackdropClick = (event) => {
      const overlay = event.target;
      if (!(overlay instanceof HTMLElement) || !overlay.isConnected) return;
      const style = window.getComputedStyle(overlay);
      const rect = overlay.getBoundingClientRect();
      const isExplicitOverlay = overlay.matches('.modal-overlay, .modal-backdrop, [data-modal-overlay="true"]');
      const isFullscreenBackdrop = style.position === 'fixed' && rect.width >= window.innerWidth * 0.9 && rect.height >= window.innerHeight * 0.9;
      if (!isExplicitOverlay && !isFullscreenBackdrop) return;
      const closeButton = findCloseButton(overlay);
      if (closeButton && overlay.isConnected) closeButton.click();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('click', handleBackdropClick);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('click', handleBackdropClick);
    };
  }, []);

  return null;
}

// ─── Top Navigation Bar ───────────────────────────────────────────────────────
function Topbar() {
  const location = useLocation();
  const { currentUser, logout, canViewDashboard, settings } = useAppContext();

  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'system');
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const applyTheme = (t) => {
      if (t === 'dark') {
        root.setAttribute('data-theme', 'dark');
      } else if (t === 'light') {
        root.setAttribute('data-theme', 'light');
      } else {
        const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
        root.setAttribute('data-theme', systemTheme);
      }
    };

    applyTheme(theme);
    localStorage.setItem('theme', theme);

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handleSystemThemeChange = (e) => {
        root.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => mediaQuery.removeEventListener('change', handleSystemThemeChange);
    }
  }, [theme]);

  const themeOptions = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Oscuro', icon: Moon },
    { value: 'system', label: 'Sistema', icon: Monitor },
  ];
  const ActiveThemeIcon = themeOptions.find(option => option.value === theme)?.icon || Palette;

  const menuItems = [
    { icon: Briefcase,       label: 'Comercial',             path: '/comercial',   restricted: false },
    { icon: LayoutDashboard, label: 'Panel de Control',      path: '/',            restricted: true  },
    { icon: Users,           label: 'Clientes',              path: '/clients',     restricted: false },
    { icon: Package,         label: 'Inventario / Equipos',  path: '/products',    restricted: false },
    { icon: FileText,        label: 'Remisión',              path: '/invoices',    restricted: false },
    { icon: Activity,        label: 'Trazabilidad',          path: '/trazability', restricted: false },
    { icon: Calculator,      label: 'Gastos y Costos Operativos', path: '/gastos-mantenimiento', restricted: false },
    { icon: Wallet,          label: 'Caja Menor',            path: '/caja-menor',  restricted: false },
    { icon: Wrench,          label: 'Mantenimientos',        path: '/maintenance', restricted: false },
    { icon: Settings,        label: 'Configuración',         path: '/settings',    restricted: true  },
  ].filter(item => !item.restricted || canViewDashboard);

  const roleColors = { admin: '#2365AB', gerente: '#10b981', operativo: '#f97316' };

  const titleStyle = {
    color: 'white',
    fontWeight: 800,
    fontSize: '1.15rem',
    letterSpacing: '-0.02em',
    whiteSpace: 'nowrap',
    marginRight: '0.75rem',
    borderLeft: '2px solid rgba(255,255,255,0.15)',
    paddingLeft: '1.25rem',
    display: 'flex',
    alignItems: 'center',
    height: '36px'
  };

  const renderActionBtn = (btn) => (
    <button
      key={btn.event}
      onClick={() => window.dispatchEvent(new CustomEvent(btn.event))}
      style={{
        padding: '0.6rem 1rem',
        borderRadius: 10,
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.15)',
        color: 'white',
        fontSize: '0.85rem',
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
      <btn.icon size={18} color={btn.color} />
      <span className="hide-on-mobile">{btn.label}</span>
    </button>
  );

  return (
    <header className="app-topbar" style={{
      position: 'fixed',
      top: 0, left: 0, right: 0,
      height: 80,
      background: 'linear-gradient(90deg, #0d3554 0%, #104166 40%, #104166 60%, #0d3554 100%)',
      zIndex: 50,
      display: 'flex',
      alignItems: 'center',
      padding: '0 1.5rem',
      boxShadow: '0 4px 30px rgba(0,0,0,0.4)',
      borderBottom: '1px solid rgba(255,255,255,0.12)',
    }}>

      {/* ── LEFT SECTION: Logo + Title (Flexible) ── */}
      <div className="header-left" style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginRight: '1rem' }}>
          {settings?.logoUI ? (
            <img src={settings.logoUI} alt="Logo" style={{ height: 48, width: 'auto', objectFit: 'contain' }} />
          ) : settings?.logo ? (
            <img src={settings.logo} alt="Logo" style={{ height: 48, width: 'auto', objectFit: 'contain' }} />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Package size={34} color="#76B1E0" />
              <span style={{ fontWeight: 900, color: 'white', fontSize: '1.1rem', letterSpacing: '-0.02em', lineHeight: 1 }}>
                {settings?.shortName || 'ARQUILER'}
              </span>
            </div>
          )}
        </div>

        {/* ── Page Titles ── */}
        {(() => {
          const titles = {
            '/': 'Panel de Control',
            '/clients': 'Gestión de Clientes',
            '/products': 'Inventario & Alquiler',
            '/comercial': 'Módulo Comercial',
            '/invoices': 'Remisión',
            '/trazability': 'Trazabilidad',
            '/maintenance': 'Mantenimientos',
            '/gastos-mantenimiento': 'Gastos y Costos Operativos',
            '/caja-menor': 'Caja Menor',
            '/settings': 'Configuración'
          };
          const title = titles[location.pathname];
          return title ? <div style={titleStyle} className="header-page-title">{title}</div> : null;
        })()}

      </div>

      {/* ── CENTER SECTION: Nav Icons (Stable) ── */}
      <nav className="header-nav" style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        gap: '0.2rem',
        padding: '0 1rem',
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
                width: 52,
                height: 52,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                flexShrink: 0,
                textDecoration: 'none',
                background: isActive ? 'rgba(255,255,255,0.18)' : 'transparent',
                border: isActive ? '2px solid rgba(255,255,255,0.25)' : '1px solid transparent',
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
              <Icon size={24} />
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
      <div className="header-right" style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flex: 1, minWidth: 0 }}>
        {/* Quick Actions */}
        <div className="header-quick-actions" style={{ display: 'flex', gap: '0.6rem', marginRight: '1rem' }}>
          {location.pathname === '/comercial' && [
            { label: 'Nueva Cotización', icon: Plus, event: 'trigger-nueva-cot', color: '#76B1E0' },
            { label: 'Devoluciones', icon: RotateCcw, event: 'trigger-devolucion', color: '#10b981' },
            { label: 'Corte de Obra', icon: DollarSign, event: 'trigger-corte', color: '#f97316' },
          ].map(renderActionBtn)}

          {location.pathname === '/products' && [
            { label: 'Reporte de Uso', icon: BarChart2, event: 'trigger-usage-report', color: '#2563EB' },
            { label: 'Ver Equipos en Campo', icon: ArrowDownCircle, event: 'trigger-field-inv', color: '#76B1E0' },
            { label: 'Nuevo Equipo', icon: Package, event: 'trigger-new-prod', color: '#10b981' },
          ].map(renderActionBtn)}

          {location.pathname === '/clients' && [
            { label: 'Nuevo Cliente', icon: Plus, event: 'trigger-new-client', color: '#10b981' },
            { label: 'Nuevo Proveedor', icon: Plus, event: 'trigger-new-provider', color: '#76B1E0' },
          ].map(renderActionBtn)}
        </div>

        {/* User + Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', flexShrink: 0 }}>
          <div className="theme-control">
            <button
              type="button"
              className="theme-toggle"
              title="Cambiar tema"
              aria-label="Cambiar tema"
              aria-expanded={themeMenuOpen}
              onClick={() => setThemeMenuOpen(open => !open)}
            >
              <ActiveThemeIcon size={18} />
            </button>
            {themeMenuOpen && (
              <div className="theme-popover" role="menu" aria-label="Selector de tema">
                {themeOptions.map((option) => {
                  const ThemeIcon = option.icon;
                  const selected = option.value === theme;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="menuitemradio"
                      aria-checked={selected}
                      className={selected ? 'active' : ''}
                      onClick={() => { setTheme(option.value); setThemeMenuOpen(false); }}
                    >
                      <ThemeIcon size={16} />
                      {option.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          <div style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            background: roleColors[currentUser?.role] || '#64748b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '1rem',
            fontWeight: 700,
            color: 'white',
            border: '2px solid rgba(255,255,255,0.3)',
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
              width: 42,
              height: 42,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(239,68,68,0.12)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: '50%',
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
            <LogOut size={20} />
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
        paddingTop: '80px',
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
        <Route path="/gastos-mantenimiento" element={<ProtectedRoute><GastosMantenimiento /></ProtectedRoute>} />
        <Route path="/caja-menor" element={<ProtectedRoute><CajaMenor /></ProtectedRoute>} />
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
        <GlobalModalDismiss />
        <AppShell />
      </BrowserRouter>
    </AppProvider>
  );
}

export default App;
