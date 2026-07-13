"use client";

import { useEffect, useState } from "react";
import { MonitorPlay, Plus, Play, Trash2, ListVideo, ListMusic } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useStore } from "@/store/useStore";
import { WorkoutPlayer } from "@/components/musik/workout-player";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Parsed = { kind: "playlist" | "video"; id: string };

// Ambil ID dari link YouTube — video tunggal atau playlist.
function parseYouTube(input: string): Parsed | null {
  const s = input.trim();
  if (!s) return null;
  try {
    const u = new URL(s.startsWith("http") ? s : `https://${s}`);
    const list = u.searchParams.get("list");
    const v = u.searchParams.get("v");
    if (u.hostname.includes("youtu.be")) {
      const id = u.pathname.slice(1).split("/")[0];
      if (list) return { kind: "playlist", id: list };
      if (id) return { kind: "video", id };
    }
    if (list) return { kind: "playlist", id: list };
    if (v) return { kind: "video", id: v };
    const pathMatch = u.pathname.match(/\/(embed|shorts|v)\/([A-Za-z0-9_-]+)/);
    if (pathMatch) return { kind: "video", id: pathMatch[2] };
  } catch {
    /* bukan URL — coba ID mentah */
  }
  const listM = s.match(/[?&]list=([A-Za-z0-9_-]+)/);
  if (listM) return { kind: "playlist", id: listM[1] };
  if (/^[A-Za-z0-9_-]{11}$/.test(s)) return { kind: "video", id: s };
  if (/^[A-Za-z0-9_-]{12,}$/.test(s) && !s.includes("/") && !s.includes(".")) return { kind: "playlist", id: s };
  return null;
}

export default function MusikPage() {
  const playlists = useStore((state) => state.playlists);
  const addPlaylist = useStore((state) => state.addPlaylist);
  const deletePlaylist = useStore((state) => state.deletePlaylist);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeId && playlists.length > 0) setActiveId(playlists[0].playlistId);
  }, [playlists, activeId]);

  const active = playlists.find((p) => p.playlistId === activeId) || null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseYouTube(url);
    if (!parsed) {
      toast.error("Link YouTube-nya kurang pas — tempel link video atau playlist ya");
      return;
    }
    if (!name.trim()) {
      toast.error("Kasih nama dulu");
      return;
    }
    setSaving(true);
    try {
      await addPlaylist({
        name: name.trim(),
        playlistId: parsed.id,
        kind: parsed.kind,
        createdAt: new Date().toISOString(),
      });
      toast.success(parsed.kind === "video" ? "Video kesimpen! 🎬" : "Playlist kesimpen! 🎵");
      setActiveId(parsed.id);
      setName("");
      setUrl("");
    } catch {
      toast.error("Gagal simpan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, pid: string, nm: string) => {
    if (!window.confirm(`Hapus "${nm}"?`)) return;
    try {
      await deletePlaylist(id);
      if (activeId === pid) setActiveId(null);
      toast.success("Dihapus");
    } catch {
      toast.error("Gagal hapus");
    }
  };

  return (
    <div className="space-y-5 pb-6">
      <PageHeader
        title="Video & Musik"
        description="Video workout & playlist favoritmu — tinggal tap buat nemenin olahraga."
        icon={MonitorPlay}
      />

      {/* Player theater — selebar konten */}
      {active ? (
        <WorkoutPlayer item={active} />
      ) : (
        <div className="rounded-[22px] border border-border bg-card flex flex-col items-center justify-center text-center py-12 px-6">
          <div className="h-11 w-11 rounded-[14px] bg-accent text-primary flex items-center justify-center mb-3">
            <ListVideo size={20} />
          </div>
          <p className="text-sm font-semibold">Belum ada yang dipilih</p>
          <p className="text-[12px] text-muted-foreground mt-1 max-w-[280px]">
            Tambah video workout atau playlist YouTube-mu di bawah, terus tap buat langsung diputar di sini.
          </p>
        </div>
      )}

      {/* Kontrol di bawah player — lebar nyaman dibaca */}
      <div className="max-w-3xl space-y-5">
      {/* Daftar tersimpan */}
      {playlists.length > 0 && (
        <div className="space-y-2">
          {playlists.map((p) => {
            const activeItem = p.playlistId === activeId;
            const isVideo = p.kind === "video";
            return (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-3 rounded-[16px] border p-3 transition-colors",
                  activeItem ? "border-primary bg-accent" : "border-border bg-card"
                )}
              >
                <button
                  onClick={() => setActiveId(p.playlistId)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <div
                    className={cn(
                      "h-10 w-10 rounded-[12px] flex items-center justify-center shrink-0",
                      activeItem ? "bg-primary text-primary-foreground" : "bg-accent text-primary"
                    )}
                  >
                    <Play size={16} className={activeItem ? "" : "ml-0.5"} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                      {isVideo ? <ListVideo size={11} /> : <ListMusic size={11} />}
                      {activeItem ? "Lagi diputar" : isVideo ? "Video · tap buat putar" : "Playlist · tap buat putar"}
                    </p>
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(p.id, p.playlistId, p.name)}
                  aria-label={`Hapus ${p.name}`}
                  className="h-9 w-9 rounded-[10px] border border-border flex items-center justify-center text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* Tambah */}
      <form onSubmit={handleAdd} className="rounded-[22px] border border-border bg-card p-5 md:p-6 space-y-3">
        <p className="font-heading font-bold tracking-tight text-[15px]">Tambah video / playlist</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama — mis. Cardio 25 menit 🔥"
          className="w-full rounded-[12px] bg-background border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary transition-colors"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Tempel link YouTube (video atau playlist)"
          className="w-full rounded-[12px] bg-background border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary transition-colors"
        />
        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 w-full h-11 rounded-[12px] bg-primary text-primary-foreground text-sm font-semibold shadow-[0_8px_18px_var(--accent-shadow)] transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          <Plus size={16} />
          {saving ? "Menyimpan..." : "Simpan"}
        </button>
        <p className="text-[11px] text-muted-foreground">
          Di YouTube: Share → Copy link, terus tempel. Video workout tunggal atau playlist dua-duanya bisa. Sekali
          simpan, next time tinggal tap.
        </p>
      </form>
      </div>
    </div>
  );
}
