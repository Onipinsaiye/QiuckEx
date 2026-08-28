/**
 * Dynamic Open Graph image for payment links.
 *
 * GET /api/og/payment-link?username=X&amount=100&asset=XLM&state=ACTIVE
 *
 * Edge-cached for 1 hour (Cache-Control: public, max-age=3600, s-maxage=3600).
 * Uses Next.js ImageResponse (built on @vercel/og / Satori).
 *
 * Fallback: redirects to the default /api/og image on missing params.
 *
 * Privacy: only username, amount, asset, and state are rendered.
 * No keys, hashes, or internal data are exposed.
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

type PaymentState =
  | "ACTIVE"
  | "EXPIRED"
  | "PAID"
  | "REFUNDED"
  | "DRAFT"
  | "UNKNOWN";

// ---------------------------------------------------------------------------
// Sanitisation
// ---------------------------------------------------------------------------

function sanitizeText(v: string | null, maxLen = 64): string {
  if (!v) return "";
  return v
    .replace(/[^\w\s\-_.#@]/g, "")
    .slice(0, maxLen)
    .trim();
}

function sanitizeAmount(v: string | null): string {
  if (!v) return "";
  const n = parseFloat(v);
  if (isNaN(n) || n < 0) return "";
  return n.toLocaleString("en-US", { maximumFractionDigits: 7 });
}

function sanitizeAsset(v: string | null): string {
  if (!v) return "XLM";
  return v.replace(/[^A-Z0-9]/gi, "").slice(0, 12).toUpperCase() || "XLM";
}

const VALID_STATES = new Set<string>([
  "ACTIVE",
  "EXPIRED",
  "PAID",
  "REFUNDED",
  "DRAFT",
  "UNKNOWN",
]);

function toState(v: string | null): PaymentState {
  return VALID_STATES.has(v ?? "") ? (v as PaymentState) : "UNKNOWN";
}

function badgeColor(state: PaymentState): string {
  switch (state) {
    case "ACTIVE":
    case "DRAFT":
      return "#22c55e";
    case "PAID":
      return ACCENT;
    case "EXPIRED":
      return "#f59e0b";
    case "REFUNDED":
      return "#64748b";
    default:
      return "#6b7280";
  }
}

function stateLabel(state: PaymentState): string {
  return {
    ACTIVE:   "Active",
    DRAFT:    "Pending",
    PAID:     "Paid",
    EXPIRED:  "Expired",
    REFUNDED: "Refunded",
    UNKNOWN:  "Unavailable",
  }[state];
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest): Promise<Response> {
  const { searchParams } = req.nextUrl;

  const username = sanitizeText(searchParams.get("username"), 32);
  const amount   = sanitizeAmount(searchParams.get("amount"));
  const asset    = sanitizeAsset(searchParams.get("asset"));
  const state    = toState(searchParams.get("state"));

  // Redirect to default image if no useful params
  if (!username && !amount) {
    return NextResponse.redirect(new URL("/api/og", req.url));
  }

  const color      = badgeColor(state);
  const label      = stateLabel(state);
  const isUnavailable = state === "EXPIRED" || state === "UNKNOWN";

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
          padding: "0 80px",
        }}
      >
        {/* Background glow */}
        <div
          style={{
            position: "absolute",
            top: -80,
            right: -80,
            width: 500,
            height: 500,
            borderRadius: "50%",
            background: isUnavailable ? "#f59e0b" : ACCENT,
            opacity: 0.06,
            filter: "blur(100px)",
          }}
        />

        {/* Card */}
        <div
          style={{
            background: CARD_BG,
            border: `1px solid ${CARD_BORDER}`,
            borderRadius: 32,
            padding: "56px 72px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            width: "100%",
            maxWidth: 900,
          }}
        >
          {/* Site name */}
          <div
            style={{
              fontSize: 22,
              color: TEXT_MUTED,
              marginBottom: 32,
              display: "flex",
              alignItems: "center",
              gap: 10,
            }}
          >
            <span style={{ color: ACCENT }}>⚡</span> QuickEx
          </div>

          {/* State badge */}
          <div
            style={{
              background: `${color}22`,
              border: `1px solid ${color}55`,
              borderRadius: 100,
              padding: "6px 20px",
              fontSize: 18,
              color: color,
              fontWeight: 700,
              marginBottom: 28,
            }}
          >
            {label}
          </div>

          {/* Content */}
          {isUnavailable ? (
            <div
              style={{
                fontSize: 40,
                fontWeight: 900,
                color: TEXT_PRIMARY,
                textAlign: "center",
              }}
            >
              This payment link is {label.toLowerCase()}
            </div>
          ) : (
            <>
              {amount && (
                <div
                  style={{
                    fontSize: 72,
                    fontWeight: 900,
                    color: TEXT_PRIMARY,
                    letterSpacing: "-2px",
                    marginBottom: 8,
                  }}
                >
                  {amount}{" "}
                  <span style={{ color: ACCENT }}>{asset}</span>
                </div>
              )}
              {username && (
                <div
                  style={{ fontSize: 32, color: TEXT_MUTED, marginTop: 8 }}
                >
                  to{" "}
                  <span style={{ color: TEXT_PRIMARY, fontWeight: 700 }}>
                    @{username}
                  </span>
                </div>
              )}
            </>
          )}

          {/* Footer */}
          <div
            style={{ marginTop: 40, fontSize: 18, color: TEXT_MUTED }}
          >
            Powered by Stellar Network
          </div>
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
