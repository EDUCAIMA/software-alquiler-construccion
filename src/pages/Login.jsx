import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function Login() {
    const { login, settings } = useAppContext();
    const [form, setForm] = useState({ username: '', password: '' });
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        await new Promise(r => setTimeout(r, 500));
        const result = login(form.username.trim(), form.password);
        if (!result.success) setError(result.error);
        setLoading(false);
    };

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            background: 'linear-gradient(135deg, #263777 0%, #2365AB 50%, #104166 100%)',
            padding: '1rem', paddingTop: '10vh'
        }}>
            <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                {/* Logo */}
                {(settings?.logo || settings?.logoUI) && (
                    <div style={{ textAlign: 'center' }}>
                        <img src={settings.logoUI || settings.logo} alt="Logo" style={{ maxHeight: 220, width: 'auto', filter: 'drop-shadow(0 10px 20px rgba(0,0,0,0.3))' }} />
                    </div>
                )}

                {/* Card */}
                <div className="glass-panel" style={{ padding: '2rem', background: 'rgba(255, 255, 255, 0.8)', backdropFilter: 'blur(20px)' }}>
                    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                        {/* Username */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 500 }}>
                                Usuario
                            </label>
                            <div style={{ position: 'relative' }}>
                                <User size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                <input
                                    type="text"
                                    value={form.username}
                                    onChange={e => setForm(f => ({ ...f, username: e.target.value }))}
                                    placeholder="Ingrese su usuario"
                                    required
                                    style={{
                                        width: '100%', padding: '0.65rem 0.75rem 0.65rem 2.5rem',
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid var(--surface-border)',
                                        borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.9rem',
                                        outline: 'none', boxSizing: 'border-box',
                                        transition: 'border-color 0.2s',
                                    }}
                                    onFocus={e => e.target.style.borderColor = '#2365AB'}
                                    onBlur={e => e.target.style.borderColor = 'var(--surface-border)'}
                                />
                            </div>
                        </div>

                        {/* Password */}
                        <div>
                            <label style={{ display: 'block', fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem', fontWeight: 500 }}>
                                Contraseña
                            </label>
                            <div style={{ position: 'relative' }}>
                                <Lock size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                                <input
                                    type={showPw ? 'text' : 'password'}
                                    value={form.password}
                                    onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                                    placeholder="Ingrese su contraseña"
                                    required
                                    style={{
                                        width: '100%', padding: '0.65rem 2.5rem 0.65rem 2.5rem',
                                        background: 'rgba(255,255,255,0.05)', border: '1px solid var(--surface-border)',
                                        borderRadius: 8, color: 'var(--text-primary)', fontSize: '0.9rem',
                                        outline: 'none', boxSizing: 'border-box',
                                        transition: 'border-color 0.2s',
                                    }}
                                    onFocus={e => e.target.style.borderColor = '#2365AB'}
                                    onBlur={e => e.target.style.borderColor = 'var(--surface-border)'}
                                />
                                <button type="button" onClick={() => setShowPw(v => !v)}
                                    style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', display: 'flex' }}>
                                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.6rem 0.75rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, color: '#ef4444', fontSize: '0.8rem' }}>
                                <AlertCircle size={14} /> {error}
                            </div>
                        )}

                        {/* Submit */}
                        <button type="submit" className="btn btn-primary" disabled={loading}
                            style={{ width: '100%', padding: '0.75rem', fontSize: '0.95rem', fontWeight: 600, opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
                            {loading ? 'Verificando...' : 'Iniciar Sesión'}
                        </button>
                    </form>
                </div>
                
                <div style={{ marginTop: '0.4rem', textAlign: 'center', fontSize: '0.85rem', color: 'rgba(255,255,255,0.9)', fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                    Versión 1.3.1
                </div>

            </div>
        </div>
    );
}
