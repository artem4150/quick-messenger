'use client';
import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import TopBar from '@/components/TopBar';
import VideoGrid from '@/components/VideoGrid';
import CallControls from '@/components/CallControls';
import { useAppStore } from '@/lib/store';
import { createPeerConnection, getMedia } from '@/lib/webrtc';

export default function CallPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { socket, joinRoom, leaveRoom } = useAppStore();

  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const [role, setRole] = useState<'offerer' | 'answerer' | null>(null);
  const [ready, setReady] = useState(false);
  const [isMuted, setMuted] = useState(false);
  const [isCamOff, setCamOff] = useState(false);

  useEffect(() => {
    if (!socket || !roomId) return;

    // Подключаемся к комнате
    joinRoom(roomId);

    let localStream: MediaStream | null = null;
    let remoteStream = new MediaStream();

    (async () => {
      // Захват медиа с фолбэком, если камера занята второй вкладкой
      try {
        localStream = await getMedia({
          video: true,
          audio: { echoCancellation: true, noiseSuppression: true }
        });
      } catch (e) {
        console.warn('Camera busy? Falling back to audio-only', e);
        localStream = await getMedia({
          video: false,
          audio: { echoCancellation: true, noiseSuppression: true }
        });
      }

      if (localVideo.current) {
        localVideo.current.srcObject = localStream!;
        localVideo.current.muted = true; // чтобы не свистело
      }

      const pc = createPeerConnection();
      pcRef.current = pc;

      // Логи для отладки
      pc.oniceconnectionstatechange = () =>
        console.log('ICE state:', pc.iceConnectionState);
      pc.onconnectionstatechange = () =>
        console.log('PC state:', pc.connectionState);

      // Добавляем локальные дорожки
      localStream!.getTracks().forEach(track => pc.addTrack(track, localStream!));

      // Корректно собираем удалённый поток
      pc.ontrack = (ev) => {
        ev.streams[0]?.getTracks().forEach(t => remoteStream.addTrack(t));
        if (remoteVideo.current && remoteVideo.current.srcObject !== remoteStream) {
          remoteVideo.current.srcObject = remoteStream;
          // На некоторых браузерах нужен явный play() после жеста пользователя
          remoteVideo.current.play?.().catch(() => {});
        }
      };

      // ICE
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit('webrtc:ice', { roomId, candidate: e.candidate });
      };

      // Роль + готовность
      socket.on('webrtc:role', ({ role }) => {
        console.log('role:', role);
        setRole(role);
      });
      socket.on('webrtc:ready', () => {
        console.log('ready');
        setReady(true);
      });

      // Приём оффера/ответа
      socket.on('webrtc:offer', async ({ sdp }) => {
        if (!pc.currentRemoteDescription && pc.signalingState !== 'closed') {
          await pc.setRemoteDescription({ type: 'offer', sdp });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('webrtc:answer', { roomId, sdp: answer.sdp });
        }
      });

      socket.on('webrtc:answer', async ({ sdp }) => {
        if (!pc.currentRemoteDescription && pc.signalingState !== 'closed') {
          await pc.setRemoteDescription({ type: 'answer', sdp });
        }
      });

      socket.on('webrtc:ice', async ({ candidate }) => {
        if (candidate) {
          try { await pc.addIceCandidate(candidate); } catch (e) { console.warn('addIceCandidate failed', e); }
        }
      });

      // Как только есть роль и ready — инициатор делает offer
      const maybeStart = async () => {
        if (role === 'offerer' && ready) {
          // Защита от двойного оффера
          if (pc.signalingState === 'stable' && !pc.currentLocalDescription) {
            const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
            await pc.setLocalDescription(offer);
            socket.emit('webrtc:offer', { roomId, sdp: offer.sdp });
          }
        }
      };

      // следим за готовностью
      const i = setInterval(maybeStart, 300);
      // попробуем сразу
      maybeStart();

      // очистка
      return () => clearInterval(i);
    })();

    return () => {
      socket.off('webrtc:role');
      socket.off('webrtc:ready');
      socket.off('webrtc:offer');
      socket.off('webrtc:answer');
      socket.off('webrtc:ice');
      pcRef.current?.close();
      pcRef.current = null;
      leaveRoom(roomId);
    };
  }, [socket, roomId, joinRoom, leaveRoom, role, ready]);

  const toggleMic = () => {
    const stream = localVideo.current?.srcObject as MediaStream | null;
    const track = stream?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMuted(!track.enabled); }
  };

  const toggleCam = () => {
    const stream = localVideo.current?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setCamOff(!track.enabled); }
  };

  return (
    <main className="flex h-dvh flex-col">
      <TopBar title={`Call • ${roomId}`} />
      <VideoGrid localRef={localVideo} remoteRef={remoteVideo} />
      <CallControls isMuted={isMuted} isCamOff={isCamOff} onMic={toggleMic} onCam={toggleCam} />
    </main>
  );
}