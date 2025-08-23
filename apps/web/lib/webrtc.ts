export function createPeerConnection() {
  const host = process.env.NEXT_PUBLIC_TURN_URL?.replace(/^turns?:/, '') || '77.110.98.32:3478';
  const username = process.env.NEXT_PUBLIC_TURN_USER || 'turnuser';
  const credential = process.env.NEXT_PUBLIC_TURN_PASS || 'turnpass';

  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: [`turn:${host}?transport=udp`], username, credential },
    { urls: [`turn:${host}?transport=tcp`], username, credential },
  ];

  return new RTCPeerConnection({
    iceServers,
    iceCandidatePoolSize: 2,
  });
}

export async function getMedia(constraints: MediaStreamConstraints) {
  try {
    return await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e) {
    // если камера занята/заблокирована, пробуем аудио-только
    if (constraints.video) {
      return await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: false,
      });
    }
    throw e;
  }
}
