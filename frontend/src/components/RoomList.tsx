"use client";

import { useEffect, useState } from "react";
import { getMyRooms, getRecentRooms, Room } from "@/lib/api";
import RoomCard from "./RoomCard";

export default function RoomList() {
  const [myRooms, setMyRooms] = useState<Room[]>([]);
  const [recentRooms, setRecentRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    Promise.all([getMyRooms(), getRecentRooms()])
      .then(([mine, recent]) => {
        setMyRooms(mine);
        setRecentRooms(recent);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-center text-sm text-amber-400">
        Could not load rooms. Make sure the backend is running on port 4000.
      </div>
    );
  }

  const hasNothing = myRooms.length === 0 && recentRooms.length === 0;

  return (
    <div className="space-y-8">
      {/* My Rooms */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
            <svg className="h-4 w-4 text-[var(--primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0h4" />
            </svg>
            My Rooms
          </h3>
          {myRooms.length > 0 && (
            <span className="text-xs text-[var(--text-muted)]">{myRooms.length}/5</span>
          )}
        </div>
        {myRooms.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 py-8 text-center text-sm text-[var(--text-muted)]">
            You haven&apos;t created any rooms yet
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {myRooms.map((room) => (
              <RoomCard key={room.id} room={room} badge="host" />
            ))}
          </div>
        )}
      </div>

      {/* Recently Joined */}
      <div>
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-[var(--text-muted)]">
          <svg className="h-4 w-4 text-[var(--accent-blue)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Recently Joined
        </h3>
        {recentRooms.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/10 py-8 text-center text-sm text-[var(--text-muted)]">
            Join a room using a code to see it here
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {recentRooms.map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        )}
      </div>

      {hasNothing && (
        <p className="pt-2 text-center text-sm text-[var(--text-muted)]">
          Create a room above or join one with a code to get started!
        </p>
      )}
    </div>
  );
}
