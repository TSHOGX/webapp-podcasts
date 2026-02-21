import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Get API URL with basePath support
 * In browser, uses relative path with basePath to work with basePath
 * In server, uses full path
 */
export function getApiUrl(path: string): string {
  // Remove leading slash if present
  const cleanPath = path.startsWith("/") ? path.slice(1) : path;

  // Use relative URL for client-side fetch with basePath
  if (typeof window !== "undefined") {
    return `/podcasts/${cleanPath}`;
  }

  // Server-side: use full URL
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:12890";
  return `${baseUrl}/${cleanPath}`;
}

export function formatDuration(seconds: number): string {
  if (seconds <= 0) return "";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  }
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}
