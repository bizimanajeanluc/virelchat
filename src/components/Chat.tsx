import React, { useState, useEffect, useRef, useCallback } from 'react';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { CryptoEngine } from '../crypto/engine';
import { 
  MessageSquare, Send, User, Shield, Search, Plus, ArrowLeft, 
  MoreVertical, Check, CheckCheck, Trash2, AlertTriangle, Edit2, 
  X, Phone, Video, Mic, StopCircle, Play, Pause, PhoneOff, 
  Clock, PhoneIncoming, PhoneOutgoing, PhoneMissed, MicOff, 
  VideoOff, Maximize, Minimize, Smile, Paperclip, Reply, Star, 
  Forward, Copy, CornerUpRight, Flag, Pin, CheckSquare, ShieldAlert, RefreshCw, 
  Volume2, Grid, ZoomIn, ZoomOut, Bluetooth, UserPlus, Camera, RotateCcw,
  Image as ImageIcon, FileText, MapPin, Headphones, Info, AlertCircle, Ban, Bell,
  ChevronRight, ChevronDown, Lock, Download, File, Settings, HelpCircle, Mic2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isToday, isYesterday } from 'date-fns';
import Calling from './Calling';
import { ContactInfo } from './ContactInfo';
import { CallHistory } from './CallHistory';
import { auditService } from '../services/audit';

interface ChatProps {
  user: any;
}

export const Chat: React.FC<ChatProps> = ({ user }) => {
  if (!user) return <div className="h-full flex items-center justify-center bg-[#020617] text-emerald-500 font-black uppercase tracking-widest text-xs">Synchronizing...</div>;

  // --- Core State ---
  const [view, setView] = useState<'chats' | 'calls'>('chats');
  const [conversations, setConversations] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [wardUsers, setWardUsers] = useState<any[]>([]);
  
  // --- UI State ---
  const [newMessage, setNewMessage] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [showContactInfo, setShowContactInfo] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [newChatSearch, setNewChatSearch] = useState('');
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [menuConfig, setMenuConfig] = useState<{ msg: any, x: number, y: number, type: 'context' | 'reactions' } | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [chatBackground, setChatBackground] = useState(() => localStorage.getItem(`chatBg_${user.id}`) || 'default');
  const [showBgPicker, setShowBgPicker] = useState(false);
  const [showDiagnosticReport, setShowDiagnosticReport] = useState(false);
  const [forwardingMsg, setForwardingMsg] = useState<any>(null);
  const [toast, setToast] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const longPressTimerRef = useRef<any>(null);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(null), 2000);
  };

  const handleTouchStart = (msg: any, e: React.TouchEvent) => {
    const { clientX, clientY } = e.touches[0];
    longPressTimerRef.current = setTimeout(() => {
      setMenuConfig({ msg, x: clientX, y: clientY, type: 'context' });
      if (navigator.vibrate) navigator.vibrate(50);
    }, 800);
  };

  const handleTouchEnd = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
  };

  const copyToClipboard = (text: string) => {
    const finalWrapper = () => {
      showToast('Message Copied');
      setMenuConfig(null);
    };

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(finalWrapper);
    } else {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      try {
        document.execCommand('copy');
        finalWrapper();
      } catch (err) {}
      document.body.removeChild(textArea);
    }
  };

  const handleReplyAction = (msg: any) => {
    setReplyingTo(msg);
    setMenuConfig(null);
    setTimeout(() => textareaRef.current?.focus(), 50);
  };

  const handleForward = async (msg: any, targetConv: any) => {
    const text = msg.text || (msg.type === 'image' ? '📷 Photo' : msg.type === 'audio' ? '🎵 Voice Note' : '📄 Document');
    const messageGroupId = crypto.randomUUID();
    try {
      const [recipientRes, senderRes] = await Promise.all([
        api.get(`/api/keys/${targetConv.other_id}`),
        api.get(`/api/keys/${user.id}`)
      ]);
      const allBundles = [...recipientRes.data, ...senderRes.data];
      const payloads: Record<string, any> = {};
      const myDeviceId = localStorage.getItem(`deviceId_${user.id}`);
      
      for (const bundle of allBundles) {
        const encryptedBody = await CryptoEngine.encryptMessage(text, bundle.identityKey, user.id);
        payloads[bundle.deviceId] = { body: encryptedBody, senderDeviceId: myDeviceId };
      }

      if (msg.type && msg.type !== 'text') {
        getSocket()?.emit('send_media', { 
          conversationId: targetConv.id, 
          recipientId: targetConv.other_id, 
          messageGroupId, 
          type: msg.type, 
          mediaUrl: msg.media_url, 
          mediaMeta: JSON.parse(msg.media_meta || '{}'), 
          payloads,
          isForwarded: true 
        });
      } else {
        getSocket()?.emit('send_message', { 
          conversationId: targetConv.id, 
          recipientId: targetConv.other_id, 
          messageGroupId, 
          payloads,
          isForwarded: true 
        });
      }
    } catch (err) {}
  };

  const backgroundOptions = [
    { id: 'default', name: 'Standard', class: 'wa-background', color: '#0b141a' },
    { id: 'soft-blue', name: 'Azure', class: '', style: { background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' } },
    { id: 'deep-emerald', name: 'Forest', class: '', style: { background: 'linear-gradient(135deg, #064e3b 0%, #022c22 100%)' } },
    { id: 'warm-slate', name: 'Slate', class: '', style: { background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)' } },
    { id: 'midnight', name: 'Midnight', class: '', style: { background: '#020617' } },
    { id: 'doodle-dark', name: 'Doodle', class: 'wa-background', style: { backgroundColor: '#0b141a', opacity: 0.8 } },
    { id: 'soft-purple', name: 'Lavender', class: '', style: { background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)' } },
  ];

  const currentBg = backgroundOptions.find(bg => bg.id === chatBackground) || backgroundOptions[0];

  const changeBackground = (bgId: string) => {
    setChatBackground(bgId);
    localStorage.setItem(`chatBg_${user.id}`, bgId);
    getSocket()?.emit('background_changed', { backgroundId: bgId });
    setShowBgPicker(false);
  };

  // --- Real-time State ---
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [lastSeenMap, setLastSeenMap] = useState<Record<string, string>>({});
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [partnerFeatures, setPartnerFeatures] = useState<any>({ audioCall: true, videoCall: true, attachments: true });

  // --- Refs ---
  const scrollRef = useRef<HTMLDivElement>(null);
  const infoPanelRef = useRef<HTMLDivElement>(null);
  const keyCacheRef = useRef<Record<string, any>>({});
  const recordingTimerRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const typingTimeoutRef = useRef<Record<string, any>>({});

  // --- Call State ---
  const [showCallingUI, setShowCallingUI] = useState(false);
  const [callingType, setCallingType] = useState<'audio' | 'video'>('audio');
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [currentCallData, setCurrentCallData] = useState<any>(null);
  const ringtoneRef = useRef<AudioContext | null>(null);

  // --- Refs for active state sync ---
  const activeConvRef = useRef<any>(null);
  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);

  const syncFeatures = useCallback(() => {
    if (!activeConv) return;
    getSocket()?.emit('feature_sync', { recipientId: activeConv.other_id, features: { audioCall: true, videoCall: true, attachments: true } });
  }, [activeConv]);

  // --- Sound Engine ---
  const startSound = (type: 'calling' | 'ringing') => {
    try {
      if (ringtoneRef.current) stopSound();
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ringtoneRef.current = ctx;
      const gain = ctx.createGain(); gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0, ctx.currentTime); gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.1);
      if (type === 'calling') {
        const playTone = (startTime: number) => {
          const osc1 = ctx.createOscillator(); osc1.frequency.setValueAtTime(425, startTime);
          const localGain = ctx.createGain(); localGain.connect(gain); osc1.connect(localGain);
          localGain.gain.setValueAtTime(0, startTime); localGain.gain.linearRampToValueAtTime(0.5, startTime + 0.1);
          localGain.gain.setValueAtTime(0.5, startTime + 1.5); localGain.gain.linearRampToValueAtTime(0, startTime + 1.6);
          osc1.start(startTime); osc1.stop(startTime + 1.6);
        };
        for (let i = 0; i < 20; i++) playTone(ctx.currentTime + i * 4);
      } else {
        const melody = [ { f: 659.25, d: 0.2 }, { f: 523.25, d: 0.2 }, { f: 783.99, d: 0.4 }, { f: 659.25, d: 0.2 }, { f: 523.25, d: 0.2 }, { f: 880.00, d: 0.4 } ];
        const playNote = (freq: number, start: number, duration: number) => {
          const osc = ctx.createOscillator(); const noteGain = ctx.createGain();
          osc.type = 'sine'; osc.frequency.setValueAtTime(freq, start);
          noteGain.gain.setValueAtTime(0, start); noteGain.gain.linearRampToValueAtTime(0.3, start + 0.05);
          noteGain.gain.linearRampToValueAtTime(0, start + duration - 0.05);
          osc.connect(noteGain); noteGain.connect(gain);
          osc.start(start); osc.stop(start + duration);
        };
        let time = ctx.currentTime;
        for (let i = 0; i < 10; i++) { melody.forEach(note => { playNote(note.f, time, note.d); time += note.d; }); time += 0.5; }
      }
    } catch (e) {}
  };
  const stopSound = () => { if (ringtoneRef.current) { try { ringtoneRef.current.close(); } catch (e) {} ringtoneRef.current = null; } };

  // --- API Actions ---
  const fetchConversations = async () => { 
    const res = await api.get('/api/conversations'); 
    setConversations(res.data);
    const lastSeens: Record<string, string> = {};
    res.data.forEach((c: any) => { if (c.last_seen) lastSeens[c.other_id] = c.last_seen; });
    setLastSeenMap(prev => ({ ...prev, ...lastSeens }));
  };
  const fetchWardUsers = async () => { 
    const res = await api.get('/api/users/ward'); 
    setWardUsers(res.data); 
    const lastSeens: Record<string, string> = {};
    res.data.forEach((u: any) => { if (u.last_seen) lastSeens[u.id] = u.last_seen; });
    setLastSeenMap(prev => ({ ...prev, ...lastSeens }));
  };
  const fetchCalls = async () => { const res = await api.get('/api/calls'); setCalls(res.data); };

  const decryptMessage = async (msg: any) => {
    if (!msg || msg.deleted_at) return null;
    try {
      const payload = typeof msg.payload === 'string' ? JSON.parse(msg.payload) : msg.payload;
      if (!payload.body) return null;
      const msgSenderId = msg.senderId || msg.sender_id;
      if (!keyCacheRef.current[msgSenderId]) { 
        try {
          const res = await api.get(`/api/keys/${msgSenderId}`); 
          keyCacheRef.current[msgSenderId] = res.data; 
        } catch (e) {
          return { error: 'KEY_MISSING', detail: 'Public keys for sender not found' };
        }
      }
      const senderDevice = keyCacheRef.current[msgSenderId]?.find((d: any) => d.deviceId === payload.senderDeviceId);
      if (!senderDevice && payload.senderDeviceId === 'system') return payload.body;
      if (!senderDevice) return { error: 'DEVICE_MISSING', detail: `Sender device ${payload.senderDeviceId} not in registry` };
      
      try {
        const decrypted = await CryptoEngine.decryptMessage(payload.body, senderDevice.identityKey, user.id);
        return decrypted;
      } catch (err) {
        return { error: 'DECRYPTION_FAILED', detail: 'Authentication tag mismatch or invalid keys' };
      }
    } catch (err) { return { error: 'INVALID_PAYLOAD', detail: 'Message structure is corrupted' }; }
  };

  const fetchMessages = async (convId: string) => {
    setLoadingMessages(true);
    try {
      const myDeviceId = localStorage.getItem(`deviceId_${user.id}`) || 'unknown';
      const res = await api.get(`/api/conversations/${convId}/messages?deviceId=${myDeviceId}`);
      const decryptedMessages = await Promise.all(res.data.map(async (msg: any) => {
        const decrypted = await decryptMessage(msg);
        const isError = decrypted && typeof decrypted === 'object' && decrypted.error;
        return { 
          ...msg, 
          id: msg.id || msg.message_group_id, 
          text: isError ? '' : decrypted,
          decryptionError: isError ? decrypted : null,
          isMe: (msg.sender_id || msg.senderId) === user.id, 
          delivered: !!msg.delivered, 
          read: !!msg.read 
        };
      }));
      setMessages(decryptedMessages.filter(m => !JSON.parse(m.deleted_by || '[]').includes(user.id)));
    } catch (err) {} finally { setLoadingMessages(false); }
  };

  const markAsRead = async (convId: string) => { 
    try { 
      // DIAGNOSTIC CHECK: Is the window hidden or blurred when marking as read?
      const isWindowHidden = document.visibilityState === 'hidden' || !document.hasFocus();
      
      await api.post('/api/messages/read', { conversationId: convId }); 
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c)); 

      // Log the action for debugging the "Premature Seen" issue
      messages.filter(m => !m.isMe && !m.read).forEach(m => {
        auditService.trackRead(m.id || m.message_group_id, isWindowHidden, document.visibilityState);
      });
    } catch (err) {} 
  };

  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [recordingUsers, setRecordingUsers] = useState<Record<string, boolean>>({});

  const [adminBroadcast, setAdminBroadcast] = useState<any>(null);

  // --- Real-time Socket Listeners ---
  useEffect(() => {
    const socket = getSocket();
    if (socket) {
      socket.on('initial_online_users', (userIds: string[]) => {
        setOnlineUsers(new Set(userIds));
      });

      socket.on('admin_broadcast', (data) => {
        setAdminBroadcast(data);
        setTimeout(() => setAdminBroadcast(null), 8000);
      });

      const handleNewMessage = async (msg: any) => {
        const myDeviceId = localStorage.getItem(`deviceId_${user.id}`);
        // Allow if it's for this device OR if I am the sender (to sync other devices)
        const isForMe = msg.recipientDeviceId === myDeviceId || msg.recipient_device_id === myDeviceId;
        const isFromMe = msg.senderId === user.id;

        if (!isForMe && !isFromMe) return;
        
        const decrypted = await decryptMessage(msg);
        const isMe = msg.senderId === user.id;
        
        setMessages(prev => {
          const exists = prev.some(m => (m.messageGroupId === msg.messageGroupId || m.message_group_id === msg.messageGroupId));
          if (exists) return prev;
          
          if (activeConvRef.current?.id === msg.conversationId || activeConvRef.current?.id === msg.conversation_id) {
            if (!isMe) markAsRead(activeConvRef.current.id);
            return [...prev, { 
              ...msg, 
              id: msg.id || msg.messageGroupId, 
              text: decrypted, 
              isMe, 
              sender_name: msg.sender_name,
              sender_profile_picture: msg.sender_profile_picture,
              created_at: msg.created_at || new Date().toISOString() 
            }];
          }
          return prev;
        });

        // Update unread count if chat is not active
        if (!isMe && activeConvRef.current?.id !== msg.conversationId) {
          setUnreadCounts(prev => ({ ...prev, [msg.conversationId]: (prev[msg.conversationId] || 0) + 1 }));
        }
        
        // Update conversation list item checkmarks and last message
        setConversations(prev => prev.map(c => {
          if (c.id === msg.conversationId || c.id === msg.conversation_id) {
            return {
              ...c,
              last_message: decrypted || 'Media message',
              created_at: msg.created_at || new Date().toISOString(),
              is_me: isMe,
              delivered: msg.delivered,
              read: msg.read,
              unread_count: (!isMe && activeConvRef.current?.id !== c.id) ? (c.unread_count + 1) : c.unread_count
            };
          }
          return c;
        }));

        if (!isMe) {
          setOnlineUsers(prevOnline => new Set(prevOnline).add(msg.senderId));
          api.post('/api/messages/delivered', { messageIds: [msg.messageGroupId] });
        }
      };

      socket.on('message_received', handleNewMessage);
      socket.on('message_sent', handleNewMessage);

      socket.on('unread_count_update', (data) => {
        if (activeConvRef.current?.id !== data.conversationId) {
          setUnreadCounts(prev => ({ ...prev, [data.conversationId]: data.count }));
          setConversations(prev => prev.map(c => c.id === data.conversationId ? { ...c, unread_count: data.count } : c));
        }
      });

      socket.on('message_delivered', (data) => {
        setMessages(prev => prev.map(m => (m.id === data.messageId || m.message_group_id === data.messageId) ? { ...m, delivered: 1 } : m));
        setConversations(prev => prev.map(c => c.id === data.conversationId ? { ...c, delivered: 1 } : c));
      });

      socket.on('messages_read', (data) => { 
        if (activeConvRef.current?.id === data.conversationId) {
          setMessages(prev => prev.map(m => m.isMe ? { ...m, read: 1, delivered: 1 } : m));
        }
        setConversations(prev => prev.map(c => c.id === data.conversationId ? { ...c, read: 1, delivered: 1 } : c));
      });

      socket.on('message_deleted', (data) => {
        if (data.mode === 'everyone') {
          setMessages(prev => prev.map(m => (m.messageGroupId === data.messageGroupId || m.message_group_id === data.messageGroupId) ? { ...m, text: '🚫 This message was deleted', isDeleted: true } : m));
        } else {
          setMessages(prev => prev.filter(m => !(m.messageGroupId === data.messageGroupId || m.message_group_id === data.messageGroupId)));
        }
        fetchConversations();
      });

      socket.on('reaction_update', (data) => {
        setMessages(prev => prev.map(m => (m.messageGroupId === data.messageGroupId || m.message_group_id === data.messageGroupId) ? { ...m, reactions: data.reactions } : m));
      });

      socket.on('call_incoming', (data) => { setIncomingCall(data); startSound('ringing'); socket.emit('call_ringing', { callerId: data.callerId }); });
      socket.on('call_ended', () => { stopSound(); setShowCallingUI(false); setCurrentCallData(null); fetchCalls(); });
      socket.on('call_history_update', fetchCalls);
      
      socket.on('user_status', ({ userId, status, lastSeen }: any) => {
        setOnlineUsers(prev => { 
          const next = new Set(prev); 
          if (status === 'online') next.add(userId); 
          else next.delete(userId); 
          return next; 
        });
        if (lastSeen) setLastSeenMap(prev => ({ ...prev, [userId]: lastSeen }));
      });

      socket.on('feature_sync_received', (data) => { if (activeConvRef.current?.other_id === data.senderId) setPartnerFeatures(data.features); });
      
      socket.on('typing', (data) => { 
        if (activeConvRef.current?.other_id === data.senderId) {
          setTypingUsers(prev => ({ ...prev, [data.senderId]: data.isTyping }));
        }
      });

      socket.on('voice_recording', (data) => {
        if (activeConvRef.current?.other_id === data.senderId) {
          setRecordingUsers(prev => ({ ...prev, [data.senderId]: data.isRecording }));
        }
      });

      socket.on('blocked_status_changed', (data) => {
        if (data.byUserId === user.id && activeConvRef.current?.other_id === data.targetId) setActiveConv((prev: any) => ({ ...prev, is_blocked_by_me: data.status === 'blocked' }));
        else if (data.targetId === user.id && activeConvRef.current?.other_id === data.byUserId) setActiveConv((prev: any) => ({ ...prev, has_blocked_me: data.status === 'blocked' }));
        fetchConversations();
      });
    }
    return () => { 
      stopSound(); 
      socket?.off('initial_online_users');
      socket?.off('message_received'); 
      socket?.off('message_sent'); 
      socket?.off('unread_count_update');
      socket?.off('message_delivered'); 
      socket?.off('messages_read'); 
      socket?.off('message_deleted'); 
      socket?.off('call_incoming'); 
      socket?.off('call_ended'); 
      socket?.off('call_history_update'); 
      socket?.off('user_status'); 
      socket?.off('feature_sync_received'); 
      socket?.off('blocked_status_changed'); 
      socket?.off('typing');
      socket?.off('voice_recording');
    };
  }, [user.id]);

  useEffect(() => { 
    fetchConversations().then(() => {
      // Initialize unread counts from fetched data
      const counts: Record<string, number> = {};
      conversations.forEach(c => { if (c.unread_count) counts[c.id] = c.unread_count; });
      setUnreadCounts(counts);
    });
    fetchWardUsers(); 
    fetchCalls(); 
  }, []);

  useEffect(() => { 
    if (activeConv) { 
      fetchMessages(activeConv.id); 
      markAsRead(activeConv.id); 
      setUnreadCounts(prev => ({ ...prev, [activeConv.id]: 0 }));
      setConversations(prev => prev.map(c => c.id === activeConv.id ? { ...c, unread_count: 0 } : c));
      syncFeatures(); 
    } 
  }, [activeConv, syncFeatures]);
  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [messages]);

  // --- Handlers ---
  const startCall = (type: 'audio' | 'video', targetId?: string, targetName?: string, targetPhoto?: string) => {
    const id = targetId || activeConv?.other_id; if (!id) return;
    if (activeConv?.is_blocked_by_me || activeConv?.has_blocked_me) return;
    if (type === 'audio' && !partnerFeatures.audioCall) { alert("Partner's device doesn't support audio calls."); return; }
    if (type === 'video' && !partnerFeatures.videoCall) { alert("Partner's device doesn't support video calls."); return; }
    setCallingType(type);
    setCurrentCallData({ id, display_name: targetName || activeConv?.other_name, profile_picture: targetPhoto || activeConv?.other_profile_picture });
    setShowCallingUI(true); startSound('calling');
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault(); if (!newMessage.trim() || !activeConv) return;
    const text = newMessage; const messageGroupId = crypto.randomUUID();
    const replyToId = replyingTo?.messageGroupId || replyingTo?.message_group_id;
    try {
      const [recipientRes, senderRes] = await Promise.all([api.get(`/api/keys/${activeConv.other_id}`), api.get(`/api/keys/${user.id}`)]);
      const allBundles = [...recipientRes.data, ...senderRes.data];
      if (allBundles.length === 0) { alert('No cryptographic endpoints found for this recipient.'); return; }
      
      const payloads: Record<string, any> = {}; const myDeviceId = localStorage.getItem(`deviceId_${user.id}`) || 'web-device-id';
      for (const bundle of allBundles) { const encryptedBody = await CryptoEngine.encryptMessage(text, bundle.identityKey, user.id); payloads[bundle.deviceId] = { body: encryptedBody, senderDeviceId: myDeviceId }; }
      
      getSocket()?.emit('send_message', { conversationId: activeConv.id, recipientId: activeConv.other_id, messageGroupId, payloads, replyToId });
      setMessages(prev => [...prev, { id: messageGroupId, text, isMe: true, message_group_id: messageGroupId, reply_to_id: replyToId, created_at: new Date().toISOString(), delivered: 0, read: 0 }]);
      
      // Track sent message in audit service
      auditService.trackSent(messageGroupId, user.id, activeConv.other_id);
      
      setNewMessage('');
      setReplyingTo(null);
    } catch (err: any) {
      alert(`Transmission failed: ${err.message || 'Unknown error'}`);
    }
  };

  const handleReact = (msg: any, emoji: string) => {
    const groupId = msg.messageGroupId || msg.message_group_id;
    getSocket()?.emit('message_reaction', { messageGroupId: groupId, emoji, action: 'add' });
    setMenuConfig(null);
    setMessages(prev => prev.map(m => (m.messageGroupId === groupId || m.message_group_id === groupId) ? { ...m, reactions: [...(m.reactions || []), { userId: user.id, emoji }] } : m));
  };

  const handleDeleteMessage = (msg: any, mode: 'me' | 'everyone') => {
    const groupId = msg.messageGroupId || msg.message_group_id;
    getSocket()?.emit('delete_message', { messageGroupId: groupId, mode });
    setMenuConfig(null);
  };

  const handleStarMessage = async (msg: any) => {
    const groupId = msg.messageGroupId || msg.message_group_id;
    const isStarred = !msg.isStarred;
    try {
      await api.post('/api/messages/star', { messageGroupId: groupId, star: isStarred });
      setMessages(prev => prev.map(m => (m.messageGroupId === groupId || m.message_group_id === groupId) ? { ...m, isStarred: isStarred ? 1 : 0 } : m));
    } catch (err) {}
  };

  const startConversation = async (recipientId: string) => {
    try {
      const res = await api.post('/api/conversations', { recipientId });
      const otherUser = wardUsers.find(u => u.id === recipientId);
      const conv = { ...res.data, other_name: otherUser?.display_name || 'User', other_profile_picture: otherUser?.profile_picture, other_id: recipientId };
      setActiveConv(conv);
      setShowNewChat(false);
      fetchConversations();

      if (forwardingMsg) {
        handleForward(forwardingMsg, conv);
        setForwardingMsg(null);
      }
    } catch (err) {}
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video' | 'document' | 'audio') => {
    const file = e.target.files?.[0]; if (!file || !activeConv) return;
    setUploading(true); setShowAttachmentMenu(false);
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onloadend = async () => {
      const base64 = reader.result as string; const messageGroupId = crypto.randomUUID();
      try {
        const text = type === 'image' ? '📷 Photo' : '📄 Document';
        const [recipientRes, senderRes] = await Promise.all([api.get(`/api/keys/${activeConv.other_id}`), api.get(`/api/keys/${user.id}`)]);
        const allBundles = [...recipientRes.data, ...senderRes.data];
        const payloads: Record<string, any> = {}; const myDeviceId = localStorage.getItem(`deviceId_${user.id}`) || 'web-device-id';
        for (const bundle of allBundles) { const encryptedBody = await CryptoEngine.encryptMessage(text, bundle.identityKey, user.id); payloads[bundle.deviceId] = { body: encryptedBody, senderDeviceId: myDeviceId }; }
        getSocket()?.emit('send_media', { conversationId: activeConv.id, recipientId: activeConv.other_id, messageGroupId, type, mediaUrl: base64, mediaMeta: { name: file.name, size: file.size, type: file.type }, payloads });
        setMessages(prev => [...prev, { id: messageGroupId, text, isMe: true, message_group_id: messageGroupId, type, media_url: base64, media_meta: JSON.stringify({ name: file.name, size: file.size }), created_at: new Date().toISOString(), delivered: 0, read: 0 }]);
      } catch (err) {} finally { setUploading(false); }
    };
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      mediaRecorderRef.current = new MediaRecorder(stream); audioChunksRef.current = [];
      
      getSocket()?.emit('voice_recording', { recipientId: activeConv.other_id, isRecording: true });

      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); const reader = new FileReader(); reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string; const messageGroupId = crypto.randomUUID();
          const replyToId = replyingTo?.messageGroupId || replyingTo?.message_group_id;
          try {
            const [rRes, sRes] = await Promise.all([api.get(`/api/keys/${activeConv.other_id}`), api.get(`/api/keys/${user.id}`)]);
            const bundles = [...rRes.data, ...sRes.data]; const payloads: Record<string, any> = {}; const myDev = localStorage.getItem(`deviceId_${user.id}`);
            for (const b of bundles) { const body = await CryptoEngine.encryptMessage('🎵 Voice Note', b.identityKey, user.id); payloads[b.deviceId] = { body, senderDeviceId: myDev }; }
            getSocket()?.emit('send_media', { conversationId: activeConv.id, recipientId: activeConv.other_id, messageGroupId, type: 'audio', mediaUrl: base64Audio, mediaMeta: { duration: recordingDuration }, payloads, replyToId });
            setMessages(prev => [...prev, { id: messageGroupId, isMe: true, message_group_id: messageGroupId, type: 'audio', media_url: base64Audio, media_meta: JSON.stringify({ duration: recordingDuration }), reply_to_id: replyToId, created_at: new Date().toISOString(), delivered: 0, read: 0 }]);
            setReplyingTo(null);
          } catch (e) {}
        };
        stream.getTracks().forEach(t => t.stop());
      };
      mediaRecorderRef.current.start(); setIsRecording(true); setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => setRecordingDuration(p => p + 1), 1000);
    } catch (e) { alert('Microphone access denied'); }
  };

  const stopRecording = (cancel: boolean = false) => {
    if (mediaRecorderRef.current && isRecording) { 
      getSocket()?.emit('voice_recording', { recipientId: activeConv.other_id, isRecording: false });
      if (cancel) { mediaRecorderRef.current.onstop = () => {}; mediaRecorderRef.current.stream.getTracks().forEach(t => t.stop()); } else { mediaRecorderRef.current.stop(); } 
    }
    setIsRecording(false); clearInterval(recordingTimerRef.current);
  };

  const toggleAudioPlay = (msgId: string) => {
    if (playingAudioId && playingAudioId !== msgId && audioRefs.current[playingAudioId]) { audioRefs.current[playingAudioId].pause(); audioRefs.current[playingAudioId].currentTime = 0; }
    const audio = audioRefs.current[msgId];
    if (audio) { if (audio.paused) { audio.play(); setPlayingAudioId(msgId); } else { audio.pause(); setPlayingAudioId(null); } }
  };

  const safeFormatTime = (dateStr: string) => { try { return format(new Date(dateStr), 'HH:mm'); } catch (e) { return ''; } };
  const formatLastSeen = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Recently';
      if (isToday(date)) return `today at ${format(date, 'HH:mm')}`;
      if (isYesterday(date)) return `yesterday at ${format(date, 'HH:mm')}`;
      return `${format(date, 'dd/MM/yyyy')}`;
    } catch (e) { return 'Recently'; }
  };
  const formatCallDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Recently';
      if (isToday(date)) return format(date, 'HH:mm');
      if (isYesterday(date)) return 'Yesterday';
      return format(date, 'dd/MM/yyyy');
    } catch (e) { return 'Recently'; }
  };
  const formatDuration = (seconds: number) => { const m = Math.floor(seconds / 60); const s = seconds % 60; return `${m}:${String(s).padStart(2, '0')}`; };

  const msgTextForCopy = (msg: any) => {
    return msg.text || (msg.type === 'image' ? '[Image]' : msg.type === 'audio' ? '[Audio]' : '[File]');
  };

  // --- Rendering ---
  const renderMessageContent = (msg: any) => {
    if (msg.text && msg.text.startsWith('SYSTEM:')) {
      const parts = msg.text.split(':'); let info = msg.text;
      if (parts[1] === 'CALL') info = parts[2] === 'MISSED' ? `Missed ${parts[3]} Call` : `Call Ended (${parts[4]}s)`;
      else if (parts[1] === 'ENCRYPTION') info = 'Messages are end-to-end encrypted. No one outside of this chat can read or listen to them.';
      return (<div key={msg.id} className="flex justify-center w-full my-2"><div className="bg-[#182229]/60 backdrop-blur-md text-[11px] font-medium text-slate-300 px-4 py-1.5 rounded-xl border border-white/5 shadow-sm max-w-[85%] text-center uppercase tracking-wider">{info}</div></div>);
    }

    const replyMsg = msg.reply_to_id || msg.replyToId ? messages.find(m => (m.messageGroupId === (msg.reply_to_id || msg.replyToId) || m.message_group_id === (msg.reply_to_id || msg.replyToId))) : null;

    return (
      <div key={msg.id} className={`flex ${msg.isMe ? 'justify-end' : 'justify-start'} w-full group relative mb-1`} onMouseEnter={() => setHoveredMsgId(msg.id)} onMouseLeave={() => setHoveredMsgId(null)}>
        {!msg.isMe && (
          <div className="flex flex-col items-center mr-2 shrink-0 self-start mt-1">
            <div className="w-8 h-8 rounded-full bg-slate-800 overflow-hidden border border-white/5 shadow-sm">
              {msg.sender_profile_picture ? <img src={msg.sender_profile_picture} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-[10px] font-bold text-slate-500">{(msg.sender_name || activeConv.other_name)[0]}</div>}
            </div>
          </div>
        )}
        <div 
          onClick={(e) => {
            // For mobile/touch users, open menu on click
            if (window.innerWidth < 768) {
              setMenuConfig({ msg, x: e.clientX, y: e.clientY, type: 'context' });
            }
          }}
          onContextMenu={(e) => { e.preventDefault(); setMenuConfig({ msg, x: e.clientX, y: e.clientY, type: 'context' }); }}
          className={`p-2 px-3 rounded-lg shadow-sm min-w-[80px] flex flex-col relative text-[14.5px] transition-all ${msg.isMe ? 'bg-[#005c4b] text-white rounded-tr-none' : 'bg-[#202c33] text-slate-200 rounded-tl-none'} max-w-[85%] sm:max-w-[75%] md:max-w-[70%] lg:max-w-[60%] overflow-wrap-anywhere`}
        >
          {!msg.isMe && (
            <span className="text-[11px] font-black uppercase tracking-widest text-emerald-500 mb-1 block">
              {msg.sender_name || activeConv.other_name}
            </span>
          )}
          {replyMsg && (
            <div 
              onClick={(e) => {
                e.stopPropagation();
                const el = document.getElementById(`msg-${replyMsg.messageGroupId || replyMsg.message_group_id}`);
                if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
              }}
              className="mb-2 p-2 bg-black/20 border-l-4 border-emerald-500 rounded flex flex-col gap-1 cursor-pointer hover:bg-black/30 transition-colors"
            >
              <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">{replyMsg.isMe ? 'You' : (replyMsg.sender_name || activeConv.other_name)}</span>
              <p className="text-[12px] text-slate-400 truncate leading-tight">{replyMsg.text || (replyMsg.type === 'image' ? '📷 Photo' : replyMsg.type === 'audio' ? '🎵 Voice Note' : '📄 Document')}</p>
            </div>
          )}
          <AnimatePresence>{hoveredMsgId === msg.id && !menuConfig && !msg.isDeleted && (
            <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className={`absolute top-1 z-10 flex items-center gap-1 ${msg.isMe ? '-left-20 flex-row-reverse' : '-right-20'}`}>
              <button onClick={(e) => setMenuConfig({ msg, x: e.clientX, y: e.clientY, type: 'context' })} className="p-1.5 bg-[#202c33] rounded-full text-slate-400 hover:text-white shadow-lg border border-white/5"><ChevronDown className="w-4 h-4" /></button>
              <button onClick={(e) => setMenuConfig({ msg, x: e.clientX, y: e.clientY, type: 'reactions' })} className="p-1.5 bg-[#202c33] rounded-full text-slate-400 hover:text-white shadow-lg border border-white/5"><Smile className="w-4 h-4" /></button>
              <button onClick={() => setReplyingTo(msg)} className="p-1.5 bg-[#202c33] rounded-full text-slate-400 hover:text-white shadow-lg border border-white/5"><Reply className="w-4 h-4" /></button>
            </motion.div>
          )}</AnimatePresence>
          {msg.isDeleted ? ( <p className="italic text-slate-400 flex items-center gap-2"><Ban className="w-3.5 h-3.5" /> This message was deleted</p> ) : msg.decryptionError ? (
            <div className="flex flex-col gap-2 p-1">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-widest">
                <Lock className="w-3.5 h-3.5" />
                <span>Message Encrypted</span>
              </div>
              <p className="text-[12px] text-slate-400 leading-relaxed italic">
                {msg.decryptionError.error === 'KEY_MISSING' ? "Waiting for sender's identity keys. This may take a moment." : 
                 msg.decryptionError.error === 'DEVICE_MISSING' ? "Message from an unregistered device. Transmission blocked." :
                 "This message is currently locked. Ensure your cryptographic registry is synced."}
              </p>
              <button onClick={() => fetchMessages(activeConv.id)} className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-emerald-500 hover:text-emerald-400 transition-colors w-fit bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                <RefreshCw className="w-3 h-3" />
                Sync Registry
              </button>
            </div>
          ) : (
            <>{msg.type === 'image' && msg.media_url && <img src={msg.media_url} className="rounded-lg mb-1 max-w-full h-auto max-h-[300px] object-cover" />}
              {msg.type === 'audio' && msg.media_url && (
                <div className="flex items-center gap-3 min-w-[200px] pb-1">
                  <button onClick={() => toggleAudioPlay(msg.id)} className="w-10 h-10 rounded-full bg-slate-400/20 flex items-center justify-center hover:bg-slate-400/30 transition-colors">{playingAudioId === msg.id ? <Pause size={20} /> : <Play size={20} />}</button>
                  <div className="flex-1 flex flex-col gap-1"><div className="h-1 bg-slate-500/30 rounded-full overflow-hidden w-full"><div className={`h-full bg-white transition-all duration-200 ${playingAudioId === msg.id ? 'w-full' : 'w-0'}`} /></div><span className="text-[10px] text-slate-400 font-mono">{playingAudioId === msg.id ? 'Playing...' : 'Voice Note'}</span></div>
                  <audio ref={el => { if (el) audioRefs.current[msg.id] = el; }} src={msg.media_url} onEnded={() => setPlayingAudioId(null)} className="hidden" /><Mic size={16} />
                </div>
              )}
              {msg.type === 'document' && msg.media_url && ( <a href={msg.media_url} download={JSON.parse(msg.media_meta || '{}').name || 'Document'} className="flex items-center gap-3 bg-black/20 p-3 rounded-lg hover:bg-black/30 transition-colors mb-1"><div className="bg-indigo-500/20 p-2 rounded-lg"><File size={24} /></div><div className="flex-1 min-w-0 font-bold text-sm truncate">{JSON.parse(msg.media_meta || '{}').name || 'Document'}</div><Download size={20} /></a> )}
              {msg.text && (msg.type === 'text' || !msg.type) && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}</>
          )}
          <div className="flex items-center justify-end gap-1 mt-1 shrink-0 ml-4">
            {msg.isStarred === 1 && <Star className="w-3 h-3 text-yellow-500 fill-yellow-500 mr-0.5" />}
            <span className="text-[10px] opacity-60 font-medium">{safeFormatTime(msg.created_at)}</span>
            {msg.isMe && (
              msg.read ? <CheckCheck className="w-4 h-4 text-[#53bdeb] stroke-[3px]" /> : 
              msg.delivered ? <CheckCheck className="w-4 h-4 text-slate-400 stroke-[2.5px]" /> : 
              <Check className="w-4 h-4 text-slate-400 stroke-[2.5px]" />
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-full w-full bg-[#020617] overflow-hidden relative text-slate-100 font-sans">
      <AnimatePresence>
        {adminBroadcast && (
          <motion.div initial={{ y: -100, opacity: 0 }} animate={{ y: 20, opacity: 1 }} exit={{ y: -100, opacity: 0 }} className="fixed top-0 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-md px-4">
            <div className="bg-emerald-600/90 backdrop-blur-xl border border-emerald-400/30 p-4 rounded-2xl shadow-2xl flex items-center gap-4">
              <div className="bg-white/20 p-2 rounded-xl"><ShieldCheck className="text-white w-6 h-6" /></div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5"><span className="text-[10px] font-black uppercase tracking-widest text-white/70">System Broadcast</span><span className="text-[10px] text-white/50">{format(new Date(), 'HH:mm')}</span></div>
                <p className="text-sm font-bold text-white leading-tight">{adminBroadcast.message}</p>
              </div>
              <button onClick={() => setAdminBroadcast(null)} className="p-1 text-white/50 hover:text-white"><X size={18} /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 1. SIDEBAR */}
      <div className={`flex flex-col h-full border-r border-white/5 bg-[#020617] transition-all duration-300 z-30 ${activeConv ? 'hidden md:flex' : 'flex w-full'} md:w-[35%] lg:w-[25%] shrink-0`}>
        <div className="p-4 bg-slate-950/30 backdrop-blur-md border-b border-white/5 h-16 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-4">
            <button onClick={() => setView('chats')} className={`p-2 rounded-xl transition-all ${view === 'chats' ? 'bg-emerald-500/10 text-emerald-500' : 'text-slate-400'}`}><MessageSquare size={20} /></button>
            <button onClick={() => setView('calls')} className={`p-2 rounded-xl transition-all ${view === 'calls' ? 'bg-emerald-500/10 text-emerald-500' : 'text-slate-400'}`}><Phone size={20} /></button>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" />
              <input type="text" placeholder="Search..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-32 pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs outline-none focus:w-48 focus:border-emerald-500/50 transition-all" />
            </div>
            <button className="p-2 text-slate-400 hover:text-emerald-500"><Settings size={20} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto scrollbar-hide pb-20">
          <AnimatePresence mode="wait">
            {view === 'chats' ? (
              <motion.div key="chats" initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="px-2 space-y-1 py-2">
                <div className="p-2"><button onClick={() => setShowNewChat(true)} className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-emerald-600/10 text-emerald-500 border border-emerald-500/20 font-bold text-[10px] tracking-widest uppercase hover:bg-emerald-600 transition-all"><Plus size={14} /> New Chat</button></div>
                {conversations.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).filter(c => c.other_name.toLowerCase().includes(searchQuery.toLowerCase())).map(conv => (
                  <button key={conv.id} onClick={() => setActiveConv(conv)} className={`w-full flex items-center gap-3 p-3.5 rounded-xl transition-all ${activeConv?.id === conv.id ? 'bg-white/10' : 'hover:bg-white/5'}`}>
                    <div className="relative shrink-0">
                      <div className={`w-12 h-12 rounded-full bg-slate-800 overflow-hidden ${onlineUsers.has(conv.other_id) ? 'ring-2 ring-emerald-500 ring-offset-2 ring-offset-[#020617]' : ''}`}>
                        {conv.other_profile_picture ? <img src={conv.other_profile_picture} className="w-full h-full object-cover" /> : <span className="flex items-center justify-center h-full font-bold">{conv.other_name[0]}</span>}
                      </div>
                      {onlineUsers.has(conv.other_id) && <div className="absolute bottom-0.5 right-0.5 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#020617]" />}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <div className="flex justify-between items-baseline mb-0.5">
                        <h3 className="font-bold text-slate-200 truncate text-sm flex items-center gap-2">
                          {conv.other_name}
                          {onlineUsers.has(conv.other_id) && <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />}
                        </h3>
                        <span className={`text-[10px] ${(unreadCounts[conv.id] || conv.unread_count) > 0 ? 'text-emerald-500 font-bold' : 'text-slate-500'}`}>
                          {safeFormatTime(conv.created_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs text-slate-400 truncate flex-1">
                          {typingUsers[conv.other_id] ? (
                            <span className="text-emerald-500 font-medium animate-pulse">typing...</span>
                          ) : recordingUsers[conv.other_id] ? (
                            <span className="text-red-400 font-medium flex items-center gap-1 animate-pulse"><Mic size={12} /> recording...</span>
                          ) : (
                            <div className="flex items-center gap-1">
                              {conv.is_me && (
                                conv.read ? <CheckCheck className="w-3.5 h-3.5 text-blue-500 shrink-0" /> : 
                                conv.delivered ? <CheckCheck className="w-3.5 h-3.5 text-slate-500 shrink-0" /> : 
                                <Check className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                              )}
                              <span className="truncate">{conv.last_message || 'Start chatting'}</span>
                            </div>
                          )}
                        </div>
                        {(unreadCounts[conv.id] || conv.unread_count) > 0 && (
                          <div className="bg-emerald-500 text-[#020617] min-w-[20px] h-5 rounded-full flex items-center justify-center text-[10px] font-black px-1.5 shadow-lg shadow-emerald-500/20">
                            {unreadCounts[conv.id] || conv.unread_count}
                          </div>
                        )}
                      </div>
                    </div>
                  </button>
                ))}
              </motion.div>
            ) : (
              <motion.div key="calls" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 20 }} className="h-full">
                <CallHistory 
                  calls={calls} 
                  onStartCall={startCall}
                  onMessage={(otherId) => {
                    const conv = conversations.find(c => c.other_id === otherId);
                    if (conv) { setActiveConv(conv); setView('chats'); }
                    else { startConversation(otherId).then(() => { setView('chats'); }); }
                  }}
                  onViewProfile={(otherId) => {
                    const conv = conversations.find(c => c.other_id === otherId);
                    if (conv) { setActiveConv(conv); setShowContactInfo(true); }
                    else {
                      const user = wardUsers.find(u => u.id === otherId);
                      if (user) {
                        setActiveConv({ 
                          id: 'temp', other_id: otherId, other_name: user.display_name, 
                          other_profile_picture: user.profile_picture, about: user.about 
                        });
                        setShowContactInfo(true);
                      }
                    }
                  }}
                  onRefresh={fetchCalls}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* 2. MAIN CHAT AREA */}
      <div id="messaging-area" className={`flex flex-col h-full bg-[#0b141a] relative transition-all duration-200 ease-in-out z-20 flex-1 ${activeConv ? 'flex' : 'hidden md:flex items-center justify-center bg-[#222e35]'}`}>
        {activeConv ? (
          <>
            <div className="bg-[#020617]/90 backdrop-blur-xl border-b border-white/5 p-3 h-16 flex items-center justify-between shrink-0 z-10">
              <div className="flex items-center gap-3 min-w-0 cursor-pointer flex-1" onClick={() => setShowContactInfo(true)}>
                <button onClick={() => setActiveConv(null)} className="md:hidden p-2 -ml-2 text-slate-400 hover:text-emerald-500 transition-colors"><ArrowLeft size={20} /></button>
                <div className="relative shrink-0">
                  <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden shrink-0">{(activeConv.other_profile_picture && !activeConv.is_blocked_by_me && !activeConv.has_blocked_me) ? <img src={activeConv.other_profile_picture} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-800 flex items-center justify-center font-bold text-slate-500">{activeConv.other_name[0]}</div>}</div>
                  {onlineUsers.has(activeConv.other_id) && <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-[#020617] shadow-[0_0_8px_#10b981]" />}
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold text-slate-100 truncate text-sm flex items-center gap-2">
                    {activeConv.other_name}
                    {onlineUsers.has(activeConv.other_id) && <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_#10b981]" />}
                  </h2>
                  <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-wider truncate">
                    {typingUsers[activeConv.other_id] ? 'Typing...' : (onlineUsers.has(activeConv.other_id) ? 'Online' : lastSeenMap[activeConv.other_id] ? `Last seen ${formatLastSeen(lastSeenMap[activeConv.other_id])}` : 'Offline')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {auditService.getIssueCount() > 0 && (
                  <button onClick={() => setShowDiagnosticReport(true)} className="p-2 text-amber-500 animate-pulse bg-amber-500/10 rounded-full" title="Issues Detected">
                    <AlertTriangle size={20} />
                  </button>
                )}
                <button onClick={() => setShowBgPicker(true)} className="p-2.5 text-slate-400 hover:text-emerald-400" title="Change Background"><Grid size={20} /></button>
                <button onClick={() => startCall('audio')} className={`p-2.5 rounded-xl transition-all ${activeConv.is_blocked_by_me || activeConv.has_blocked_me ? 'opacity-50 cursor-not-allowed' : 'text-slate-400 hover:text-emerald-400'}`} disabled={activeConv.is_blocked_by_me || activeConv.has_blocked_me}><Phone size={20} /></button>
                <button onClick={() => startCall('video')} className={`p-2.5 rounded-xl transition-all ${activeConv.is_blocked_by_me || activeConv.has_blocked_me ? 'opacity-50 cursor-not-allowed' : 'text-slate-400 hover:text-emerald-400'}`} disabled={activeConv.is_blocked_by_me || activeConv.has_blocked_me}><Video size={20} /></button>
                <button onClick={() => setShowContactInfo(!showContactInfo)} className="p-2.5 text-slate-400"><MoreVertical size={20} /></button>
              </div>
            </div>
            {/* Dynamic Chat Area: Uses flex-col-reverse for bottom anchoring */}
            <div ref={scrollRef} className={`flex-1 overflow-y-auto p-4 lg:px-12 relative scrollbar-hide flex flex-col-reverse transition-all duration-500 ${currentBg.class}`} style={currentBg.style}>
              <div className="flex flex-col gap-3 py-4">
                {/* Messages mapped in reverse order for col-reverse anchoring */}
                {[...messages].filter(m => !searchQuery || m.text?.toLowerCase().includes(searchQuery.toLowerCase())).map(msg => (
                  <div key={msg.id} id={`msg-${msg.messageGroupId || msg.message_group_id}`}>
                    {renderMessageContent(msg)}
                  </div>
                ))}
                <div className="flex justify-center my-4 sticky top-4 z-10"><div className="bg-[#182229]/80 backdrop-blur-md text-[11px] font-medium text-slate-300 px-4 py-1.5 rounded-xl border border-white/5 shadow-sm max-w-[85%] text-center uppercase tracking-wider"><Shield className="w-3 h-3 text-emerald-500 inline mr-2" /> End-to-end encrypted</div></div>
              </div>
            </div>
            <div className="p-3 bg-[#202c33] border-t border-white/5 pb-[max(env(safe-area-inset-bottom),12px)]">
              {replyingTo && (
                <div className="mb-2 p-3 bg-[#111b21] rounded-xl border-l-4 border-emerald-500 flex items-center justify-between group animate-in slide-in-from-bottom-2 duration-200">
                  <div className="flex flex-col gap-1 overflow-hidden">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">{replyingTo.isMe ? 'You' : activeConv.other_name}</span>
                    <p className="text-[12px] text-slate-400 truncate leading-tight">{replyingTo.text || (replyingTo.type === 'image' ? '📷 Photo' : replyingTo.type === 'audio' ? '🎵 Voice Note' : '📄 Document')}</p>
                  </div>
                  <button onClick={() => setReplyingTo(null)} className="p-1 text-slate-500 hover:text-white transition-colors"><X size={16} /></button>
                </div>
              )}
              {activeConv.is_blocked_by_me || activeConv.has_blocked_me ? ( <div className="p-4 bg-[#111b21] rounded-xl text-sm text-slate-400 italic text-center w-full">{activeConv.is_blocked_by_me ? 'You blocked this contact. Tap to unblock.' : 'You have been blocked by this contact.'}{activeConv.is_blocked_by_me && <button onClick={() => api.post('/api/users/unblock', { blockedId: activeConv.other_id })} className="ml-2 text-emerald-500 font-bold hover:underline">Unblock</button>}</div> ) : (
                <div className="flex items-end gap-2 max-w-5xl mx-auto relative">
                  <button onClick={() => setShowAttachmentMenu(!showAttachmentMenu)} className="p-3 text-slate-400 hover:text-white"><Plus size={24} /></button>
                  <div className="flex-1 bg-[#2a3942] rounded-2xl flex items-center px-2 py-1.5 min-h-[44px]">
                    {isRecording ? ( <div className="flex items-center w-full px-2 gap-3 text-red-400 animate-pulse"><Mic2 size={20} /><span className="font-mono font-bold text-sm">{formatDuration(recordingDuration)}</span><div className="flex-1" /><span className="text-[10px] uppercase font-black tracking-widest text-slate-500">Recording...</span></div> ) : (
                      <><button className="p-2 text-slate-400 hover:text-slate-200"><Smile size={24} /></button><textarea placeholder="Type a message" className="flex-1 bg-transparent text-slate-200 text-sm outline-none px-2 resize-none max-h-32 py-2" rows={1} value={newMessage} onChange={e => { setNewMessage(e.target.value); getSocket()?.emit('typing', { recipientId: activeConv.other_id, isTyping: true }); }} onBlur={() => getSocket()?.emit('typing', { recipientId: activeConv.other_id, isTyping: false })} onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(e); getSocket()?.emit('typing', { recipientId: activeConv.other_id, isTyping: false }); } }} /></>
                    )}
                  </div>
                  {isRecording ? ( <div className="flex gap-2"><button onClick={() => stopRecording(true)} className="p-3 rounded-full bg-slate-700 text-white shadow-lg transition-all"><Trash2 size={20} /></button><button onClick={() => stopRecording(false)} className="p-3 rounded-full bg-emerald-500 text-white shadow-lg transition-all"><Send size={20} className="ml-0.5" /></button></div> ) : (
                    <button onClick={newMessage.trim() ? sendMessage : startRecording} className={`p-3 rounded-full shadow-lg ${newMessage.trim() ? 'bg-emerald-500 text-white' : 'bg-[#2a3942] text-slate-400'}`}>{newMessage.trim() ? <Send size={20} className="ml-0.5" /> : <Mic size={20} />}</button>
                  )}
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center opacity-20 text-slate-400"><MessageSquare size={120} /><h2 className="text-2xl font-bold mt-4 uppercase tracking-[0.2em]">virelChat</h2></div>
        )}
      </div>

      {/* Identity Registry Modal */}
      <AnimatePresence>
        {showNewChat && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[200] flex items-center justify-center p-4 lg:p-6" onClick={() => setShowNewChat(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-slate-950/80 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col h-[70vh] border border-white/10 relative" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-white/5 flex flex-col gap-4 bg-slate-950/20">
                <div className="flex items-center justify-between"><h2 className="text-xl font-black text-slate-100 uppercase tracking-tighter">Identity Registry</h2><button onClick={() => setShowNewChat(false)} className="p-2.5 bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors"><X size={20} /></button></div>
                <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4" /><input autoFocus type="text" placeholder="Query identity..." className="w-full pl-11 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-slate-200 outline-none focus:border-emerald-500/50 transition-all" value={newChatSearch} onChange={e => setNewChatSearch(e.target.value)} /></div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 scrollbar-hide">
                {wardUsers.filter(u => u.display_name.toLowerCase().includes(newChatSearch.toLowerCase())).map(u => (
                  <button key={u.id} onClick={() => startConversation(u.id)} className="w-full flex items-center gap-4 p-4 rounded-2xl hover:bg-white/5 transition-all text-left group">
                    <div className={`w-12 h-12 rounded-[1.25rem] bg-slate-900 flex items-center justify-center text-slate-400 font-black overflow-hidden border border-white/5 shadow-xl group-hover:scale-105 transition-transform ${onlineUsers.has(u.id) ? 'ring-2 ring-emerald-500' : ''}`}>{u.profile_picture ? <img src={u.profile_picture} className="w-full h-full object-cover" /> : u.display_name[0]}</div>
                    <div className="min-w-0 flex-1"><h3 className="font-bold text-slate-200 truncate group-hover:text-emerald-400 transition-colors">{u.display_name}</h3><p className="text-[10px] text-slate-600 font-black uppercase tracking-widest opacity-60">{onlineUsers.has(u.id) ? 'Online now' : u.last_seen ? `Last seen ${formatLastSeen(u.last_seen)}` : 'Available for transmission'}</p></div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showBgPicker && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[200] flex items-center justify-center p-4 lg:p-6" onClick={() => setShowBgPicker(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-[#202c33] w-full max-w-md rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-white/10 relative" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-white/5 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-100">Chat Wallpaper</h2>
                <button onClick={() => setShowBgPicker(false)} className="p-2.5 bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
              </div>
              <div className="p-6 grid grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto scrollbar-hide">
                {backgroundOptions.map(bg => (
                  <button key={bg.id} onClick={() => changeBackground(bg.id)} className={`relative h-32 rounded-xl overflow-hidden border-2 transition-all ${chatBackground === bg.id ? 'border-emerald-500 scale-95 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'border-transparent hover:border-white/20'}`}>
                    <div className={`absolute inset-0 ${bg.class}`} style={bg.style} />
                    <div className="absolute inset-0 bg-black/20 flex items-center justify-center">
                      <span className="text-xs font-bold text-white uppercase tracking-widest bg-black/40 px-3 py-1 rounded-full backdrop-blur-md">{bg.name}</span>
                    </div>
                    {chatBackground === bg.id && <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1 rounded-full"><Check size={12} strokeWidth={4} /></div>}
                  </button>
                ))}
              </div>
              <div className="p-4 bg-black/20 text-center">
                <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Readability optimization active</p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{menuConfig && ( 
        <div 
          className="fixed inset-0 z-[1000] flex items-center justify-center md:block overflow-hidden" 
          onClick={(e) => { e.stopPropagation(); setMenuConfig(null); }}
          onContextMenu={(e) => { e.preventDefault(); setMenuConfig(null); }}
        >
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="md:hidden absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <motion.div 
            initial={window.innerWidth < 768 ? { y: '100%' } : { opacity: 0, scale: 0.95 }} 
            animate={window.innerWidth < 768 ? { y: 0 } : { opacity: 1, scale: 1, x: Math.min(menuConfig.x, window.innerWidth - 260), y: Math.min(menuConfig.y, window.innerHeight - 300) }} 
            exit={window.innerWidth < 768 ? { y: '100%' } : { opacity: 0, scale: 0.95 }} 
            transition={{ type: 'spring', damping: 25, stiffness: 300 }} 
            className={`absolute z-[1001] bg-[#233138] border border-white/10 shadow-2xl overflow-hidden ${window.innerWidth < 768 ? 'bottom-0 left-0 right-0 rounded-t-[2rem]' : 'rounded-xl w-[240px]'}`} 
            onClick={e => e.stopPropagation()}
          >
            {menuConfig.type === 'reactions' ? ( 
              <div className="flex items-center justify-around p-4 gap-2">
                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                  <button key={emoji} onClick={(e) => { e.stopPropagation(); handleReact(menuConfig.msg, emoji); setMenuConfig(null); }} className="text-2xl hover:scale-125 transition-transform duration-200">{emoji}</button>
                ))}
                <button className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white"><Plus size={20} /></button>
              </div> 
            ) : ( 
              <div className="py-2"> 
                {[ 
                  { label: 'Reply', icon: Reply, color: 'text-slate-300', action: () => setReplyingTo(menuConfig.msg) }, 
                  { label: 'Copy', icon: Copy, color: 'text-slate-300', action: () => copyToClipboard(msgTextForCopy(menuConfig.msg)) }, 
                  { label: 'Star', icon: Star, color: menuConfig.msg.isStarred ? 'text-yellow-500' : 'text-slate-300', action: () => handleStarMessage(menuConfig.msg) }, 
                  { label: 'Forward', icon: CornerUpRight, color: 'text-slate-300', action: () => { setForwardingMsg(menuConfig.msg); setShowNewChat(true); } }, 
                  { label: 'Delete for me', icon: Trash2, color: 'text-red-400', action: () => handleDeleteMessage(menuConfig.msg, 'me') }, 
                  ...(menuConfig.msg.isMe ? [{ label: 'Delete for everyone', icon: AlertCircle, color: 'text-red-400', action: () => handleDeleteMessage(menuConfig.msg, 'everyone') }] : []) 
                ].map((item, idx) => ( 
                  <button 
                    key={idx} 
                    onClick={(e) => { e.stopPropagation(); item.action(); setMenuConfig(null); }} 
                    className={`w-full flex items-center gap-4 px-5 py-3 hover:bg-white/5 transition-colors text-left ${item.color}`}
                  >
                    <item.icon size={20} opacity={0.7} />
                    <span className="text-[15px] font-medium">{item.label}</span>
                  </button> 
                ))} 
              </div> 
            )}
          </motion.div>
        </div> 
      )}</AnimatePresence>

      <AnimatePresence>
        {showContactInfo && activeConv && (
          <motion.div 
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed inset-0 md:inset-y-0 md:right-0 md:left-auto md:w-[400px] z-[150] bg-[#0b141a] border-l border-white/5 shadow-2xl"
          >
            <div className="h-full flex flex-col">
              <div className="bg-[#111b21] p-4 flex items-center gap-4 border-b border-[#202c33] shrink-0">
                <button onClick={() => setShowContactInfo(false)} className="text-slate-400 hover:text-white">
                  <X size={24} />
                </button>
                <h2 className="text-lg font-bold">Contact Info</h2>
              </div>
              <div className="flex-1 overflow-hidden">
                <ContactInfo 
                  contact={activeConv} 
                  onClose={() => setShowContactInfo(false)}
                  onBlock={() => api.post('/api/users/block', { blockedId: activeConv.other_id })}
                  onUnblock={() => api.post('/api/users/unblock', { blockedId: activeConv.other_id })}
                  onClearChat={() => { if(confirm('Are you sure?')) setMessages([]); }}
                  onStartCall={startCall}
                  onMessage={() => setShowContactInfo(false)}
                  messages={messages}
                  isBlockedByMe={activeConv.is_blocked_by_me}
                  onlineStatus={typingUsers[activeConv.other_id] ? 'Typing...' : (onlineUsers.has(activeConv.other_id) ? 'Online' : lastSeenMap[activeConv.other_id] ? `Last seen ${formatLastSeen(lastSeenMap[activeConv.other_id])}` : 'Offline')}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>{showAttachmentMenu && (<motion.div initial={{ opacity: 0, scale: 0.8, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.8, y: 20 }} className="fixed bottom-20 left-4 md:left-[36%] z-[100] bg-[#233138] border border-white/10 rounded-2xl shadow-2xl p-4 grid grid-cols-3 gap-4 w-64 mb-2 backdrop-blur-xl"><input type="file" ref={fileInputRef} className="hidden" onChange={(e) => handleFileUpload(e, 'document')} /><input type="file" ref={mediaInputRef} accept="image/*,video/*" className="hidden" onChange={(e) => handleFileUpload(e, 'image')} /><div onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 cursor-pointer group"><div className="bg-indigo-500 p-3 rounded-full text-white shadow-lg group-hover:scale-110 transition-transform"><FileText size={20} /></div><span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Document</span></div><div onClick={() => mediaInputRef.current?.click()} className="flex flex-col items-center gap-2 cursor-pointer group"><div className="bg-pink-500 p-3 rounded-full text-white shadow-lg group-hover:scale-110 transition-transform"><ImageIcon size={20} /></div><span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Photos</span></div><div className="flex flex-col items-center gap-2 cursor-pointer group"><div className="bg-rose-500 p-3 rounded-full text-white shadow-lg group-hover:scale-110 transition-transform"><Camera size={20} /></div><span className="text-[10px] text-slate-300 font-bold uppercase tracking-widest">Camera</span></div></motion.div>)}</AnimatePresence>

      {showCallingUI && currentCallData && <Calling type={callingType} otherUser={currentCallData} localUser={{ id: user.id, display_name: user.displayName, profile_picture: user.profilePicture }} socket={getSocket()} incomingCall={incomingCall} onEndCall={() => { setShowCallingUI(false); setCurrentCallData(null); stopSound(); fetchCalls(); }} startSound={startSound} stopSound={stopSound} />}

      {/* 4. DIAGNOSTIC REPORT MODAL */}
      <AnimatePresence>
        {showDiagnosticReport && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[300] flex items-center justify-center p-4 lg:p-6" onClick={() => setShowDiagnosticReport(false)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }} className="bg-[#111b21] w-full max-w-2xl rounded-[2rem] shadow-2xl overflow-hidden flex flex-col border border-amber-500/20 relative" onClick={e => e.stopPropagation()}>
              <div className="p-6 border-b border-white/5 flex items-center justify-between bg-amber-500/10">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="text-amber-500 w-6 h-6" />
                  <h2 className="text-xl font-bold text-slate-100">Seen Status Accuracy Report</h2>
                </div>
                <button onClick={() => setShowDiagnosticReport(false)} className="p-2.5 bg-white/5 rounded-xl text-slate-500 hover:text-white transition-colors"><X size={20} /></button>
              </div>
              
              <div className="p-6 overflow-y-auto max-h-[70vh]">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Tracked</p>
                    <p className="text-2xl font-black">{auditService.getReport().totalTracked}</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-amber-500/20">
                    <p className="text-[10px] text-amber-500/50 font-black uppercase tracking-widest mb-1">Issues</p>
                    <p className="text-2xl font-black text-amber-500">{auditService.getReport().issuesFound}</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Accuracy</p>
                    <p className="text-2xl font-black">{auditService.getReport().accuracyRate}%</p>
                  </div>
                  <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Status</p>
                    <p className={`text-sm font-black mt-2 uppercase ${auditService.getIssueCount() > 0 ? 'text-amber-500' : 'text-emerald-500'}`}>
                      {auditService.getIssueCount() > 0 ? 'Inaccurate' : 'Optimal'}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Detected Premature Events</h3>
                  {auditService.getLogs().filter(l => l.accuracyWarning).length === 0 ? (
                    <div className="text-center py-12 bg-white/5 rounded-[2rem] border border-white/5">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500/20 mx-auto mb-4" />
                      <p className="text-slate-500 text-xs font-bold uppercase tracking-widest">No status inaccuracies detected in this session</p>
                    </div>
                  ) : (
                    auditService.getLogs().filter(l => l.accuracyWarning).map((log, i) => (
                      <div key={i} className="bg-amber-500/5 border border-amber-500/10 rounded-2xl p-4 flex flex-col gap-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-mono text-amber-500/80">MSG_ID: {log.messageId.substring(0, 8)}...</span>
                          <span className="text-[10px] font-bold text-slate-600 uppercase">{format(new Date(log.readAt!), 'HH:mm:ss')}</span>
                        </div>
                        <p className="text-sm font-bold text-amber-500 flex items-center gap-2">
                          <AlertCircle size={14} />
                          {log.detectedIssue}
                        </p>
                        <div className="flex items-center gap-4 mt-2">
                          <div className="flex flex-col">
                            <span className="text-[8px] text-slate-600 font-black uppercase tracking-tighter">Sender</span>
                            <span className="text-[10px] text-slate-400 truncate w-32">{log.senderId}</span>
                          </div>
                          <div className="flex flex-col">
                            <span className="text-[8px] text-slate-600 font-black uppercase tracking-tighter">Recipient</span>
                            <span className="text-[10px] text-slate-400 truncate w-32">{log.recipientId}</span>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
              
              <div className="p-6 bg-amber-500/5 border-t border-white/5">
                <p className="text-[10px] text-amber-500/60 font-bold uppercase tracking-[0.2em] leading-relaxed">
                  Note: Seen statuses are marked as inaccurate when the recipient's client emits a read event while the application window is hidden or inactive.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Chat;
