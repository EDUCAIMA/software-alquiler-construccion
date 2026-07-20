import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Save, Building2, Upload, Phone, Mail, FileText, MapPin, Users, UserPlus, Trash2, KeyRound } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import Swal from 'sweetalert2';

export default function Settings() {
  const { settings, updateSettings, isAdmin, users, addUser, deleteUser, currentUser } = useAppContext();
  const [activeTab, setActiveTab] = useState('company'); // 'company' or 'users'
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

  // State for user profiles form
  const [userForm, setUserForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'operativo'
  });
  const [userSaving, setUserSaving] = useState(false);
  const [userMessage, setUserMessage] = useState({ type: '', text: '' });

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

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!userForm.name.trim() || !userForm.username.trim() || !userForm.password) {
      setUserMessage({ type: 'error', text: 'Todos los campos son requeridos' });
      return;
    }
    setUserSaving(true);
    setUserMessage({ type: '', text: '' });
    try {
      await addUser({
        name: userForm.name.trim(),
        username: userForm.username.trim().toLowerCase(),
        password: userForm.password,
        role: userForm.role
      });
      setUserMessage({ type: 'success', text: 'Perfil de usuario creado correctamente' });
      setUserForm({ name: '', username: '', password: '', role: 'operativo' });
    } catch (err) {
      setUserMessage({ type: 'error', text: err.message || 'Error al crear el perfil' });
    } finally {
      setUserSaving(false);
      setTimeout(() => setUserMessage({ type: '', text: '' }), 4000);
    }
  };

  const handleDeleteUser = async (userId, userName) => {
    if (userId === currentUser?.id) {
      Swal.fire('Error', 'No puedes eliminar tu propio usuario con el que estás conectado.', 'error');
      return;
    }
    if (userId === 'U-001') {
      Swal.fire('Error', 'El usuario administrador principal no puede ser eliminado.', 'error');
      return;
    }
    const result = await Swal.fire({
      title: '¿Eliminar perfil?',
      text: `¿Estás seguro de que deseas eliminar permanentemente el usuario "${userName}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      confirmButtonColor: '#ef4444',
      cancelButtonColor: 'var(--text-muted)'
    });
    if (result.isConfirmed) {
      try {
        await deleteUser(userId);
        Swal.fire('Eliminado', 'El usuario ha sido eliminado correctamente.', 'success');
      } catch (err) {
        Swal.fire('Error', err.message || 'No se pudo eliminar el usuario', 'error');
      }
    }
  };

  const getRoleBadgeStyle = (role) => {
    switch (role) {
      case 'admin':
        return { background: 'rgba(249, 115, 22, 0.1)', color: '#f97316', border: '1px solid rgba(249, 115, 22, 0.2)' };
      case 'gerente':
        return { background: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6', border: '1px solid rgba(59, 130, 246, 0.2)' };
      case 'operativo':
        return { background: 'rgba(16, 185, 129, 0.1)', color: '#10b981', border: '1px solid rgba(16, 185, 129, 0.2)' };
      default:
        return { background: 'rgba(107, 114, 128, 0.1)', color: '#6b7280', border: '1px solid rgba(107, 114, 128, 0.2)' };
    }
  };

  const getRoleLabel = (role) => {
    switch (role) {
      case 'admin': return 'Administrador';
      case 'gerente': return 'Gerente';
      case 'operativo': return 'Operativo (Operario)';
      default: return role;
    }
  };

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto' }}>
      <header style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <div style={{
          padding: '0.75rem',
          background: 'rgba(35, 101, 171, 0.1)',
          borderRadius: '12px',
          color: '#2365AB'
        }}>
          <SettingsIcon size={24} />
        </div>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', margin: 0 }}>Panel de Configuración</h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Administra los ajustes de tu empresa y perfiles de acceso</p>
        </div>
      </header>

      {/* Tab Navigation */}
      <div style={{ 
        display: 'flex', 
        gap: '0.5rem', 
        borderBottom: '1px solid var(--surface-border)', 
        marginBottom: '2rem',
        paddingBottom: '2px'
      }}>
        <button
          onClick={() => setActiveTab('company')}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'company' ? '3px solid #2365AB' : '3px solid transparent',
            color: activeTab === 'company' ? '#2365AB' : 'var(--text-muted)',
            fontWeight: activeTab === 'company' ? '700' : '500',
            cursor: 'pointer',
            fontSize: '0.95rem',
            transition: 'all 0.2s',
            outline: 'none'
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={16} /> Información de la Empresa
          </span>
        </button>
        <button
          onClick={() => setActiveTab('users')}
          style={{
            padding: '0.75rem 1.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'users' ? '3px solid #2365AB' : '3px solid transparent',
            color: activeTab === 'users' ? '#2365AB' : 'var(--text-muted)',
            fontWeight: activeTab === 'users' ? '700' : '500',
            cursor: 'pointer',
            fontSize: '0.95rem',
            transition: 'all 0.2s',
            outline: 'none'
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <Users size={16} /> Perfiles y Usuarios
          </span>
        </button>
      </div>

      {activeTab === 'company' ? (
        /* Tab: Company Settings */
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
                  value={formData.shortName || ''} 
                  onChange={e => {
                    const val = e.target.value;
                    setFormData({...formData, shortName: val, companyName: `${val} ${formData.nameComplement || ''}`.trim()});
                  }}
                  placeholder="Ej: CIELO"
                  required
                />
              </div>
              <div className="input-group">
                <label><Building2 size={14} /> Complemento de Razón Social</label>
                <input 
                  type="text" 
                  value={formData.nameComplement || ''} 
                  onChange={e => {
                    const val = e.target.value;
                    setFormData({...formData, nameComplement: val, companyName: `${formData.shortName || ''} ${val}`.trim()});
                  }}
                  placeholder="Ej: ALQUILER DE EQUIPOS"
                />
              </div>
              <div className="input-group" style={{ gridColumn: 'span 2' }}>
                <label><Building2 size={14} /> Razón Social Completa (como aparecerá en documentos)</label>
                <input 
                  type="text" 
                  value={formData.companyName || ''} 
                  onChange={e => setFormData({...formData, companyName: e.target.value})}
                  required
                />
              </div>
              <div className="input-group">
                <label><FileText size={14} /> NIT / Identificación Fiscal</label>
                <input 
                  type="text" 
                  value={formData.nit || ''} 
                  onChange={e => setFormData({...formData, nit: e.target.value})}
                  required
                />
              </div>
              <div className="input-group">
                <label><Phone size={14} /> Teléfono de Contacto</label>
                <input 
                  type="text" 
                  value={formData.phone || ''} 
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                  required
                />
              </div>
              <div className="input-group">
                <label><Mail size={14} /> Correo Electrónico</label>
                <input 
                  type="email" 
                  value={formData.email || ''} 
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  required
                />
              </div>
              <div className="input-group" style={{ gridColumn: 'span 2' }}>
                <label><MapPin size={14} /> Dirección Principal</label>
                <input 
                  type="text" 
                  value={formData.address || ''} 
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
      ) : (
        /* Tab: User Profiles / Users manager */
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '2rem', alignItems: 'start' }}>
          
          {/* User List Panel */}
          <div className="card">
            <h2 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} color="#2365AB" /> Perfiles Registrados
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {users.map(u => (
                <div key={u.id} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '1rem',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--surface-border)',
                  borderRadius: '12px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div style={{ 
                      width: '40px', 
                      height: '40px', 
                      borderRadius: '50%', 
                      background: 'rgba(35, 101, 171, 0.1)', 
                      color: '#2365AB',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontWeight: 'bold',
                      fontSize: '1.1rem'
                    }}>
                      {u.avatar || u.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontWeight: 'bold', color: 'var(--text-primary)', fontSize: '0.95rem' }}>{u.name}</div>
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>@{u.username}</div>
                    </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ 
                      padding: '0.25rem 0.6rem',
                      borderRadius: '12px',
                      fontSize: '0.75rem',
                      fontWeight: '600',
                      ...getRoleBadgeStyle(u.role)
                    }}>
                      {getRoleLabel(u.role)}
                    </span>
                    <button 
                      onClick={() => handleDeleteUser(u.id, u.name)}
                      disabled={u.id === currentUser?.id || u.id === 'U-001'}
                      style={{ 
                        background: 'none', 
                        border: 'none', 
                        color: (u.id === currentUser?.id || u.id === 'U-001') ? 'rgba(255,255,255,0.05)' : '#ef4444', 
                        cursor: (u.id === currentUser?.id || u.id === 'U-001') ? 'not-allowed' : 'pointer',
                        padding: '6px'
                      }}
                      title={(u.id === currentUser?.id) ? 'Sesión activa' : (u.id === 'U-001') ? 'Admin principal' : 'Eliminar usuario'}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* User Registration Form */}
          <div className="card">
            <h2 style={{ color: 'var(--text-primary)', fontSize: '1.1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <UserPlus size={18} color="#2365AB" /> Crear Nuevo Perfil
            </h2>
            <form onSubmit={handleCreateUser} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="input-group">
                <label>Nombre Completo</label>
                <input 
                  type="text" 
                  value={userForm.name} 
                  onChange={e => setUserForm({...userForm, name: e.target.value})}
                  placeholder="Ej: Andres Polanco"
                  required
                />
              </div>
              <div className="input-group">
                <label>Usuario (nombre de acceso)</label>
                <input 
                  type="text" 
                  value={userForm.username} 
                  onChange={e => setUserForm({...userForm, username: e.target.value})}
                  placeholder="Ej: andresp"
                  required
                />
              </div>
              <div className="input-group">
                <label><KeyRound size={12} /> Contraseña</label>
                <input 
                  type="password" 
                  value={userForm.password} 
                  onChange={e => setUserForm({...userForm, password: e.target.value})}
                  placeholder="Defina una contraseña..."
                  required
                />
              </div>
              <div className="input-group">
                <label>Rol / Perfil de Acceso</label>
                <select 
                  value={userForm.role}
                  onChange={e => setUserForm({...userForm, role: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.75rem',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid var(--surface-border)',
                    borderRadius: '8px',
                    color: 'var(--text-primary)',
                    fontSize: '0.9rem',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                >
                  <option value="operativo" style={{ background: 'var(--surface)' }}>Operativo (Operarios)</option>
                  <option value="gerente" style={{ background: 'var(--surface)' }}>Gerente</option>
                  <option value="admin" style={{ background: 'var(--surface)' }}>Administrativo (Admin)</option>
                </select>
              </div>

              {userMessage.text && (
                <div style={{ 
                  color: userMessage.type === 'success' ? '#10b981' : '#ef4444',
                  fontSize: '0.85rem',
                  fontWeight: 500,
                  marginTop: '0.5rem'
                }}>
                  {userMessage.text}
                </div>
              )}

              <button 
                type="submit" 
                className="btn btn-primary" 
                disabled={userSaving}
                style={{ width: '100%', marginTop: '1rem', justifyContent: 'center' }}
              >
                <UserPlus size={16} /> {userSaving ? 'Creando perfil...' : 'Crear Perfil'}
              </button>
            </form>
          </div>
          
        </div>
      )}
    </div>
  );
}
