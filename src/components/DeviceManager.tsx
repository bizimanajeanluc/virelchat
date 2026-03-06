import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { CryptoEngine } from '../crypto/engine';
import { Shield, Smartphone, Monitor, Trash2, Plus, CheckCircle2, AlertTriangle, Key } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';

interface DeviceManagerProps {
  user: any;
}

export const DeviceManager: React.FC<DeviceManagerProps> = ({ user }) => {
  const [devices, setDevices] = useState<any[]>([]);
  const [currentKeys, setCurrentKeys] = useState<any>(null);
  const [isRegistering, setIsRegistering] = useState(false);

  useEffect(() => {
    fetchDevices();
    CryptoEngine.getStoredKeys(user.id).then(setCurrentKeys);
  }, []);

  const fetchDevices = async () => {
    // In a real app, we'd have a GET /api/devices endpoint
    // For this demo, we'll simulate the response
    const res = await api.get(`/keys/${user.id}`);
    setDevices(res.data);
  };

  const registerCurrentDevice = async () => {
    setIsRegistering(true);
    try {
      let keys = await CryptoEngine.getStoredKeys(user.id);
      if (!keys) {
        keys = await CryptoEngine.generateDeviceKeys(user.id);
      }

      let deviceId = localStorage.getItem('deviceId');
      if (!deviceId) {
        deviceId = 'web-device-' + Math.random().toString(36).substr(2, 9);
        localStorage.setItem('deviceId', deviceId);
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
      alert('Device registered successfully!');
    } catch (err) {
      console.error(err);
    } finally {
      setIsRegistering(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-stone-50 p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-3xl font-bold text-stone-900 tracking-tight">Device Management</h2>
            <p className="text-stone-500 mt-1">Manage your secure endpoints and cryptographic keys.</p>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => window.open('/api/download', '_blank')}
              className="bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold px-6 py-3 rounded-2xl transition-all flex items-center gap-2"
            >
              <Plus className="w-5 h-5 rotate-45" />
              Download Project Source
            </button>
            <button 
              onClick={registerCurrentDevice}
              disabled={isRegistering}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-2xl shadow-lg shadow-emerald-100 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Plus className="w-5 h-5" />
              {isRegistering ? 'Registering...' : 'Register This Device'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {devices.map((device, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-6 border border-stone-200 shadow-sm relative group"
            >
              <div className="flex items-start gap-4">
                <div className="bg-stone-100 p-4 rounded-2xl text-stone-400">
                  {device.deviceName?.includes('Chrome') ? <Monitor className="w-6 h-6" /> : <Smartphone className="w-6 h-6" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-stone-900">{device.deviceName || 'Unknown Device'}</h3>
                    {i === 0 && (
                      <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">Current</span>
                    )}
                  </div>
                  <p className="text-xs text-stone-400 mt-1 flex items-center gap-1">
                    <Key className="w-3 h-3" />
                    ID: {device.deviceId}
                  </p>
                  <div className="mt-4 flex items-center gap-2 text-xs font-medium text-stone-500 bg-stone-50 p-2 rounded-xl">
                    <Shield className="w-3.5 h-3.5 text-emerald-500" />
                    Identity Key: {device.identityKey.substring(0, 16)}...
                  </div>
                </div>
              </div>
              <button className="absolute top-6 right-6 p-2 text-stone-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                <Trash2 className="w-5 h-5" />
              </button>
            </motion.div>
          ))}
        </div>

        <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-emerald-100 p-3 rounded-2xl">
              <Key className="text-emerald-600 w-6 h-6" />
            </div>
            <h3 className="text-xl font-bold text-stone-900">Your Identity Keys</h3>
          </div>
          
          <div className="space-y-6">
            <div className="p-6 bg-stone-50 rounded-2xl border border-stone-100">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider">Public Identity Key</span>
                <div className="flex items-center gap-1 text-emerald-600 text-xs font-bold">
                  <CheckCircle2 className="w-4 h-4" />
                  Verified
                </div>
              </div>
              <code className="block text-sm text-stone-600 break-all font-mono leading-relaxed">
                {currentKeys?.identityKey.publicKey}
              </code>
            </div>

            <div className="bg-amber-50 border border-amber-100 p-6 rounded-2xl flex gap-4">
              <AlertTriangle className="text-amber-600 w-6 h-6 shrink-0" />
              <div>
                <h4 className="font-bold text-amber-900 mb-1">Safety Numbers</h4>
                <p className="text-sm text-amber-800 leading-relaxed">
                  Safety numbers are used to verify that your messages are encrypted with the correct keys. 
                  If a contact's identity key changes, you will be notified. This prevents man-in-the-middle attacks.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
