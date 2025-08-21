'use client';
import VideoGrid from '@/components/VideoGrid';
import CallControls from '@/components/CallControls';
import { useAppStore } from '@/lib/store';

import { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import TopBar from '@/components/TopBar';


import { createPeerConnection, getMedia } from '@/lib/webrtc';

export default function CallPage() {
const { roomId } = useParams<{ roomId: string }>();
const { socket } = useAppStore();


const localVideo = useRef<HTMLVideoElement>(null);
const remoteVideo = useRef<HTMLVideoElement>(null);
const pcRef = useRef<RTCPeerConnection | null>(null);
const [isMuted, setMuted] = useState(false);
const [isCamOff, setCamOff] = useState(false);


useEffect(() => {
if (!socket) return;


let localStream: MediaStream;
let pc: RTCPeerConnection;


(async () => {
localStream = await getMedia({ audio: true, video: true });
if (localVideo.current) localVideo.current.srcObject = localStream;


pc = createPeerConnection();
pcRef.current = pc;


localStream.getTracks().forEach(track => pc.addTrack(track, localStream));


pc.ontrack = (ev) => {
const [remoteStream] = ev.streams;
if (remoteVideo.current) remoteVideo.current.srcObject = remoteStream;
};


socket.emit('webrtc:join', { roomId });


socket.on('webrtc:offer', async ({ sdp }) => {
await pc.setRemoteDescription({ type: 'offer', sdp });
const answer = await pc.createAnswer();
await pc.setLocalDescription(answer);
socket.emit('webrtc:answer', { roomId, sdp: answer.sdp });
});


socket.on('webrtc:answer', async ({ sdp }) => {
await pc.setRemoteDescription({ type: 'answer', sdp });
});


socket.on('webrtc:ice', async ({ candidate }) => {
if (candidate) await pc.addIceCandidate(candidate);
});


pc.onicecandidate = (e) => {
if (e.candidate) socket.emit('webrtc:ice', { roomId, candidate: e.candidate });
};


const offer = await pc.createOffer();
await pc.setLocalDescription(offer);
socket.emit('webrtc:offer', { roomId, sdp: offer.sdp });
})();


return () => {
socket.off('webrtc:offer');
socket.off('webrtc:answer');
socket.off('webrtc:ice');
pcRef.current?.close();
pcRef.current = null;
};
}, [socket, roomId]);


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