"use client";

import { useEffect, useState } from "react";
import { Music, Plus, Play, Trash2, ListMusic } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { useStore } from "@/store/useStore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// Ambil ID playlist dari macam-macam bentuk link YouTube (atau ID mentah).
function parsePlaylistId(input: string): string | null {
  const s = input.trim();
  if (!s) return null;
  const m = s.match(/[?&]list=([A-Za-z0-9_-]+)/);
  if (m) return m[1];
  // ID mentah (biasanya diawali PL/RD/OLAK/UU, huruf-angka-_-)
  if (/^[A-Za-z0-9_-]{12,}$/.test(s) && !s.includes("/") && !s.includes(".")) return s;
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

  // Auto-pilih playlist pertama pas data kebuka
  useEffect(() => {
    if (!activeId && playlists.length > 0) setActiveId(playlists[0].playlistId);
  }, [playlists, activeId]);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const pid = parsePlaylistId(url);
    if (!pid) {
      toast.error("Link playlist YouTube-nya kurang pas — pastiin ada bagian ?list=...");
      return;
    }
    if (!name.trim()) {
      toast.error("Kasih nama playlist-nya dulu");
      return;
    }
    setSaving(true);
    try {
      await addPlaylist({ name: name.trim(), playlistId: pid, createdAt: new Date().toISOString() });
      toast.success("Playlist kesimpen! 🎵");
      setActiveId(pid);
      setName("");
      setUrl("");
    } catch {
      toast.error("Gagal simpan playlist");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, pid: string, nm: string) => {
    if (!window.confirm(`Hapus playlist "${nm}"?`)) return;
    try {
      await deletePlaylist(id);
      if (activeId === pid) setActiveId(null);
      toast.success("Dihapus");
    } catch {
      toast.error("Gagal hapus");
    }
  };

  return (
    <div className="space-y-5 pb-6 max-w-2xl">
      <PageHeader
        title="Musik Olahraga"
        description="Playlist YouTube favoritmu, tinggal tap buat nemenin cardio."
        icon={Music}
      />

      {/* Player */}
      {activeId ? (
        <div className="rounded-[22px] border border-border bg-card p-2.5 md:p-3 overflow-hidden">
          <div className="relative w-full overflow-hidden rounded-[16px]" style={{ aspectRatio: "16 / 9" }}>
            <iframe
              key={activeId}
              src={`https://www.youtube.com/embed/videoseries?list=${activeId}&rel=0&autoplay=1`}
              title="YouTube playlist"
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        </div>
      ) : (
        <div className="rounded-[22px] border border-border bg-card flex flex-col items-center justify-center text-center py-12 px-6">
          <div className="h-11 w-11 rounded-[14px] bg-accent text-primary flex items-center justify-center mb-3">
            <ListMusic size={20} />
          </div>
          <p className="text-sm font-semibold">Belum ada playlist dipilih</p>
          <p className="text-[12px] text-muted-foreground mt-1 max-w-[280px]">
            Tambah playlist YouTube-mu di bawah, terus tap buat langsung diputar di sini.
          </p>
        </div>
      )}

      {/* Daftar playlist tersimpan */}
      {playlists.length > 0 && (
        <div className="space-y-2">
          {playlists.map((p) => {
            const active = p.playlistId === activeId;
            return (
              <div
                key={p.id}
                className={cn(
                  "flex items-center gap-3 rounded-[16px] border p-3 transition-colors",
                  active ? "border-primary bg-accent" : "border-border bg-card"
                )}
              >
                <button
                  onClick={() => setActiveId(p.playlistId)}
                  className="flex items-center gap-3 min-w-0 flex-1 text-left"
                >
                  <div
                    className={cn(
                      "h-10 w-10 rounded-[12px] flex items-center justify-center shrink-0",
                      active ? "bg-primary text-primary-foreground" : "bg-accent text-primary"
                    )}
                  >
                    <Play size={16} className={active ? "" : "ml-0.5"} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{p.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{active ? "Lagi diputar" : "Tap buat putar"}</p>
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

      {/* Tambah playlist */}
      <form onSubmit={handleAdd} className="rounded-[22px] border border-border bg-card p-5 md:p-6 space-y-3">
        <p className="font-heading font-bold tracking-tight text-[15px]">Tambah playlist</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nama — mis. Cardio HIIT 🔥"
          className="w-full rounded-[12px] bg-background border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary transition-colors"
        />
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Link playlist YouTube (yang ada ?list=...)"
          className="w-full rounded-[12px] bg-background border border-border px-3.5 py-2.5 text-sm outline-none focus:border-primary transition-colors"
        />
        <button
          type="submit"
          disabled={saving}
          className="flex items-center justify-center gap-2 w-full h-11 rounded-[12px] bg-primary text-primary-foreground text-sm font-semibold shadow-[0_8px_18px_var(--accent-shadow)] transition-transform active:scale-[0.98] disabled:opacity-50"
        >
          <Plus size={16} />
          {saving ? "Menyimpan..." : "Simpan playlist"}
        </button>
        <p className="text-[11px] text-muted-foreground">
          Buka playlist di YouTube → Share → Copy link, terus tempel di sini. Sekali simpan, next time tinggal tap.
        </p>
      </form>
    </div>
  );
}
