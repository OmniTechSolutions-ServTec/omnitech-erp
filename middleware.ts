import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { registrarEventoSIEM } from './lib/siemLogger';

export async function middleware(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') || request.ip || 'IP_NO_IDENTIFICADA';
  const rutaSolicitada = request.nextUrl.pathname;

  // Lista negra de prueba (puedes expandirla con IPs maliciosas detectadas)
  const ipsBloqueadas = ['192.168.1.999']; 
  
  if (ipsBloqueadas.includes(ip)) {
    // Registramos el intento de intrusión bloqueada para la auditoría SIEM
    await registrarEventoSIEM({
      tipo: "BLOQUEO_IP",
      ip,
      ruta: rutaSolicitada,
      detalles: "Intento de conexión desde IP en lista negra perimetral."
    });

    return new NextResponse(
      JSON.stringify({ 
        alerta: "ACCESO DENEGADO", 
        motivo: "Su dirección IP ha sido bloqueada por el Firewall de OmniTech Solutions." 
      }),
      { status: 403, headers: { 'content-type': 'application/json' } }
    );
  }

  const response = NextResponse.next();

  // Cabeceras de seguridad de grado empresarial
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // Auditoría en tiempo real para áreas restringidas (NOC / Radar)
  if (rutaSolicitada.startsWith('/admin') || rutaSolicitada.startsWith('/radar')) {
    await registrarEventoSIEM({
      tipo: "ACCESO_AUTORIZADO",
      ip,
      ruta: rutaSolicitada,
      detalles: "Consulta de perímetro seguro bajo supervisión de red."
    });
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|logo.png|qr.png).*)',
  ],
};