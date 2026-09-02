import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { registrarEventoSIEM } from './lib/siemLogger';

export async function middleware(request: NextRequest) {
  // CORRECCIÓN: Leemos la IP directamente de las cabeceras para evitar el error TS2339
  const ip = request.headers.get('x-forwarded-for') || 'IP_NO_IDENTIFICADA';
  const rutaSolicitada = request.nextUrl.pathname;

  const ipsBloqueadas = ['192.168.1.999']; 
  
  if (ipsBloqueadas.includes(ip)) {
    await registrarEventoSIEM({
      tipo: "BLOQUEO_IP", ip, ruta: rutaSolicitada, detalles: "Intento de conexión desde IP bloqueada."
    });
    return new NextResponse(
      JSON.stringify({ alerta: "ACCESO DENEGADO", motivo: "IP bloqueada por el Firewall NOC." }),
      { status: 403, headers: { 'content-type': 'application/json' } }
    );
  }

  const response = NextResponse.next();
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  if (rutaSolicitada.startsWith('/admin') || rutaSolicitada.startsWith('/radar')) {
    await registrarEventoSIEM({
      tipo: "ACCESO_AUTORIZADO", ip, ruta: rutaSolicitada, detalles: "Consulta de perímetro seguro."
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|logo.png|qr.png).*)'],
};