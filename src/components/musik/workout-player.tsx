"use client";

import { useEffect, useRef, useState } from "react";
import { Shuffle } from "lucide-react";
import { Playlist } from "@/store/useStore";
import { cn } from "@/lib/utils";

/* eslint-disable @typescript-eslint/no-explicit-any */
declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<void> | null = null;
function loadYT(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve();
    };
    const tag = document.createElement("script");
    tag.src = "https://www.youtube.com/iframe_api";
    document.body.appendChild(tag);
  });
  return apiPromise;
}

export function WorkoutPlayer({ item }: { item: Playlist }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [videos, setVideos] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [shuffle, setShuffle] = useState(false);

  const isVideo = item.kind === "video";

  // Buat player sekali; YT ganti <div> jadi <iframe> di dalam wrapper.
  useEffect(() => {
    let cancelled = false;
    loadYT().then(() => {
      if (cancelled || !wrapperRef.current || playerRef.current) return;
      const inner = document.createElement("div");
      wrapperRef.current.appendChild(inner);
      playerRef.current = new window.YT.Player(inner, {
        width: "100%",
        height: "100%",
        playerVars: { rel: 0, playsinline: 1 },
        events: {
          onReady: () => setReady(true),
          onStateChange: () => {
            const p = playerRef.current;
            const list = p?.getPlaylist?.();
            if (Array.isArray(list)) setVideos(list);
            const idx = p?.getPlaylistIndex?.();
            if (typeof idx === "number" && idx >= 0) setCurrentIndex(idx);
          },
        },
      });
    });
    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
  }, []);

  // Muat video / playlist tiap item berubah.
  useEffect(() => {
    if (!ready || !playerRef.current) return;
    const p = playerRef.current;
    setVideos([]);
    setShuffle(false);
    setCurrentIndex(0);
    if (isVideo) {
      p.loadVideoById(item.playlistId);
    } else {
      p.loadPlaylist({ list: item.playlistId, listType: "playlist", index: 0 });
    }
  }, [ready, item.playlistId, isVideo]);

  const toggleShuffle = () => {
    const p = playerRef.current;
    if (!p) return;
    const next = !shuffle;
    setShuffle(next);
    p.setShuffle?.(next);
    if (next) p.nextVideo?.(); // langsung lompat ke urutan acak
  };

  const playAt = (i: number) => {
    playerRef.current?.playVideoAt?.(i);
    setCurrentIndex(i);
  };

  return (
    <div className="rounded-[22px] border border-border bg-card p-2.5 md:p-3 space-y-3 overflow-hidden">
      {/* Theater: video selebar mungkin, tapi tinggi dibatasi ~76vh biar muat layar */}
      <div
        className="relative w-full mx-auto overflow-hidden rounded-[16px] bg-black"
        style={{ aspectRatio: "16 / 9", maxWidth: "calc(76vh * 16 / 9)" }}
      >
        <div ref={wrapperRef} className="absolute inset-0 h-full w-full [&>iframe]:h-full [&>iframe]:w-full" />
      </div>

      {/* Daftar video di playlist + shuffle (cuma buat playlist) */}
      {!isVideo && videos.length > 1 && (
        <div className="px-1.5 pb-1.5 space-y-2.5">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[12px] font-semibold text-muted-foreground">{videos.length} video di playlist</p>
            <button
              onClick={toggleShuffle}
              className={cn(
                "flex items-center gap-1.5 px-3 h-8 rounded-full text-[12px] font-bold border transition-colors",
                shuffle
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border hover:text-foreground"
              )}
            >
              <Shuffle size={13} /> Acak
            </button>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 xl:grid-cols-8 gap-2 max-h-72 overflow-y-auto scrollbar-hide">
            {videos.map((vid, i) => (
              <button
                key={`${vid}-${i}`}
                onClick={() => playAt(i)}
                className={cn(
                  "relative rounded-[10px] overflow-hidden border-2 transition-colors",
                  i === currentIndex ? "border-primary" : "border-transparent hover:border-border"
                )}
                title={`Video ${i + 1}`}
              >
                {/* thumbnail langsung dari YouTube, tanpa API key */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`https://i.ytimg.com/vi/${vid}/mqdefault.jpg`}
                  alt={`Video ${i + 1}`}
                  loading="lazy"
                  className="w-full aspect-video object-cover bg-muted"
                />
                <span className="absolute bottom-1 left-1 text-[10px] font-bold text-white bg-black/70 rounded px-1 tabular-nums">
                  {i + 1}
                </span>
                {i === currentIndex && (
                  <span className="absolute inset-0 bg-primary/25 flex items-center justify-center">
                    <span className="text-[10px] font-bold text-white bg-primary rounded-full px-2 py-0.5">▶ main</span>
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
