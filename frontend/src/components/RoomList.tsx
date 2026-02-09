"use client";

import { useEffect, useState } from "react";
import { getRooms, Room } from "@/lib/api";
import RoomCard from "./RoomCard";

export default function RoomList() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    getRooms()
      .then(setRooms)
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

  if (rooms.length === 0) {
    return (
      <div className="py-12 text-center text-[var(--text-muted)]">
        No rooms yet. Create one above to get started!
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rooms.map((room) => (
        <RoomCard key={room.id} room={room} />
      ))}
    </div>
  );
}
