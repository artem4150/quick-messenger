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
  const { socket, connect, joinRoom, leaveRoom } = useAppStore();

  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  const [role, setRole] = useState<'offerer' | 'answerer' | null>(null);
  const [ready, setReady] = useState(false);
  const [isMuted, setMuted] = useState(false);
  const [isCamOff, setCamOff] = useState(false);

  // 1) Гарантируем соединение сокета даже при прямом заходе на /call/...
  useEffect(() => {
    if (!socket) connect();
  }, [socket, connect]);

  // 2) Вступаем/выходим из комнаты
  useEffect(() => {
    if (!socket || !roomId) return;
    joinRoom(roomId);
    return () => leaveRoom(roomId);
  }, [socket, roomId, joinRoom, leaveRoom]);

  // 3) Основная WebRTC-логика
  useEffect(() => {
    if (!socket || !roomId) return;

    let localStream: MediaStream | null = null;
    let remoteStream = new MediaStream();

    (async () => {
      // Получаем медиа с фолбэком на аудио-только
      try {
        localStream = await getMedia({
          video: true,
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch {
        localStream = await getMedia({
          video: false,
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      }

      if (localVideo.current) {
        localVideo.current.srcObject = localStream!;
        localVideo.current.muted = true;
      }

      const pc = createPeerConnection();
      pcRef.current = pc;

      // Логи для дебага
      pc.oniceconnectionstatechange = () =>
        console.log('ICE state:', pc.iceConnectionState);
      pc.onconnectionstatechange = () =>
        console.log('PC state:', pc.connectionState);

      // Добавляем локальные треки
      localStream!.getTracks().forEach((t) => pc.addTrack(t, localStream!));

      // Собираем удалённый стрим
      pc.ontrack = (ev) => {
        ev.streams[0]?.getTracks().forEach((t) => remoteStream.addTrack(t));
        if (remoteVideo.current && remoteVideo.current.srcObject !== remoteStream) {
          remoteVideo.current.srcObject = remoteStream;
          remoteVideo.current.play?.().catch(() => {});
        }
      };

      // Лед-кандидаты
      pc.onicecandidate = (e) => {
        if (e.candidate) socket.emit('webrtc:ice', { roomId, candidate: e.candidate });
      };

      // События ролей/готовности
      const onRole = ({ role }: { role: 'offerer' | 'answerer' }) => {
        console.log('role:', role);
        setRole(role);
      };
      const onReady = () => {
        console.log('ready');
        setReady(true);
      };

      socket.on('webrtc:role', onRole);
      socket.on('webrtc:ready', onReady);

      // Обработка SDP
      socket.on('webrtc:offer', async ({ sdp }: { sdp: string }) => {
        if (pc.signalingState === 'closed') return;
        if (!pc.currentRemoteDescription) {
          await pc.setRemoteDescription({ type: 'offer', sdp });
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          socket.emit('webrtc:answer', { roomId, sdp: answer.sdp! });
        }
      });

      socket.on('webrtc:answer', async ({ sdp }: { sdp: string }) => {
        if (pc.signalingState === 'closed') return;
        if (!pc.currentRemoteDescription) {
          await pc.setRemoteDescription({ type: 'answer', sdp });
        }
      });

      socket.on('webrtc:ice', async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
        if (!candidate) return;
        try {
          await pc.addIceCandidate(candidate);
        } catch (e) {
          console.warn('addIceCandidate failed', e);
        }
      });

      // Инициируем оффер только когда есть роль offerer и пришёл ready
      const maybeStart = async () => {
        if (role === 'offerer' && ready) {
          if (pc.signalingState === 'stable' && !pc.currentLocalDescription) {
            const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
            await pc.setLocalDescription(offer);
            socket.emit('webrtc:offer', { roomId, sdp: offer.sdp! });
          }
        }
      };

      const interval = setInterval(maybeStart, 300);
      // пробуем сразу
      maybeStart();

      return () => {
        clearInterval(interval);
      };
    })();

    return () => {
      socket.off('webrtc:role');
      socket.off('webrtc:ready');
      socket.off('webrtc:offer');
      socket.off('webrtc:answer');
      socket.off('webrtc:ice');
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, [socket, roomId, role, ready]);

  const toggleMic = () => {
    const stream = localVideo.current?.srcObject as MediaStream | null;
    const track = stream?.getAudioTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setMuted(!track.enabled);
    }
  };

  const toggleCam = () => {
    const stream = localVideo.current?.srcObject as MediaStream | null;
    const track = stream?.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      setCamOff(!track.enabled);
    }
  };

  return (
    <main className="flex h-dvh flex-col">
      <TopBar title={`Call • ${roomId}`} />
      <VideoGrid localRef={localVideo} remoteRef={remoteVideo} />
      <CallControls
        isMuted={isMuted}
        isCamOff={isCamOff}
        onMic={toggleMic}
        onCam={toggleCam}
      />
    </main>
  );
}
