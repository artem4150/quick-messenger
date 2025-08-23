"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

import TopBar from "@/components/TopBar";
import VideoGrid from "@/components/VideoGrid";
import CallControls from "@/components/CallControls";
import { useAppStore } from "@/lib/store";
import { createPeerConnection, getMedia } from "@/lib/webrtc";

export default function CallPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { socket, connect, joinRoom, leaveRoom } = useAppStore();

  // ⚠️ Все хуки вызываются всегда и в одном порядке
  const [mounted, setMounted] = useState(false); // не используем для "раннего return"
  const [role, setRole] = useState<"offerer" | "answerer" | null>(null);
  const [ready, setReady] = useState(false);
  const [isMuted, setMuted] = useState(false);
  const [isCamOff, setCamOff] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);

  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);

  // просто отмечаем, что смонтировались (эффекты ниже всё равно клиентские)
  useEffect(() => {
    setMounted(true);
  }, []);

  // 1) гарантируем подключение сокета
  useEffect(() => {
    if (!socket) connect();
  }, [socket, connect]);

  // 2) создаём RTCPeerConnection, медиа и подписки сокета (один раз на сокет+roomId)
  useEffect(() => {
    if (!socket || !roomId) return;

    let cancelled = false;
    const remoteStream = new MediaStream();

    const pc = createPeerConnection();
    pcRef.current = pc;

    pc.oniceconnectionstatechange = () =>
      console.log("ICE state:", pc.iceConnectionState);
    pc.onconnectionstatechange = () =>
      console.log("PC state:", pc.connectionState);

    pc.ontrack = (ev) => {
      remoteStream.addTrack(ev.track);
      if (remoteVideo.current) {
        if (remoteVideo.current.srcObject !== remoteStream) {
          remoteVideo.current.srcObject = remoteStream;
        }
        remoteVideo.current.play?.().catch(() => {});
      }
    };

    pc.onicecandidate = (e) => {
      if (e.candidate)
        socket.emit("webrtc:ice", { roomId, candidate: e.candidate });
    };

    const onRole = ({ role }: { role: "offerer" | "answerer" }) => {
      console.log("role:", role);
      setRole(role);
    };
    const onReady = () => {
      console.log("ready");
      setReady(true);
    };
    const onOffer = async ({ sdp }: { sdp: string }) => {
      if (pc.signalingState === "closed") return;
      if (!pc.currentRemoteDescription) {
        await pc.setRemoteDescription({ type: "offer", sdp });
        const answer = await pc.createAnswer();

        await pc.setLocalDescription(answer);
        socket.emit("webrtc:answer", { roomId, sdp: answer.sdp! });
      }
    };
    const onAnswer = async ({ sdp }: { sdp: string }) => {
      if (pc.signalingState === "closed") return;
      if (!pc.currentRemoteDescription) {
        await pc.setRemoteDescription({ type: "answer", sdp });
      }
    };
    const onIce = async ({
      candidate,
    }: {
      candidate: RTCIceCandidateInit;
    }) => {
      if (!candidate) return;
      try {
        await pc.addIceCandidate(candidate);
      } catch (e) {
        console.warn("addIceCandidate failed", e);
      }
    };

    socket.on("webrtc:role", onRole);
    socket.on("webrtc:ready", onReady);
    socket.on("webrtc:offer", onOffer);
    socket.on("webrtc:answer", onAnswer);
    socket.on("webrtc:ice", onIce);

    (async () => {
      let localStream: MediaStream | null = null;
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
      if (cancelled) return;

      if (localVideo.current) {
        localVideo.current.srcObject = localStream!;
        localVideo.current.muted = true;
      }

      localStream!.getTracks().forEach((t) => pc.addTrack(t, localStream!));
      setMediaReady(true);
      joinRoom(roomId);
    })();

    return () => {
      cancelled = true;
      leaveRoom(roomId);
      socket.off("webrtc:role", onRole);
      socket.off("webrtc:ready", onReady);
      socket.off("webrtc:offer", onOffer);
      socket.off("webrtc:answer", onAnswer);
      socket.off("webrtc:ice", onIce);
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, [socket, roomId, joinRoom, leaveRoom]);

  // 3) инициируем offer ТОЛЬКО когда назначена роль offerer, пришло ready и готова медиа
  useEffect(() => {
    const pc = pcRef.current;

    if (!pc || role !== "offerer" || !ready || !mediaReady) return;

    (async () => {
      if (pc.signalingState === "stable" && !pc.currentLocalDescription) {
        const offer = await pc.createOffer({
          offerToReceiveAudio: true,
          offerToReceiveVideo: true,
        });

        await pc.setLocalDescription(offer);
        useAppStore.getState().socket?.emit("webrtc:offer", {
          roomId,
          sdp: offer.sdp!,
        });
      }
    })();
  }, [role, ready, mediaReady, roomId]);

  // UI
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
        isCamOff={isCamOff}
        isMuted={isMuted}
        onCam={toggleCam}
        onMic={toggleMic}
      />
    </main>
  );
}
