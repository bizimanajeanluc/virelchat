import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { 
  User, Camera, Shield, MapPin, Info, Save, CheckCircle2, 
  Settings, Trash2, RotateCcw, X, ChevronRight, Lock, 
  Bell, HelpCircle, Star, Image as ImageIcon, FileText, 
  Link as LinkIcon, Download, ZoomIn, ZoomOut
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getSocket } from '../services/socket';
import { format } from 'date-fns';

interface ProfileProps {
  user: any;
  onClose: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ user, onClose }) => {
  if (!user) return <div className="h-full flex items-center justify-center bg-[#020617] text-emerald-500">Loading profile...</div>;

  const [profile, setProfile] = useState({
    displayName: user?.displayName || '',
    about: user?.about || 'Available',
    profilePicture: user?.profilePicture || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [deletedMessages, setDeletedMessages] = useState<any[]>([]);

  const [textTransformation, setTextTransformation] = useState(localStorage.getItem('textTransformation') || 'none');
  const [forceLowercase, setForceLowercase] = useState(localStorage.getItem('forceLowercase') === 'true');

  const emitInteraction = (event: string, extra = {}) => {
    getSocket()?.emit('profile_interaction', { event, userId: user.id, ...extra });
  };

  const handleSettingChange = (type: 'transform' | 'force', value: string | boolean) => {
    if (type === 'transform') {
      setTextTransformation(value as string);
      localStorage.setItem('textTransformation', value as string);
      getSocket()?.emit('update_text_transform', { mode: value });
      window.dispatchEvent(new CustomEvent('text_transform_updated', { detail: { mode: value } }));
    } else {
      setForceLowercase(value as boolean);
      localStorage.setItem('forceLowercase', String(value));
    }
    emitInteraction('settings_updated', { type, value });
  };

  useEffect(() => {
    fetchTrash();
    const socket = getSocket();
    socket?.on('message_restored', () => fetchTrash());
    socket?.on('message_deleted', () => fetchTrash());
    
    emitInteraction('profile_info_viewed');

    return () => {
      socket?.off('message_restored');
      socket?.off('message_deleted');
    };
  }, []);

  const fetchTrash = async () => {
    try {
      const res = await api.get('/api/messages/trash');
      setDeletedMessages(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch trash', err);
      setDeletedMessages([]);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const res = await api.put(`/api/users/${user.id}`, {
        displayName: profile.displayName,
        about: profile.about,
        profilePicture: profile.profilePicture
      });
      const updatedUser = { ...user, displayName: profile.displayName, about: profile.about, profilePicture: profile.profilePicture };
      localStorage.setItem('user', JSON.stringify(updatedUser));
      setShowSuccess(true);
      emitInteraction('profile_updated', { name: profile.displayName, about: profile.about });
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      alert('Failed to update profile: ' + (err.response?.data?.error || err.message));
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
          if (width > height) { if (width > MAX_SIZE) { height *= MAX_SIZE / width; width = MAX_SIZE; } }
          else { if (height > MAX_SIZE) { width *= MAX_SIZE / height; height = MAX_SIZE; } }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.7);
          setProfile({ ...profile, profilePicture: compressedBase64 });
          emitInteraction('profile_photo_updated');
        };
      };
      reader.readAsDataURL(file);
    }
  };

  const PhotoViewer = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center p-4"
    >
      <div className="absolute top-6 left-6 flex items-center gap-4">
        <button onClick={() => setShowPhotoViewer(false)} className="p-2 text-white hover:bg-white/10 rounded-full transition-colors">
          <X className="w-6 h-6" />
        </button>
        <span className="text-white font-bold">Profile Photo</span>
      </div>
      <div className="absolute top-6 right-6 flex items-center gap-2">
        <button onClick={() => setZoomLevel(prev => Math.min(prev + 0.5, 3))} className="p-2 text-white hover:bg-white/10 rounded-full transition-colors">
          <ZoomIn className="w-6 h-6" />
        </button>
        <button onClick={() => setZoomLevel(prev => Math.max(prev - 0.5, 1))} className="p-2 text-white hover:bg-white/10 rounded-full transition-colors">
          <ZoomOut className="w-6 h-6" />
        </button>
        {profile.profilePicture && (
          <a href={profile.profilePicture} download="profile-photo.jpg" className="p-2 text-white hover:bg-white/10 rounded-full transition-colors">
            <Download className="w-6 h-6" />
          </a>
        )}
      </div>
      <motion.div 
        animate={{ scale: zoomLevel }}
        className="relative w-full max-w-2xl aspect-square"
      >
        {profile.profilePicture ? (
          <img src={profile.profilePicture} alt="Profile" className="w-full h-full object-contain" />
        ) : (
          <div className="w-full h-full bg-slate-900 flex items-center justify-center">
            <User className="w-32 h-32 text-slate-700" />
          </div>
        )}
      </motion.div>
    </motion.div>
  );

  return (
    <div className="h-full flex flex-col bg-[#0b141a] text-slate-100 font-sans">
      <AnimatePresence>
        {showPhotoViewer && <PhotoViewer />}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-[#111b21] h-28 flex items-end px-6 pb-4 shrink-0 border-b border-white/5">
        <div className="flex items-center gap-6 w-full">
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X className="w-6 h-6" />
          </button>
          <h2 className="text-xl font-bold">Profile</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-hide pb-12">
        {/* Profile Photo Section */}
        <div className="py-8 flex flex-col items-center gap-4">
          <div className="relative group cursor-pointer" onClick={() => { setShowPhotoViewer(true); emitInteraction('profile_photo_clicked'); }}>
            <div className="w-[120px] h-[120px] md:w-[140px] md:h-[140px] rounded-full overflow-hidden bg-slate-800 ring-4 ring-emerald-500/20 shadow-2xl relative">
              {profile.profilePicture ? (
                <img src={profile.profilePicture} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <User className="w-16 h-16 text-slate-500" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-black uppercase tracking-widest">
                <Camera className="w-6 h-6 mb-1" />
                Change Photo
              </div>
            </div>
            <label onClick={e => e.stopPropagation()} className="absolute bottom-1 right-1 bg-emerald-500 text-white p-2.5 rounded-full shadow-xl cursor-pointer hover:bg-emerald-400 transition-all border-4 border-[#0b141a]">
              <Camera className="w-5 h-5" />
              <input type="file" className="hidden" accept="image/*" onChange={handleImageUpload} />
            </label>
          </div>
        </div>

        {/* Name Section */}
        <div className="bg-[#111b21] p-6 mb-2">
          <label className="text-emerald-500 text-sm mb-4 block font-medium">Your Name</label>
          <div className="flex items-center justify-between gap-4">
            <input 
              type="text" 
              value={profile.displayName} 
              onChange={e => setProfile({ ...profile, displayName: e.target.value })}
              className="bg-transparent border-none outline-none text-lg w-full focus:ring-0 placeholder:text-slate-600"
              placeholder="Enter your name"
            />
            <Save className="w-5 h-5 text-slate-500 hover:text-emerald-500 cursor-pointer" onClick={handleSave} />
          </div>
          <p className="text-slate-500 text-[13px] mt-4 leading-relaxed">
            This is not a username or pin. This name will be visible to your virelChat contacts.
          </p>
        </div>

        {/* About Section */}
        <div className="bg-[#111b21] p-6 mb-2">
          <label className="text-emerald-500 text-sm mb-4 block font-medium">About</label>
          <div className="flex items-center justify-between gap-4">
            <textarea 
              rows={2}
              value={profile.about} 
              onChange={e => setProfile({ ...profile, about: e.target.value })}
              className="bg-transparent border-none outline-none text-lg w-full focus:ring-0 placeholder:text-slate-600 resize-none"
              placeholder="About"
            />
            <Save className="w-5 h-5 text-slate-500 hover:text-emerald-500 cursor-pointer" onClick={handleSave} />
          </div>
        </div>

        {/* Phone Section (Static) */}
        <div className="bg-[#111b21] p-6 mb-8">
          <label className="text-emerald-500 text-sm mb-2 block font-medium">Phone</label>
          <p className="text-lg text-slate-300">+250 723 223 653</p>
        </div>

        {/* Settings List */}
        <div className="space-y-1">
          {[
            { id: 'privacy', icon: Lock, label: 'Privacy', sub: 'Last seen, profile photo, groups', action: () => emitInteraction('privacy_settings_opened') },
            { id: 'account', icon: User, label: 'Account', sub: 'Security notifications, change number', action: () => emitInteraction('account_settings_opened') },
            { id: 'media', icon: ImageIcon, label: 'Media, Links, and Docs', sub: '243 shared items', action: () => emitInteraction('media_gallery_opened') },
            { id: 'starred', icon: Star, label: 'Starred Messages', sub: '12 messages', action: () => emitInteraction('starred_messages_opened') },
            { id: 'notifications', icon: Bell, label: 'Notifications', sub: 'Message, group & call tones', action: () => {} },
            { id: 'help', icon: HelpCircle, label: 'Help', sub: 'Help center, contact us, privacy policy', action: () => {} },
          ].map(item => (
            <button key={item.id} onClick={item.action} className="w-full bg-[#111b21] p-5 flex items-center gap-6 hover:bg-[#1a2329] transition-colors group">
              <item.icon className="w-6 h-6 text-slate-500 group-hover:text-emerald-500 transition-colors" />
              <div className="flex-1 text-left">
                <h4 className="font-medium">{item.label}</h4>
                <p className="text-slate-500 text-sm">{item.sub}</p>
              </div>
              <ChevronRight className="w-5 h-5 text-slate-600" />
            </button>
          ))}
        </div>

        {/* Trash Section (Existing feature) */}
        <div className="mt-8 px-6">
          <div className="flex items-center gap-2 text-red-500/50 mb-4 px-2">
            <Trash2 className="w-4 h-4" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em]">Restoration Vault</span>
          </div>
          <div className="space-y-3">
            {deletedMessages.length === 0 ? (
              <div className="bg-white/5 border border-white/5 rounded-2xl p-6 text-center">
                <p className="text-slate-600 text-[10px] font-black uppercase tracking-widest">No entities in trash</p>
              </div>
            ) : deletedMessages.map(m => (
              <div key={m.message_group_id} className="bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-slate-400">Message from {m.sender_name}</p>
                  <p className="text-[10px] text-slate-600 uppercase font-black tracking-tighter mt-1">{format(new Date(m.created_at), 'MMM d, HH:mm')}</p>
                </div>
                <button onClick={() => getSocket()?.emit('restore_message', { messageGroupId: m.message_group_id })} className="p-2.5 bg-emerald-500/10 text-emerald-500 rounded-xl hover:bg-emerald-500 hover:text-white transition-all">
                  <RotateCcw className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center pb-12">
          <p className="text-[10px] font-black text-slate-700 uppercase tracking-[0.4em]">virelChat Protocol v2.0</p>
          <p className="text-[10px] font-black text-slate-800 uppercase tracking-[0.2em] mt-2">SECURED BY QUANTUM-SAFE CRYPTOGRAPHY</p>
        </div>
      </div>
    </div>
  );
};
