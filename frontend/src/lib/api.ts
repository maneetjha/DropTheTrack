const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

// ---------- Types ----------

export interface User {
  id: string;
  name: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface Room {
  id: string;
  name: string;
  code: string;
  mode: "open" | "listen_only";
  createdBy: string | null;
  createdAt: string;
}

export interface Song {
  id: string;
  roomId: string;
  title: string;
  url: string;
  thumbnail: string | null;
  userId: string;
  user: { id: string; name: string };
  upvotes: number;
  hasVoted: boolean;
  isPlaying: boolean;
  played: boolean;
  createdAt: string;
}

// ---------- Helpers ----------

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("dtt_token");
}

function authHeaders(): Record<string, string> {
  const token = getToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

// ---------- Auth ----------

export async function register(name: string, email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Registration failed");
  }
  return res.json();
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Login failed");
  }
  return res.json();
}

export async function googleAuth(accessToken: string): Promise<AuthResponse> {
  const res = await fetch(`${API_URL}/auth/google`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accessToken }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Google authentication failed");
  }
  return res.json();
}

export async function getMe(): Promise<User> {
  const res = await fetch(`${API_URL}/auth/me`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Not authenticated");
  return res.json();
}

// ---------- Rooms ----------

export async function createRoom(name: string): Promise<Room> {
  const res = await fetch(`${API_URL}/rooms`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ name }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to create room");
  }
  return res.json();
}

export async function getMyRooms(): Promise<Room[]> {
  const res = await fetch(`${API_URL}/rooms/mine`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch your rooms");
  return res.json();
}

export async function getRecentRooms(): Promise<Room[]> {
  const res = await fetch(`${API_URL}/rooms/recent`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch recent rooms");
  return res.json();
}

export async function trackRoomJoin(roomId: string): Promise<void> {
  await fetch(`${API_URL}/rooms/${roomId}/join`, {
    method: "POST",
    headers: authHeaders(),
  }).catch(() => {});
}

export async function getRoom(id: string): Promise<Room | null> {
  try {
    const res = await fetch(`${API_URL}/rooms/${id}`, { cache: "no-store" });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

export async function updateRoomMode(id: string, mode: "open" | "listen_only"): Promise<Room> {
  const res = await fetch(`${API_URL}/rooms/${id}`, {
    method: "PATCH",
    headers: authHeaders(),
    body: JSON.stringify({ mode }),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to update room");
  }
  return res.json();
}

export async function deleteRoom(id: string): Promise<void> {
  const res = await fetch(`${API_URL}/rooms/${id}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to delete room");
  }
}

export async function joinRoomByCode(code: string): Promise<Room> {
  const res = await fetch(`${API_URL}/rooms/join/${code}`, { cache: "no-store" });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Room not found");
  }
  return res.json();
}

// ---------- Messages ----------

export interface ChatMessage {
  id: string;
  text: string;
  userId: string;
  userName: string;
  createdAt: string;
}

export async function getMessages(roomId: string): Promise<ChatMessage[]> {
  const res = await fetch(`${API_URL}/rooms/${roomId}/messages`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

// ---------- YouTube ----------

export interface YouTubeResult {
  videoId: string;
  title: string;
  thumbnail: string | null;
  channelTitle: string;
}

export async function searchYouTube(query: string): Promise<YouTubeResult[]> {
  const res = await fetch(`${API_URL}/youtube/search?q=${encodeURIComponent(query)}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "YouTube search failed");
  }
  return res.json();
}

// ---------- Songs ----------

export async function getSongs(roomId: string): Promise<Song[]> {
  const res = await fetch(`${API_URL}/rooms/${roomId}/songs`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Failed to fetch songs");
  return res.json();
}

export async function addSong(
  roomId: string,
  song: { title: string; url: string; thumbnail?: string }
): Promise<Song> {
  const res = await fetch(`${API_URL}/rooms/${roomId}/songs`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(song),
  });
  if (!res.ok) throw new Error("Failed to add song");
  return res.json();
}

export async function upvoteSong(songId: string): Promise<Song> {
  const res = await fetch(`${API_URL}/songs/${songId}/upvote`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    if (res.status === 401) throw new Error("Login required");
    throw new Error("Failed to toggle vote");
  }
  return res.json();
}

export async function removeSong(songId: string): Promise<void> {
  const res = await fetch(`${API_URL}/songs/${songId}`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to remove song");
  }
}

export async function playSong(songId: string): Promise<Song> {
  const res = await fetch(`${API_URL}/songs/${songId}/play`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to play song");
  }
  return res.json();
}

export async function clearQueue(roomId: string): Promise<void> {
  const res = await fetch(`${API_URL}/rooms/${roomId}/songs/clear`, {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to clear queue");
  }
}

export async function skipSong(roomId: string): Promise<Song[]> {
  const res = await fetch(`${API_URL}/rooms/${roomId}/songs/skip`, {
    method: "POST",
    headers: authHeaders(),
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error || "Failed to skip song");
  }
  return res.json();
}
