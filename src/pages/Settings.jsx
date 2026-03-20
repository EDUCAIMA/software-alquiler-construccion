import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Building2, Upload, Phone, Mail, FileText, MapPin } from 'lucide-react';
import { useAppContext } from '../context/AppContext';

export default function Settings() {
  const { settings, updateSettings, isAdmin } = useAppContext();
  const [formData, setFormData] = useState({
    companyName: '',
    shortName: '',
    nameComplement: '',
    nit: '',
    phone: '',
    email: '',
    address: '',
    logo: '',
    logoUI: '',
    headerExtra: ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    if (settings) {
      setFormData(settings);
    }
  }, [settings]);

  if (!isAdmin) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
        <h2 style={{ color: 'var(--text-primary)' }}>Acceso Denegado</h2>
        <p style={{ color: 'var(--text-muted)' }}>Solo los administradores pueden modificar la configuración de la empresa.</p>
      </div>
    );
  }

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage({ type: '', text: '' });
    try {
      await updateSettings(formData);
      setMessage({ type: 'success', text: 'Configuración guardada correctamente' });
    } catch (err) {
      setMessage({ type: 'error', text: 'Error al guardar la configuración' });
    } finally {
      setIsSaving(false);
      setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    }
  };

  const handleLogoChange = (e, field) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData(prev => ({ ...prev, [field]: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          padding: '0.75rem',
          background: 'rgba(35, 101, 171, 0.1)',
          borderRadius: '12px',
          color: '#2365AB'
        }}>
          <SettingsIcon size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', margin: 0 }}>Ajustes de Empresa</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Configura la información que aparecerá en facturas y cotizaciones</p>
        </div>
      </header>

      <div className="card">
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Logo Section */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
            <section>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Upload size={18} /> Logo para Documentos (PDF)
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '12px',
                  border: '2px dashed var(--surface-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  background: 'var(--surface)'
                }}>
                  {formData.logo ? (
                    <img src={formData.logo} alt="Logo Doc" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <Building2 size={32} style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    id="logo-upload"
                    accept="image/*"
                    onChange={(e) => handleLogoChange(e, 'logo')}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="logo-upload" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <Upload size={16} /> Subir Logo PDF
                  </label>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Fondo blanco recomendado</p>
                </div>
              </div>
            </section>

            <section>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-primary)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Upload size={18} /> Logo para Interfaz (App)
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
                <div style={{
                  width: '100px',
                  height: '100px',
                  borderRadius: '12px',
                  border: '2px dashed var(--surface-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  background: 'var(--surface)'
                }}>
                  {formData.logoUI ? (
                    <img src={formData.logoUI} alt="Logo UI" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <Building2 size={32} style={{ color: 'var(--text-muted)' }} />
                  )}
                </div>
                <div>
                  <input
                    type="file"
                    id="logo-ui-upload"
                    accept="image/*"
                    onChange={(e) => handleLogoChange(e, 'logoUI')}
                    style={{ display: 'none' }}
                  />
                  <label htmlFor="logo-ui-upload" className="btn btn-secondary" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    <Upload size={16} /> Subir Logo App
                  </label>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Utilizado en Login y Menú Lateral</p>
                </div>
              </div>
            </section>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.05)' }} />

          {/* Form Fields */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
            <div className="input-group">
              <label><Building2 size={14} /> Nombre Corto / Identificador</label>
              <input 
                type="text" 
                value={formData.shortName} 
                onChange={e => {
                  const val = e.target.value;
                  setFormData({...formData, shortName: val, companyName: `${val} ${formData.nameComplement}`.trim()});
                }}
                placeholder="Ej: CIELO"
                required
              />
            </div>
            <div className="input-group">
              <label><Building2 size={14} /> Complemento de Razón Social</label>
              <input 
                type="text" 
                value={formData.nameComplement} 
                onChange={e => {
                  const val = e.target.value;
                  setFormData({...formData, nameComplement: val, companyName: `${formData.shortName} ${val}`.trim()});
                }}
                placeholder="Ej: ALQUILER DE EQUIPOS"
              />
            </div>
            <div className="input-group" style={{ gridColumn: 'span 2' }}>
              <label><Building2 size={14} /> Razón Social Completa (como aparecerá en documentos)</label>
              <input 
                type="text" 
                value={formData.companyName} 
                onChange={e => setFormData({...formData, companyName: e.target.value})}
                required
              />
            </div>
            <div className="input-group">
              <label><FileText size={14} /> NIT / Identificación Fiscal</label>
              <input 
                type="text" 
                value={formData.nit} 
                onChange={e => setFormData({...formData, nit: e.target.value})}
                required
              />
            </div>
            <div className="input-group">
              <label><Phone size={14} /> Teléfono de Contacto</label>
              <input 
                type="text" 
                value={formData.phone} 
                onChange={e => setFormData({...formData, phone: e.target.value})}
                required
              />
            </div>
            <div className="input-group">
              <label><Mail size={14} /> Correo Electrónico</label>
              <input 
                type="email" 
                value={formData.email} 
                onChange={e => setFormData({...formData, email: e.target.value})}
                required
              />
            </div>
            <div className="input-group" style={{ gridColumn: 'span 2' }}>
              <label><MapPin size={14} /> Dirección Principal</label>
              <input 
                type="text" 
                value={formData.address} 
                onChange={e => setFormData({...formData, address: e.target.value})}
                required
              />
            </div>
            <div className="input-group" style={{ gridColumn: 'span 2' }}>
              <label><FileText size={14} /> Información Adicional en Cabezote (Ej: Resolución, Régimen, Slogan)</label>
              <input 
                type="text" 
                value={formData.headerExtra || ''} 
                onChange={e => setFormData({...formData, headerExtra: e.target.value})}
                placeholder="Aparecerá debajo del complemento de nombre en los documentos"
              />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '1rem' }}>
            {message.text && (
              <span style={{ 
                color: message.type === 'success' ? '#10b981' : '#ef4444',
                fontSize: '0.9rem',
                fontWeight: 500
              }}>
                {message.text}
              </span>
            )}
            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={isSaving}
              style={{ padding: '0.75rem 2rem', gap: '0.75rem' }}
            >
              <Save size={18} /> {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
