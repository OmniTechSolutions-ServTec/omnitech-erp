"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../../firebase"; // Ajusta la ruta si es necesario

interface Cita {
  id: string;
  nombre: string;
  direccion: string;
  coordenadas: string;
  estado: string;
}

export default function RadarOperativo() {
  const [puntos, setPuntos] = useState<Cita[]>([]);
  const [escaneando, setEscaneando] = useState(true);

  // Conexión en tiempo real a la bóveda de datos
  useEffect(() => {
    const q = query(collection(db, "citas"), where("coordenadas", "!=", ""));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const datos: Cita[] = [];
      snapshot.forEach((doc) => {
        datos.push({ id: doc.id, ...doc.data() } as Cita);
      });
      setPuntos(datos);
    });

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-[#02050a] text-cyan-400 font-mono overflow-hidden relative selection:bg-cyan-900 selection:text-white">
      
      {/* CUADRÍCULA HOLOGRÁFICA Y FONDO */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,20,30,0.8)_2px,transparent_2px),linear-gradient(90deg,rgba(0,20,30,0.8)_2px,transparent_2px)] bg-[size:40px_40px] pointer-events-none opacity-40"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-cyan-900/20 rounded-full mix-blend-screen filter blur-[100px] pointer-events-none"></div>

      {/* CABECERA DEL RADAR */}
      <header className="absolute top-0 w-full p-6 flex justify-between items-start z-50 pointer-events-none">
        <div>
          <h1 className="text-3xl font-black tracking-widest text-white drop-shadow-[0_0_10px_rgba(34,211,238,0.8)]">
            SISTEMA TÁCTICO DE DESPACHO
          </h1>
          <p className="text-xs tracking-[0.3em] text-cyan-600 uppercase mt-1 flex items-center">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-2 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
            Transmisión en vivo - Enlace Seguro
          </p>
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="text-xs text-cyan-700 mb-1">Rastreadores Activos</div>
          <div className="text-4xl font-black text-cyan-300 drop-shadow-[0_0_15px_rgba(34,211,238,0.5)]">
            {puntos.length < 10 ? `0${puntos.length}` : puntos.length}
          </div>
        </div>
      </header>

      {/* MOTOR VISUAL DEL RADAR (CSS ANIMATION) */}
      <div className="relative w-full h-screen flex items-center justify-center z-10">
        
        {/* Círculos Concéntricos */}
        <div className="absolute w-[300px] h-[300px] md:w-[600px] md:h-[600px] rounded-full border border-cyan-900/40 flex items-center justify-center">
          <div className="absolute w-[200px] h-[200px] md:w-[400px] md:h-[400px] rounded-full border border-cyan-800/50 flex items-center justify-center">
            <div className="absolute w-[100px] h-[100px] md:w-[200px] md:h-[200px] rounded-full border border-cyan-500/50 flex items-center justify-center">
              <div className="w-2 h-2 bg-cyan-300 rounded-full shadow-[0_0_20px_rgba(34,211,238,1)]"></div>
            </div>
          </div>
          
          {/* Ejes X e Y */}
          <div className="absolute w-full h-[1px] bg-cyan-900/50"></div>
          <div className="absolute h-full w-[1px] bg-cyan-900/50"></div>

          {/* Barrido del Radar (Animación) */}
          <div className="absolute w-[150px] h-[150px] md:w-[300px] md:h-[300px] bg-gradient-to-tr from-transparent via-cyan-500/10 to-cyan-400/40 rounded-full origin-bottom-right animate-[spin_4s_linear_infinite] border-r-2 border-cyan-400/80 -top-[0px] -left-[0px] md:-top-[0px] md:-left-[0px] blur-[1px]"></div>
        </div>

        {/* Mapeo de Puntos Detectados */}
        {puntos.map((punto, index) => {
          // Simulamos una dispersión aleatoria en el radar basándonos en el índice para efecto visual,
          // ya que mapear lat/long real requiere la API paga de Google Maps.
          const angle = (index * 45) % 360; 
          const distance = 50 + (index * 30) % 200; 
          
          return (
            <div 
              key={punto.id}
              className="absolute z-20 flex flex-col items-center animate-fade-in"
              style={{
                transform: `rotate(${angle}deg) translateY(-${distance}px) rotate(-${angle}deg)`,
              }}
            >
              {/* El Punto Pulsante */}
              <div className="relative group cursor-crosshair">
                <div className="w-3 h-3 bg-red-500 rounded-full absolute top-0 left-0 animate-ping opacity-75"></div>
                <div className="w-3 h-3 bg-red-500 rounded-full relative z-10 border border-white/50 shadow-[0_0_15px_rgba(239,68,68,1)]"></div>
                
                {/* Etiqueta de Datos (Aparece al pasar el mouse) */}
                <div className="absolute top-4 left-4 bg-black/90 border border-cyan-800 p-3 rounded-lg w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-[0_0_20px_rgba(0,0,0,0.8)] z-50">
                  <div className="text-[10px] text-cyan-600 mb-1 border-b border-cyan-900 pb-1">OBJETIVO DETECTADO</div>
                  <div className="text-white text-xs font-bold mb-1 truncate">{punto.nombre}</div>
                  <div className="text-slate-400 text-[10px] leading-tight mb-2">{punto.direccion}</div>
                  <div className="bg-cyan-950 text-cyan-400 text-[9px] px-2 py-1 rounded inline-block">GPS: {punto.coordenadas.substring(0,12)}...</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* CONTROLES INFERIORES */}
      <div className="absolute bottom-0 w-full p-6 flex justify-between items-end z-50">
        <div className="flex gap-4">
          <Link href="/admin" className="px-6 py-2 border border-cyan-800 text-cyan-600 hover:text-cyan-300 hover:border-cyan-400 hover:bg-cyan-950/30 transition-all rounded text-xs font-bold tracking-widest backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.5)]">
            [ SALIR A CONSOLA ]
          </Link>
          <button 
            onClick={() => setEscaneando(!escaneando)}
            className={`px-6 py-2 border transition-all rounded text-xs font-bold tracking-widest backdrop-blur-sm shadow-[0_0_15px_rgba(0,0,0,0.5)] ${escaneando ? 'border-red-800 text-red-500 hover:bg-red-950/30' : 'border-emerald-800 text-emerald-500 hover:bg-emerald-950/30'}`}
          >
            {escaneando ? '[ DETENER ESCÁNER ]' : '[ INICIAR ESCÁNER ]'}
          </button>
        </div>
        
        <div className="bg-black/60 border border-cyan-900 p-3 rounded backdrop-blur-md">
          <div className="text-[10px] text-cyan-600 tracking-widest uppercase mb-1">Estado de Red</div>
          <div className="flex items-center text-xs text-white">
            <svg className="w-4 h-4 mr-2 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            Sincronización Telemática Estable
          </div>
        </div>
      </div>
    </div>
  );
}