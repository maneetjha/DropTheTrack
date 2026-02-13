"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { getMyRooms, getRecentRooms, Room } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import RoomCard from "./RoomCard";

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
        // Leave dashboard channels
        if (subscribedRef.current) {
          for (const room of socket.rooms ?? []) {
            // client-side socket.rooms isn't always available, so just disconnect cleanly
          }
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

  if (loading) return <div className="flex justify-center py-16"><div className="h-7 w-7 animate-spin rounded-full border-2 border-[#7c3aed] border-t-transparent" /></div>;
  if (error) return <div className="rounded-xl bg-white/5 p-4 text-center text-sm text-amber-400">Could not load rooms. Is the backend running?</div>;

  return (
    <div className="space-y-10">
      {/* My Rooms */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5 text-[#7c3aed]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" /></svg>
            <h3 className="text-xl font-bold text-white sm:text-2xl">My Rooms</h3>
          </div>
          {myRooms.length > 0 && <span className="text-xs text-[#6b7280]">{myRooms.length}/5</span>}
        </div>
        {myRooms.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.02)" }}>
            <p className="text-sm text-[#6b7280]">You haven&apos;t created any rooms yet</p>
            <p className="mt-1 text-xs text-[#6b7280]/50">Create your first room above</p>
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
          <svg className="h-5 w-5 text-[#06b6d4]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          <h3 className="text-xl font-bold text-white sm:text-2xl">Recently Joined</h3>
        </div>
        {recentRooms.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center" style={{ borderColor: "rgba(255,255,255,0.12)", background: "rgba(255,255,255,0.02)" }}>
            <p className="text-sm text-[#6b7280]">Join a room using a code to see it here</p>
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
