import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "upwork_session";

const PUBLIC_PATHS = ["/login", "/api/auth/login", "/api/auth/logout"];

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths through
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const secretKey = process.env.SESSION_SECRET;
      if (secretKey) {
        await jwtVerify(token, new TextEncoder().encode(secretKey), {
          algorithms: ["HS256"],
        });
        return NextResponse.next();
      }
    } catch {
      // Invalid / expired token — fall through to redirect
    }
  }

  // For API routes, return 401 instead of redirecting
  if (pathname.startsWith("/api/")) {
    return Response.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  // For page routes, redirect to login
  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("from", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimisation)
     * - favicon.ico / icon.svg
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg).*)",
  ],
};
