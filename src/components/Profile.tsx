import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { User, Camera, Shield, MapPin, Info, Save, CheckCircle2, Settings, Trash2, RotateCcw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getSocket } from '../services/socket';
import { format } from 'date-fns';

interface ProfileProps {
  user: any;
}

export const Profile: React.FC<ProfileProps> = ({ user }) => {
  if (!user) return <div className="h-full flex items-center justify-center bg-stone-50">Loading profile...</div>;

  const [profile, setProfile] = useState({
    displayName: user?.displayName || '',
    about: user?.about || 'Available',
    profilePicture: user?.profilePicture || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [deletedMessages, setDeletedMessages] = useState<any[]>([]);

  useEffect(() => {
    fetchTrash();

    const socket = getSocket();
    socket?.on('message_restored', () => fetchTrash());
    socket?.on('message_deleted', () => fetchTrash());

    return () => {
      socket?.off('message_restored');
      socket?.off('message_deleted');
    };
  }, []);

  const fetchTrash = async () => {
    try {
      const res = await api.get('/messages/trash');
      setDeletedMessages(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch trash', err);
      setDeletedMessages([]);
    }
  };

  const restoreMessage = (messageGroupId: string) => {
    getSocket()?.emit('restore_message', { messageGroupId });
    setDeletedMessages(prev => prev.filter(m => m.message_group_id !== messageGroupId));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await api.put(`/users/${user.id}`, profile);
      // Update local storage user
      const updatedUser = { ...user, displayName: profile.displayName, about: profile.about, profilePicture: profile.profilePicture };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const img = new Image();
        img.src = reader.result as string;
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_SIZE = 400;
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > MAX_SIZE) {
              height *= MAX_SIZE / width;
              width = MAX_SIZE;
            }
          } else {
            if (height > MAX_SIZE) {
              width *= MAX_SIZE / height;
              height = MAX_SIZE;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setProfile({ ...profile, profilePicture: compressedBase64 });
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const safeFormatDate = (dateStr: string) => {
    try {
      if (!dateStr) return 'Unknown Date';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return format(date, 'MMM d, HH:mm');
    } catch (e) {
      return 'Unknown Date';
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-stone-50 p-6 md:p-12">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-3xl shadow-xl shadow-stone-200/50 border border-stone-200 overflow-hidden">
          <div className="h-32 bg-emerald-600 relative">
            <div className="absolute -bottom-12 left-8">
              <div className="relative group">
                <div className="w-24 h-24 rounded-3xl bg-white p-1 shadow-xl">
                  <div className="w-full h-full rounded-2xl bg-stone-100 flex items-center justify-center text-stone-400 overflow-hidden">
                    {profile.profilePicture ? (
                      <img src={profile.profilePicture} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-10 h-10" />
                    )}
                  </div>
                </div>
                <label className="absolute bottom-1 right-1 bg-emerald-600 text-white p-2 rounded-xl shadow-lg cursor-pointer hover:bg-emerald-700 transition-all">
                  <Camera className="w-4 h-4" />
                  <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
                </label>
              </div>
            </div>
          </div>

          <div className="pt-16 px-8 pb-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-2xl font-bold text-stone-900 tracking-tight">{profile.displayName}</h2>
                <div className="flex items-center gap-2 text-stone-500 text-sm mt-1">
                  <MapPin className="w-4 h-4" />
                  <span>{user?.wardName || 'Salt Lake 1st Ward'}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2 items-end">
                <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-2xl text-xs font-bold border border-emerald-100 flex items-center gap-2">
                  <Shield className="w-4 h-4" />
                  Verified Member
                </div>
                {user?.role === 'admin' && (
                  <div className="bg-stone-900 text-white px-4 py-2 rounded-2xl text-[10px] font-bold uppercase tracking-widest flex items-center gap-2">
                    <Shield className="w-3.5 h-3.5 text-emerald-400" />
                    System Admin
                  </div>
                )}
              </div>
            </div>

            <form onSubmit={handleSave} className="space-y-6">
              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">Display Name</label>
                <div className="relative">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
                  <input 
                    type="text" 
                    className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                    value={profile.displayName}
                    onChange={e => setProfile({ ...profile, displayName: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-stone-400 uppercase tracking-wider ml-1">About / Status</label>
                <div className="relative">
                  <Info className="absolute left-4 top-4 text-stone-400 w-5 h-5" />
                  <textarea 
                    rows={3}
                    className="w-full pl-12 pr-4 py-3.5 bg-stone-50 border border-stone-200 rounded-2xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all resize-none"
                    value={profile.about}
                    onChange={e => setProfile({ ...profile, about: e.target.value })}
                  />
                </div>
              </div>

              <div className="pt-4 flex items-center gap-4">
                <button 
                  type="submit"
                  disabled={isSaving}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-8 py-3.5 rounded-2xl shadow-lg shadow-emerald-100 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {isSaving ? 'Saving...' : 'Save Changes'}
                  {!isSaving && <Save className="w-5 h-5" />}
                </button>
                {showSuccess && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-emerald-600 font-bold flex items-center gap-2"
                  >
                    <CheckCircle2 className="w-5 h-5" />
                    Profile updated!
                  </motion.div>
                )}
              </div>
            </form>
          </div>
        </div>

        <div className="mt-8 space-y-6">
          <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
            <h3 className="font-bold text-stone-900 mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-emerald-600" />
              Privacy Information
            </h3>
            <p className="text-sm text-stone-500 leading-relaxed">
              Your profile information (name, picture, and status) is visible to other members of your ward. 
              Unlike your messages, this information is stored on the server to help your contacts identify you. 
            </p>
          </div>

          <div className="bg-white rounded-3xl p-8 border border-stone-200 shadow-sm">
            <h3 className="font-bold text-stone-900 mb-6 flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-red-500" />
              Deleted Messages (Trash)
            </h3>
            {(!Array.isArray(deletedMessages) || deletedMessages.length === 0) ? (
              <p className="text-sm text-stone-400 italic">No deleted messages found.</p>
            ) : (
              <div className="space-y-4">
                {deletedMessages.map((msg, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-stone-50 rounded-2xl border border-stone-100">
                    <div className="flex-1 min-w-0 mr-4">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold text-stone-900">{msg.sender_name}</span>
                        <span className="text-[10px] text-stone-400 uppercase tracking-tighter">
                          {safeFormatDate(msg.created_at)}
                        </span>
                      </div>
                      <p className="text-xs text-stone-500 italic truncate">
                        [End-to-end encrypted message]
                      </p>
                    </div>
                    <button 
                      onClick={() => restoreMessage(msg.message_group_id)}
                      className="p-2 bg-emerald-50 text-emerald-600 rounded-xl hover:bg-emerald-100 transition-colors flex items-center gap-2 text-xs font-bold"
                      title="Restore Message"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Restore
                    </button>
                  </div>
                ))}
                <p className="text-[10px] text-stone-400 mt-4 italic">
                  * For your security, deleted messages cannot be previewed in the trash, but they can be restored back to their original conversation.
                </p>
              </div>
            )}
          </div>

          <div className="bg-stone-100 rounded-3xl p-8 border border-stone-200 opacity-60">
            <h3 className="font-bold text-stone-900 mb-4 flex items-center gap-2">
              <Settings className="w-5 h-5 text-stone-600" />
              System Settings
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-600">Ward Identity Locking</span>
                <span className="font-bold text-emerald-600">Enabled</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-600">Multi-Device Secure Sync</span>
                <span className="font-bold text-emerald-600">Active</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-stone-600">Encryption Protocol</span>
                <span className="font-mono text-stone-900">Signal v3</span>
              </div>
              <p className="text-[10px] text-stone-400 mt-4 italic">
                * These settings are managed by the Stake/Ward Administrator and cannot be modified by individual members.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
