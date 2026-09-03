import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || 'IP_NO_IDENTIFICADA';
  const rutaSolicitada = request.nextUrl.pathname;
  const response = NextResponse.next();
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|logo.png|qr.png).*)'],
};