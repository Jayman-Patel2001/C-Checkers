import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const pathname = req.nextUrl.pathname;

    // Redirect authenticated users away from login
    if (pathname === "/login" && token) {
      if (token.role === "ADMIN") return NextResponse.redirect(new URL("/admin", req.url));
      if (token.role === "CO_ADMIN") return NextResponse.redirect(new URL("/coadmin/reviews", req.url));
      return NextResponse.redirect(new URL("/employee", req.url));
    }

    // Admin-only routes
    if (pathname.startsWith("/admin") && token?.role !== "ADMIN") {
      if (token?.role === "CO_ADMIN") return NextResponse.redirect(new URL("/coadmin/reviews", req.url));
      return NextResponse.redirect(new URL("/employee", req.url));
    }

    // Co-admin routes
    if (pathname.startsWith("/coadmin") && token?.role !== "CO_ADMIN" && token?.role !== "ADMIN") {
      return NextResponse.redirect(new URL("/employee", req.url));
    }

    // Employee routes — also allow CO_ADMIN to use employee dashboard
    if (pathname.startsWith("/employee") && token?.role !== "EMPLOYEE" && token?.role !== "CO_ADMIN") {
      if (token?.role === "ADMIN") return NextResponse.redirect(new URL("/admin", req.url));
    }

    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: ({ token, req }) => {
        const pathname = req.nextUrl.pathname;
        if (pathname === "/login" || pathname === "/") return true;
        return !!token;
      },
    },
  }
);

export const config = {
  matcher: ["/", "/login", "/admin/:path*", "/coadmin/:path*", "/employee/:path*"],
};
