"use client";
/* eslint-disable jsx-a11y/media-has-caption */
import { RefObject } from "react";

export default function VideoGrid({
  localRef,
  remoteRef,
}: {
  localRef: RefObject<HTMLVideoElement>;
  remoteRef: RefObject<HTMLVideoElement>;
}) {
  return (
    <div className="grid flex-1 grid-cols-2 gap-2 p-3">
      <video
        ref={localRef}
        autoPlay
        muted
        playsInline
        className="aspect-video w-full rounded-2xl bg-black object-cover"
      />
      <video
        ref={remoteRef}
        autoPlay
        playsInline
        className="aspect-video w-full rounded-2xl bg-black object-cover"
      />
    </div>
  );
}
