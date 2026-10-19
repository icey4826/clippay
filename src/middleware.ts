import { NextResponse, type NextRequest } from "next/server";

// Basic auth for the merchant dashboard and its API. Open locally when MERCHANT_PASSWORD isn't set.
export function middleware(req: NextRequest) {
  const password = process.env.MERCHANT_PASSWORD;
  if (!password) return NextResponse.next();

  const header = req.headers.get("authorization") ?? "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = atob(encoded);
    const given = decoded.slice(decoded.indexOf(":") + 1);
    if (safeEqual(given, password)) return NextResponse.next();
  }
  return new NextResponse("Merchant login required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="ClipPay merchant", charset="UTF-8"' },
  });
}

function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const config = { matcher: ["/merchant/:path*", "/api/merchant/:path*"] };
