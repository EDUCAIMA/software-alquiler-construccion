import React, { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { Lock, User, Eye, EyeOff, AlertCircle } from 'lucide-react';

export default function Login() {
    const { login } = useAppContext();
    const [form, setForm] = useState({ username: '', password: '' });
    const [showPw, setShowPw] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        await new Promise(r => setTimeout(r, 500)); // small delay for UX
        const result = login(form.username.trim(), form.password);
        if (!result.success) setError(result.error);
        setLoading(false);
    };

    const fillDemo = (username, password) => setForm({ username, password });

    return (
        <div style={{
            minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'radial-gradient(ellipse at 60% 20%, #1e3a5f 0%, #09090b 60%)',
            padding: '1rem'
        }}>
            <div style={{ width: '100%', maxWidth: 420, display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                {/* Logo */}
                <div style={{ textAlign: 'center' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                        <svg width="40" height="40" viewBox="0 0 38 38" fill="none">
                            <circle cx="19" cy="19" r="17" stroke="white" strokeWidth="1.5" fill="none" />
                            <circle cx="19" cy="19" r="12" stroke="white" strokeWidth="1.5" fill="none" />
                            <circle cx="19" cy="19" r="7" stroke="white" strokeWidth="1.5" fill="none" />
                            <circle cx="19" cy="19" r="2.5" fill="white" />
                        </svg>
                        <div style={{ textAlign: 'left' }}>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, letterSpacing: '0.15em', color: '#fff' }}>CIELO</div>
                            <div style={{ fontSize: '0.65rem', letterSpacing: '0.2em', color: '#94a3b8' }}>ALQUILER DE EQUIPOS</div>
                        </div>
                    </div>
                    <p style={{ color: '#94a3b8', fontSize: '0.875rem', marginTop: 4 }}>Ingrese sus credenciales para continuar</p>
                </div>

                {/* Card */}
                <div className="glass-panel" style={{ padding: '2rem' }}>
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
                                    onFocus={e => e.target.style.borderColor = '#3b82f6'}
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
                                    onFocus={e => e.target.style.borderColor = '#3b82f6'}
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

                {/* Demo credentials */}
                <div className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
                    <p style={{ fontSize: '0.7rem', color: '#64748b', marginBottom: '0.6rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Accesos de demostración</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {[
                            { label: 'Administrador', user: 'admin', pw: 'admin123', color: '#3b82f6' },
                            { label: 'Gerente', user: 'gerente', pw: 'gerente123', color: '#10b981' },
                            { label: 'Operativo', user: 'op', pw: 'op123', color: '#f97316' },
                        ].map(item => (
                            <button key={item.user} type="button"
                                onClick={() => fillDemo(item.user, item.pw)}
                                style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                    padding: '0.4rem 0.6rem', background: 'rgba(255,255,255,0.04)',
                                    border: `1px solid rgba(255,255,255,0.08)`, borderRadius: 6,
                                    cursor: 'pointer', transition: 'background 0.15s',
                                }}
                                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.08)'}
                                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
                            >
                                <span style={{ fontSize: '0.8rem', color: item.color, fontWeight: 600 }}>{item.label}</span>
                                <span style={{ fontSize: '0.75rem', color: '#64748b', fontFamily: 'monospace' }}>{item.user} / {item.pw}</span>
                            </button>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
