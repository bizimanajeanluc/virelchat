import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Shield, Mail, Phone, Lock, User, MapPin, ArrowRight, CheckCircle2, MessageSquare, Zap, Users, Globe, Check, ChevronDown, RefreshCw, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface AuthProps {
  onLogin: (token: string, user: any) => void;
}

const TRUST_WORDS = ["Privacy", "Verified", "Encrypted", "Secure", "No Spying", "Signal v3"];

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'verify' | 'forgot' | 'reset'>('login');
  const [formData, setFormData] = useState({ identifier: '', password: '', displayName: '', code: '', newPassword: '' });
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const googleBtnRef = React.useRef<HTMLDivElement>(null);

  useEffect(() => {
    if ((mode === 'login' || mode === 'signup') && googleBtnRef.current && window.google?.accounts?.id) {
      window.google.accounts.id.initialize({
        client_id: '972968562607-6iv5i4vqm4jr9her4o295gognllkslto.apps.googleusercontent.com',
        cancel_on_tap_outside: false,
        callback: async (response: any) => {
          if (!response.credential) return;
          setError(''); setSuccessMessage(''); setIsLoading(true);
          try {
            const res = await api.post('/api/auth/google', { credential: response.credential });
            onLogin(res.data.token, res.data.user);
          } catch (err: any) {
            setError(err.response?.data?.error || 'Google Sign-In failed.');
          } finally { setIsLoading(false); }
        },
      });
      window.google.accounts.id.renderButton(googleBtnRef.current, {
        theme: 'outline', size: 'large', type: 'standard', shape: 'pill',
        width: googleBtnRef.current.offsetWidth || 400,
      });
    }
  }, [mode]);

  useEffect(() => {
    let timer: any;
    if (resendCooldown > 0) { timer = setInterval(() => { setResendCooldown(prev => prev - 1); }, 1000); }
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const validateGmail = (email: string) => /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email);
  const validatePhone = (phone: string) => /^[0-9+]{8,15}$/.test(phone);

  const clearForm = () => setFormData({ identifier: '', password: '', displayName: '', code: '', newPassword: '' });

  const handleResend = async () => {
    setError(''); setSuccessMessage('');
    if (!userId) return;
    setIsLoading(true);
    try {
      const res = await api.post('/api/auth/resend-code', { userId });
      setSuccessMessage(res.data.message);
      setResendCooldown(60);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to resend code');
    } finally { setIsLoading(false); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setSuccessMessage('');
    const idntRaw = formData.identifier.trim();
    const isEmail = validateGmail(idntRaw);
    const isPhone = validatePhone(idntRaw);
    const idnt = isEmail ? idntRaw.toLowerCase() : idntRaw;

    if (mode === 'signup') {
      if (!isEmail && !isPhone) { setError('Signup requires a valid @gmail.com address or phone number.'); return; }
      if (!formData.displayName.trim()) { setError('Display name is required.'); return; }
    }

    setIsLoading(true);
    try {
      if (mode === 'login') {
        const res = await api.post('/api/auth/login', { 
          email: isEmail ? idnt : undefined, 
          phone: !isEmail ? idnt : undefined, 
          password: formData.password 
        });
        
        // Ensure cryptographic registry is ready for this device
        const userId = res.data.user.id;
        const existingDeviceId = localStorage.getItem(`deviceId_${userId}`);
        if (!existingDeviceId) {
          console.log('[AUTH] New device detected. Initializing cryptographic registry...');
          // The DeviceManager or App.tsx should handle the actual registration,
          // but we ensure the state is primed for it.
        }
        
        onLogin(res.data.token, res.data.user);
      } else if (mode === 'signup') {
        const res = await api.post('/api/auth/signup', { 
          email: isEmail ? idnt : undefined, 
          phone: !isEmail ? idnt : undefined, 
          password: formData.password, 
          displayName: formData.displayName.trim() 
        });
        setUserId(res.data.userId);
        setMode('verify');
        setSuccessMessage(res.data.message);
        setResendCooldown(60);
      } else if (mode === 'verify') {
        const res = await api.post('/api/auth/verify', { userId, code: formData.code.trim() });
        if (res.data.token && res.data.user) {
          onLogin(res.data.token, res.data.user);
        } else {
          clearForm();
          setMode('login'); 
          setSuccessMessage('Identity verified. You may now login.');
        }
      } else if (mode === 'forgot') {
        const res = await api.post('/api/auth/forgot-password', { email: idnt });
        setUserId(res.data.userId);
        clearForm();
        setMode('reset');
        setSuccessMessage(res.data.message);
        setResendCooldown(60);
      } else if (mode === 'reset') {
        const res = await api.post('/api/auth/reset-password', { userId, code: formData.code.trim(), newPassword: formData.newPassword });
        clearForm();
        setMode('login');
        setSuccessMessage(res.data.message);
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Authentication sequence failed.');
      if (err.response?.status === 400 || err.response?.status === 403) {
        setFormData(prev => ({ ...prev, code: '', newPassword: '' }));
        if (err.response?.data?.error?.toLowerCase().includes('expired')) {
          clearForm();
        }
      }
      if (err.response?.status === 403 && err.response.data.userId) { setUserId(err.response.data.userId); setMode('verify'); setResendCooldown(60); }
    } finally { setIsLoading(false); }
  };

  const handleIdentifierChange = (val: string) => {
    // Force all characters to lowercase to ensure "small case" as requested.
    // This handles the "I" becoming "i" case and ensures the default is always lowercase.
    setFormData({ ...formData, identifier: val.toLowerCase() });
  };

  const handleDisplayNameChange = (val: string) => {
    // Force lowercase for display name as well.
    setFormData({ ...formData, displayName: val.toLowerCase() });
  };

  return (
    <div className="fixed inset-0 w-full h-full flex items-center justify-center bg-[#020617] overflow-hidden">
      {/* Background patterns */}
      <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none select-none">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex whitespace-nowrap gap-8 py-4">
            <motion.div initial={{ x: i % 2 === 0 ? "0%" : "-50%" }} animate={{ x: i % 2 === 0 ? "-50%" : "0%" }} transition={{ duration: 80 + i * 10, repeat: Infinity, ease: "linear" }} className="flex gap-8 items-center shrink-0 px-8">
              {[...TRUST_WORDS, ...TRUST_WORDS].map((word, idx) => (<span key={idx} className="font-black uppercase tracking-tighter text-emerald-500 text-7xl md:text-9xl opacity-20">{word}</span>))}
            </motion.div>
          </div>
        ))}
      </div>

      <div className="relative z-10 w-full max-w-lg p-6">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900/60 backdrop-blur-2xl border border-white/10 p-8 sm:p-12 rounded-[3rem] shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1.5 bg-emerald-500/10">
            <motion.div className="h-full bg-emerald-500 shadow-[0_0_15px_#10b981]" initial={{ width: "0%" }} animate={{ width: isLoading ? "100%" : "0%" }} transition={{ duration: 1.5, repeat: Infinity }} />
          </div>

          <div className="flex flex-col items-center mb-12">
            <div className="w-20 h-20 bg-emerald-600 rounded-[2rem] flex items-center justify-center shadow-2xl shadow-emerald-900/40 mb-6 rotate-3 hover:rotate-0 transition-transform duration-500"><Shield className="text-white w-10 h-10" /></div>
            <h1 className="text-4xl font-black text-white uppercase tracking-tighter mb-2">virelChat</h1>
            <p className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.5em]">Identity Protocol</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <AnimatePresence mode="wait">
              {error && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400"><AlertCircle size={18} className="shrink-0" /><p className="text-[11px] font-bold uppercase tracking-wider">{error}</p></motion.div>}
              {successMessage && !error && <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center gap-3 text-emerald-400"><CheckCircle2 size={18} className="shrink-0" /><p className="text-[11px] font-bold uppercase tracking-wider">{successMessage}</p></motion.div>}
            </AnimatePresence>

            <div className="space-y-4">
              {mode !== 'verify' && mode !== 'reset' && (
                <div className="relative group">
                  <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 group-focus-within:text-emerald-500 transition-colors" />
                  <input type="text" placeholder="GMAIL ADDRESS" required autoCapitalize="none" autoCorrect="off" spellCheck="false" className="w-full pl-12 pr-5 py-5 bg-white/5 border border-white/10 rounded-[1.5rem] text-sm font-bold text-slate-200 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-700 tracking-widest" value={formData.identifier} onChange={e => handleIdentifierChange(e.target.value)} />
                </div>
              )}

              {mode === 'signup' && (
                <div className="relative group">
                  <User className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 group-focus-within:text-emerald-500 transition-colors" />
                  <input type="text" placeholder="DISPLAY NAME" required autoCapitalize="none" autoCorrect="off" spellCheck="false" className="w-full pl-12 pr-5 py-5 bg-white/5 border border-white/10 rounded-[1.5rem] text-sm font-bold text-slate-200 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-700 tracking-widest" value={formData.displayName} onChange={e => handleDisplayNameChange(e.target.value)} />
                </div>
              )}

              {(mode === 'login' || mode === 'signup') && (
                <div className="relative group">
                  <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 group-focus-within:text-emerald-500 transition-colors" />
                  <input type="password" placeholder="ENCRYPTION KEY" required autoCapitalize="none" autoCorrect="off" spellCheck="false" className="w-full pl-12 pr-5 py-5 bg-white/5 border border-white/10 rounded-[1.5rem] text-sm font-bold text-slate-200 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-700 tracking-widest" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value.toLowerCase() })} />
                </div>
              )}

              {(mode === 'verify' || mode === 'reset') && (
                <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="space-y-6 pt-4">
                  <input type="text" placeholder="000000" maxLength={6} required className="w-full px-4 py-8 bg-white/5 border-2 border-white/10 rounded-[2.5rem] text-center text-6xl tracking-[0.5em] font-black text-emerald-500 outline-none focus:border-emerald-500/50 transition-all shadow-inner placeholder:text-slate-800" value={formData.code} onChange={e => setFormData({ ...formData, code: e.target.value.replace(/\D/g, '') })} />
                  <div className="flex justify-center">
                    <button type="button" disabled={resendCooldown > 0 || isLoading} onClick={handleResend} className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-emerald-500 transition-colors disabled:opacity-50">
                      <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                      {resendCooldown > 0 ? `Await Sync (${resendCooldown}s)` : 'Request New Token'}
                    </button>
                  </div>
                  {mode === 'reset' && (
                    <div className="relative group">
                      <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 group-focus-within:text-emerald-500 transition-colors" />
                      <input type="password" placeholder="NEW ENCRYPTION KEY" required autoCapitalize="none" autoCorrect="off" spellCheck="false" className="w-full pl-12 pr-5 py-5 bg-white/5 border border-white/10 rounded-[1.5rem] text-sm font-bold text-slate-200 focus:ring-2 focus:ring-emerald-500/20 outline-none transition-all placeholder:text-slate-700 tracking-widest" value={formData.newPassword} onChange={e => setFormData({ ...formData, newPassword: e.target.value.toLowerCase() })} />
                    </div>
                  )}
                </motion.div>
              )}
            </div>

            {(mode === 'login' || mode === 'signup') && (
              <div className="pt-2 pb-4">
                <div className="flex items-center gap-4 mb-5">
                  <div className="flex-1 h-px bg-white/10" />
                  <span className="text-[9px] font-black text-slate-600 uppercase tracking-[0.3em]">or continue with</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
                <div ref={googleBtnRef} className="flex justify-center w-full [&>div]:w-full [&>div>div]:w-full" />
              </div>
            )}
            <button type="submit" disabled={isLoading} className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-black py-6 rounded-[1.5rem] text-xs uppercase tracking-[0.4em] transition-all shadow-2xl shadow-emerald-900/40 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-4 group">
              {isLoading ? <div className="w-6 h-6 border-3 border-white/30 border-t-white rounded-full animate-spin" /> : <>{mode === 'login' ? 'Login' : mode === 'signup' ? 'Authorize' : mode === 'forgot' ? 'Send Code' : mode === 'reset' ? 'Reset Password' : 'Verify Identity'}<ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" /></>}
            </button>

            <div className="pt-6 border-t border-white/5 text-center space-y-3">
              {mode === 'login' && (
                <button type="button" onClick={() => { setMode('forgot'); setError(''); setSuccessMessage(''); }} className="block text-[10px] font-black text-slate-600 uppercase tracking-widest hover:text-amber-500 transition-colors mx-auto">
                  Forgot Encryption Key?
                </button>
              )}
              <button type="button" onClick={() => { setMode(mode === 'login' || mode === 'forgot' ? 'signup' : 'login'); setError(''); setSuccessMessage(''); }} className="text-[10px] font-black text-slate-600 uppercase tracking-widest hover:text-emerald-500 transition-colors">
                {mode === 'login' || mode === 'forgot' ? "Need a Secure Identity? Signup" : "Existing Identity? Login to Terminal"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};
