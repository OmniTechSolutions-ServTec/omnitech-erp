"use client";
import { useState } from "react";
import Link from "next/link";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../../firebase";

export default function AcademiaOmniTech() {
  const [moduloActivo, setModuloActivo] = useState(1);
  const [nombreTecnico, setNombreTecnico] = useState("");
  const [evaluacionIniciada, setEvaluacionIniciada] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [evaluacionCompletada, setEvaluacionCompletada] = useState(false);
  const [resultado, setResultado] = useState<any>(null);

  const procesarRespuesta = async (opcion: string) => {
    if (!nombreTecnico.trim()) {
      alert("Por favor, ingrese su Nombre Completo antes de responder.");
      return;
    }

    setEnviando(true);
    const esCorrecta = opcion === "B";
    const puntaje = esCorrecta ? 100 : 0;
    const estado = esCorrecta ? "Aprobado" : "Reprobado";

    try {
      await addDoc(collection(db, "evaluaciones_tecnicas"), {
        tecnico: nombreTecnico.trim(),
        casoId: "CASO_01_DOMICILIO",
        respuestaElegida: opcion,
        esCorrecta: esCorrecta,
        puntaje: puntaje,
        estadoCompetencia: estado,
        fechaEvaluacion: new Date().toISOString()
      });

      setResultado({ esCorrecta, puntaje, estado });
      setEvaluacionCompletada(true);
    } catch (error) {
      alert("Error de conexión al registrar la evaluación en el servidor central.");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#030712] text-slate-300 font-sans selection:bg-cyan-500 relative">
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0"></div>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-cyan-900/20 rounded-full mix-blend-screen filter blur-[100px] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto p-6 md:p-12 relative z-10">
        <header className="flex justify-between items-end border-b border-slate-800 pb-6 mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 tracking-widest">
              ACADEMIA OMNITECH
            </h1>
            <p className="text-slate-400 mt-2 font-mono text-sm tracking-wide">
              Capacitación Técnica • <span className="text-cyan-500 font-bold">Evaluación por Competencias</span>
            </p>
          </div>
          <Link href="/admin" className="px-4 py-2 border border-slate-700 hover:border-cyan-500 text-slate-400 hover:text-cyan-400 rounded transition-all text-xs font-bold tracking-widest flex items-center">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
            VOLVER AL NOC
          </Link>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-4">
            <div className="bg-[#0a1120] border border-cyan-900/50 rounded-xl p-6 shadow-[0_0_20px_rgba(34,211,238,0.05)]">
              <h2 className="text-xs font-black text-cyan-500 tracking-widest uppercase mb-4 border-b border-slate-800 pb-2">Ruta de Aprendizaje</h2>
              
              <ul className="space-y-3 font-mono text-sm">
                <li>
                  <button onClick={() => setModuloActivo(1)} className={`w-full text-left px-4 py-3 rounded border transition-all ${moduloActivo === 1 ? 'bg-cyan-950/40 border-cyan-500 text-cyan-300' : 'border-slate-800 text-slate-500 hover:border-slate-600'}`}>
                    UNIDAD I: Protocolos de Intervención
                  </button>
                </li>
                <li>
                  <button onClick={() => setModuloActivo(2)} className={`w-full text-left px-4 py-3 rounded border transition-all ${moduloActivo === 2 ? 'bg-cyan-950/40 border-cyan-500 text-cyan-300' : 'border-slate-800 text-slate-500 hover:border-slate-600'}`}>
                    UNIDAD II: Uso Proporcional de Herramientas
                  </button>
                </li>
                <li>
                  <button onClick={() => setModuloActivo(3)} className={`w-full text-left px-4 py-3 rounded border transition-all flex justify-between items-center ${moduloActivo === 3 ? 'bg-emerald-950/40 border-emerald-500 text-emerald-400' : 'border-slate-800 text-slate-500 hover:border-slate-600'}`}>
                    <span>EVALUACIÓN PRÁCTICA</span>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </button>
                </li>
              </ul>
            </div>
            
            <div className="bg-slate-900/50 border border-slate-800 rounded-xl p-4">
               <p className="text-[10px] text-slate-500 leading-relaxed text-justify">
                 * El modelo de aula invertida requiere que el cursante domine el material teórico antes de proceder a la evaluación centrada en la resolución de casos reales.
               </p>
            </div>
          </div>

          <div className="lg:col-span-2">
            <div className="bg-[#0a1120]/80 border border-slate-800 rounded-xl p-8 backdrop-blur-sm min-h-[500px]">
              
              {moduloActivo === 1 && (
                <div className="animate-fade-in-up">
                  <h2 className="text-2xl font-black text-white mb-4">Protocolos de Intervención Técnica</h2>
                  <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
                    <p><strong className="text-cyan-400">Objetivo de la Competencia:</strong> Analizar y ejecutar el protocolo de primer contacto con el hardware del cliente, garantizando la preservación de datos e integridad del equipo.</p>
                    <div className="bg-[#030712] p-4 rounded border border-slate-800 my-4">
                      <h4 className="font-bold text-slate-300 mb-2">Fase de Aproximación:</h4>
                      <ul className="list-disc pl-5 space-y-2">
                        <li>Verificación visual del estado del equipo antes del desensamble.</li>
                        <li>Registro fotográfico y documental en la plataforma NOC.</li>
                        <li>Aislamiento de fuentes de energía estática.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {moduloActivo === 2 && (
                <div className="animate-fade-in-up">
                  <h2 className="text-2xl font-black text-white mb-4">Uso Proporcional de Herramientas</h2>
                  <div className="space-y-4 text-sm text-slate-400 leading-relaxed">
                    <p><strong className="text-cyan-400">Objetivo de la Competencia:</strong> Seleccionar y aplicar el instrumento adecuado según el nivel de resistencia o vulnerabilidad del hardware, evitando daños colaterales.</p>
                    <div className="bg-[#030712] p-4 rounded border border-slate-800 my-4">
                      <h4 className="font-bold text-slate-300 mb-2">Principios de Intervención Física:</h4>
                      <ul className="list-disc pl-5 space-y-2">
                        <li>Identificación de tensiones mecánicas en carcasas modernas.</li>
                        <li>Aplicación de fuerza escalonada al remover componentes adheridos.</li>
                        <li>Uso de herramientas térmicas (estaciones de calor) bajo estrictos márgenes de temperatura.</li>
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {moduloActivo === 3 && (
                <div className="animate-fade-in-up flex flex-col items-center justify-center min-h-[400px]">
                  <div className="w-16 h-16 bg-emerald-950/50 border border-emerald-500 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                    <svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path></svg>
                  </div>
                  <h2 className="text-2xl font-black text-white mb-2 text-center">Simulador de Casos Prácticos</h2>
                  <p className="text-sm text-slate-400 max-w-md mb-6 text-center">
                    La evaluación medirá su capacidad de resolución bajo el modelo de competencias operativas.
                  </p>

                  {!evaluacionIniciada ? (
                    <div className="w-full max-w-md space-y-4">
                      <div>
                        <label className="block text-xs font-mono text-cyan-400 mb-2 uppercase">Nombre Completo del Técnico</label>
                        <input
                          type="text"
                          placeholder="Ej. Juan Pérez"
                          value={nombreTecnico}
                          onChange={(e) => setNombreTecnico(e.target.value)}
                          className="w-full bg-[#030712] border border-slate-700 rounded p-3 text-white focus:outline-none focus:border-cyan-400 text-sm"
                        />
                      </div>
                      <button
                        onClick={() => {
                          if (!nombreTecnico.trim()) {
                            alert("Ingrese su nombre antes de iniciar.");
                            return;
                          }
                          setEvaluacionIniciada(true);
                        }}
                        className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold tracking-widest rounded transition-all shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                      >
                        INICIAR EVALUACIÓN
                      </button>
                    </div>
                  ) : evaluacionCompletada ? (
                    <div className="w-full bg-[#030712] border border-slate-800 p-6 rounded text-center space-y-4">
                      <div className={`text-2xl font-black ${resultado.esCorrecta ? 'text-emerald-400' : 'text-red-400'}`}>
                        {resultado.esCorrecta ? "COMPETENCIA CERTIFICADA" : "RESULTADO INSATISFACTORIO"}
                      </div>
                      <p className="text-sm text-slate-300">
                        Puntaje Obtenido: <strong className="text-white">{resultado.puntaje} / 100</strong>
                      </p>
                      <p className="text-xs text-slate-500">
                        Los resultados han sido transmitidos a la consola del Administrador Maestro en el Panel NOC.
                      </p>
                    </div>
                  ) : (
                    <div className="w-full text-left bg-[#030712] border border-cyan-900/50 p-6 rounded space-y-4">
                      <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                        <p className="font-mono text-cyan-400 text-xs">CASO #01 - INTERVENCIÓN EN DOMICILIO</p>
                        <p className="font-mono text-slate-500 text-xs">TÉCNICO: {nombreTecnico}</p>
                      </div>
                      <p className="text-sm text-slate-300">
                        Un cliente reporta un cortocircuito en su placa base. Al llegar, el equipo aún está conectado a la red eléctrica pero emite olor a quemado. Según los protocolos de intervención aprendidos, ¿cuál es el primer paso táctico a seguir?
                      </p>

                      <div className="space-y-3">
                        <button
                          disabled={enviando}
                          onClick={() => procesarRespuesta("A")}
                          className="w-full text-left p-3 border border-slate-700 rounded text-sm text-slate-400 hover:bg-slate-800 transition-colors"
                        >
                          A) Abrir el chasis inmediatamente para ventilar.
                        </button>
                        <button
                          disabled={enviando}
                          onClick={() => procesarRespuesta("B")}
                          className="w-full text-left p-3 border border-slate-700 rounded text-sm text-slate-400 hover:bg-slate-800 transition-colors"
                        >
                          B) Aislar la fuente de energía y asegurar el perímetro antes del contacto físico.
                        </button>
                        <button
                          disabled={enviando}
                          onClick={() => procesarRespuesta("C")}
                          className="w-full text-left p-3 border border-slate-700 rounded text-sm text-slate-400 hover:bg-slate-800 transition-colors"
                        >
                          C) Solicitar al cliente que encienda el equipo para replicar la falla.
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}