import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Mic, MicOff, Video, VideoOff, Phone, PhoneOff, 
  RotateCw, Grid, Bluetooth, Volume2, Speaker, Mic2
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface CallingProps {
  type: 'audio' | 'video';
  otherUser: {
    id: string;
    display_name: string;
    profile_picture?: string;
  };
  localUser: {
    id: string;
    display_name: string;
    profile_picture?: string;
  };
  socket: any;
  incomingCall?: any;
  onEndCall: () => void;
  startSound: (type: 'calling' | 'ringing') => void;
  stopSound: () => void;
}

const Calling: React.FC<CallingProps> = ({
  type,
  otherUser,
  localUser,
  socket,
  incomingCall,
  onEndCall,
  startSound,
  stopSound
}) => {
  const [callState, setCallState] = useState<'calling' | 'ringing' | 'connecting' | 'active' | 'ended'>('calling');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(type === 'audio');
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [showControls, setShowControls] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [isSwapped, setIsSwapped] = useState(false);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<any>(null);
  const controlsTimeoutRef = useRef<any>(null);
  const statsIntervalRef = useRef<any>(null);
  const candidateQueue = useRef<RTCIceCandidateInit[]>([]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const adjustBitrate = useCallback((quality: '720p' | '480p' | '360p') => {
    if (!peerConnection.current) return;
    const videoSender = peerConnection.current.getSenders().find(s => s.track?.kind === 'video');
    if (videoSender) {
      const parameters = videoSender.getParameters();
      if (!parameters.encodings) parameters.encodings = [{}];
      switch(quality) {
        case '720p': parameters.encodings[0].maxBitrate = 2500000; break;
        case '480p': parameters.encodings[0].maxBitrate = 1000000; break;
        case '360p': parameters.encodings[0].maxBitrate = 500000; break;
      }
      videoSender.setParameters(parameters).catch(() => {});
    }
  }, []);

  const monitorStats = useCallback(() => {
    statsIntervalRef.current = setInterval(async () => {
      try {
        const stats = await peerConnection.current?.getStats();
        stats?.forEach(report => {
          if (report.type === 'inbound-rtp' && report.kind === 'video') {
            if (report.fractionLost > 0.08) adjustBitrate('360p');
            else if (report.fractionLost > 0.04) adjustBitrate('480p');
            else adjustBitrate('720p');
          }
        });
      } catch (e) {}
    }, 2000);
  }, [adjustBitrate]);

  const initMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: type === 'video' ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' } : false
      });
      setLocalStream(stream);
      if (localVideoRef.current) localVideoRef.current.srcObject = stream;
      return stream;
    } catch (err) {
      alert('Media access denied. Enable camera/microphone to call.');
      return null;
    }
  };

  const createPeerConnection = (stream: MediaStream) => {
    const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }] });
    pc.onicecandidate = (e) => e.candidate && socket.emit('ice_candidate', { otherId: otherUser.id, candidate: e.candidate });
    pc.ontrack = (e) => {
      setRemoteStream(e.streams[0]);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
    };
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') { setCallState('active'); stopSound(); monitorStats(); }
      else if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed') endCall();
    };
    stream.getTracks().forEach(track => pc.addTrack(track, stream));
    peerConnection.current = pc;
    return pc;
  };

  useEffect(() => {
    let pc: RTCPeerConnection;
    const run = async () => {
      const stream = await initMedia();
      if (!stream) { onEndCall(); return; }
      pc = createPeerConnection(stream);
      if (incomingCall) {
        setCallState('connecting');
        socket.on('offer', async (data: any) => {
          await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('answer', { otherId: otherUser.id, answer });
          candidateQueue.current.forEach(c => pc.addIceCandidate(new RTCIceCandidate(c)));
          candidateQueue.current = [];
        });
      } else {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call_request', { recipientId: otherUser.id, type, callId: uuidv4(), offer });
      }
    };
    run();

    socket.on('call_ringing', () => setCallState('ringing'));
    socket.on('call_accepted', async (data: any) => {
      if (data.answer) await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
      setCallState('connecting');
    });
    socket.on('call_rejected', () => endCall());
    socket.on('call_ended', () => endCall());
    socket.on('answer', async (data: any) => pc && await pc.setRemoteDescription(new RTCSessionDescription(data.answer)));
    socket.on('ice_candidate', (data: any) => pc?.remoteDescription ? pc.addIceCandidate(new RTCIceCandidate(data.candidate)) : candidateQueue.current.push(data.candidate));

    return () => {
      socket.off('call_ringing'); socket.off('call_accepted'); socket.off('call_rejected'); socket.off('call_ended');
      socket.off('offer'); socket.off('answer'); socket.off('ice_candidate');
      if (statsIntervalRef.current) clearInterval(statsIntervalRef.current);
      stopSound();
    };
  }, []);

  useEffect(() => {
    if (callState === 'active') timerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000);
    else if (timerRef.current) clearInterval(timerRef.current);
    return () => clearInterval(timerRef.current);
  }, [callState]);

  const resetControlsTimer = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => { if (callState === 'active') setShowControls(false); }, 3000);
  };

  const endCall = () => {
    localStream?.getTracks().forEach(t => t.stop());
    peerConnection.current?.close();
    setCallState('ended');
    socket.emit('call_ended', { otherId: otherUser.id, callId: incomingCall?.callId });
    stopSound();
    setTimeout(onEndCall, 500);
  };

  const toggleMute = () => { if (localStream) { localStream.getAudioTracks().forEach(t => t.enabled = !t.enabled); setIsMuted(!isMuted); } };
  const toggleVideo = () => { if (localStream) { localStream.getVideoTracks().forEach(t => t.enabled = !t.enabled); setIsVideoOff(!isVideoOff); } };

  return (
    <div ref={containerRef} className="fixed inset-0 z-[3000] bg-[#020617] overflow-hidden flex flex-col text-white select-none" onClick={() => !showControls ? resetControlsTimer() : setShowControls(false)}>
      <AnimatePresence>
        {type === 'video' ? (
          <div className="relative w-full h-full flex items-center justify-center">
            <motion.div className="absolute inset-0 w-full h-full" onDoubleClick={() => setZoomLevel(z => z === 1 ? 1.5 : z === 1.5 ? 2.0 : 1.0)} animate={{ scale: zoomLevel }} transition={{ type: 'spring', damping: 25, stiffness: 200 }}>
              <video ref={isSwapped ? localVideoRef : remoteVideoRef} autoPlay playsInline className="w-full h-full object-cover" />
              {(!remoteStream && !isSwapped) && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xl">
                  <div className="w-32 h-32 rounded-full overflow-hidden mb-6 border-2 border-white/10 shadow-2xl">
                    {otherUser.profile_picture ? <img src={otherUser.profile_picture} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-emerald-600 text-4xl font-black">{otherUser.display_name[0]}</div>}
                  </div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter">{otherUser.display_name}</h2>
                  <p className="text-emerald-500 font-black uppercase tracking-[0.3em] text-[10px] mt-2 animate-pulse">{callState}</p>
                </div>
              )}
            </motion.div>
            <motion.div drag dragMomentum={false} dragConstraints={containerRef} initial={{ x: 20, y: 20 }} className="absolute top-4 right-4 z-50 overflow-hidden rounded-2xl shadow-2xl border border-white/10 touch-none bg-slate-900" style={{ width: '25%', aspectRatio: '9/16' }} onClick={(e) => { e.stopPropagation(); setIsSwapped(!isSwapped); }}>
              <video ref={isSwapped ? remoteVideoRef : localVideoRef} autoPlay playsInline muted className="w-full h-full object-cover mirror" />
              {(isVideoOff && !isSwapped) && <div className="absolute inset-0 bg-slate-900 flex items-center justify-center"><VideoOff className="w-6 h-6 text-slate-700" /></div>}
            </motion.div>
            <AnimatePresence>
              {showControls && (
                <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }} className="absolute bottom-12 left-0 right-0 flex justify-center px-6 pointer-events-none">
                  <div className="flex items-center gap-4 p-4 rounded-[2.5rem] bg-slate-950/40 backdrop-blur-3xl border border-white/5 pointer-events-auto shadow-2xl">
                    <button onClick={(e) => { e.stopPropagation(); toggleMute(); }} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isMuted ? 'bg-white text-black' : 'bg-white/10 text-white'}`}><Mic size={24} /></button>
                    <button onClick={(e) => { e.stopPropagation(); toggleVideo(); }} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isVideoOff ? 'bg-white text-black' : 'bg-white/10 text-white'}`}><Video size={24} /></button>
                    <button onClick={(e) => { e.stopPropagation(); }} className="w-14 h-14 rounded-full flex items-center justify-center bg-white/10 text-white"><RotateCw size={24} /></button>
                    <button onClick={(e) => { e.stopPropagation(); setIsSpeakerOn(!isSpeakerOn); }} className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${isSpeakerOn ? 'bg-white text-black' : 'bg-white/10 text-white'}`}><Volume2 size={24} /></button>
                    <button onClick={(e) => { e.stopPropagation(); endCall(); }} className="w-14 h-14 rounded-full flex items-center justify-center bg-red-600 text-white shadow-xl shadow-red-900/40 transition-all active:scale-90"><PhoneOff size={24} /></button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        ) : (
          <div className="relative w-full h-full flex flex-col items-center justify-between py-24 bg-[#020617] overflow-hidden">
            <div className="absolute inset-0 opacity-[0.05] blur-3xl scale-150 pointer-events-none"><div className="w-full h-full" style={{ backgroundImage: `url(${otherUser.profile_picture || ''})`, backgroundSize: 'cover', backgroundPosition: 'center' }} /></div>
            <div className="relative z-10 flex flex-col items-center text-center">
              <h2 className="text-3xl font-black uppercase tracking-tighter mb-2">{otherUser.display_name}</h2>
              <p className="text-emerald-500 font-black uppercase tracking-[0.3em] text-xs mb-16">{callState}</p>
              <div className="relative"><div className="w-44 h-44 rounded-[3.5rem] bg-slate-800 border-2 border-white/10 overflow-hidden shadow-2xl relative z-10">{otherUser.profile_picture ? <img src={otherUser.profile_picture} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-emerald-600 flex items-center justify-center text-6xl font-black">{otherUser.display_name[0]}</div>}</div><div className="absolute inset-0 -m-4 bg-emerald-500/10 rounded-[4rem] animate-ping opacity-20" /></div>
              {callState === 'active' && <p className="mt-12 text-2xl font-mono text-emerald-500 tracking-[0.2em] font-black">{formatDuration(callDuration)}</p>}
            </div>
            <div className="relative z-10 w-full px-8 max-w-md flex flex-col gap-10">
              <div className="flex items-center justify-center gap-6">
                <button onClick={toggleMute} className={`w-16 h-16 rounded-[2rem] flex items-center justify-center transition-all ${isMuted ? 'bg-white text-black' : 'bg-white/10 text-white'} shadow-2xl border border-white/5`}><Mic size={28} /></button>
                <button onClick={() => setIsSpeakerOn(!isSpeakerOn)} className={`w-16 h-16 rounded-[2rem] flex items-center justify-center transition-all ${isSpeakerOn ? 'bg-white text-black' : 'bg-white/10 text-white'} shadow-2xl border border-white/5`}><Volume2 size={28} /></button>
                <button className="w-16 h-16 rounded-[2rem] bg-white/10 text-white flex items-center justify-center border border-white/5 shadow-2xl"><Bluetooth size={28} /></button>
                <button className="w-16 h-16 rounded-[2rem] bg-white/10 text-white flex items-center justify-center border border-white/5 shadow-2xl"><Grid size={28} /></button>
              </div>
              <button onClick={endCall} className="w-16 h-16 rounded-[2rem] bg-red-600 text-white flex items-center justify-center self-center shadow-2xl shadow-red-900/40 border border-white/10 active:scale-90 transition-all"><PhoneOff size={32} /></button>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Calling;

function uuidv4() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
