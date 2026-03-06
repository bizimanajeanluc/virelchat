import React, { useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { getSocket } from '../services/socket';
import { CryptoEngine } from '../crypto/engine';
import { MessageSquare, Send, User, Shield, Search, Plus, ArrowLeft, MoreVertical, Check, CheckCheck, Trash2, AlertTriangle, Edit2, X, Phone, Video, Mic, StopCircle, Play, Pause, PhoneOff, Clock, PhoneIncoming, PhoneOutgoing, PhoneMissed, MicOff, VideoOff, Maximize, Minimize, Smile, Paperclip, Reply, Star, Forward, Copy, Flag, Pin, CheckSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, formatDistanceToNow } from 'date-fns';

interface ChatProps {
  user: any;
}

export const Chat: React.FC<ChatProps> = ({ user }) => {
  if (!user) return <div className="h-full flex items-center justify-center bg-stone-50">Loading chat...</div>;

  const [conversations, setConversations] = useState<any[]>([]);
  const [activeConv, setActiveConv] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [wardUsers, setWardUsers] = useState<any[]>([]);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [lastSeenMap, setLastSeenMap] = useState<Record<string, string>>({});
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [editingMessage, setEditingMessage] = useState<any>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<any>(null);
  const keyCacheRef = useRef<Record<string, any>>({});

  // Call States
  const [isCalling, setIsCalling] = useState(false);
  const [incomingCall, setIncomingCall] = useState<any>(null);
  const [callType, setCallType] = useState<'audio' | 'video' | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [callHistory, setCallHistory] = useState<any[]>([]);
  const [showCallHistory, setShowCallHistory] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isCallAccepted, setIsCallAccepted] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const callTimerRef = useRef<any>(null);
  const [replyingTo, setReplyingTo] = useState<any>(null);
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set());
  const [isSelectMode, setIsSelectMode] = useState(false);
  const [showMsgMenu, setShowMsgMenu] = useState<string | null>(null);
  const [menuPosition, setMenuPosition] = useState<'top' | 'bottom'>('top');

  const handleOpenMenu = (e: React.MouseEvent, msgId: string) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const spaceAbove = rect.top;
    // If less than 300px space above (top of screen), show it below (bottom)
    setMenuPosition(spaceAbove < 300 ? 'bottom' : 'top');
    setShowMsgMenu(showMsgMenu === msgId ? null : msgId);
  };
  const [pinnedMessages, setPinnedMessages] = useState<Set<string>>(new Set());
  const [starredMessages, setStarredMessages] = useState<Set<string>>(new Set());
  const [forwardingMessage, setForwardingMessage] = useState<any>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [reactions, setReactions] = useState<Record<string, string[]>>({});

  const toggleStar = (messageGroupId: string) => {
    setStarredMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageGroupId)) next.delete(messageGroupId);
      else next.add(messageGroupId);
      return next;
    });
  };

  const togglePin = (messageGroupId: string) => {
    setPinnedMessages(prev => {
      const next = new Set(prev);
      if (next.has(messageGroupId)) next.delete(messageGroupId);
      else next.add(messageGroupId);
      return next;
    });
  };

  const handleReaction = (messageGroupId: string, emoji: string) => {
    setReactions(prev => ({
      ...prev,
      [messageGroupId]: [...(prev[messageGroupId] || []), emoji].slice(-3)
    }));
    getSocket()?.emit('message_reaction', { messageGroupId, emoji });
  };
  const fileInputRef = useRef<HTMLInputElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const callTimeoutRef = useRef<any>(null);
  const ringtoneRef = useRef<AudioContext | null>(null);
  const ringtoneOscillator = useRef<OscillatorNode | null>(null);

  const startSound = (type: 'calling' | 'ringing') => {
    try {
      if (ringtoneRef.current) stopSound();
      
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      ringtoneRef.current = ctx;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.1, ctx.currentTime);

      const osc = ctx.createOscillator();
      osc.connect(gain);
      
      if (type === 'calling') {
        // Standard US ringback tone: 440Hz + 480Hz
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        // We'll just use 440 for simplicity in a single oscillator
        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.frequency.setValueAtTime(480, ctx.currentTime);
        gain2.gain.setValueAtTime(0.1, ctx.currentTime);
        osc2.connect(gain2);
        gain2.connect(ctx.destination);
        
        // Cadence: 2s on, 4s off
        const now = ctx.currentTime;
        for (let i = 0; i < 10; i++) {
          gain.gain.setValueAtTime(0.1, now + i * 6);
          gain.gain.setValueAtTime(0, now + i * 6 + 2);
          gain2.gain.setValueAtTime(0.1, now + i * 6);
          gain2.gain.setValueAtTime(0, now + i * 6 + 2);
        }
        osc2.start();
        (osc2 as any)._stop = () => osc2.stop();
      } else {
        // European style ring: 400Hz + 450Hz dual tone
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, ctx.currentTime);
        
        // Cadence: 0.4s on, 0.2s off, 0.4s on, 2s off
        const now = ctx.currentTime;
        for (let i = 0; i < 20; i++) {
          const start = now + i * 3;
          gain.gain.setValueAtTime(0.2, start);
          gain.gain.setValueAtTime(0, start + 0.4);
          gain.gain.setValueAtTime(0.2, start + 0.6);
          gain.gain.setValueAtTime(0, start + 1.0);
        }
      }
      
      osc.start();
      ringtoneOscillator.current = osc;
    } catch (e) {
      console.warn('Audio context failed', e);
    }
  };

  const stopSound = () => {
    if (ringtoneOscillator.current) {
      try { ringtoneOscillator.current.stop(); } catch (e) {}
      ringtoneOscillator.current = null;
    }
    if (ringtoneRef.current) {
      try { ringtoneRef.current.close(); } catch (e) {}
      ringtoneRef.current = null;
    }
  };

  // Bind streams to video elements
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
    }
  }, [localStream, isCalling]);

  useEffect(() => {
    if (remoteVideoRef.current && remoteStream) {
      remoteVideoRef.current.srcObject = remoteStream;
      remoteVideoRef.current.play().catch(err => console.warn('Autoplay prevented:', err));
    }
  }, [remoteStream, isCallAccepted]);

  // Voice Note States
  const [isRecording, setIsRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const recordingTimerRef = useRef<any>(null);

  const activeConvRef = useRef<any>(null);
  useEffect(() => { activeConvRef.current = activeConv; }, [activeConv]);

  useEffect(() => {
    fetchConversations();
    fetchWardUsers();

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission();
    }

    const socket = getSocket();
    if (socket) {
      socket.on('message', async (msg) => {
        const myDeviceId = localStorage.getItem(`deviceId_${user.id}`);
        if (msg.recipientDeviceId !== myDeviceId && msg.recipient_device_id !== myDeviceId) return;

        const decrypted = await decryptMessage(msg);
        const msgSenderId = msg.senderId || msg.sender_id;
        const msgGroupId = msg.messageGroupId || msg.message_group_id;
        
        if (decrypted) {
          const isActive = activeConvRef.current?.id === msg.conversationId || activeConvRef.current?.id === msg.conversation_id;
          
          if (!isActive) {
            if (Notification.permission === 'granted') {
              new Notification('New Message', {
                body: decrypted.startsWith('data:audio') ? 'Voice Note' : decrypted,
                icon: '/manifest-icon-192.maskable.png'
              });
            }
          } else {
            // Automatically mark as read if active
            markAsRead(activeConvRef.current.id);
          }

          // Mark as delivered
          api.post('/api/messages/delivered', { messageIds: [msg.id] }).catch(() => {});

          setMessages(prev => {
            if (prev.some(m => (m.messageGroupId || m.message_group_id) === msgGroupId)) return prev;
            if (!isActive) return prev;
            return [...prev, { ...msg, message_group_id: msgGroupId, text: decrypted, isMe: msgSenderId === user.id, created_at: msg.created_at || new Date().toISOString() }];
          });
          fetchConversations();
        }
      });

      socket.on('message_delivered', ({ messageId, conversationId }) => {
        if (activeConvRef.current?.id === conversationId) {
          setMessages(prev => prev.map(m => m.id === messageId ? { ...m, delivered: 1 } : m));
        }
      });

      socket.on('message_edited', async ({ messageGroupId, recipientDeviceId, payload, editedAt }) => {
        const myDeviceId = localStorage.getItem(`deviceId_${user.id}`);
        if (recipientDeviceId !== myDeviceId) return;

        setMessages(prev => {
          const msgToEdit = prev.find(m => (m.messageGroupId || m.message_group_id) === messageGroupId);
          if (msgToEdit) {
            decryptMessage({ payload, senderId: msgToEdit.senderId || msgToEdit.sender_id }).then(decrypted => {
              if (decrypted) {
                setMessages(current => current.map(m => 
                  (m.messageGroupId || m.message_group_id) === messageGroupId ? { ...m, text: decrypted, edited_at: editedAt } : m
                ));
              }
            });
          }
          return prev;
        });
      });

      socket.on('message_deleted', ({ messageGroupId, mode }) => {
        if (mode === 'everyone') {
          setMessages(prev => prev.map(m => (m.message_group_id || m.messageGroupId) === messageGroupId ? { ...m, deleted_at: new Date().toISOString() } : m));
        } else {
          setMessages(prev => prev.filter(m => (m.message_group_id || m.messageGroupId) !== messageGroupId));
        }
        fetchConversations();
      });

      socket.on('messages_read', ({ conversationId }) => {
        if (activeConvRef.current?.id === conversationId) {
          setMessages(prev => prev.map(m => ({ ...m, read: 1 })));
        }
        fetchConversations();
      });


      socket.on('message_restored', ({ messageGroupId }) => {
        if (activeConvRef.current) fetchMessages(activeConvRef.current.id);
        fetchConversations();
      });

      socket.on('message_reaction', ({ messageGroupId, emoji }) => {
        setReactions(prev => ({
          ...prev,
          [messageGroupId]: [...(prev[messageGroupId] || []), emoji].slice(-3)
        }));
      });

      socket.on('online_users', (users: string[]) => {
        setOnlineUsers(new Set(users));
      });

      socket.on('user_status', ({ userId, status, lastSeen }: { userId: string, status: 'online' | 'offline', lastSeen?: string }) => {
        setOnlineUsers(prev => {
          const next = new Set(prev);
          if (status === 'online') next.add(userId);
          else next.delete(userId);
          return next;
        });
        if (lastSeen) {
          setLastSeenMap(prev => ({ ...prev, [userId]: lastSeen }));
        }
      });

      socket.on('typing', ({ senderId, isTyping }: { senderId: string, isTyping: boolean }) => {
        setTypingUsers(prev => ({ ...prev, [senderId]: isTyping }));
      });

      socket.on('profile_updated', (data) => {
        const { userId, displayName, profilePicture, about } = data;
        
        // Update ward users list
        setWardUsers(prev => prev.map(u => 
          u.id === userId ? { ...u, display_name: displayName, profile_picture: profilePicture, about } : u
        ));

        // Update active conversation if it's the same user
        setActiveConv(prev => {
          if (prev?.other_id === userId) {
            return { ...prev, other_name: displayName, other_profile_picture: profilePicture };
          }
          return prev;
        });

        // Update conversations list
        setConversations(prev => prev.map(c => 
          c.other_id === userId ? { ...c, other_name: displayName, other_profile_picture: profilePicture } : c
        ));
      });

      socket.on('user_deleted', ({ userId }) => {
        setConversations(prev => prev.filter(c => c.other_id !== userId));
        setWardUsers(prev => prev.filter(u => u.id !== userId));
        if (activeConvRef.current?.other_id === userId) {
          setActiveConv(null);
          alert('This user has been deleted and the conversation is no longer available.');
        }
      });

      socket.on('call_incoming', (data) => {
        setIncomingCall(data);
        startSound('ringing');
      });
      socket.on('call_accepted', async (data: any) => {
        stopSound();
        if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
        setIsCallAccepted(true);
        if (data.callId) setActiveCallId(data.callId);

        // Caller side: Create PeerConnection when recipient accepts
        if (localStreamRef.current && !peerConnection.current) {
          const pc = createPeerConnection(activeConvRef.current?.other_id || data.recipientId, localStreamRef.current);
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('offer', { otherId: activeConvRef.current?.other_id || data.recipientId, offer });
        }
      });
      socket.on('call_rejected', () => {
        stopSound();
        if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
        endCall();
        alert('Call rejected');
      });
      socket.on('call_ended', () => {
        stopSound();
        if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
        endCall();
      });

      socket.on('offer', async ({ offer, senderId }) => {
        if (!peerConnection.current) {
          createPeerConnection(senderId); 
        }
        try {
          await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(offer));
          const answer = await peerConnection.current?.createAnswer();
          await peerConnection.current?.setLocalDescription(answer);
          socket.emit('answer', { otherId: senderId, answer });
        } catch (err) {
          console.error('Failed to handle offer', err);
        }
      });

      socket.on('answer', async ({ answer }) => {
        try {
          if (peerConnection.current?.signalingState !== 'stable') {
            await peerConnection.current?.setRemoteDescription(new RTCSessionDescription(answer));
          }
        } catch (err) {
          console.error('Failed to handle answer', err);
        }
      });

      socket.on('ice_candidate', async ({ candidate }) => {
        try {
          if (candidate && peerConnection.current) {
            await peerConnection.current.addIceCandidate(new RTCIceCandidate(candidate));
          }
        } catch (err) {
          console.error('Failed to add ice candidate', err);
        }
      });
    }

    return () => {
      stopSound();
      socket?.off('message');
      socket?.off('message_edited');
      socket?.off('message_deleted');
      socket?.off('message_restored');
      socket?.off('online_users');
      socket?.off('user_status');
      socket?.off('typing');
      socket?.off('call_incoming');
      socket?.off('call_accepted');
      socket?.off('call_rejected');
      socket?.off('call_ended');
      socket?.off('offer');
      socket?.off('answer');
      socket?.off('ice_candidate');
    };
  }, []);

  useEffect(() => {
    if (isCallAccepted) {
      stopSound();
      setCallDuration(0);
      callTimerRef.current = setInterval(() => {
        setCallDuration(prev => prev + 1);
      }, 1000);
    } else {
      if (callTimerRef.current) clearInterval(callTimerRef.current);
      setCallDuration(0);
    }
    return () => { if (callTimerRef.current) clearInterval(callTimerRef.current); };
  }, [isCallAccepted]);

  const formatCallDuration = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs > 0 ? hrs + ':' : ''}${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const localStreamRef = useRef<MediaStream | null>(null);
  useEffect(() => { localStreamRef.current = localStream; }, [localStream]);

  const createPeerConnection = (otherId: string, stream?: MediaStream) => {
    if (peerConnection.current) {
      peerConnection.current.close();
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        getSocket()?.emit('ice_candidate', { otherId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      console.log('Got remote track:', event.track.kind, event.streams[0]?.id);
      if (event.streams && event.streams[0]) {
        setRemoteStream(event.streams[0]);
      } else {
        setRemoteStream(prev => {
          const newStream = prev || new MediaStream();
          newStream.addTrack(event.track);
          return newStream;
        });
      }
    };

    const streamToUse = stream || localStreamRef.current;
    if (streamToUse) {
      streamToUse.getTracks().forEach(track => pc.addTrack(track, streamToUse));
    }

    peerConnection.current = pc;
    return pc;
  };

  const fetchCallHistory = async () => {
    try {
      const res = await api.get('/calls');
      setCallHistory(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Failed to fetch call history', err);
      setCallHistory([]);
    }
  };

  const startCall = async (type: 'audio' | 'video', targetUserId?: string) => {
    const recipientId = targetUserId || activeConv?.other_id;
    if (!recipientId) return;
    
    setCallType(type);
    setIsCalling(true);
    setIsMuted(false);
    setIsVideoOff(false);
    startSound('calling');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: type === 'video'
      });
      setLocalStream(stream);
      localStreamRef.current = stream;

      getSocket()?.emit('call_request', {
        recipientId,
        callerName: user.displayName,
        type
      });

      if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
      callTimeoutRef.current = setTimeout(() => {
        if (!isCallAccepted) {
          getSocket()?.emit('call_timeout', { recipientId, callId: activeCallId });
          endCall();
        }
      }, 30000);
    } catch (err) {
      console.error('Failed to get media stream', err);
      setIsCalling(false);
      stopSound();
    }
  };

  const acceptCall = async () => {
    if (!incomingCall) return;
    stopSound();
    setCallType(incomingCall.type);
    setActiveCallId(incomingCall.callId);
    setIsCallAccepted(true);
    setIsCalling(true);
    setIsMuted(false);
    setIsVideoOff(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: incomingCall.type === 'video'
      });
      setLocalStream(stream);
      localStreamRef.current = stream;

      const pc = createPeerConnection(incomingCall.callerId, stream);
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      getSocket()?.emit('call_accepted', { callId: incomingCall.callId, callerId: incomingCall.callerId });
      getSocket()?.emit('offer', { otherId: incomingCall.callerId, offer });
      setIncomingCall(null);
    } catch (err) {
      console.error('Failed to accept call', err);
      stopSound();
      endCall();
    }
  };

  const toggleMute = () => {
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsMuted(!isMuted);
    }
  };

  const toggleVideo = () => {
    if (localStream && callType === 'video') {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = !track.enabled;
      });
      setIsVideoOff(!isVideoOff);
    }
  };

  const rejectCall = () => {
    if (!incomingCall) return;
    stopSound();
    getSocket()?.emit('call_rejected', { callId: incomingCall.callId, callerId: incomingCall.callerId });
    setIncomingCall(null);
  };

  const endCall = () => {
    stopSound();
    localStream?.getTracks().forEach(track => track.stop());
    localStreamRef.current?.getTracks().forEach(track => track.stop());
    peerConnection.current?.close();
    peerConnection.current = null;
    setLocalStream(null);
    localStreamRef.current = null;
    setRemoteStream(null);
    setIsCalling(false);
    setIsCallAccepted(false);
    setCallType(null);
    if (activeConv) {
      getSocket()?.emit('call_ended', { otherId: activeConv.other_id });
    }
  };

  // Voice Note Functions
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(chunks, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          await sendVoiceNote(base64Audio);
        };
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setIsRecording(true);
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && isRecording) {
      mediaRecorder.stop();
      setIsRecording(false);
      clearInterval(recordingTimerRef.current);
    }
  };

  const sendVoiceNote = async (base64Audio: string) => {
    if (!activeConv) return;
    const messageGroupId = crypto.randomUUID();
    
    try {
      const [recipientRes, senderRes] = await Promise.all([
        api.get(`/keys/${activeConv.other_id}`),
        api.get(`/keys/${user.id}`)
      ]);
      
      const recipientBundles = recipientRes.data;
      const senderBundles = senderRes.data;
      const allBundles = [...recipientBundles, ...senderBundles];
      const payloads: Record<string, any> = {};
      const myDeviceId = localStorage.getItem(`deviceId_${user.id}`) || 'web-device-id';
      
      for (const bundle of allBundles) {
        const encryptedBody = await CryptoEngine.encryptMessage(base64Audio, bundle.identityKey, user.id);
        payloads[bundle.deviceId] = { body: encryptedBody, senderDeviceId: myDeviceId };
      }

      getSocket()?.emit('send_message', {
        conversationId: activeConv.id,
        recipientId: activeConv.other_id,
        messageGroupId,
        payloads
      });

      setMessages(prev => [...prev, { text: base64Audio, isMe: true, messageGroupId, created_at: new Date().toISOString(), read: 0 }]);
    } catch (err) {
      console.error('Failed to send voice note', err);
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, typingUsers]);

  useEffect(() => {
    if (activeConv) {
      fetchMessages(activeConv.id);
      markAsRead(activeConv.id);
    }
  }, [activeConv]);

  const fetchMessages = async (convId: string) => {
    try {
      const myDeviceId = localStorage.getItem(`deviceId_${user.id}`);
      const res = await api.get(`/conversations/${convId}/messages?deviceId=${myDeviceId}`);
      
      // Filter out messages deleted by this user
      const activeMessages = res.data.filter((msg: any) => {
        if (msg.deleted_at && !msg.is_me) return false; // Still show "deleted" placeholder for received? 
        // Actually the server already filters deleted_by.
        // We just need to handle deleted_at (everyone)
        return true;
      });

      const decryptedMessages = await Promise.all(activeMessages.map(async (msg: any) => {
        const isMe = msg.sender_id === user.id;
        const msgGroupId = msg.message_group_id || msg.messageGroupId;
        try {
          const decrypted = await decryptMessage(msg);
          return { ...msg, message_group_id: msgGroupId, text: decrypted || '[Decryption Error]', isMe };
        } catch (e) {
          console.error('Decryption failed for message', msg.id, e);
          return { ...msg, message_group_id: msgGroupId, text: '[Decryption Error]', isMe };
        }
      }));
      setMessages(decryptedMessages);
    } catch (err) {
      console.error('Failed to fetch messages', err);
    }
  };

  const markAsRead = async (convId: string) => {
    try {
      await api.post('/messages/read', { conversationId: convId });
      setConversations(prev => prev.map(c => c.id === convId ? { ...c, unread_count: 0 } : c));
    } catch (err) {
      console.error('Failed to mark as read', err);
    }
  };

  const deleteConversation = async () => {
    if (!activeConv || !confirm('Are you sure you want to delete this conversation? This will delete all messages for you.')) return;
    try {
      await api.delete(`/conversations/${activeConv.id}`);
      setActiveConv(null);
      fetchConversations();
    } catch (err) {
      alert('Failed to delete conversation');
    }
  };

  const blockUser = async () => {
    if (!activeConv || !confirm(`Are you sure you want to block ${activeConv.other_name}?`)) return;
    try {
      await api.post('/users/block', { blockedId: activeConv.other_id });
      setActiveConv(null);
      fetchConversations();
      alert('User blocked');
    } catch (err) {
      alert('Failed to block user');
    }
  };

  const deleteMessage = async (msg: any) => {
    let choice: 'me' | 'everyone' | null = null;
    const mID = msg.message_group_id || msg.messageGroupId;

    if (confirm('Delete this message for EVERYONE?')) {
      choice = 'everyone';
    } else if (confirm('Delete for ME only?')) {
      choice = 'me';
    }

    if (choice) {
      // Immediate local update
      if (choice === 'everyone') {
        setMessages(prev => prev.map(m => (m.message_group_id || m.messageGroupId) === mID ? { ...m, deleted_at: new Date().toISOString() } : m));
      } else {
        setMessages(prev => prev.filter(m => (m.message_group_id || m.messageGroupId) !== mID));
      }

      const socket = getSocket();
      socket?.emit('delete_message', { messageGroupId: mID, mode: choice });
      setShowMsgMenu(null);
    }
  };

  const editMessage = async (messageGroupId: string, newText: string) => {
    if (!newText.trim() || !activeConv) return;
    try {
      const [recipientRes, senderRes] = await Promise.all([
        api.get(`/keys/${activeConv.other_id}`),
        api.get(`/keys/${user.id}`)
      ]);
      const allBundles = [...recipientRes.data, ...senderRes.data];
      const payloads: Record<string, any> = {};
      const myDeviceId = localStorage.getItem(`deviceId_${user.id}`) || 'web-device-id';

      for (const bundle of allBundles) {
        const encryptedBody = await CryptoEngine.encryptMessage(newText, bundle.identityKey, user.id);
        payloads[bundle.deviceId] = { body: encryptedBody, senderDeviceId: myDeviceId };
      }

      getSocket()?.emit('edit_message', { messageGroupId, payloads });
      setMessages(prev => prev.map(m =>
        (m.message_group_id || m.messageGroupId) === messageGroupId ? { ...m, text: newText, edited_at: new Date().toISOString() } : m
      ));
    } catch (err) {
      console.error('Failed to edit message', err);
    }
  };
  const fetchConversations = async () => {
    const res = await api.get('/conversations');
    setConversations(res.data);
  };

  const fetchWardUsers = async () => {
    const res = await api.get('/users/ward');
    setWardUsers(res.data);
    const seen: Record<string, string> = {};
    res.data.forEach((u: any) => {
      if (u.last_seen) seen[u.id] = u.last_seen;
    });
    setLastSeenMap(seen);
  };

  const decryptMessage = async (msg: any) => {
    if (!msg) return null;
    try {
      const payload = JSON.parse(typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload));
      const msgSenderId = msg.senderId || msg.sender_id;
      
      // Use cache to avoid hundreds of API calls
      if (!keyCacheRef.current[msgSenderId]) {
        const res = await api.get(`/keys/${msgSenderId}`);
        keyCacheRef.current[msgSenderId] = res.data;
      }
      
      const senderKeys = keyCacheRef.current[msgSenderId];
      const senderDevice = senderKeys.find((d: any) => d.deviceId === payload.senderDeviceId);
      
      if (!senderDevice) {
        // If not found in cache, force refresh once
        const res = await api.get(`/keys/${msgSenderId}`);
        keyCacheRef.current[msgSenderId] = res.data;
        const refreshedDevice = res.data.find((d: any) => d.deviceId === payload.senderDeviceId);
        if (!refreshedDevice) {
          console.error('Sender device not found for message', msg.id, payload.senderDeviceId);
          return null;
        }
        return await CryptoEngine.decryptMessage(payload.body, refreshedDevice.identityKey, user.id);
      }

      const senderIdentityKey = senderDevice.identityKey;
      return await CryptoEngine.decryptMessage(payload.body, senderIdentityKey, user.id);
    } catch (err) {
      console.error('Decryption failed', err, msg);
      return null;
    }
  };

  const startConversation = async (recipientId: string) => {
    const res = await api.post('/conversations', { recipientId });
    const conv = res.data;
    const otherUser = wardUsers.find(u => u.id === recipientId);
    const newActiveConv = { ...conv, other_name: otherUser?.display_name || 'User', other_id: recipientId };
    
    setActiveConv(newActiveConv);
    setShowNewChat(false);
    
    // Handle Forwarding
    if (forwardingMessage) {
      const textToForward = forwardingMessage.text;
      setForwardingMessage(null);
      // Wait a bit for state update
      setTimeout(() => {
        forwardMessageToConv(textToForward, newActiveConv);
      }, 500);
    } else {
      setMessages([]);
    }
  };

  const forwardMessageToConv = async (text: string, conv: any) => {
    const messageGroupId = crypto.randomUUID();
    try {
      const [recipientRes, senderRes] = await Promise.all([
        api.get(`/keys/${conv.other_id}`),
        api.get(`/keys/${user.id}`)
      ]);
      const allBundles = [...recipientRes.data, ...senderRes.data];
      const payloads: Record<string, any> = {};
      const myDeviceId = localStorage.getItem(`deviceId_${user.id}`) || 'web-device-id';
      
      for (const bundle of allBundles) {
        const encryptedBody = await CryptoEngine.encryptMessage(text, bundle.identityKey, user.id);
        payloads[bundle.deviceId] = { body: encryptedBody, senderDeviceId: myDeviceId };
      }

      getSocket()?.emit('send_message', {
        conversationId: conv.id,
        recipientId: conv.other_id,
        messageGroupId,
        payloads
      });

      if (activeConv?.id === conv.id) {
        setMessages(prev => [...prev, { text, isMe: true, messageGroupId, created_at: new Date().toISOString(), read: 0 }]);
      }
      alert(`Message forwarded to ${conv.other_name}`);
    } catch (err) {
      console.error('Failed to forward message', err);
    }
  };

  const handleTyping = () => {
    if (!activeConv) return;
    const socket = getSocket();
    socket?.emit('typing', { recipientId: activeConv.other_id, conversationId: activeConv.id, isTyping: true });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socket?.emit('typing', { recipientId: activeConv.other_id, conversationId: activeConv.id, isTyping: false });
    }, 3000);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConv) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64 = reader.result as string;
      const type = file.type.startsWith('image/') ? 'image' : 'file';
      await sendMediaMessage(base64, file.name, type);
    };
    reader.readAsDataURL(file);
  };

  const sendMediaMessage = async (base64: string, fileName: string, type: 'image' | 'file') => {
    if (!activeConv) return;
    const messageGroupId = crypto.randomUUID();
    const body = type === 'image' ? `MEDIA:IMAGE:${base64}` : `MEDIA:FILE:${fileName}|${base64}`;
    
    try {
      const [recipientRes, senderRes] = await Promise.all([
        api.get(`/keys/${activeConv.other_id}`),
        api.get(`/keys/${user.id}`)
      ]);
      const allBundles = [...recipientRes.data, ...senderRes.data];
      const payloads: Record<string, any> = {};
      const myDeviceId = localStorage.getItem(`deviceId_${user.id}`) || 'web-device-id';
      
      for (const bundle of allBundles) {
        const encryptedBody = await CryptoEngine.encryptMessage(body, bundle.identityKey, user.id);
        payloads[bundle.deviceId] = { body: encryptedBody, senderDeviceId: myDeviceId };
      }

      getSocket()?.emit('send_message', {
        conversationId: activeConv.id,
        recipientId: activeConv.other_id,
        messageGroupId,
        payloads
      });

      setMessages(prev => [...prev, { text: body, isMe: true, message_group_id: messageGroupId, created_at: new Date().toISOString(), read: 0 }]);
    } catch (err) {
      console.error('Failed to send media message', err);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConv) return;

    if (editingMessage) {
      await editMessage(editingMessage.messageGroupId, newMessage);
      setEditingMessage(null);
      setNewMessage('');
      return;
    }

    let text = newMessage;
    if (replyingTo) {
      text = `REPLY_TO:${replyingTo.messageGroupId}:${replyingTo.text.substring(0, 50)}|${newMessage}`;
    }

    setNewMessage('');
    setReplyingTo(null);
    const messageGroupId = crypto.randomUUID();
    
    // Stop typing indicator
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    getSocket()?.emit('typing', { recipientId: activeConv.other_id, conversationId: activeConv.id, isTyping: false });

    try {
      // 1. Fetch recipient AND sender device bundles
      const [recipientRes, senderRes] = await Promise.all([
        api.get(`/keys/${activeConv.other_id}`),
        api.get(`/keys/${user.id}`)
      ]);
      
      const recipientBundles = recipientRes.data;
      const senderBundles = senderRes.data;
      const allBundles = [...recipientBundles, ...senderBundles];

      // 2. Encrypt for each device
      const payloads: Record<string, any> = {};
      const myDeviceId = localStorage.getItem(`deviceId_${user.id}`) || 'web-device-id';
      
      for (const bundle of allBundles) {
        const encryptedBody = await CryptoEngine.encryptMessage(text, bundle.identityKey, user.id);
        payloads[bundle.deviceId] = {
          body: encryptedBody,
          senderDeviceId: myDeviceId,
        };
      }

      // 3. Send via socket
      getSocket()?.emit('send_message', {
        conversationId: activeConv.id,
        recipientId: activeConv.other_id,
        messageGroupId,
        payloads
      });

      setMessages(prev => [...prev, { text, isMe: true, message_group_id: messageGroupId, created_at: new Date().toISOString(), read: 0, replyingTo }]);
    } catch (err) {
      console.error('Failed to send message', err);
    }
  };

  const safeFormatDate = (dateStr: string, formatStr: string = 'HH:mm') => {
    try {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return '';
      
      if (formatStr === 'relative') {
        return formatDistanceToNow(date, { addSuffix: true });
      }
      return format(date, formatStr);
    } catch (e) {
      return '';
    }
  };

  return (
    <div className="flex h-full bg-stone-50 overflow-hidden relative">
      {/* Sidebar */}
      <div className={`absolute inset-0 z-30 md:relative md:inset-auto w-full md:w-[380px] border-r border-stone-200 flex flex-col h-full bg-white transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${activeConv ? '-translate-x-full md:translate-x-0 opacity-0 md:opacity-100 pointer-events-none md:pointer-events-auto' : 'translate-x-0 opacity-100 pointer-events-auto'}`}>
        <div className="p-4 md:p-6 border-b border-stone-100 bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-4 h-4 transition-colors group-focus-within:text-emerald-500" />
            <input 
              type="text" 
              placeholder="Search conversations..."
              className="w-full pl-11 pr-4 py-3 bg-stone-50 border border-stone-200 rounded-2xl text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none transition-all placeholder:text-stone-400"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          <div className="p-4 flex items-center gap-3">
            <button 
              onClick={() => setShowNewChat(true)}
              className="flex-1 flex items-center justify-center gap-3 p-4 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-100 transition-all active:scale-[0.98] font-bold text-sm"
            >
              <Plus className="w-5 h-5" />
              New Message
            </button>
            <button 
              onClick={() => { setShowCallHistory(true); fetchCallHistory(); }}
              className="p-4 rounded-2xl bg-stone-100 hover:bg-stone-200 text-stone-600 transition-all active:scale-[0.98]"
              title="Call History"
            >
              <Clock className="w-5 h-5" />
            </button>
          </div>

          <div className="px-2 pb-4 space-y-1">
            {conversations.filter(c => c.other_name.toLowerCase().includes(searchQuery.toLowerCase())).map(conv => (
              <button
                key={conv.id}
                onClick={() => {
                  setActiveConv(conv);
                  markAsRead(conv.id);
                }}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all relative group ${activeConv?.id === conv.id ? 'bg-emerald-50' : 'hover:bg-stone-50'}`}
              >
                <div className="relative shrink-0">
                  <div className="w-14 h-14 rounded-2xl bg-stone-200 flex items-center justify-center text-stone-500 font-bold text-xl overflow-hidden shadow-inner">
                    {conv.other_profile_picture ? (
                      <img src={conv.other_profile_picture} alt="" className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                    ) : (
                      conv.other_name[0]
                    )}
                  </div>
                  {onlineUsers.has(conv.other_id) && (
                    <div className="absolute -bottom-1 -right-1 w-4.5 h-4.5 bg-emerald-500 border-4 border-white rounded-full shadow-sm" />
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex justify-between items-baseline mb-1">
                    <h3 className="font-bold text-stone-900 truncate pr-2">{conv.other_name}</h3>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[10px] text-stone-400 font-bold uppercase tracking-tighter">
                        {safeFormatDate(conv.created_at)}
                      </span>
                      {onlineUsers.has(conv.other_id) ? (
                        <span className="text-[8px] text-emerald-600 font-black uppercase tracking-widest mt-0.5">Active</span>
                      ) : (
                        <span className="text-[8px] text-stone-300 font-bold uppercase tracking-widest mt-0.5">Offline</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <div className="text-xs text-stone-500 truncate flex-1 pr-2 font-medium">
                      {typingUsers[conv.other_id] ? (
                        <span className="text-emerald-600 font-bold italic animate-pulse">Typing...</span>
                      ) : onlineUsers.has(conv.other_id) ? (
                        <span className="text-emerald-500/80 font-bold flex items-center gap-1">
                          <div className="w-1 h-1 bg-emerald-500 rounded-full" />
                          Online now
                        </span>
                      ) : (
                        <span className="text-stone-400">
                          {lastSeenMap[conv.other_id] ? safeFormatDate(lastSeenMap[conv.other_id], 'relative') : 'Offline'}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {conv.unread_count > 0 && (
                        <div className="flex flex-col items-center">
                          <span className="text-[7px] text-emerald-500 font-black uppercase tracking-tighter mb-0.5">New</span>
                          <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full min-w-[22px] text-center shadow-lg shadow-emerald-200">
                            {conv.unread_count}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Chat Window */}
      <div className={`flex-1 flex flex-col bg-white h-full overflow-hidden transition-all duration-500 ease-[cubic-bezier(0.4,0,0.2,1)] ${!activeConv ? 'translate-x-full md:translate-x-0 opacity-0 md:opacity-100 pointer-events-none md:pointer-events-auto' : 'translate-x-0 opacity-100 pointer-events-auto z-40'}`}>
        {activeConv ? (
          <>
            {/* Chat Header */}
            <div className="bg-white border-b border-stone-200 px-4 md:px-8 py-4 flex items-center justify-between shadow-sm z-20 shrink-0">
              {isSelectMode ? (
                <div className="flex items-center justify-between w-full">
                  <div className="flex items-center gap-4">
                    <button 
                      onClick={() => { setIsSelectMode(false); setSelectedMessages(new Set()); }}
                      className="p-2 text-stone-500 hover:bg-stone-100 rounded-xl transition-all"
                    >
                      <X className="w-6 h-6" />
                    </button>
                    <span className="font-bold text-lg text-stone-900">{selectedMessages.size} selected</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      className="p-2.5 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                      onClick={() => {
                        selectedMessages.forEach(id => toggleStar(id));
                        setIsSelectMode(false);
                        setSelectedMessages(new Set());
                      }}
                    >
                      <Star className="w-5 h-5" />
                    </button>
                    <button 
                      className="p-2.5 text-stone-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all" 
                      onClick={() => { 
                        if (confirm(`Delete ${selectedMessages.size} messages?`)) { 
                          selectedMessages.forEach(id => {
                            getSocket()?.emit('delete_message', { messageGroupId: id, mode: 'me' });
                          });
                          setMessages(prev => prev.filter(m => !selectedMessages.has(m.messageGroupId)));
                          setIsSelectMode(false); 
                          setSelectedMessages(new Set()); 
                        } 
                      }}
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                    <button 
                      className="p-2.5 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                      onClick={() => {
                        const texts = messages.filter(m => selectedMessages.has(m.messageGroupId)).map(m => m.text).join('\n---\n');
                        setForwardingMessage({ text: texts });
                        setShowNewChat(true);
                        setIsSelectMode(false);
                        setSelectedMessages(new Set());
                      }}
                    >
                      <Forward className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 md:gap-4 overflow-hidden">
                <button 
                  onClick={() => setActiveConv(null)} 
                  className="md:hidden p-2.5 -ml-2 text-stone-500 hover:bg-stone-100 rounded-xl transition-all active:scale-90"
                >
                  <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="relative shrink-0">
                  <div className="w-10 h-10 md:w-12 md:h-12 rounded-2xl bg-stone-200 flex items-center justify-center text-stone-500 font-bold text-lg overflow-hidden shadow-inner">
                    {activeConv.other_profile_picture ? (
                      <img src={activeConv.other_profile_picture} alt="" className="w-full h-full object-cover" />
                    ) : (
                      activeConv.other_name ? activeConv.other_name[0] : '?'
                    )}
                  </div>
                  {onlineUsers.has(activeConv.other_id) && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-emerald-500 border-2 border-white rounded-full shadow-sm" />
                  )}
                </div>
                <div className="truncate">
                  <h2 className="font-bold text-stone-900 text-base md:text-lg leading-tight truncate">{activeConv.other_name}</h2>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {typingUsers[activeConv.other_id] ? (
                      <span className="text-[10px] text-emerald-600 font-bold animate-pulse">Typing...</span>
                    ) : onlineUsers.has(activeConv.other_id) ? (
                      <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider flex items-center gap-1">
                        <div className="w-1 h-1 bg-emerald-500 rounded-full animate-ping" />
                        Online
                      </span>
                    ) : (
                      <span className="text-[10px] text-stone-400 font-bold">
                        Last seen {lastSeenMap[activeConv.other_id] ? safeFormatDate(lastSeenMap[activeConv.other_id], 'relative') : 'recently'}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 md:gap-2">
                <button
                  onClick={() => startCall('audio')}
                  className="p-2.5 md:p-3 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all active:scale-90"
                  title="Audio Call"
                >
                  <Phone className="w-5 h-5 md:w-6 h-6" />
                </button>
                <button
                  onClick={() => startCall('video')}
                  className="p-2.5 md:p-3 text-stone-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-2xl transition-all active:scale-90"
                  title="Video Call"
                >
                  <Video className="w-5 h-5 md:w-6 h-6" />
                </button>
                <div className="w-px h-6 bg-stone-200 mx-1 md:mx-2 hidden md:block" />
                <button
                  onClick={deleteConversation}
                  className="p-2.5 md:p-3 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all active:scale-90 hidden md:block"
                  title="Delete Conversation"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
                <button
                  onClick={blockUser}
                  className="p-2.5 md:p-3 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-2xl transition-all active:scale-90"
                  title="Block User"
                >
                  <AlertTriangle className="w-5 h-5 md:w-6 h-6" />
                </button>
                <div className="relative">
                  <button
                    className="p-2.5 md:p-3 text-stone-400 hover:text-stone-600 hover:bg-stone-100 rounded-2xl transition-all active:scale-90"
                    title="Menu"
                  >
                    <MoreVertical className="w-5 h-5 md:w-6 h-6" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

            {/* Messages Area */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 scroll-smooth">
              <div className="flex justify-center mb-8">
                <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-2xl text-xs font-medium border border-emerald-100 flex items-center gap-2 max-w-sm text-center">
                  <Shield className="w-3.5 h-3.5 shrink-0" />
                  Messages are end-to-end encrypted. No one outside of this chat can read them.
                </div>
              </div>

              {messages.map((msg, i) => {
                const isMedia = msg.text?.startsWith('MEDIA:');
                const isImage = msg.text?.startsWith('MEDIA:IMAGE:');
                const isFile = msg.text?.startsWith('MEDIA:FILE:');
                const isReply = msg.text?.startsWith('REPLY_TO:');
                const mID = msg.message_group_id || msg.messageGroupId;
                const isSelected = selectedMessages.has(mID);
                
                let displayText = msg.text;
                let replyInfo = null;

                if (isReply) {
                  const parts = msg.text.split('|');
                  const replyParts = parts[0].split(':');
                  replyInfo = {
                    id: replyParts[1],
                    text: replyParts[2]
                  };
                  displayText = parts.slice(1).join('|');
                }

                return (
                  <div 
                    key={mID || i} 
                    className={`flex items-start gap-2 ${msg.isMe ? 'flex-row-reverse' : 'flex-row'} group/msg relative ${isSelectMode ? 'cursor-pointer hover:bg-emerald-50/30' : ''}`}
                    onClick={() => {
                      if (isSelectMode) {
                        const next = new Set(selectedMessages);
                        if (next.has(mID)) next.delete(mID);
                        else next.add(mID);
                        setSelectedMessages(next);
                      }
                    }}
                  >
                    {/* Multi-Select Checkbox */}
                    {isSelectMode && (
                      <div className="shrink-0 pt-3">
                        <div className={`w-5 h-5 rounded-md border-2 transition-all flex items-center justify-center ${isSelected ? 'bg-emerald-600 border-emerald-600' : 'bg-white border-stone-300'}`}>
                          {isSelected && <CheckSquare className="w-4 h-4 text-white" />}
                        </div>
                      </div>
                    )}

                    <div className={`relative max-w-[85%] md:max-w-[70%] group/bubble ${showMsgMenu === mID ? 'z-50' : 'z-10'}`}>
                      <div className={`relative px-4 py-3 rounded-2xl shadow-sm transition-all ${
                        msg.deleted_at ? 'bg-stone-100 text-stone-400 italic' :
                        msg.isMe ? 
                          (isSelected ? 'bg-emerald-700 shadow-lg scale-[1.02]' : 'bg-emerald-600 text-white rounded-tr-none') : 
                          (isSelected ? 'bg-emerald-100 shadow-lg scale-[1.02]' : 'bg-white text-stone-900 rounded-tl-none border border-stone-100')
                      }`}>
                        {/* Reply Bubble */}
                        {replyInfo && !msg.deleted_at && (
                          <div className={`mb-2 p-2 rounded-lg text-xs border-l-4 ${msg.isMe ? 'bg-emerald-700/50 border-emerald-300 text-emerald-100' : 'bg-stone-100 border-emerald-500 text-stone-600'}`}>
                            <p className="font-bold mb-1">Replying to</p>
                            <p className="truncate opacity-80">{replyInfo.text}</p>
                          </div>
                        )}

                        {msg.text?.startsWith('data:audio') ? (
                          <div className="flex flex-col gap-2 min-w-[200px]">
                            <div className="flex items-center gap-3">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${msg.isMe ? 'bg-emerald-500' : 'bg-emerald-100'}`}>
                                <Mic className={`w-4 h-4 ${msg.isMe ? 'text-white' : 'text-emerald-600'}`} />
                              </div>
                              <audio controls src={msg.text} className="h-8 w-40" />
                            </div>
                          </div>
                        ) : isImage ? (
                          <div className="space-y-2">
                            <img src={msg.text.replace('MEDIA:IMAGE:', '')} alt="Shared" className="rounded-lg max-w-full h-auto cursor-pointer hover:opacity-90 transition-opacity" onClick={() => window.open(msg.text.replace('MEDIA:IMAGE:', ''), '_blank')} />
                          </div>
                        ) : isFile ? (
                          <div className={`flex items-center gap-3 p-3 rounded-xl ${msg.isMe ? 'bg-emerald-700/30' : 'bg-stone-50'}`}>
                            <div className="bg-emerald-100 p-2 rounded-lg">
                              <Paperclip className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{msg.text.split(':')[2].split('|')[0]}</p>
                              <button 
                                onClick={() => {
                                  const base64 = msg.text.split('|')[1];
                                  const link = document.createElement('a');
                                  link.href = base64;
                                  link.download = msg.text.split(':')[2].split('|')[0];
                                  link.click();
                                }}
                                className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 hover:text-emerald-400 mt-1"
                              >
                                Download File
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{displayText}</p>
                        )}

                        <div className={`flex items-center justify-end gap-1 mt-1.5 ${msg.isMe ? 'text-emerald-200' : 'text-stone-400'}`}>
                          {msg.edited_at && !msg.deleted_at && <span className="text-[9px] uppercase tracking-wider mr-1">Edited</span>}
                          <span className="text-[10px] font-medium">
                            {safeFormatDate(msg.created_at || Date.now().toString())}
                          </span>
                          {msg.isMe && !msg.deleted_at && (
                            <div className="flex items-center ml-1">
                              {msg.read ? (
                                <CheckCheck className="w-4 h-4 text-sky-400 stroke-[4]" title="Seen" />
                              ) : msg.delivered ? (
                                <CheckCheck className="w-3.5 h-3.5 text-white/70 stroke-[2.5]" title="Delivered" />
                              ) : (
                                <Check className="w-3.5 h-3.5 text-white/50 stroke-[2.5]" title="Sent (Offline)" />
                              )}
                            </div>
                          )}
                        </div>

                        {/* Reactions Display */}
                        <div className={`absolute -bottom-3 ${msg.isMe ? 'right-0' : 'left-0'} flex items-center gap-1 z-20`}>
                          {reactions[mID] && reactions[mID].map((emoji, idx) => (
                            <span key={idx} className="bg-white border border-stone-100 rounded-full px-1.5 py-0.5 text-[10px] shadow-sm animate-in zoom-in duration-200">{emoji}</span>
                          ))}
                          {starredMessages.has(mID) && (
                            <span className="bg-amber-50 border border-amber-100 rounded-full p-1 shadow-sm">
                              <Star className="w-2.5 h-2.5 text-amber-500 fill-amber-500" />
                            </span>
                          )}
                          {pinnedMessages.has(mID) && (
                            <span className="bg-blue-50 border border-blue-100 rounded-full p-1 shadow-sm">
                              <Pin className="w-2.5 h-2.5 text-blue-500 fill-blue-500" />
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Message Menu Button */}
                      {!msg.deleted_at && !isSelectMode && (
                        <button 
                          onClick={(e) => handleOpenMenu(e, mID)}
                          className={`absolute ${msg.isMe ? '-left-10' : '-right-10'} top-0 p-2 text-stone-400 hover:text-stone-600 md:opacity-0 group-hover/bubble:opacity-100 transition-all z-[60]`}
                        >
                          <MoreVertical className="w-5 h-5" />
                        </button>
                      )}

                      {/* Action Menu Dropdown */}
                      <AnimatePresence>
                        {showMsgMenu === mID && (
                          <>
                            {/* Simple invisible backdrop to catch clicks outside */}
                            <div className="fixed inset-0 z-[95]" onClick={(e) => { e.stopPropagation(); setShowMsgMenu(null); }} />
                            
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.9, x: msg.isMe ? 20 : -20 }}
                              animate={{ opacity: 1, scale: 1, x: 0 }}
                              exit={{ opacity: 0, scale: 0.9, x: msg.isMe ? 20 : -20 }}
                              className={`absolute z-[100] ${menuPosition === 'top' ? 'bottom-0' : 'top-0'} ${msg.isMe ? 'right-full mr-4' : 'left-full ml-4'} w-[260px] bg-white rounded-[28px] shadow-[0_25px_70px_rgba(0,0,0,0.3)] border border-stone-200 py-3 overflow-hidden backdrop-blur-2xl ring-1 ring-black/5`}
                              style={{ transformOrigin: msg.isMe ? 'right center' : 'left center' }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              {/* Integrated Reactions Section */}
                              <div className="px-4 py-2 border-b border-stone-100 mb-2">
                                <p className="text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-2 px-1">React</p>
                                <div className="flex items-center justify-between">
                                  {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(emoji => (
                                    <button 
                                      key={emoji}
                                      onClick={() => handleReaction(mID, emoji)}
                                      className="text-2xl hover:scale-150 active:scale-90 transition-transform p-1 rounded-full"
                                    >
                                      {emoji}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              
                              <div className="flex flex-col px-2">
                                <button onClick={() => { setReplyingTo(msg); setShowMsgMenu(null); }} className="flex items-center gap-3.5 px-4 py-3 text-sm font-bold text-stone-700 hover:bg-stone-50 rounded-2xl transition-all group">
                                  <Reply className="w-4 h-4 text-stone-400 group-hover:text-emerald-600" />
                                  Reply
                                </button>
                                <button onClick={() => { togglePin(mID); setShowMsgMenu(null); }} className="flex items-center gap-3.5 px-4 py-3 text-sm font-bold text-stone-700 hover:bg-stone-50 rounded-2xl transition-all group">
                                  <Pin className={`w-4 h-4 ${pinnedMessages.has(mID) ? 'text-blue-500' : 'text-stone-400'}`} />
                                  {pinnedMessages.has(mID) ? 'Unpin' : 'Pin (Spin)'}
                                </button>
                                <button onClick={() => { setForwardingMessage(msg); setShowNewChat(true); setShowMsgMenu(null); }} className="flex items-center gap-3.5 px-4 py-3 text-sm font-bold text-stone-700 hover:bg-stone-50 rounded-2xl transition-all group">
                                  <Forward className="w-4 h-4 text-stone-400 group-hover:text-emerald-600" />
                                  Forward
                                </button>
                                <button onClick={() => { navigator.clipboard.writeText(displayText); setShowMsgMenu(null); }} className="flex items-center gap-3.5 px-4 py-3 text-sm font-bold text-stone-700 hover:bg-stone-50 rounded-2xl transition-all group">
                                  <Copy className="w-4 h-4 text-stone-400 group-hover:text-emerald-600" />
                                  Copy
                                </button>
                                <button onClick={() => { toggleStar(mID); setShowMsgMenu(null); }} className="flex items-center gap-3.5 px-4 py-3 text-sm font-bold text-stone-700 hover:bg-stone-50 rounded-2xl transition-all group">
                                  <Star className={`w-4 h-4 ${starredMessages.has(mID) ? 'text-amber-500 fill-amber-500' : 'text-stone-400'}`} />
                                  {starredMessages.has(mID) ? 'Unstar' : 'Star'}
                                </button>
                                <button onClick={() => { setIsSelectMode(true); setSelectedMessages(new Set([mID])); setShowMsgMenu(null); }} className="flex items-center gap-3.5 px-4 py-3 text-sm font-bold text-stone-700 hover:bg-stone-50 rounded-2xl transition-all group">
                                  <CheckSquare className="w-4 h-4 text-stone-400 group-hover:text-emerald-600" />
                                  Select
                                </button>
                                
                                <div className="h-px bg-stone-100 my-1.5 mx-2" />
                                
                                <button 
                                  onClick={() => {
                                    setMessages(prev => prev.filter(m => (m.message_group_id || m.messageGroupId) !== mID));
                                    getSocket()?.emit('delete_message', { messageGroupId: mID, mode: 'me' });
                                    setShowMsgMenu(null);
                                  }}
                                  className="flex items-center gap-3.5 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 rounded-2xl transition-all group"
                                >
                                  <Trash2 className="w-4 h-4 text-red-400" />
                                  Delete for Me
                                </button>

                                {msg.isMe && (
                                  <button 
                                    onClick={() => deleteMessage(msg)}
                                    className="flex items-center gap-3.5 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 rounded-2xl transition-all group"
                                  >
                                    <AlertTriangle className="w-4 h-4 text-red-400" />
                                    Delete for Everyone
                                  </button>
                                )}
                              </div>
                            </motion.div>
                          </>
                        )}
                      </AnimatePresence>

                    </div>
                  </div>
                );
              })}
              {typingUsers[activeConv.other_id] && (
                <div className="flex justify-start">
                  <div className="bg-white border border-stone-100 px-4 py-2 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-stone-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-stone-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-stone-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 md:p-6 bg-white border-t border-stone-200 shrink-0 z-20">
              {editingMessage && (
                <div className="max-w-4xl mx-auto mb-3 flex items-center justify-between bg-stone-50 p-3 rounded-2xl border border-stone-200 shadow-sm">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="bg-emerald-100 p-2 rounded-xl shrink-0">
                      <Edit2 className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div className="text-xs truncate">
                      <span className="font-bold text-stone-900 block">Editing Message</span>
                      <span className="text-stone-500 truncate block">{editingMessage.text}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setEditingMessage(null); setNewMessage(''); }}
                    className="p-2 text-stone-400 hover:text-stone-600 shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              {replyingTo && (
                <div className="max-w-4xl mx-auto mb-3 flex items-center justify-between bg-emerald-50 p-3 rounded-2xl border border-emerald-100 shadow-sm">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="bg-emerald-600 p-2 rounded-xl shrink-0">
                      <Reply className="w-4 h-4 text-white" />
                    </div>
                    <div className="text-xs truncate">
                      <span className="font-bold text-emerald-900 block">Replying to {replyingTo.isMe ? 'yourself' : activeConv.other_name}</span>
                      <span className="text-emerald-700 truncate block">{replyingTo.text}</span>
                    </div>
                  </div>
                  <button 
                    onClick={() => setReplyingTo(null)}
                    className="p-2 text-emerald-400 hover:text-emerald-600 shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              )}

              <form onSubmit={sendMessage} className="flex items-center gap-2 md:gap-4 max-w-4xl mx-auto">
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleFileUpload} 
                  className="hidden" 
                  accept="image/*, .pdf, .doc, .docx, .txt"
                />
                
                <button 
                  type="button" 
                  onClick={() => fileInputRef.current?.click()}
                  className="p-3 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-all active:scale-90"
                  title="Attach File"
                >
                  <Plus className="w-6 h-6" />
                </button>

                <div className="flex-1 relative flex items-center">
                  <button 
                    type="button"
                    onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                    className={`absolute left-3 p-1.5 transition-colors ${showEmojiPicker ? 'text-emerald-600' : 'text-stone-400 hover:text-emerald-600'}`}
                  >
                    <Smile className="w-5 h-5" />
                  </button>

                  <AnimatePresence>
                    {showEmojiPicker && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: -10, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="absolute bottom-full left-0 mb-2 w-72 bg-white rounded-3xl shadow-2xl border border-stone-100 p-4 z-50 grid grid-cols-6 gap-2"
                      >
                        {['👍', '❤️', '😂', '😮', '😢', '🙏', '🔥', '✨', '✅', '🎉', '😊', '🤔', '🙌', '💯', '👋', '🚀', '👀', '💡'].map(emoji => (
                          <button 
                            key={emoji}
                            type="button"
                            onClick={() => {
                              setNewMessage(prev => prev + emoji);
                              setShowEmojiPicker(false);
                            }}
                            className="text-2xl hover:scale-125 transition-transform p-1 active:bg-stone-50 rounded-lg"
                          >
                            {emoji}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <input 
                    type="text" 
                    placeholder={isRecording ? 'Recording...' : 'Type a secure message...'}
                    className={`w-full pl-12 pr-14 md:pr-16 py-3.5 md:py-4 bg-stone-50 border border-stone-200 rounded-[24px] text-sm md:text-base focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 outline-none transition-all ${isRecording ? 'animate-pulse' : ''}`}
                    value={newMessage}
                    onChange={e => {
                      setNewMessage(e.target.value);
                      handleTyping();
                    }}
                    disabled={isRecording}
                  />
                  <div className="absolute right-2 md:right-3 flex items-center gap-1">
                    {isRecording ? (
                      <div className="flex items-center gap-2 bg-red-50 px-3 py-2 rounded-full border border-red-100">
                        <span className="text-red-500 text-xs font-bold font-mono">
                          {Math.floor(recordingDuration / 60)}:{String(recordingDuration % 60).padStart(2, '0')}
                        </span>
                        <button type="button" onClick={stopRecording} className="text-red-500 hover:text-red-600 active:scale-90 transition-all">
                          <StopCircle className="w-6 h-6" />
                        </button>
                      </div>
                    ) : (
                      <button 
                        type="button" 
                        onClick={startRecording}
                        className="p-2.5 text-stone-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-full transition-all active:scale-90"
                        title="Voice Note"
                      >
                        <Mic className="w-5 h-5 md:w-6 h-6" />
                      </button>
                    )}
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={!newMessage.trim() && !isRecording}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white p-3.5 md:p-4 rounded-full shadow-lg shadow-emerald-200 transition-all active:scale-90 disabled:opacity-50 disabled:shadow-none disabled:grayscale"
                >
                  <Send className="w-5 h-5 md:w-6 h-6" />
                </button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-stone-400 p-8 text-center">
            <div className="bg-stone-100 p-8 rounded-full mb-6">
              <MessageSquare className="w-16 h-16 opacity-20" />
            </div>
            <h2 className="text-xl font-bold text-stone-900 mb-2">Your Private Sanctuary</h2>
            <p className="max-w-xs text-sm leading-relaxed">
              Select a conversation to start messaging. All chats are secured with the Signal Protocol.
            </p>
          </div>
        )}
      </div>

      {/* New Chat Modal */}
      <AnimatePresence>
        {showNewChat && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-stone-900">New Conversation</h2>
                <button onClick={() => setShowNewChat(false)} className="text-stone-400 hover:text-stone-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {wardUsers.map(u => (
                  <button
                    key={u.id}
                    onClick={() => startConversation(u.id)}
                    className="w-full flex items-center gap-4 p-3 rounded-2xl hover:bg-stone-50 transition-all text-left"
                  >
                    <div className="w-12 h-12 rounded-2xl bg-stone-200 flex items-center justify-center text-stone-500 font-bold">
                      {u.profile_picture ? (
                        <img src={u.profile_picture} alt="" className="w-full h-full object-cover" />
                      ) : (
                        u.display_name[0]
                      )}
                    </div>
                    <div>
                      <h3 className="font-bold text-stone-900">{u.display_name}</h3>
                      <p className="text-xs text-stone-500">{u.about || 'Available'}</p>
                    </div>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Incoming Call UI */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div 
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 20, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="fixed top-0 left-1/2 -translate-x-1/2 z-[100] w-full max-w-sm px-4"
          >
            <div className="bg-white rounded-3xl shadow-2xl border border-stone-100 p-6 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600">
                  {incomingCall.type === 'video' ? <Video className="w-6 h-6" /> : <Phone className="w-6 h-6" />}
                </div>
                <div>
                  <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest">Incoming {incomingCall.type} call</p>
                  <h4 className="text-base font-bold text-stone-900">{incomingCall.callerName}</h4>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={rejectCall} className="p-3 bg-red-100 text-red-600 rounded-2xl hover:bg-red-200 transition-colors">
                  <PhoneOff className="w-5 h-5" />
                </button>
                <button onClick={acceptCall} className="p-3 bg-emerald-600 text-white rounded-2xl hover:bg-emerald-700 transition-colors shadow-lg shadow-emerald-100">
                  <Phone className="w-5 h-5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Call History Modal */}
      <AnimatePresence>
        {showCallHistory && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-stone-100 flex items-center justify-between">
                <h2 className="text-xl font-bold text-stone-900">Recent Calls</h2>
                <button onClick={() => setShowCallHistory(false)} className="text-stone-400 hover:text-stone-600">
                  <X className="w-6 h-6" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {(!Array.isArray(callHistory) || callHistory.length === 0) ? (
                  <div className="p-12 text-center text-stone-400">
                    <Clock className="w-12 h-12 mx-auto mb-4 opacity-20" />
                    <p>No recent calls</p>
                  </div>
                ) : (
                  callHistory.map(call => (
                    <div key={call.id} className="flex items-center justify-between p-4 hover:bg-stone-50 rounded-2xl transition-all">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-stone-100 flex items-center justify-center text-stone-500 overflow-hidden font-bold">
                          {call.other_profile_picture ? (
                            <img src={call.other_profile_picture} alt="" className="w-full h-full object-cover" />
                          ) : (
                            call.other_name[0]
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="font-bold text-stone-900">{call.other_name}</h4>
                            <span className="text-[10px] text-stone-400 font-medium">
                              {safeFormatDate(call.created_at, 'MMM d, HH:mm')}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs font-medium">
                            {call.caller_id === user.id ? (
                              <PhoneOutgoing className="w-3 h-3 text-stone-400" />
                            ) : (
                              call.status === 'missed' ? <PhoneMissed className="w-3 h-3 text-red-500" /> : <PhoneIncoming className="w-3 h-3 text-emerald-500" />
                            )}
                            <span className={call.status === 'missed' && call.recipient_id === user.id ? 'text-red-500 font-bold' : 'text-stone-500'}>
                              {call.status.charAt(0).toUpperCase() + call.status.slice(1)} {call.type} call
                            </span>
                          </div>
                        </div>
                      </div>
                      <button 
                        onClick={() => {
                          setShowCallHistory(false);
                          startCall(call.type as any, call.caller_id === user.id ? call.recipient_id : call.caller_id);
                        }}
                        className="p-3 bg-stone-100 hover:bg-emerald-50 text-stone-500 hover:text-emerald-600 rounded-2xl transition-all"
                      >
                        <Phone className="w-5 h-5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Active Call Overlay */}
      <AnimatePresence>
        {isCalling && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className={`fixed inset-0 z-[90] bg-stone-900 flex flex-col items-center justify-center p-4 md:p-6 text-white ${isFullScreen ? 'p-0' : ''}`}
          >
            <div className="absolute top-8 left-8 flex items-center gap-3 z-50">
              <div className="bg-emerald-600 p-2 rounded-xl">
                <Shield className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold uppercase tracking-widest opacity-70">Secure Encrypted Call</span>
            </div>

            <div className={`relative w-full transition-all duration-500 overflow-hidden shadow-2xl ${isFullScreen ? 'h-full rounded-0' : 'max-w-4xl aspect-video rounded-3xl border border-stone-700 bg-stone-800'}`}>
              {/* Call Timer Overlay */}
              {isCallAccepted && (
                <div className="absolute top-6 left-1/2 -translate-x-1/2 z-50 bg-black/40 backdrop-blur-md px-4 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
                  <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-sm font-mono font-bold tracking-wider">{formatCallDuration(callDuration)}</span>
                </div>
              )}

              {/* Hidden audio element for audio calls to ensure sound plays */}
              {callType === 'audio' && remoteStream && (
                <video ref={remoteVideoRef} autoPlay playsInline muted={false} className="hidden" />
              )}

              {callType === 'video' ? (
                <>
                  {remoteStream ? (
                    <video ref={remoteVideoRef} autoPlay playsInline muted={false} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-stone-800">
                      <div className="w-24 h-24 rounded-full bg-stone-700 flex items-center justify-center animate-pulse">
                        <User className="w-12 h-12 text-stone-500" />
                      </div>
                      <p className="mt-4 text-stone-400 font-medium">Waiting for {activeConv?.other_name || incomingCall?.callerName}...</p>
                    </div>
                  )}
                  
                  <div className="absolute bottom-6 right-6 w-32 md:w-48 aspect-video bg-stone-900 rounded-2xl overflow-hidden border-2 border-stone-700 shadow-xl z-20">
                    <video ref={localVideoRef} autoPlay playsInline muted className={`w-full h-full object-cover ${isVideoOff ? 'hidden' : ''}`} />
                    {isVideoOff && (
                      <div className="w-full h-full flex items-center justify-center bg-stone-800">
                        <User className="w-8 h-8 text-stone-600" />
                      </div>
                    )}
                  </div>

                  <button 
                    onClick={() => setIsFullScreen(!isFullScreen)}
                    className="absolute top-6 right-6 p-3 bg-black/40 hover:bg-black/60 rounded-xl transition-all z-50"
                  >
                    {isFullScreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-8 bg-stone-800">
                  <div className="w-32 h-32 rounded-full bg-emerald-600/20 flex items-center justify-center animate-pulse">
                    <div className="w-24 h-24 rounded-full bg-emerald-600 flex items-center justify-center shadow-2xl">
                      <User className="w-12 h-12" />
                    </div>
                  </div>
                  <div className="text-center">
                    <h3 className="text-2xl font-bold mb-2">{activeConv?.other_name || incomingCall?.callerName}</h3>
                    <p className="text-emerald-400 font-medium uppercase tracking-widest text-xs">
                      {isCallAccepted ? 'Connected' : 'Calling...'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className={`mt-8 md:mt-12 flex items-center gap-4 md:gap-8 z-50`}>
              <button 
                onClick={toggleMute}
                className={`p-4 md:p-5 rounded-full transition-all border ${isMuted ? 'bg-red-600 border-red-600 text-white' : 'bg-stone-800 border-stone-700 text-white hover:bg-stone-700'}`}
              >
                {isMuted ? <MicOff className="w-6 h-6 md:w-7 h-7" /> : <Mic className="w-6 h-6 md:w-7 h-7" />}
              </button>
              <button onClick={endCall} className="p-5 md:p-6 bg-red-600 text-white rounded-full hover:bg-red-700 transition-all shadow-2xl shadow-red-900/20 active:scale-95">
                <PhoneOff className="w-7 h-7 md:w-8 h-8" />
              </button>
              {callType === 'video' && (
                <button 
                  onClick={toggleVideo}
                  className={`p-4 md:p-5 rounded-full transition-all border ${isVideoOff ? 'bg-red-600 border-red-600 text-white' : 'bg-stone-800 border-stone-700 text-white hover:bg-stone-700'}`}
                >
                  {isVideoOff ? <VideoOff className="w-6 h-6 md:w-7 h-7" /> : <Video className="w-6 h-6 md:w-7 h-7" />}
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
