import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

export default withAuth(
  function middleware(req) {
    const token = req.nextauth.token;
    const isAuth = !!token;
    const isAuthPage = req.nextUrl.pathname.startsWith('/admin/giris');
    
    // RBAC logic
    if (req.nextUrl.pathname.startsWith('/admin') && !isAuthPage) {
      if (token?.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/admin/giris', req.url));
      }
    }

    if (req.nextUrl.pathname.startsWith('/emlakci-panel')) {
      if (token?.role !== 'AGENT' && token?.role !== 'ADMIN') {
        return NextResponse.redirect(new URL('/admin/giris', req.url));
      }
    }
    
    return NextResponse.next();
  },
  {
    callbacks: {
      authorized: () => true, // We handle authorization in the middleware function
    },
  }
);

export const config = {
  matcher: ['/admin/:path*', '/emlakci-panel/:path*'],
};
