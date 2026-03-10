import React, { useState } from 'react';
import { 
  Phone, Video, PhoneIncoming, PhoneOutgoing, PhoneMissed, 
  MoreVertical, Trash2, MessageSquare, User, Info, X 
} from 'lucide-react';
import { format, isToday, isYesterday } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';
import api from '../services/api';

interface CallHistoryProps {
  calls: any[];
  onStartCall: (type: 'audio' | 'video', otherId: string, otherName: string, otherPhoto: string) => void;
  onMessage: (otherId: string) => void;
  onViewProfile: (otherId: string) => void;
  onRefresh: () => void;
}

export const CallHistory: React.FC<CallHistoryProps> = ({ 
  calls, onStartCall, onMessage, onViewProfile, onRefresh 
}) => {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  const handleDeleteCall = async (callId: string) => {
    try {
      await api.post('/api/calls/delete', { callId });
      onRefresh();
      setActiveMenu(null);
    } catch (err) {}
  };

  const formatCallDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return format(date, 'HH:mm');
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'dd/MM/yyyy');
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const getCallIcon = (call: any) => {
    if (call.status === 'missed' || call.status === 'declined') {
      return <PhoneMissed size={16} className="text-red-500" />;
    }
    if (call.caller_id === call.recipient_id) return <PhoneIncoming size={16} className="text-emerald-500" />; // Should not happen but for safety
    return call.caller_id === localStorage.getItem('userId') ? 
      <PhoneOutgoing size={16} className="text-emerald-500" /> : 
      <PhoneIncoming size={16} className="text-emerald-500" />;
  };

  return (
    <div className="flex flex-col h-full bg-[#0b141a] text-slate-200">
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {calls.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center opacity-20 p-8 text-center">
            <Phone size={80} strokeWidth={1} />
            <p className="mt-4 font-bold uppercase tracking-widest text-sm">No recent calls</p>
          </div>
        ) : (
          <div className="divide-y divide-[#202c33]">
            {calls.map((call) => (
              <div key={call.id} className="relative group">
                <div className="flex items-center gap-4 p-4 hover:bg-[#202c33] transition-colors">
                  {/* Photo */}
                  <div className="shrink-0">
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-[#2a3942]">
                      {call.other_profile_picture ? (
                        <img src={call.other_profile_picture} className="w-full h-full object-cover" alt={call.other_name} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold">
                          {call.other_name?.[0]}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-bold text-[15px] truncate ${call.status === 'missed' ? 'text-red-500' : ''}`}>
                      {call.other_name}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-0.5">
                      {getCallIcon(call)}
                      <span>{formatCallDate(call.created_at)}</span>
                      {call.duration > 0 && <span>• {formatDuration(call.duration)}</span>}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => onStartCall(call.type, call.other_id, call.other_name, call.other_profile_picture)}
                      className="p-2 text-emerald-500 hover:bg-emerald-500/10 rounded-full transition-all"
                    >
                      {call.type === 'video' ? <Video size={20} /> : <Phone size={20} />}
                    </button>
                    <div className="relative">
                      <button 
                        onClick={() => setActiveMenu(activeMenu === call.id ? null : call.id)}
                        className="p-2 text-slate-500 hover:bg-[#2a3942] rounded-full transition-all"
                      >
                        <MoreVertical size={20} />
                      </button>

                      {/* Dropdown Menu */}
                      <AnimatePresence>
                        {activeMenu === call.id && (
                          <>
                            <div className="fixed inset-0 z-[100]" onClick={() => setActiveMenu(null)} />
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.95, y: -10 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              exit={{ opacity: 0, scale: 0.95, y: -10 }}
                              className="absolute right-0 top-full mt-2 w-48 bg-[#233138] border border-white/5 rounded-xl shadow-2xl z-[101] overflow-hidden py-1"
                            >
                              <button 
                                onClick={() => { onStartCall(call.type, call.other_id, call.other_name, call.other_profile_picture); setActiveMenu(null); }}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2a3942] text-left text-sm transition-colors"
                              >
                                {call.type === 'video' ? <Video size={18} /> : <Phone size={18} />}
                                <span>Call back</span>
                              </button>
                              <button 
                                onClick={() => { onMessage(call.other_id); setActiveMenu(null); }}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2a3942] text-left text-sm transition-colors"
                              >
                                <MessageSquare size={18} />
                                <span>Message contact</span>
                              </button>
                              <button 
                                onClick={() => { onViewProfile(call.other_id); setActiveMenu(null); }}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2a3942] text-left text-sm transition-colors"
                              >
                                <User size={18} />
                                <span>View profile</span>
                              </button>
                              <div className="h-[1px] bg-white/5 my-1" />
                              <button 
                                onClick={() => handleDeleteCall(call.id)}
                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2a3942] text-left text-sm text-red-400 transition-colors"
                              >
                                <Trash2 size={18} />
                                <span>Delete call</span>
                              </button>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
