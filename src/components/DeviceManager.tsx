import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { CryptoEngine } from '../crypto/engine';
import { Shield, Smartphone, Monitor, Trash2, Plus, CheckCircle2, AlertTriangle, Key, RefreshCw, Copy } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface DeviceManagerProps {
  user: any;
}

export const DeviceManager: React.FC<DeviceManagerProps> = ({ user }) => {
  const [devices, setDevices] = useState<any[]>([]);
  const [currentKeys, setCurrentKeys] = useState<any>(null);
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDevices();
    CryptoEngine.getStoredKeys(user.id).then(setCurrentKeys);
  }, []);

  const fetchDevices = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/api/keys/${user.id}`);
      setDevices(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const registerCurrentDevice = async () => {
    setIsRegistering(true);
    try {
      let keys = await CryptoEngine.getStoredKeys(user.id);
      if (!keys) {
        keys = await CryptoEngine.generateDeviceKeys(user.id);
      }

      let deviceId = localStorage.getItem(`deviceId_${user.id}`);
      if (!deviceId) {
        deviceId = 'web-device-' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem(`deviceId_${user.id}`, deviceId);
      }

      await api.post('/devices/register', {
        deviceId,
        deviceName: 'Browser (' + navigator.platform + ')',
        identityKey: keys.identityKey.publicKey,
        signedPreKey: JSON.stringify(keys.signedPreKey),
        registrationId: Math.floor(Math.random() * 10000),
        oneTimePreKeys: keys.oneTimePreKeys.map((k, i) => ({ keyId: i, publicKey: k.publicKey }))
      });

      fetchDevices();
      alert('Endpoint authorized successfully!');
    } catch (err) {
      console.error(err);
    } finally {
      setIsRegistering(false);
    }
  };

  if (loading && devices.length === 0) return (
    <div className="h-full flex items-center justify-center bg-[#020617]">
      <RefreshCw className="w-10 h-10 text-emerald-500 animate-spin" />
    </div>
  );

  return (
    <div className="h-full overflow-y-auto bg-[#020617] p-4 sm:p-8 md:p-12 text-slate-100 scrollbar-hide">
      <div className="max-w-5xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-10 md:mb-16">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-slate-100 uppercase tracking-tighter leading-none mb-2">Registry</h2>
            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-500">Cryptographic Endpoint Management</p>
          </div>
          <button
            onClick={registerCurrentDevice}
            disabled={isRegistering}
            className="w-full md:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-black px-8 py-4 rounded-2xl shadow-xl shadow-emerald-900/40 transition-all flex items-center justify-center gap-3 disabled:opacity-50 active:scale-95 text-[10px] uppercase tracking-widest"
          >
            {isRegistering ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {isRegistering ? 'Syncing...' : 'Add Endpoint'}
          </button>
        </div>

        {/* Devices Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-12 md:mb-20">
          {devices.map((device, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/40 backdrop-blur-md rounded-[2rem] p-6 md:p-8 border border-white/5 shadow-xl relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-[60px] pointer-events-none" />
              
              <div className="flex items-start gap-5 relative z-10">
                <div className="bg-slate-800 p-4 md:p-5 rounded-2xl text-slate-500 border border-white/5 shadow-inner">
                  {device.deviceName?.includes('Browser') ? <Monitor className="w-7 h-7" /> : <Smartphone className="w-7 h-7" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-black text-slate-100 uppercase tracking-tight truncate">{device.deviceName || 'Secure Node'}</h3>
                    {device.deviceId === localStorage.getItem(`deviceId_${user.id}`) && (
                      <span className="bg-emerald-950/30 text-emerald-400 text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-widest border border-emerald-500/20">Active</span>
                    )}
                  </div>
                  <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-4 truncate">UID: {device.deviceId}</p>
                  <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-widest text-slate-400 bg-white/5 p-2.5 rounded-xl border border-white/5">
                    <Shield className="w-3.5 h-3.5 text-emerald-500" />
                    Identity: {device.identityKey?.substring(0, 12) || 'Unknown'}...
                  </div>
                </div>
              </div>
              <button className="absolute top-6 right-6 p-2 text-slate-700 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 className="w-4 h-4" />
              </button>
            </motion.div>
          ))}
        </div>

        {/* Identity Core Section */}
        <div className="bg-slate-900/30 rounded-[2.5rem] p-6 md:p-12 border border-white/5 shadow-2xl relative overflow-hidden">
          <div className="absolute top-[-50%] left-[-10%] w-[60%] h-[150%] bg-emerald-900/10 blur-[120px] pointer-events-none" />
          
          <div className="flex items-center gap-4 mb-10 relative z-10">
            <div className="bg-emerald-950/50 p-4 rounded-2xl border border-emerald-500/20">
              <Key className="text-emerald-500 w-7 h-7" />
            </div>
            <div>
              <h3 className="text-2xl font-black text-slate-100 uppercase tracking-tighter">Identity Vault</h3>
              <p className="text-slate-500 text-[9px] font-black uppercase tracking-[0.3em]">Master Cryptographic Core</p>
            </div>
          </div>
          
          <div className="space-y-6 md:space-y-10 relative z-10">
            <div className="p-6 md:p-10 bg-white/5 rounded-[2rem] border border-white/10 shadow-inner">
              <div className="flex items-center justify-between mb-6">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">Public Identity Packet</span>
                <div className="flex items-center gap-2 text-emerald-400 text-[9px] font-black uppercase tracking-widest bg-emerald-950/30 px-3 py-1 rounded-full border border-emerald-500/20">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Validated
                </div>
              </div>
              <div className="bg-black/40 p-5 md:p-8 rounded-2xl border border-white/5 relative group">
                <code className="block text-[10px] md:text-xs text-slate-400 break-all font-mono leading-relaxed select-all">
                  {currentKeys?.identityKey.publicKey}
                </code>
                <button 
                  onClick={() => { navigator.clipboard.writeText(currentKeys?.identityKey.publicKey || ''); alert('Copied to clipboard'); }}
                  className="absolute top-4 right-4 p-2 bg-emerald-600/10 text-emerald-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all hover:bg-emerald-600/20"
                >
                  <Copy className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="bg-amber-950/20 border border-amber-500/10 p-6 md:p-10 rounded-[2rem] flex flex-col sm:flex-row gap-6 shadow-inner">
              <AlertTriangle className="text-amber-500 w-10 h-10 shrink-0" />
              <div>
                <h4 className="font-black text-amber-200 mb-2 uppercase tracking-widest text-sm">Security Advisory</h4>
                <p className="text-xs md:text-sm text-amber-200/60 leading-relaxed font-medium">
                  Identity keys are unique to your local storage. If you clear your browser cache or re-install the application without a backup, you must generate a new key set. Existing contacts will receive a security notification regarding the change.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
