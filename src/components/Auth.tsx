import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { Shield, Mail, Phone, Lock, User, MapPin, ArrowRight, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface AuthProps {
  onLogin: (token: string, user: any) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const [mode, setMode] = useState<'login' | 'signup' | 'verify'>('login');
  const [wards, setWards] = useState<any[]>([]);
  const [formData, setFormData] = useState({
    email: '',
    phone: '',
    password: '',
    displayName: '',
    wardId: '',
    code: '',
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [error, setError] = useState('');  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    api.get('/wards').then(res => setWards(res.data));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const email = formData.email.trim().toLowerCase();
    const phone = formData.phone.trim();
    const password = formData.password;

    try {
      if (mode === 'login') {
        const res = await api.post('/auth/login', {
          email,
          phone,
          password,
        });
        onLogin(res.data.token, res.data.user);
      } else if (mode === 'signup') {
        const res = await api.post('/auth/signup', {
          email,
          phone,
          password,
          displayName: formData.displayName.trim(),
          wardId: formData.wardId,
        });
        setUserId(res.data.userId);
        if (res.data.isVerified) {
          setMode('login');
          alert('Admin account created successfully! Please login.');
        } else {
          setMode('verify');
        }
      } else if (mode === 'verify') {
        await api.post('/auth/verify', {
          userId,
          code: formData.code.trim(),
        });
        setMode('login');
        alert('Verification successful! Please login with your credentials.');
      }
    } catch (err: any) {
      const msg = err.response?.data?.error || err.message || 'An error occurred';
      setError(msg);
      if (err.response?.status === 403 && err.response.data.userId) {
        setUserId(err.response.data.userId);
        setMode('verify');
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full bg-white rounded-3xl shadow-xl shadow-stone-200/50 border border-stone-200 overflow-hidden"
      >
        <div className="p-8">
          <div className="flex flex-col items-center mb-8">
            <div className="bg-emerald-600 p-4 rounded-2xl mb-4 shadow-lg shadow-emerald-200">
              <Shield className="text-white w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-stone-900 tracking-tight">
              {mode === 'login' ? 'Welcome Back' : mode === 'signup' ? 'Join virelChat' : 'Verify Identity'}
            </h2>
            <p className="text-stone-500 text-sm mt-1">
              {mode === 'login' ? 'Secure end-to-end encrypted messaging' : mode === 'signup' ? 'Create your private secure account' : 'Enter the 6-digit code sent to you'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium border border-red-100">
                {error}
              </div>
            )}

            {mode !== 'verify' && (
              <>
                <div className="space-y-4">
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
                    <input
                      type="email"
                      placeholder="Email Address"
                      className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                      value={formData.email}
                      onChange={e => setFormData({ ...formData, email: e.target.value })}
                    />
                  </div>
                  
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
                    <input
                      type="tel"
                      placeholder="Phone Number (Optional)"
                      className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                      value={formData.phone}
                      onChange={e => setFormData({ ...formData, phone: e.target.value })}
                    />
                  </div>
                </div>

                {mode === 'signup' && (
                  <>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
                      <input
                        type="text"
                        placeholder="Display Name"
                        required
                        className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                        value={formData.displayName}
                        onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                      />
                    </div>
                    <div className="relative">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
                      <select
                        className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all appearance-none"
                        value={formData.wardId}
                        onChange={e => setFormData({ ...formData, wardId: e.target.value })}
                      >
                        <option value="">Select Ward (Optional)</option>
                        {wards.map(w => (
                          <option key={w.id} value={w.id}>{w.name}</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
                  <input
                    type="password"
                    placeholder="Password"
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all"
                    value={formData.password}
                    onChange={e => setFormData({ ...formData, password: e.target.value })}
                  />
                </div>
              </>
            )}

            {mode === 'verify' && (
              <div className="space-y-4">
                <div className="text-center mb-6">
                  <p className="text-stone-600">
                    A verification code has been sent to your {formData.email ? 'email' : 'phone'}.
                  </p>
                  <p className="text-sm text-stone-400 mt-1">Please enter the 6-digit code below to continue.</p>
                </div>
                <div className="relative">
                  <CheckCircle2 className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
                  <input
                    type="text"
                    placeholder="6-Digit Code"
                    maxLength={6}
                    required
                    className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition-all text-center text-2xl tracking-[0.5em] font-bold"
                    value={formData.code}
                    onChange={e => setFormData({ ...formData, code: e.target.value })}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 group disabled:opacity-50"
            >
              {isLoading ? 'Processing...' : mode === 'login' ? 'Login' : mode === 'signup' ? 'Create Account' : 'Verify'}
              {!isLoading && <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-stone-100 text-center">
            <button
              onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
              className="text-emerald-600 font-semibold hover:text-emerald-700 transition-colors"
            >
              {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Login'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
