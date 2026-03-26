"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { getMyRooms, getRecentRooms, Room } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import RoomCard from "./RoomCard";
import { Home as HomeIcon, History } from "lucide-react";

export default function RoomList() {
  const [myRooms, setMyRooms] = useState<Room[]>([]);
  const [recentRooms, setRecentRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  // Live overrides keyed by roomId
  const [liveCounts, setLiveCounts] = useState<Record<string, number>>({});
  const [liveSongs, setLiveSongs] = useState<Record<string, { title: string; thumbnail: string | null } | null>>({});
  const subscribedRef = useRef(false);

  const fetchRooms = useCallback(async () => {
    try {
      const [mine, recent] = await Promise.all([getMyRooms(), getRecentRooms()]);
      setMyRooms(mine);
      setRecentRooms(recent);
      setError(false);
      return [...mine, ...recent];
    } catch {
      setError(true);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const allRooms = await fetchRooms();
      if (!mounted || allRooms.length === 0) return;

      // Connect socket and subscribe to dashboard counts
      const socket = getSocket();
      if (!socket.connected) socket.connect();

      const roomIds = allRooms.map((r) => r.id);

      const doSubscribe = () => {
        socket.emit("subscribe-dashboard", { roomIds });
        subscribedRef.current = true;
      };

      if (socket.connected) {
        doSubscribe();
      } else {
        socket.once("connect", doSubscribe);
      }

      // Listen for real-time count updates
      const handleCountUpdate = ({ roomId, count }: { roomId: string; count: number }) => {
        if (!mounted) return;
        setLiveCounts((prev) => ({ ...prev, [roomId]: count }));
      };

      socket.on("room-count-updated", handleCountUpdate);

      // Listen for real-time song changes
      const handleSongUpdate = ({ roomId, currentSong }: { roomId: string; currentSong: { title: string; thumbnail: string | null } | null }) => {
        if (!mounted) return;
        setLiveSongs((prev) => ({ ...prev, [roomId]: currentSong }));
      };

      socket.on("room-song-updated", handleSongUpdate);

      return () => {
        mounted = false;
        socket.off("room-count-updated", handleCountUpdate);
        socket.off("room-song-updated", handleSongUpdate);
        // Unsubscribe from dashboard channels
        if (subscribedRef.current) {
          socket.emit("unsubscribe-dashboard");
        }
      };
    })();

    return () => {
      mounted = false;
    };
  }, [fetchRooms]);

  // Merge live counts and song info into room objects
  const withLive = (rooms: Room[]): Room[] =>
    rooms.map((r) => {
      const updated = { ...r };
      if (liveCounts[r.id] !== undefined) updated.liveListeners = liveCounts[r.id];
      if (liveSongs[r.id] !== undefined) updated.currentSong = liveSongs[r.id];
      return updated;
    });

  if (loading) return <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-2 border-black/20 border-t-black/60" /></div>;
  if (error) return <div className="rounded-2xl border border-black/10 bg-white/45 p-4 text-center text-sm text-ink">Could not load rooms. Is the backend running?</div>;

  return (
    <div className="space-y-10">
      {/* My Rooms */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="rounded-xl bg-gradient-to-br from-[#f46c52]/80 to-[#8cc6e8]/80 p-[1px]">
              <div className="flex h-8 w-8 items-center justify-center rounded-[11px] bg-white/65 ring-1 ring-white/70">
                <HomeIcon className="h-4 w-4 text-ink" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-ink sm:text-2xl">My Rooms</h3>
          </div>
          {myRooms.length > 0 && <span className="text-xs text-ink-muted">{myRooms.length}/5</span>}
        </div>
        {myRooms.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-black/10 bg-white/35 p-10 text-center">
            <p className="text-sm text-ink">You haven&apos;t created any rooms yet</p>
            <p className="mt-1 text-xs text-ink-muted">Create your first room above</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
            {withLive(myRooms).map((r) => <RoomCard key={r.id} room={r} badge="host" />)}
          </div>
        )}
      </section>

      {/* Recently Joined */}
      <section>
        <div className="mb-4 flex items-center gap-2">
          <div className="rounded-xl bg-gradient-to-br from-[#8cc6e8]/80 to-[#f46c52]/80 p-[1px]">
            <div className="flex h-8 w-8 items-center justify-center rounded-[11px] bg-white/65 ring-1 ring-white/70">
              <History className="h-4 w-4 text-ink" />
            </div>
          </div>
          <h3 className="text-xl font-bold text-ink sm:text-2xl">Recently Joined</h3>
        </div>
        {recentRooms.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-black/10 bg-white/35 p-10 text-center">
            <p className="text-sm text-ink-muted">Join a room using a code to see it here</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
            {withLive(recentRooms).map((r) => <RoomCard key={r.id} room={r} />)}
          </div>
        )}
      </section>
    </div>
  );
}
