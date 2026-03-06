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
  const [view, setView] = useState<'chat' | 'profile' | 'devices' | 'admin'>('chat');
  const [isLoading, setIsLoading] = useState(true);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      const storedUser = localStorage.getItem('user');
      if (token && storedUser && mounted) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        
        const socket = initSocket(token);

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
            alert('Your account has been deleted by an administrator.');
          }
        });
        
        // Ensure keys exist for THIS user
        let keys = await CryptoEngine.getStoredKeys(parsedUser.id);
        if (!mounted) return;

        let isNewKeys = false;
        if (!keys) {
          keys = await CryptoEngine.generateDeviceKeys(parsedUser.id);
          isNewKeys = true;
        }

        // Auto-register device if not registered or if backend doesn't know about it
        let deviceId = localStorage.getItem(`deviceId_${parsedUser.id}`);
        const registerDevice = async (id: string) => {
          try {
            await api.post('/devices/register', {
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
          // Verify device still exists in DB AND keys match
          try {
            const res = await api.get(`/keys/${parsedUser.id}`);
            if (!mounted) return;
            const myDevice = res.data.find((d: any) => d.deviceId === deviceId);
            
            // If device missing OR keys changed, re-register
            if (!myDevice || myDevice.identityKey !== keys.identityKey.publicKey || isNewKeys) {
              await registerDevice(deviceId);
            }
          } catch (err) {
            // Probably unauthorized or other error, ignore for now
          }
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
    if (user?.role === 'admin') {
      if (!window.confirm('Are you sure you want to logout? (Always logged in is recommended for admin)')) {
        return;
      }
    }
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setToken(null);
    setUser(null);
    setShowAuth(false);
    disconnectSocket();
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-stone-100">Loading...</div>;

  if (!token) {
    if (showAuth) {
      return (
        <div className="h-screen relative">
          <button 
            onClick={() => setShowAuth(false)}
            className="absolute top-4 left-4 z-[100] flex items-center gap-2 px-4 py-2 bg-white border border-stone-200 rounded-xl font-bold text-stone-600 hover:bg-stone-50 transition-all shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>
          <Auth onLogin={handleLogin} />
        </div>
      );
    }
    return <Landing onGetStarted={() => setShowAuth(true)} />;
  }

  return (
    <div className="h-[100dvh] flex flex-col bg-stone-100 text-stone-900 font-sans overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b border-stone-200 px-4 md:px-6 py-3 md:py-4 flex items-center justify-between shadow-sm shrink-0 z-50">
        <div className="flex items-center gap-2 md:gap-3">
          <div className="bg-emerald-600 p-2 rounded-xl shrink-0">
            <Shield className="text-white w-5 h-5 md:w-6 md:h-6" />
          </div>
          <div className="hidden sm:block">
            <h1 className="font-bold text-base md:text-lg tracking-tight">virelChat</h1>
            <p className="text-[10px] md:text-xs text-stone-500 font-medium uppercase tracking-wider">
              {user?.wardName || 'Salt Lake 1st Ward'}
            </p>
          </div>
        </div>
        
        <nav className="flex items-center gap-1">
          <button 
            onClick={() => setView('chat')}
            className={`p-2.5 rounded-xl transition-all ${view === 'chat' ? 'bg-emerald-50 text-emerald-700' : 'text-stone-500 hover:bg-stone-50'}`}
          >
            <MessageSquare className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setView('profile')}
            className={`p-2.5 rounded-xl transition-all ${view === 'profile' ? 'bg-emerald-50 text-emerald-700' : 'text-stone-500 hover:bg-stone-50'}`}
          >
            <User className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setView('devices')}
            className={`p-2.5 rounded-xl transition-all ${view === 'devices' ? 'bg-emerald-50 text-emerald-700' : 'text-stone-500 hover:bg-stone-50'}`}
          >
            <Settings className="w-5 h-5" />
          </button>
          {user?.role === 'admin' && (
            <button 
              onClick={() => setView('admin')}
              className={`p-2.5 rounded-xl transition-all ${view === 'admin' ? 'bg-emerald-50 text-emerald-700' : 'text-stone-500 hover:bg-stone-50'}`}
              title="Admin Panel"
            >
              <Database className="w-5 h-5" />
            </button>
          )}
          <div className="w-px h-6 bg-stone-200 mx-2" />
          <button 
            onClick={handleLogout}
            className="p-2.5 rounded-xl text-stone-500 hover:bg-red-50 hover:text-red-600 transition-all"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden relative">
        <AnimatePresence mode="wait">
          {view === 'chat' && (
            <motion.div 
              key="chat"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full"
            >
              <Chat user={user} />
            </motion.div>
          )}
          {view === 'profile' && (
            <motion.div 
              key="profile"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full"
            >
              <Profile user={user} />
            </motion.div>
          )}
          {view === 'devices' && (
            <motion.div 
              key="devices"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full"
            >
              <DeviceManager user={user} />
            </motion.div>
          )}
          {view === 'admin' && (
            <motion.div 
              key="admin"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="h-full"
            >
              <Admin />
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
