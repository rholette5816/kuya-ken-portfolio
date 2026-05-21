"use client";

import { useRef, useState } from "react";
import type { FeedbackVideo } from "../data";

export default function FeedbackGrid({ videos }: { videos: FeedbackVideo[] }) {
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [playing, setPlaying] = useState<number | null>(null);

  const handlePlay = (index: number) => {
    videoRefs.current.forEach((v, i) => {
      if (v && i !== index) {
        v.pause();
        v.currentTime = 0;
      }
    });
    const current = videoRefs.current[index];
    if (current) {
      current.play();
      setPlaying(index);
    }
  };

  const handlePause = (index: number) => {
    videoRefs.current[index]?.pause();
    setPlaying(null);
  };

  return (
    <div className="feedback-grid">
      {videos.map((video, i) => (
        <div key={video.src} className="feedback-card">
          <div
            className="feedback-video-wrap"
            onClick={() => playing === i ? handlePause(i) : handlePlay(i)}
          >
            <video
              ref={(el) => { videoRefs.current[i] = el; }}
              src={video.src}
              className="feedback-video"
              playsInline
              preload="none"
              onEnded={() => setPlaying(null)}
            />
            <div className={`feedback-play-btn${playing === i ? " hidden" : ""}`}>
              <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          </div>
          <p className="feedback-label">{video.label}</p>
        </div>
      ))}
    </div>
  );
}
