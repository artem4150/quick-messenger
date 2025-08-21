export function createPeerConnection() {
const url = process.env.NEXT_PUBLIC_TURN_URL ||"turn:localhost:3478";
const username = process.env.NEXT_PUBLIC_TURN_USER || "turnuser" ;
const credential = process.env.NEXT_PUBLIC_TURN_PASS || "turnpass"; ;
const pc = new RTCPeerConnection({
iceServers: [
{ urls: 'stun:stun.l.google.com:19302' },
url && username && credential ? { urls: [url!], username, credential } as RTCIceServer : (null as any)
].filter(Boolean)
});
return pc;
}


export async function getMedia(constraints: MediaStreamConstraints) {
return await navigator.mediaDevices.getUserMedia(constraints);
}