import React, { useState, useEffect } from 'react';
import api from './services/api';
import { Auth } from './components/Auth';
import { Chat } from './components/Chat';
import { Profile } from './components/Profile';
import { Admin } from './components/Admin';
import { DeviceManager } from './components/DeviceManager';
import { Landing } from './components/Landing';
import { initSocket, disconnectSocket } from './services/socket';
import { CryptoEngine } from './crypto/engine';
import { Shield, MessageSquare, User, Settings, LogOut, Database, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [view, setView] = useState<'chat' | 'devices' | 'admin'>('chat');
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);
  const [textTransformation, setTextTransformation] = useState<string>(localStorage.getItem('textTransformation') || 'none');

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      const storedUser = localStorage.getItem('user');
      if (token && storedUser && mounted) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        
        const socket = initSocket(token);

        socket.on('text_transform_updated', (data) => {
          if (mounted) {
            setTextTransformation(data.mode);
            localStorage.setItem('textTransformation', data.mode);
          }
        });

        socket.on('profile_interaction', (data) => {
          console.log('[SOCKET] Profile interaction:', data);
        });

        socket.on('profile_updated', (data) => {
          if (mounted && data.userId === parsedUser.id) {
            setUser(prev => {
              if (!prev) return prev;
              const updated = { ...prev, displayName: data.displayName, profilePicture: data.profilePicture, about: data.about, role: data.role || prev.role };
              localStorage.setItem('user', JSON.stringify(updated));
              return updated;
            });
          }
        });

        socket.on('user_role_updated', (data) => {
          if (mounted) {
            setUser(prev => {
              if (!prev) return prev;
              const updated = { ...prev, role: data.role };
              localStorage.setItem('user', JSON.stringify(updated));
              return updated;
            });
          }
        });
        
        socket.on('user_deleted', (data) => {
          if (mounted && data.userId === parsedUser.id) {
            handleLogout();
          }
        });
        
        let keys = await CryptoEngine.getStoredKeys(parsedUser.id);
        if (!mounted) return;

        let isNewKeys = false;
        if (!keys) {
          keys = await CryptoEngine.generateDeviceKeys(parsedUser.id);
          isNewKeys = true;
        }

        let deviceId = localStorage.getItem(`deviceId_${parsedUser.id}`);
        const registerDevice = async (id: string) => {
          try {
            await api.post('/api/devices/register', {
              deviceId: id,
              deviceName: 'Browser (' + navigator.platform + ')',
              identityKey: keys!.identityKey.publicKey,
              signedPreKey: JSON.stringify(keys!.signedPreKey),
              registrationId: Math.floor(Math.random() * 10000),
              oneTimePreKeys: keys!.oneTimePreKeys.map((k, i) => ({ keyId: i, publicKey: k.publicKey }))
            });
            if (mounted) localStorage.setItem(`deviceId_${parsedUser.id}`, id);
          } catch (err) {
            console.error('Registration failed', err);
          }
        };

        if (!deviceId) {
          deviceId = 'web-device-' + Math.random().toString(36).substr(2, 9);
          await registerDevice(deviceId);
        } else {
          try {
            const res = await api.get(`/api/keys/${parsedUser.id}`);
            if (!mounted) return;
            const myDevice = res.data.find((d: any) => d.deviceId === deviceId);
            if (!myDevice || myDevice.identityKey !== keys.identityKey.publicKey || isNewKeys) {
              await registerDevice(deviceId);
            }
          } catch (err) {}
        }
      }
      if (mounted) setIsLoading(false);
    };
    checkAuth();

    return () => {
      mounted = false;
      disconnectSocket();
    };
  }, [token]);

  const handleLogin = (newToken: string, newUser: any) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    setShowAuth(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setShowAuth(false);
    disconnectSocket();
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-[#020617] text-emerald-500">Loading...</div>;

  if (!token) {
    if (showAuth) {
      return (
        <div className="fixed inset-0 bg-[#020617] z-[100] flex items-center justify-center p-0 md:p-4 overflow-y-auto">
          <button 
            onClick={() => setShowAuth(false)}
            className="absolute top-4 left-4 z-[110] flex items-center gap-2 px-4 py-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-xl font-bold text-stone-300 hover:bg-white/10 transition-all shadow-xl"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline uppercase text-[10px] tracking-widest">Back</span>
          </button>
          <Auth onLogin={handleLogin} />
        </div>
      );
    }
    return <Landing onGetStarted={() => setShowAuth(true)} />;
  }

  const navItems = [
    { id: 'chat', icon: MessageSquare, label: 'Chat', action: () => { setView('chat'); setIsProfileOpen(false); } },
    { id: 'profile', icon: User, label: 'Profile', action: () => { 
      setIsProfileOpen(true); 
      initSocket(token!)?.emit('profile_interaction', { event: 'self_profile_opened', userId: user?.id });
    } },
    { id: 'devices', icon: Settings, label: 'Vault', action: () => { setView('devices'); setIsProfileOpen(false); } },
    ...(user?.role === 'admin' ? [{ id: 'admin', icon: Database, label: 'Terminal', action: () => { setView('admin'); setIsProfileOpen(false); } }] : [])
  ];

  return (
    <div className="fixed inset-0 h-[100dvh] w-full flex flex-col bg-[#020617] text-slate-100 font-sans overflow-hidden" style={{ textTransform: textTransformation as any }}>
      {/* Header - Desktop Only */}
      <header 
        className="hidden md:flex bg-slate-950/50 backdrop-blur-2xl border-b border-white/5 py-4 items-center justify-between shadow-2xl shrink-0 z-50 px-8"
      >
        <div className="flex items-center gap-3">
          <div className="bg-emerald-600 p-2 rounded-xl shrink-0 shadow-lg shadow-emerald-900/20">
            <Shield className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-black text-lg tracking-tighter uppercase leading-none">virelChat</h1>
            <p className="text-[10px] text-emerald-500 font-black uppercase tracking-[0.2em] mt-1">
              {user?.wardName || 'SECURE NETWORK'}
            </p>
          </div>
        </div>
        
        <nav className="flex items-center gap-2">
          {navItems.map(({ id, icon: Icon, action }) => (
            <button 
              key={id}
              onClick={action}
              className={`p-3 rounded-xl transition-all duration-300 relative group ${(view === id && !isProfileOpen) || (id === 'profile' && isProfileOpen) ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40' : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'}`}
            >
              <Icon className="w-5 h-5" />
              {((view === id && !isProfileOpen) || (id === 'profile' && isProfileOpen)) && <motion.div layoutId="desktop-nav-active" className="absolute -bottom-1 left-2 right-1 h-0.5 bg-emerald-400 rounded-full" />}
            </button>
          ))}
          <div className="w-px h-6 bg-white/10 mx-2" />
          <button 
            onClick={handleLogout}
            className="p-3 rounded-xl text-slate-500 hover:bg-red-900/20 hover:text-red-400 transition-all"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </nav>
      </header>

      {/* Header - Mobile Only (Compact) */}
      <header className="flex md:hidden bg-slate-950/80 backdrop-blur-3xl border-b border-white/5 py-3 px-4 items-center justify-between z-50 shrink-0">
        <div className="flex items-center gap-2">
          <div className="bg-emerald-600 p-1.5 rounded-lg">
            <Shield className="text-white w-4 h-4" />
          </div>
          <h1 className="font-black text-sm tracking-tighter uppercase">virelChat</h1>
        </div>
        <button onClick={handleLogout} className="p-2 text-slate-500 active:text-red-400">
          <LogOut className="w-4 h-4" />
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative pb-[max(env(safe-area-inset-bottom),0px)] md:pb-0">
        <AnimatePresence mode="wait">
          <motion.div 
            key={view}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="h-full"
          >
            {view === 'chat' && <Chat user={user} />}
            {view === 'devices' && <DeviceManager user={user} />}
            {view === 'admin' && <Admin />}
          </motion.div>
        </AnimatePresence>

        <AnimatePresence>
          {isProfileOpen && (
            <div className="fixed inset-0 z-[100] flex justify-end">
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsProfileOpen(false)}
                className="absolute inset-0 bg-black/60 backdrop-blur-sm md:backdrop-blur-none"
              />
              <motion.div 
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="relative w-full md:w-[400px] h-full bg-[#020617] border-l border-white/10 shadow-2xl overflow-hidden"
              >
                <Profile user={user} onClose={() => setIsProfileOpen(false)} />
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </main>

      {/* Mobile Navigation - Tab Bar */}
      <nav className="flex md:hidden bg-slate-950/90 backdrop-blur-3xl border-t border-white/10 px-4 py-2 justify-around items-center z-50 shrink-0 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        {navItems.map(({ id, icon: Icon, label, action }) => (
          <button 
            key={id}
            onClick={action}
            className="flex flex-col items-center gap-1 py-1.5 px-4 relative"
          >
            <div className={`p-2 rounded-2xl transition-all duration-300 ${((view === id && !isProfileOpen) || (id === 'profile' && isProfileOpen)) ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/40 scale-110' : 'text-slate-500'}`}>
              <Icon className="w-5 h-5" />
            </div>
            <span className={`text-[8px] font-black uppercase tracking-widest transition-colors ${((view === id && !isProfileOpen) || (id === 'profile' && isProfileOpen)) ? 'text-emerald-400' : 'text-slate-600'}`}>
              {label}
            </span>
            {((view === id && !isProfileOpen) || (id === 'profile' && isProfileOpen)) && (
              <motion.div layoutId="mobile-nav-active" className="absolute -top-2 left-1/2 -translate-x-1/2 w-8 h-1 bg-emerald-500 rounded-full shadow-[0_0_10px_#10b981]" />
            )}
          </button>
        ))}
      </nav>
    </div>
  );
}
