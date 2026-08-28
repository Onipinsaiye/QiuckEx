/**
 * Dynamic Open Graph image for user profiles.
 *
 * GET /api/og/profile?username=X
 *
 * Edge-cached for 1 hour (Cache-Control: public, max-age=3600, s-maxage=3600).
 * Uses Next.js ImageResponse (built on @vercel/og / Satori).
 *
 * Fallback: redirects to the default /api/og image when no username is given.
 *
 * Privacy: only the public username is rendered — no keys, balances, or
 * internal data.
 */

import { ImageResponse } from "next/og";
import { type NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const WIDTH  = 1200;
const HEIGHT = 630;

// Brand colours
const BG           = "#0a0a0a";
const ACCENT       = "#6366f1";
const TEXT_PRIMARY = "#ffffff";
const TEXT_MUTED   = "#a3a3a3";
const CARD_BG      = "rgba(255,255,255,0.04)";
const CARD_BORDER  = "rgba(255,255,255,0.08)";

// ---------------------------------------------------------------------------
// Sanitisation
// ---------------------------------------------------------------------------

function sanitizeUsername(v: string | null): string {
  if (!v) return "";
  // Accept only alphanumeric, underscore, hyphen — match Stellar username rules
  return v
    .replace(/[^\w-]/g, "")
    .slice(0, 32)
    .trim();
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = req.nextUrl;
  const username = sanitizeUsername(searchParams.get("username"));

  if (!username) {
    return NextResponse.redirect(new URL("/api/og", req.url));
  }

  const initial = username[0]?.toUpperCase() ?? "?";

  const imageResponse = new ImageResponse(
    (
      <div
        style={{
          width: WIDTH,
          height: HEIGHT,
          background: BG,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: "absolute",
            bottom: -100,
            right: -100,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: ACCENT,
            opacity: 0.07,
            filter: "blur(100px)",
          }}
        />

        {/* Avatar */}
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: "50%",
            background: `${ACCENT}33`,
            border: `3px solid ${ACCENT}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 56,
            fontWeight: 900,
            color: ACCENT,
            marginBottom: 32,
          }}
        >
          {initial}
        </div>

        {/* Username */}
        <div
          style={{
            fontSize: 60,
            fontWeight: 900,
            color: TEXT_PRIMARY,
            marginBottom: 16,
          }}
        >
          @{username}
        </div>

        {/* CTA */}
        <div style={{ fontSize: 28, color: TEXT_MUTED, marginBottom: 40 }}>
          Send a payment on Stellar
        </div>

        {/* Brand pill */}
        <div
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 100,
            padding: "10px 28px",
            fontSize: 20,
            color: TEXT_MUTED,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <span style={{ color: ACCENT }}>⚡</span> QuickEx · Stellar Network
        </div>
      </div>
    ),
    { width: WIDTH, height: HEIGHT },
  );

  // Apply edge cache headers: 1h TTL, stale-while-revalidate 5m
  const headers = new Headers(imageResponse.headers);
  headers.set(
    "Cache-Control",
    "public, max-age=3600, s-maxage=3600, stale-while-revalidate=300",
  );

  return new Response(imageResponse.body, {
    status: imageResponse.status,
    headers,
  });
}
