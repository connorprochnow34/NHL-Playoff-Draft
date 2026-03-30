/**
 * NHL API Service Layer
 *
 * All NHL API calls go through this file. If an endpoint changes or breaks,
 * patch it here — the rest of the app stays untouched.
 *
 * Base URL: https://api-web.nhle.com
 * Note: /now endpoints return 307 redirects. fetch() follows them by default.
 */

import type { NhlBracketResponse, NhlStandingsResponse } from "./types";

const BASE_URL =
  process.env.NHL_API_BASE_URL || "https://api-web.nhle.com";

async function fetchNhl<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    next: { revalidate: 300 }, // Cache for 5 minutes in Next.js
    redirect: "follow",
  });

  if (!res.ok) {
    throw new Error(`NHL API error: ${res.status} ${res.statusText} for ${path}`);
  }

  return res.json();
}

/**
 * Fetch the playoff bracket for a given season.
 * @param year - The ending year of the season (e.g., 2025 for 2024-25)
 */
export async function fetchPlayoffBracket(
  year: number
): Promise<NhlBracketResponse> {
  return fetchNhl<NhlBracketResponse>(`/v1/playoff-bracket/${year}`);
}

/**
 * Fetch current standings. The /now endpoint redirects to the current date.
 */
export async function fetchStandings(): Promise<NhlStandingsResponse> {
  return fetchNhl<NhlStandingsResponse>("/v1/standings/now");
}

/**
 * Get the current season's ending year for the bracket endpoint.
 * NHL season spans two calendar years: a season starting in Oct 2024 ends in 2025.
 */
export function getCurrentSeasonYear(): number {
  const now = new Date();
  const month = now.getMonth(); // 0-indexed
  // If we're in Jan-Aug, we're in the ending year already
  // If we're in Sep-Dec, the season ends next year
  return month >= 8 ? now.getFullYear() + 1 : now.getFullYear();
}
