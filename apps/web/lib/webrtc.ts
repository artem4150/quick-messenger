export function createPeerConnection() {
  const url = process.env.NEXT_PUBLIC_TURN_URL;
  const username = process.env.NEXT_PUBLIC_TURN_USER;
  const credential = process.env.NEXT_PUBLIC_TURN_PASS;

  const iceServers: RTCIceServer[] = [
    { urls: 'stun:stun.l.google.com:19302' },
  ];
  if (url && username && credential) {
    iceServers.push({ urls: [url], username, credential });
  }

  return new RTCPeerConnection({ iceServers });
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
