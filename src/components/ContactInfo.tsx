import React, { useState, useEffect } from 'react';
import { 
  X, Download, ZoomIn, ZoomOut, Search, BellOff, Bell, 
  Image as ImageIcon, FileText, Link as LinkIcon, Star, 
  Trash2, Ban, Flag, ChevronRight, Phone, Video, MessageSquare, 
  Maximize2, Share2, CornerUpRight, History
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import api from '../services/api';
import { format } from 'date-fns';

interface ContactInfoProps {
  contact: any;
  onClose: () => void;
  onBlock: () => void;
  onUnblock: () => void;
  onClearChat: () => void;
  onStartCall: (type: 'audio' | 'video') => void;
  onMessage: () => void;
  messages: any[];
  isBlockedByMe: boolean;
  onlineStatus: string;
}

export const ContactInfo: React.FC<ContactInfoProps> = ({ 
  contact, onClose, onBlock, onUnblock, onClearChat, onStartCall, 
  onMessage, messages, isBlockedByMe, onlineStatus 
}) => {
  const [view, setView] = useState<'main' | 'media' | 'starred'>('main');
  const [showFullImage, setShowFullImage] = useState(false);
  const [starredMessages, setStarredMessages] = useState<any[]>([]);
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (view === 'starred') {
      api.get(`/api/messages/starred/${contact.id}`).then(res => {
        setStarredMessages(res.data);
      });
    }
    if (view === 'media' || view === 'main') {
      const media = messages.filter(m => m.type && m.type !== 'text');
      setMediaItems(media);
    }
  }, [view, contact.id, messages]);

  const handleDownload = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const renderMainView = () => (
    <div className="flex flex-col h-full overflow-y-auto bg-[#0b141a] text-slate-200 scrollbar-hide">
      {/* Header Profile Section */}
      <div className="bg-[#111b21] p-6 flex flex-col items-center gap-4 shadow-lg shrink-0">
        <motion.div 
          layoutId="profile-pic"
          className="relative group cursor-pointer"
          onClick={() => setShowFullImage(true)}
        >
          <div className="w-[120px] h-[120px] md:w-[140px] md:h-[140px] rounded-full overflow-hidden border-4 border-[#202c33] shadow-2xl transition-transform group-hover:scale-105">
            {contact.other_profile_picture ? (
              <img src={contact.other_profile_picture} className="w-full h-full object-cover" alt={contact.other_name} />
            ) : (
              <div className="w-full h-full bg-[#2a3942] flex items-center justify-center">
                <span className="text-5xl font-bold text-slate-500">{contact.other_name[0]}</span>
              </div>
            )}
          </div>
          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 rounded-full flex items-center justify-center transition-opacity">
            <Maximize2 className="text-white" />
          </div>
        </motion.div>

        <div className="text-center">
          <h2 className="text-2xl font-bold">{contact.other_name}</h2>
          <p className="text-sm text-emerald-500 font-medium uppercase tracking-widest mt-1">
            {onlineStatus}
          </p>
        </div>

        <div className="flex items-center gap-6 mt-2">
          <button onClick={onMessage} className="flex flex-col items-center gap-1 group">
            <div className="p-3 rounded-full bg-[#202c33] text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
              <MessageSquare size={22} />
            </div>
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Message</span>
          </button>
          <button onClick={() => onStartCall('audio')} className="flex flex-col items-center gap-1 group">
            <div className="p-3 rounded-full bg-[#202c33] text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
              <Phone size={22} />
            </div>
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Audio</span>
          </button>
          <button onClick={() => onStartCall('video')} className="flex flex-col items-center gap-1 group">
            <div className="p-3 rounded-full bg-[#202c33] text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all">
              <Video size={22} />
            </div>
            <span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Video</span>
          </button>
        </div>
      </div>

      {/* Info Sections */}
      <div className="p-4 space-y-3 pb-20">
        {/* About Section */}
        <div className="bg-[#111b21] p-4 rounded-xl space-y-1 shadow-md">
          <h3 className="text-xs font-black text-slate-500 uppercase tracking-widest">About</h3>
          <p className="text-[15px]">{contact.about || 'Hey there! I am using virelChat.'}</p>
        </div>

        {/* Media Section */}
        <button 
          onClick={() => setView('media')}
          className="w-full bg-[#111b21] p-4 rounded-xl flex items-center justify-between shadow-md hover:bg-[#202c33] transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="text-emerald-500"><ImageIcon size={20} /></div>
            <div className="text-left">
              <h3 className="text-[15px] font-medium">Media, Links and Docs</h3>
              <p className="text-xs text-slate-500">{mediaItems.length} items</p>
            </div>
          </div>
          <ChevronRight size={20} className="text-slate-600" />
        </button>

        {/* Starred Section */}
        <button 
          onClick={() => setView('starred')}
          className="w-full bg-[#111b21] p-4 rounded-xl flex items-center justify-between shadow-md hover:bg-[#202c33] transition-colors"
        >
          <div className="flex items-center gap-4">
            <div className="text-yellow-500"><Star size={20} /></div>
            <h3 className="text-[15px] font-medium">Starred Messages</h3>
          </div>
          <ChevronRight size={20} className="text-slate-600" />
        </button>

        {/* Settings/Actions Section */}
        <div className="bg-[#111b21] rounded-xl overflow-hidden shadow-md">
          <button className="w-full p-4 flex items-center gap-4 hover:bg-[#202c33] transition-colors border-b border-[#202c33]">
            <Bell size={20} className="text-slate-500" />
            <h3 className="text-[15px]">Mute Notifications</h3>
          </button>
          <button className="w-full p-4 flex items-center gap-4 hover:bg-[#202c33] transition-colors border-b border-[#202c33]">
            <Search size={20} className="text-slate-500" />
            <h3 className="text-[15px]">Search in Chat</h3>
          </button>
          <button onClick={onClearChat} className="w-full p-4 flex items-center gap-4 hover:bg-[#202c33] transition-colors text-red-400">
            <History size={20} />
            <h3 className="text-[15px]">Clear Chat</h3>
          </button>
          <button 
            onClick={isBlockedByMe ? onUnblock : onBlock}
            className="w-full p-4 flex items-center gap-4 hover:bg-[#202c33] transition-colors text-red-500 font-bold"
          >
            <Ban size={20} />
            <h3 className="text-[15px]">{isBlockedByMe ? 'Unblock Contact' : 'Block Contact'}</h3>
          </button>
          <button className="w-full p-4 flex items-center gap-4 hover:bg-[#202c33] transition-colors text-red-500">
            <Flag size={20} />
            <h3 className="text-[15px]">Report Contact</h3>
          </button>
        </div>
      </div>
    </div>
  );

  const renderMediaView = () => (
    <div className="flex flex-col h-full bg-[#0b141a]">
      <div className="bg-[#111b21] p-4 flex items-center gap-4 border-b border-[#202c33] shrink-0">
        <button onClick={() => setView('main')} className="text-slate-400 hover:text-white">
          <ChevronRight size={24} className="rotate-180" />
        </button>
        <h2 className="text-lg font-bold">Media, Links and Docs</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 grid grid-cols-3 gap-2 scrollbar-hide">
        {mediaItems.map((item, idx) => (
          <div key={idx} className="aspect-square bg-[#111b21] rounded-lg overflow-hidden relative group cursor-pointer">
            {item.type === 'image' ? (
              <img src={item.media_url} className="w-full h-full object-cover" />
            ) : item.type === 'audio' ? (
              <div className="w-full h-full flex items-center justify-center text-emerald-500">
                <History size={32} />
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center text-indigo-500">
                <FileText size={32} />
              </div>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-2">
              <button onClick={() => handleDownload(item.media_url, 'file')} className="p-2 bg-emerald-500 rounded-full text-white">
                <Download size={16} />
              </button>
              <button className="p-2 bg-blue-500 rounded-full text-white">
                <CornerUpRight size={16} />
              </button>
            </div>
          </div>
        ))}
        {mediaItems.length === 0 && (
          <div className="col-span-3 flex flex-col items-center justify-center py-20 opacity-20">
            <ImageIcon size={64} />
            <p className="mt-4 font-bold uppercase tracking-widest">No Media Found</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderStarredView = () => (
    <div className="flex flex-col h-full bg-[#0b141a]">
      <div className="bg-[#111b21] p-4 flex items-center gap-4 border-b border-[#202c33] shrink-0">
        <button onClick={() => setView('main')} className="text-slate-400 hover:text-white">
          <ChevronRight size={24} className="rotate-180" />
        </button>
        <h2 className="text-lg font-bold">Starred Messages</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
        {starredMessages.map((msg, idx) => (
          <div key={idx} className="bg-[#111b21] p-4 rounded-xl space-y-2 shadow-md">
            <div className="flex justify-between items-start">
              <span className="text-xs font-bold text-emerald-500 uppercase tracking-widest">
                {msg.sender_id === contact.id ? contact.other_name : 'You'}
              </span>
              <span className="text-[10px] text-slate-500">
                {format(new Date(msg.created_at), 'MMM d, HH:mm')}
              </span>
            </div>
            <p className="text-sm text-slate-200 italic">{msg.text || '[Media Content]'}</p>
          </div>
        ))}
        {starredMessages.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 opacity-20">
            <Star size={64} />
            <p className="mt-4 font-bold uppercase tracking-widest">No Starred Messages</p>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="h-full w-full flex flex-col relative z-[150]">
      {/* Full-screen Image Viewer */}
      <AnimatePresence>
        {showFullImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-[200] flex flex-col"
          >
            <div className="p-4 flex items-center justify-between bg-black/50 backdrop-blur-md z-10">
              <div className="flex items-center gap-4">
                <button onClick={() => setShowFullImage(false)} className="text-white hover:bg-white/10 p-2 rounded-full">
                  <X size={24} />
                </button>
                <span className="font-bold">{contact.other_name}</span>
              </div>
              <div className="flex items-center gap-4">
                <button onClick={() => setZoom(prev => Math.min(prev + 0.5, 3))} className="text-white hover:bg-white/10 p-2 rounded-full">
                  <ZoomIn size={24} />
                </button>
                <button onClick={() => setZoom(prev => Math.max(prev - 0.5, 1))} className="text-white hover:bg-white/10 p-2 rounded-full">
                  <ZoomOut size={24} />
                </button>
                <button 
                  onClick={() => contact.other_profile_picture && handleDownload(contact.other_profile_picture, 'profile.jpg')}
                  className="text-white hover:bg-white/10 p-2 rounded-full"
                >
                  <Download size={24} />
                </button>
              </div>
            </div>
            <div className="flex-1 flex items-center justify-center p-4 overflow-hidden">
              <motion.img 
                animate={{ scale: zoom }}
                transition={{ type: 'spring', damping: 20 }}
                src={contact.other_profile_picture} 
                className="max-w-full max-h-full object-contain shadow-2xl" 
                alt={contact.other_name}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 overflow-hidden">
        {view === 'main' && renderMainView()}
        {view === 'media' && renderMediaView()}
        {view === 'starred' && renderStarredView()}
      </div>
    </div>
  );
};
