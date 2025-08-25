"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";

import TopBar from "@/components/TopBar";
import VideoGrid from "@/components/VideoGrid";
import CallControls from "@/components/CallControls";
import ShareButton from "@/components/ShareButton";
import VUMeter from "@/components/VUMeter";
import StatsOverlay, { type PeerStats } from "@/components/StatsOverlay";

import { useAppStore } from "@/lib/store";
import {
  createPeerConnection,
  getMedia,
  iceRestart,
  replaceVideoTrack,
  replaceAudioTrack,
} from "@/lib/webrtc";

export default function CallPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const { socket, connect, joinRoom, leaveRoom } = useAppStore();

  // call state
  const [role, setRole] = useState<"offerer" | "answerer" | null>(null);
  const [ready, setReady] = useState(false);
  const [isMuted, setMuted] = useState(false);
  const [isCamOff, setCamOff] = useState(false);
  const [mediaReady, setMediaReady] = useState(false);
  const [sharing, setSharing] = useState(false);

  // VU levels 0..1
  const [vuLocal, setVuLocal] = useState(0);
  const [vuRemote, setVuRemote] = useState(0);

  // Stats
  const [stats, setStats] = useState<PeerStats | null>(null);

  // refs
  const localVideo = useRef<HTMLVideoElement>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // audio metering
  const audioCtxRef = useRef<AudioContext | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const remoteAnalyserRef = useRef<AnalyserNode | null>(null);
  const vuRafRef = useRef<number | null>(null);

  // stats loop
  const statsTimerRef = useRef<number | null>(null);
  const lastStatsRef = useRef({
    t: 0,
    outA: 0, outV: 0,
    inA: 0, inV: 0,
    lostIn: 0, lostOut: 0,
  });

  // ensure socket connection
  useEffect(() => {
    if (!socket) connect();
  }, [socket, connect]);

  // screen share toggle
  const startShare = async () => {
    const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
    screenStreamRef.current = screen;
    const track = screen.getVideoTracks()[0];
    const pc = pcRef.current;
    if (pc) await replaceVideoTrack(pc, track);
    track.onended = () => stopShare();
    setSharing(true);
  };
  const stopShare = async () => {
    screenStreamRef.current?.getTracks().forEach((t) => t.stop());
    screenStreamRef.current = null;
    const camTrack = localStreamRef.current?.getVideoTracks()[0] || null;
    const pc = pcRef.current;
    if (pc) await replaceVideoTrack(pc, camTrack);
    setSharing(false);
  };

  // setup audio analysers once we have streams
  const startMeters = (local: MediaStream, remote: MediaStream) => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      // на первый пользовательский клик браузер может требовать resume
      const resume = () => {
        audioCtxRef.current?.resume().catch(() => {});
        document.removeEventListener('click', resume);
      };
      document.addEventListener('click', resume, { once: true });
    }
    const ctx = audioCtxRef.current!;
    // очищаем предыдущие
    localAnalyserRef.current?.disconnect();
    remoteAnalyserRef.current?.disconnect();

    const localSrc = ctx.createMediaStreamSource(local);
    const remoteSrc = ctx.createMediaStreamSource(remote);

    const lAn = ctx.createAnalyser();
    lAn.fftSize = 2048;
    const rAn = ctx.createAnalyser();
    rAn.fftSize = 2048;

    localSrc.connect(lAn);
    remoteSrc.connect(rAn);

    localAnalyserRef.current = lAn;
    remoteAnalyserRef.current = rAn;

    const bufL = new Float32Array(lAn.fftSize);
    const bufR = new Float32Array(rAn.fftSize);

    const tick = () => {
      if (!localAnalyserRef.current || !remoteAnalyserRef.current) return;

      localAnalyserRef.current.getFloatTimeDomainData(bufL);
      remoteAnalyserRef.current.getFloatTimeDomainData(bufR);

      // RMS → 0..1
      const rms = (arr: Float32Array) => {
        let sum = 0;
        for (let i = 0; i < arr.length; i++) sum += arr[i] * arr[i];
        return Math.sqrt(sum / arr.length);
      };
      setVuLocal(Math.min(1, rms(bufL) * 3));   // небольшое усиление
      setVuRemote(Math.min(1, rms(bufR) * 3));

      vuRafRef.current = requestAnimationFrame(tick);
    };

    if (vuRafRef.current) cancelAnimationFrame(vuRafRef.current);
    vuRafRef.current = requestAnimationFrame(tick);
  };

  const stopMeters = () => {
    if (vuRafRef.current) cancelAnimationFrame(vuRafRef.current);
    vuRafRef.current = null;
    localAnalyserRef.current?.disconnect();
    remoteAnalyserRef.current?.disconnect();
  };

  // stats loop from RTCPeerConnection.getStats()
  const startStatsLoop = (pc: RTCPeerConnection) => {
    const poll = async () => {
      try {
        const report = await pc.getStats();
        let outA = 0, outV = 0, inA = 0, inV = 0;
        let fps: number | undefined;
        let rttMs: number | undefined;
        let lostIn = 0, lostOut = 0;

        report.forEach((r: any) => {
          if (r.type === 'outbound-rtp' && !r.isRemote) {
            if (r.mediaType === 'audio') { outA += r.bytesSent || 0; lostOut += r.packetsLost || 0; }
            if (r.mediaType === 'video') { outV += r.bytesSent || 0; fps = r.framesPerSecond ?? fps; lostOut += r.packetsLost || 0; }
          }
          if (r.type === 'inbound-rtp' && !r.isRemote) {
            if (r.mediaType === 'audio') { inA += r.bytesReceived || 0; lostIn += r.packetsLost || 0; }
            if (r.mediaType === 'video') { inV += r.bytesReceived || 0; lostIn += r.packetsLost || 0; }
          }
          if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.nominated) {
            if (typeof r.currentRoundTripTime === 'number') rttMs = r.currentRoundTripTime * 1000;
          }
        });

        const now = performance.now();
        const last = lastStatsRef.current;
        if (last.t > 0) {
          const dt = (now - last.t) / 1000;
          const outKbps = {
            audio: (outA - last.outA) * 8 / dt / 1000,
            video: (outV - last.outV) * 8 / dt / 1000,
            total: (outA + outV - (last.outA + last.outV)) * 8 / dt / 1000,
          };
          const inKbps = {
            audio: (inA - last.inA) * 8 / dt / 1000,
            video: (inV - last.inV) * 8 / dt / 1000,
            total: (inA + inV - (last.inA + last.inV)) * 8 / dt / 1000,
          };
          setStats({
            outKbps, inKbps,
            rttMs, fps,
            packetsLostIn: lostIn,
            packetsLostOut: lostOut,
          });
        }
        lastStatsRef.current = { t: now, outA, outV, inA, inV, lostIn, lostOut };
      } catch (e) {
        // ignore
      }
    };

    stopStatsLoop();
    statsTimerRef.current = window.setInterval(poll, 1000);
  };

  const stopStatsLoop = () => {
    if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    statsTimerRef.current = null;
  };

  // main PC + media + signaling
  useEffect(() => {
    if (!socket || !roomId) return;

    let cancelled = false;
    const remoteStream = new MediaStream();
    const pc = createPeerConnection();
    pcRef.current = pc;

    pc.oniceconnectionstatechange = () =>
      console.log("ICE state:", pc.iceConnectionState);

    pc.onconnectionstatechange = () => {
      console.log("PC state:", pc.connectionState);
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") {
        if (useAppStore.getState().socket && role === "offerer") {
          iceRestart(pc, (sdp) => socket.emit("webrtc:offer", { roomId, sdp }));
        }
      }
    };

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
      if (e.candidate) socket.emit("webrtc:ice", { roomId, candidate: e.candidate });
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
    const onIce = async ({ candidate }: { candidate: RTCIceCandidateInit }) => {
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
      // локальный стрим
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

      localStreamRef.current = localStream;

      if (localVideo.current) {
        localVideo.current.srcObject = localStream!;
        localVideo.current.muted = true;
      }

      localStream!.getTracks().forEach((t) => pc.addTrack(t, localStream!));
      setMediaReady(true);

      // запускаем метры и сбор статистики
      startMeters(localStream!, remoteStream);
      startStatsLoop(pc);

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
      stopMeters();
      stopStatsLoop();
      pcRef.current?.close();
      pcRef.current = null;
    };
  }, [socket, roomId, joinRoom, leaveRoom, role]);

  // инициировать offer когда готовы
  useEffect(() => {
    const pc = pcRef.current;
    if (!pc || role !== "offerer" || !ready || !mediaReady) return;

    (async () => {
      if (pc.signalingState === "stable" && !pc.currentLocalDescription) {
        const offer = await pc.createOffer({ offerToReceiveAudio: true, offerToReceiveVideo: true });
        await pc.setLocalDescription(offer);
        useAppStore.getState().socket?.emit("webrtc:offer", { roomId, sdp: offer.sdp! });
      }
    })();
  }, [role, ready, mediaReady, roomId]);

  // UI toggles
  const toggleMic = () => {
    const track = localStreamRef.current?.getAudioTracks()[0];
    if (track) { track.enabled = !track.enabled; setMuted(!track.enabled); }
  };
  const toggleCam = () => {
    const track = localStreamRef.current?.getVideoTracks()[0];
    if (track) { track.enabled = !track.enabled; setCamOff(!track.enabled); }
  };

  return (
    <main className="flex h-dvh flex-col">
      <TopBar title={`Call • ${roomId}`} />
      <VideoGrid localRef={localVideo} remoteRef={remoteVideo} />

      <div className="flex flex-col gap-4 p-4">
        <CallControls
          isCamOff={isCamOff}
          isMuted={isMuted}
          onCam={toggleCam}
          onMic={toggleMic}
        />

        <ShareButton
          sharing={sharing}
          onToggle={sharing ? stopShare : startShare}
          className="self-center"
        />

        <VUMeter
          localLevel={vuLocal}
          remoteLevel={vuRemote}
          className="max-w-xl self-center w-full"
        />
      </div>

      <StatsOverlay stats={stats} />
    </main>
  );
}
