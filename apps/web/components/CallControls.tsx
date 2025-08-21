'use client';


export default function CallControls({ isMuted, isCamOff, onMic, onCam }: { isMuted: boolean; isCamOff: boolean; onMic: () => void; onCam: () => void }) {
return (
<div className="sticky bottom-0 flex items-center justify-center gap-3 border-t border-zinc-800 bg-neutral-950 p-3">
<button onClick={onMic} className="rounded-xl bg-zinc-800 px-4 py-2">{isMuted ? 'Mic Off' : 'Mic On'}</button>
<button onClick={onCam} className="rounded-xl bg-zinc-800 px-4 py-2">{isCamOff ? 'Cam Off' : 'Cam On'}</button>
</div>
);
}