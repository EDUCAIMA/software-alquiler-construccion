import React, { useState, useEffect, useRef } from 'react';
import { Settings as SettingsIcon, Save, Building2, Upload, Phone, Mail, FileText, MapPin, Users, UserPlus, Trash2, KeyRound, Edit2, DollarSign, Briefcase, CreditCard, User, IdCard, Eye, EyeOff, ShieldCheck, HardHat, Wallet, X, CheckCircle2, AlertCircle, Image as ImageIcon, Info } from 'lucide-react';
import { useAppContext } from '../context/AppContext';
import Swal from 'sweetalert2';

export default function Settings() {
  const { settings, updateSettings, isAdmin, users, addUser, updateUser, deleteUser, currentUser } = useAppContext();
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
  const [editingUserId, setEditingUserId] = useState(null);
  const [userForm, setUserForm] = useState({
    name: '',
    username: '',
    password: '',
    role: 'operativo',
    cargo: '',
    documento: '',
    salario_base: '',
    auxilio_transporte: 162000,
    banco_cuenta: ''
  });
  const [userSaving, setUserSaving] = useState(false);
  const [userMessage, setUserMessage] = useState({ type: '', text: '' });
  const [showPassword, setShowPassword] = useState(false);
  const userFormRef = useRef(null);

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

  const handleSaveUser = async (e) => {
    e.preventDefault();
    if (!userForm.name.trim() || !userForm.username.trim() || (!editingUserId && !userForm.password)) {
      setUserMessage({ type: 'error', text: 'Nombre, usuario y contraseña son requeridos' });
      return;
    }
    setUserSaving(true);
    setUserMessage({ type: '', text: '' });
    try {
      const payload = {
        name: userForm.name.trim(),
        username: userForm.username.trim().toLowerCase(),
        role: userForm.role,
        cargo: userForm.cargo.trim(),
        documento: userForm.documento.trim(),
        salario_base: Number(userForm.salario_base) || 0,
        auxilio_transporte: Number(userForm.auxilio_transporte) || 0,
        banco_cuenta: userForm.banco_cuenta.trim()
      };
      if (userForm.password) {
        payload.password = userForm.password;
      }

      if (editingUserId) {
        await updateUser(editingUserId, payload);
        setUserMessage({ type: 'success', text: 'Perfil de usuario actualizado correctamente' });
      } else {
        await addUser(payload);
        setUserMessage({ type: 'success', text: 'Perfil de usuario creado correctamente' });
      }
      cancelEditUser();
    } catch (err) {
      setUserMessage({ type: 'error', text: err.message || 'Error al guardar el perfil' });
    } finally {
      setUserSaving(false);
      setTimeout(() => setUserMessage({ type: '', text: '' }), 4000);
    }
  };

  const startEditUser = (u) => {
    setEditingUserId(u.id);
    setShowPassword(false);
    userFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setUserForm({
      name: u.name || '',
      username: u.username || '',
      password: '',
      role: u.role || 'operativo',
      cargo: u.cargo || '',
      documento: u.documento || '',
      salario_base: u.salario_base || '',
      auxilio_transporte: u.auxilio_transporte ?? 162000,
      banco_cuenta: u.banco_cuenta || ''
    });
  };

  const cancelEditUser = () => {
    setEditingUserId(null);
    setShowPassword(false);
    setUserForm({ name: '', username: '', password: '', role: 'operativo', cargo: '', documento: '', salario_base: '', auxilio_transporte: 162000, banco_cuenta: '' });
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

  const ROLE_OPTIONS = [
    { value: 'operativo', label: 'Operativo', desc: 'Operarios en campo', Icon: HardHat },
    { value: 'gerente', label: 'Gerente', desc: 'Supervisión y reportes', Icon: Briefcase },
    { value: 'admin', label: 'Administrador', desc: 'Acceso total', Icon: ShieldCheck }
  ];

  const formatMoney = (value) => `$${Number(value || 0).toLocaleString('es-CO')}`;

  const editingUser = editingUserId ? users.find(u => u.id === editingUserId) : null;

  return (
    <div style={{ maxWidth: activeTab === 'users' ? '1220px' : '1020px', margin: '0 auto', transition: 'max-width 0.25s ease' }}>
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
        <form onSubmit={handleSave} className="cfg-company-layout">

          {/* Panel: Identidad visual */}
          <div className="cfg-panel">
            <div className="cfg-panel__header">
              <div className="cfg-panel__icon"><ImageIcon size={20} /></div>
              <div className="cfg-panel__heading">
                <h2 className="cfg-panel__title">Identidad Visual</h2>
                <p className="cfg-panel__subtitle">Logos que se usan en los documentos PDF y dentro de la aplicación</p>
              </div>
            </div>

            <div className="cfg-panel__body">
              <div className="cfg-logo-grid">
                {[
                  {
                    field: 'logo',
                    inputId: 'logo-upload',
                    title: 'Logo para Documentos (PDF)',
                    hint: 'Se imprime en cotizaciones, remisiones y facturas. Se recomienda fondo blanco y formato PNG horizontal.',
                    alt: 'Logo Doc'
                  },
                  {
                    field: 'logoUI',
                    inputId: 'logo-ui-upload',
                    title: 'Logo para Interfaz (App)',
                    hint: 'Se muestra en la pantalla de Login y en el menú lateral. Idealmente PNG con fondo transparente.',
                    alt: 'Logo UI'
                  }
                ].map(({ field, inputId, title, hint, alt }) => (
                  <div key={field} className="cfg-logo-card">
                    <div className={`cfg-logo-preview${formData[field] ? ' has-image' : ''}`}>
                      {formData[field] ? (
                        <img src={formData[field]} alt={alt} />
                      ) : (
                        <Building2 size={30} />
                      )}
                    </div>
                    <div className="cfg-logo-info">
                      <span className="cfg-logo-title"><Upload size={14} /> {title}</span>
                      <span className="cfg-logo-hint">{hint}</span>
                      <input
                        type="file"
                        id={inputId}
                        accept="image/*"
                        onChange={(e) => handleLogoChange(e, field)}
                        style={{ display: 'none' }}
                      />
                      <div className="cfg-logo-actions">
                        <label htmlFor={inputId} className="cfg-upload-btn">
                          <Upload size={14} /> {formData[field] ? 'Cambiar imagen' : 'Subir imagen'}
                        </label>
                        {formData[field] && (
                          <button
                            type="button"
                            className="cfg-ghost-btn"
                            onClick={() => setFormData({ ...formData, [field]: '' })}
                          >
                            <Trash2 size={14} /> Quitar
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Panel: Datos de la empresa */}
          <div className="cfg-panel">
            <div className="cfg-panel__header">
              <div className="cfg-panel__icon"><Building2 size={20} /></div>
              <div className="cfg-panel__heading">
                <h2 className="cfg-panel__title">Datos de la Empresa</h2>
                <p className="cfg-panel__subtitle">Información legal y de contacto que aparecerá en todos los documentos</p>
              </div>
            </div>

            <div className="cfg-panel__body">
              <div className="cfg-form">

                {/* Sección: Razón social */}
                <section className="cfg-section">
                  <div className="cfg-section__head">
                    <span className="cfg-section__title"><Building2 size={13} /> Razón Social</span>
                  </div>

                  <div className="cfg-grid">
                    <div className="cfg-field">
                      <label className="cfg-field__label" htmlFor="empresa-corto">
                        <Building2 size={13} /> Nombre Corto / Identificador <span className="cfg-field__required">*</span>
                      </label>
                      <div className="cfg-field__control">
                        <input
                          id="empresa-corto"
                          className="cfg-input"
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
                      <span className="cfg-field__hint">Se usa como identificador corto de la marca.</span>
                    </div>

                    <div className="cfg-field">
                      <label className="cfg-field__label" htmlFor="empresa-complemento">
                        <Building2 size={13} /> Complemento de Razón Social
                      </label>
                      <div className="cfg-field__control">
                        <input
                          id="empresa-complemento"
                          className="cfg-input"
                          type="text"
                          value={formData.nameComplement || ''}
                          onChange={e => {
                            const val = e.target.value;
                            setFormData({...formData, nameComplement: val, companyName: `${formData.shortName || ''} ${val}`.trim()});
                          }}
                          placeholder="Ej: ALQUILER DE EQUIPOS"
                        />
                      </div>
                      <span className="cfg-field__hint">Se combina automáticamente con el nombre corto.</span>
                    </div>

                    <div className="cfg-field cfg-grid__full">
                      <label className="cfg-field__label" htmlFor="empresa-razon">
                        <FileText size={13} /> Razón Social Completa <span className="cfg-field__required">*</span>
                      </label>
                      <div className="cfg-field__control">
                        <input
                          id="empresa-razon"
                          className="cfg-input"
                          type="text"
                          value={formData.companyName || ''}
                          onChange={e => setFormData({...formData, companyName: e.target.value})}
                          required
                        />
                      </div>
                      <span className="cfg-field__hint">Puede editarla manualmente si el nombre legal difiere de la combinación anterior.</span>
                    </div>

                    <div className="cfg-preview-box">
                      <div className="cfg-preview-box__label"><FileText size={12} /> Vista previa del cabezote</div>
                      <div className="cfg-preview-box__value">{formData.companyName || 'Nombre de la empresa'}</div>
                      {formData.headerExtra && <div className="cfg-preview-box__extra">{formData.headerExtra}</div>}
                      <div className="cfg-preview-box__extra">
                        {[formData.nit && `NIT ${formData.nit}`, formData.phone, formData.email].filter(Boolean).join('  ·  ') || 'NIT · Teléfono · Correo'}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Sección: Identificación y contacto */}
                <section className="cfg-section">
                  <div className="cfg-section__head">
                    <span className="cfg-section__title"><Phone size={13} /> Identificación y Contacto</span>
                  </div>

                  <div className="cfg-grid">
                    <div className="cfg-field">
                      <label className="cfg-field__label" htmlFor="empresa-nit">
                        <FileText size={13} /> NIT / Identificación Fiscal <span className="cfg-field__required">*</span>
                      </label>
                      <div className="cfg-field__control">
                        <input
                          id="empresa-nit"
                          className="cfg-input"
                          type="text"
                          value={formData.nit || ''}
                          onChange={e => setFormData({...formData, nit: e.target.value})}
                          placeholder="Ej: 901234567-8"
                          required
                        />
                      </div>
                    </div>

                    <div className="cfg-field">
                      <label className="cfg-field__label" htmlFor="empresa-telefono">
                        <Phone size={13} /> Teléfono de Contacto <span className="cfg-field__required">*</span>
                      </label>
                      <div className="cfg-field__control">
                        <input
                          id="empresa-telefono"
                          className="cfg-input"
                          type="text"
                          value={formData.phone || ''}
                          onChange={e => setFormData({...formData, phone: e.target.value})}
                          placeholder="Ej: 320 000 0000"
                          required
                        />
                      </div>
                    </div>

                    <div className="cfg-field">
                      <label className="cfg-field__label" htmlFor="empresa-email">
                        <Mail size={13} /> Correo Electrónico <span className="cfg-field__required">*</span>
                      </label>
                      <div className="cfg-field__control">
                        <input
                          id="empresa-email"
                          className="cfg-input"
                          type="email"
                          value={formData.email || ''}
                          onChange={e => setFormData({...formData, email: e.target.value})}
                          placeholder="Ej: contacto@empresa.com"
                          required
                        />
                      </div>
                    </div>

                    <div className="cfg-field">
                      <label className="cfg-field__label" htmlFor="empresa-direccion">
                        <MapPin size={13} /> Dirección Principal <span className="cfg-field__required">*</span>
                      </label>
                      <div className="cfg-field__control">
                        <input
                          id="empresa-direccion"
                          className="cfg-input"
                          type="text"
                          value={formData.address || ''}
                          onChange={e => setFormData({...formData, address: e.target.value})}
                          placeholder="Ej: Calle 10 # 5-20, Neiva"
                          required
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {/* Sección: Documentos */}
                <section className="cfg-section">
                  <div className="cfg-section__head">
                    <span className="cfg-section__title"><FileText size={13} /> Personalización de Documentos</span>
                  </div>

                  <div className="cfg-grid">
                    <div className="cfg-field cfg-grid__full">
                      <label className="cfg-field__label" htmlFor="empresa-cabezote">
                        <FileText size={13} /> Información Adicional en Cabezote <span className="cfg-field__optional">(opcional)</span>
                      </label>
                      <div className="cfg-field__control">
                        <input
                          id="empresa-cabezote"
                          className="cfg-input"
                          type="text"
                          value={formData.headerExtra || ''}
                          onChange={e => setFormData({...formData, headerExtra: e.target.value})}
                          placeholder="Ej: Resolución DIAN, Régimen, Slogan..."
                        />
                      </div>
                      <span className="cfg-field__hint">Aparecerá debajo del complemento de nombre en cotizaciones, remisiones y facturas.</span>
                    </div>
                  </div>
                </section>

              </div>
            </div>
          </div>

          {/* Barra de guardado */}
          <div className="cfg-save-bar">
            {message.text ? (
              <div className={`cfg-alert cfg-alert--${message.type === 'success' ? 'success' : 'error'}`}>
                {message.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                {message.text}
              </div>
            ) : (
              <span className="cfg-save-bar__note">
                <Info size={14} /> Los cambios se aplican a todos los documentos generados a partir de ahora.
              </span>
            )}
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
            >
              <Save size={18} /> {isSaving ? 'Guardando...' : 'Guardar Cambios'}
            </button>
          </div>
        </form>
      ) : (
        /* Tab: User Profiles / Users manager */
        <div className="cfg-users-layout">

          {/* User List Panel */}
          <div className="cfg-panel">
            <div className="cfg-panel__header">
              <div className="cfg-panel__icon"><Users size={20} /></div>
              <div className="cfg-panel__heading">
                <h2 className="cfg-panel__title">Perfiles Registrados</h2>
                <p className="cfg-panel__subtitle">Usuarios con acceso al sistema y sus datos de nómina</p>
              </div>
              <span className="cfg-chip">{users.length} {users.length === 1 ? 'perfil' : 'perfiles'}</span>
            </div>

            <div className="cfg-panel__body">
              {users.length === 0 ? (
                <div className="cfg-empty">
                  <Users size={28} style={{ opacity: 0.4, marginBottom: '0.5rem' }} />
                  <p style={{ fontSize: '0.85rem' }}>Aún no hay perfiles registrados. Cree el primero desde el formulario.</p>
                </div>
              ) : (
                <div className="cfg-profile-list">
                  {users.map(u => {
                    const isLocked = u.id === currentUser?.id || u.id === 'U-001';
                    return (
                      <div key={u.id} className={`cfg-profile-card${editingUserId === u.id ? ' is-editing' : ''}`}>
                        <div className="cfg-profile-card__top">
                          <div className="cfg-profile-card__identity">
                            <div className="cfg-avatar">
                              {u.avatar || u.name.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <div className="cfg-profile-card__name">{u.name}</div>
                              <div className="cfg-profile-card__user">@{u.username}</div>
                            </div>
                          </div>

                          <div className="cfg-profile-card__actions">
                            <span className="cfg-role-badge" style={getRoleBadgeStyle(u.role)}>
                              {getRoleLabel(u.role)}
                            </span>
                            <button
                              type="button"
                              className="cfg-icon-btn"
                              onClick={() => startEditUser(u)}
                              title="Editar datos salariales y perfil"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              type="button"
                              className="cfg-icon-btn cfg-icon-btn--danger"
                              onClick={() => handleDeleteUser(u.id, u.name)}
                              disabled={isLocked}
                              title={(u.id === currentUser?.id) ? 'Sesión activa' : (u.id === 'U-001') ? 'Admin principal' : 'Eliminar usuario'}
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>

                        {/* Payroll / Worker Info Sub-panel */}
                        <div className="cfg-profile-meta">
                          <div className="cfg-profile-meta__item">
                            <span className="cfg-profile-meta__label">Cargo</span>
                            <span className="cfg-profile-meta__value" title={u.cargo || 'Sin asignar'}>{u.cargo || 'Sin asignar'}</span>
                          </div>
                          <div className="cfg-profile-meta__item">
                            <span className="cfg-profile-meta__label">Cédula / Doc.</span>
                            <span className="cfg-profile-meta__value">{u.documento || '—'}</span>
                          </div>
                          <div className="cfg-profile-meta__item">
                            <span className="cfg-profile-meta__label">Salario Base</span>
                            <span className="cfg-profile-meta__value cfg-profile-meta__value--money">{formatMoney(u.salario_base)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* User Registration Form */}
          <div className="cfg-panel" ref={userFormRef}>
            <div className="cfg-panel__header">
              <div className="cfg-panel__icon">{editingUserId ? <Edit2 size={18} /> : <UserPlus size={20} />}</div>
              <div className="cfg-panel__heading">
                <h2 className="cfg-panel__title">{editingUserId ? 'Editar Perfil Registrado' : 'Crear Nuevo Perfil'}</h2>
                <p className="cfg-panel__subtitle">
                  {editingUserId
                    ? `Actualizando los datos de ${editingUser?.name || 'este usuario'}`
                    : 'Defina el acceso y las variables de nómina del colaborador'}
                </p>
              </div>
              {editingUserId && (
                <button type="button" className="cfg-chip cfg-chip--edit" onClick={cancelEditUser} style={{ cursor: 'pointer' }}>
                  <X size={13} /> Cancelar
                </button>
              )}
            </div>

            <div className="cfg-panel__body">
              <form onSubmit={handleSaveUser} className="cfg-form">

                {/* Sección: Datos de acceso */}
                <section className="cfg-section">
                  <div className="cfg-section__head">
                    <span className="cfg-section__title"><KeyRound size={13} /> Datos de Acceso</span>
                  </div>

                  <div className="cfg-grid">
                    <div className="cfg-field cfg-grid__full">
                      <label className="cfg-field__label" htmlFor="perfil-nombre">
                        <User size={13} /> Nombre Completo <span className="cfg-field__required">*</span>
                      </label>
                      <div className="cfg-field__control">
                        <input
                          id="perfil-nombre"
                          className="cfg-input"
                          type="text"
                          value={userForm.name}
                          onChange={e => setUserForm({...userForm, name: e.target.value})}
                          placeholder="Ej: Andres Polanco"
                          required
                        />
                      </div>
                    </div>

                    <div className="cfg-field">
                      <label className="cfg-field__label" htmlFor="perfil-usuario">
                        <IdCard size={13} /> Usuario de acceso <span className="cfg-field__required">*</span>
                      </label>
                      <div className="cfg-field__control cfg-field__control--addon">
                        <span className="cfg-field__addon">@</span>
                        <input
                          id="perfil-usuario"
                          className="cfg-input"
                          type="text"
                          value={userForm.username}
                          onChange={e => setUserForm({...userForm, username: e.target.value})}
                          placeholder="andresp"
                          disabled={!!editingUserId}
                          required
                        />
                      </div>
                      <span className="cfg-field__hint">
                        {editingUserId ? 'El usuario no puede modificarse.' : 'Se guardará en minúsculas.'}
                      </span>
                    </div>

                    <div className="cfg-field">
                      <label className="cfg-field__label" htmlFor="perfil-password">
                        <KeyRound size={13} /> Contraseña {editingUserId
                          ? <span className="cfg-field__optional">(opcional)</span>
                          : <span className="cfg-field__required">*</span>}
                      </label>
                      <div className="cfg-field__control cfg-field__control--action">
                        <input
                          id="perfil-password"
                          className="cfg-input"
                          type={showPassword ? 'text' : 'password'}
                          value={userForm.password}
                          onChange={e => setUserForm({...userForm, password: e.target.value})}
                          placeholder={editingUserId ? 'Dejar en blanco para no cambiar' : 'Defina una contraseña...'}
                          required={!editingUserId}
                        />
                        <button
                          type="button"
                          className="cfg-input-action"
                          onClick={() => setShowPassword(v => !v)}
                          title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        >
                          {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </div>
                      <span className="cfg-field__hint">
                        {editingUserId ? 'Solo se actualiza si escribe una nueva.' : 'Será la clave de ingreso al sistema.'}
                      </span>
                    </div>

                    <div className="cfg-field cfg-grid__full">
                      <label className="cfg-field__label">
                        <ShieldCheck size={13} /> Rol / Perfil de Acceso
                      </label>
                      <div className="cfg-roles">
                        {ROLE_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            className={`cfg-role${userForm.role === opt.value ? ' is-active' : ''}`}
                            onClick={() => setUserForm({...userForm, role: opt.value})}
                            aria-pressed={userForm.role === opt.value}
                          >
                            <span className="cfg-role__icon"><opt.Icon size={16} /></span>
                            <span className="cfg-role__name">{opt.label}</span>
                            <span className="cfg-role__desc">{opt.desc}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Sección: Variables de nómina */}
                <section className="cfg-section">
                  <div className="cfg-section__head">
                    <span className="cfg-section__title"><Wallet size={13} /> Variables de Nómina y Salario</span>
                  </div>

                  <div className="cfg-grid">
                    <div className="cfg-field">
                      <label className="cfg-field__label" htmlFor="perfil-cargo">
                        <Briefcase size={13} /> Cargo / Puesto
                      </label>
                      <div className="cfg-field__control">
                        <input
                          id="perfil-cargo"
                          className="cfg-input"
                          type="text"
                          value={userForm.cargo}
                          onChange={e => setUserForm({...userForm, cargo: e.target.value})}
                          placeholder="Ej: Operario de Bodega"
                        />
                      </div>
                    </div>

                    <div className="cfg-field">
                      <label className="cfg-field__label" htmlFor="perfil-documento">
                        <FileText size={13} /> Documento / Cédula
                      </label>
                      <div className="cfg-field__control">
                        <input
                          id="perfil-documento"
                          className="cfg-input"
                          type="text"
                          value={userForm.documento}
                          onChange={e => setUserForm({...userForm, documento: e.target.value})}
                          placeholder="Ej: 101829384"
                        />
                      </div>
                    </div>

                    <div className="cfg-field">
                      <label className="cfg-field__label" htmlFor="perfil-salario">
                        <DollarSign size={13} /> Salario Base Mensual
                      </label>
                      <div className="cfg-field__control cfg-field__control--addon">
                        <span className="cfg-field__addon">$</span>
                        <input
                          id="perfil-salario"
                          className="cfg-input"
                          type="number"
                          value={userForm.salario_base}
                          onChange={e => setUserForm({...userForm, salario_base: e.target.value})}
                          placeholder="1300000"
                        />
                      </div>
                      <span className="cfg-field__hint">
                        {userForm.salario_base ? <>Equivale a <strong>{formatMoney(userForm.salario_base)}</strong></> : 'Valor mensual sin auxilios.'}
                      </span>
                    </div>

                    <div className="cfg-field">
                      <label className="cfg-field__label" htmlFor="perfil-auxilio">
                        <DollarSign size={13} /> Aux. Transporte
                      </label>
                      <div className="cfg-field__control cfg-field__control--addon">
                        <span className="cfg-field__addon">$</span>
                        <input
                          id="perfil-auxilio"
                          className="cfg-input"
                          type="number"
                          value={userForm.auxilio_transporte}
                          onChange={e => setUserForm({...userForm, auxilio_transporte: e.target.value})}
                          placeholder="162000"
                        />
                      </div>
                      <span className="cfg-field__hint">
                        {userForm.auxilio_transporte ? <>Equivale a <strong>{formatMoney(userForm.auxilio_transporte)}</strong></> : 'Deje en 0 si no aplica.'}
                      </span>
                    </div>

                    <div className="cfg-field cfg-grid__full">
                      <label className="cfg-field__label" htmlFor="perfil-banco">
                        <CreditCard size={13} /> Banco y Cuenta de Pago
                      </label>
                      <div className="cfg-field__control">
                        <input
                          id="perfil-banco"
                          className="cfg-input"
                          type="text"
                          value={userForm.banco_cuenta}
                          onChange={e => setUserForm({...userForm, banco_cuenta: e.target.value})}
                          placeholder="Ej: Bancolombia Ahorros #123456789"
                        />
                      </div>
                    </div>
                  </div>
                </section>

                {userMessage.text && (
                  <div className={`cfg-alert cfg-alert--${userMessage.type === 'success' ? 'success' : 'error'}`}>
                    {userMessage.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                    {userMessage.text}
                  </div>
                )}

                <div className="cfg-form__footer">
                  {editingUserId && (
                    <button type="button" className="btn btn-secondary" onClick={cancelEditUser} style={{ flex: '0 0 auto' }}>
                      <X size={16} /> Cancelar
                    </button>
                  )}
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={userSaving}
                  >
                    <UserPlus size={16} /> {userSaving ? 'Guardando...' : (editingUserId ? 'Actualizar Perfil' : 'Crear Perfil')}
                  </button>
                </div>
              </form>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
