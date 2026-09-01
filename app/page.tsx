"use client";
import { useState } from "react";
import Link from "next/link";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase"; 

export default function Home() {
  const [formData, setFormData] = useState({
    nombre: "",
    telefono: "",
    descripcion: "",
    fecha: "",
    hora: "",
    direccion: "",     // NUEVO: Dirección escrita
    coordenadas: "",   // NUEVO: Coordenadas GPS
    adelanto: false,
    montoAdelanto: "",
  });

  const [dateError, setDateError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [comprobante, setComprobante] = useState("");
  const [pagoVerificado, setPagoVerificado] = useState(false);
  const [validandoPago, setValidandoPago] = useState(false);
  const [qrZoomed, setQrZoomed] = useState(false); 
  const [obteniendoUbicacion, setObteniendoUbicacion] = useState(false); // NUEVO: Estado del radar GPS

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seleccion = e.target.value;
    setFormData({ ...formData, fecha: seleccion });
    if (seleccion) {
      const [year, month, day] = seleccion.split('-');
      const dateObj = new Date(Number(year), Number(month) - 1, Number(day));
      const dayOfWeek = dateObj.getDay(); 
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        setDateError("Atención exclusiva fines de semana. Por favor, seleccione un Sábado o Domingo.");
      } else {
        setDateError("");
      }
    } else {
      setDateError("");
    }
  };

  // Validación: Ahora exige Nombre, Teléfono, Descripción, Fecha, Hora y Dirección.
  const isFormValid = formData.nombre && formData.telefono && formData.descripcion && formData.fecha && formData.hora && formData.direccion && !dateError && (!formData.adelanto || (formData.adelanto && formData.montoAdelanto));

  // === MOTOR DE GEOLOCALIZACIÓN TÁCTICA ===
  const capturarUbicacion = () => {
    setObteniendoUbicacion(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setFormData({ ...formData, coordenadas: `${lat},${lng}` });
          setObteniendoUbicacion(false);
        },
        (error) => {
          console.error("Error GPS:", error);
          alert("No se pudo obtener la ubicación. Verifique los permisos de su navegador.");
          setObteniendoUbicacion(false);
        }
      );
    } else {
      alert("Su dispositivo no soporta geolocalización.");
      setObteniendoUbicacion(false);
    }
  };

  const verificarTransferencia = () => {
    if (comprobante.length < 4) {
      alert("Por favor, ingrese un número de comprobante válido.");
      return;
    }
    setValidandoPago(true);
    setTimeout(() => {
      setValidandoPago(false);
      setPagoVerificado(true);
    }, 2000);
  };

  const confirmarYGuardar = async () => {
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "citas"), {
        nombre: formData.nombre,
        telefono: formData.telefono,
        descripcion: formData.descripcion,
        fecha: formData.fecha,
        hora: formData.hora,
        direccion: formData.direccion,
        coordenadas: formData.coordenadas, // Se envían las coordenadas a tu bóveda
        estado: "Pendiente",
        adelantoRealizado: formData.adelanto,
        montoAdelanto: formData.adelanto ? formData.montoAdelanto : "0",
        nroComprobante: formData.adelanto ? comprobante : "N/A",
        fechaRegistro: new Date().toISOString()
      });
      
      alert("✅ ¡Éxito! La asistencia técnica ha sido procesada.");
      
      setFormData({ nombre: "", telefono: "", descripcion: "", fecha: "", hora: "", direccion: "", coordenadas: "", adelanto: false, montoAdelanto: "" });
      setComprobante("");
      setPagoVerificado(false);
      setShowModal(false);
    } catch (error) {
      console.error("Error de conexión:", error);
      alert("❌ Hubo un error al intentar conectar con el servidor.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const puedeConfirmar = formData.adelanto ? pagoVerificado : true;

  return (
    <main className="min-h-screen bg-[#030712] text-white flex items-center justify-center p-4 md:p-8 selection:bg-cyan-500 selection:text-black relative overflow-hidden">
      
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-cyan-600 rounded-full mix-blend-screen filter blur-[120px] opacity-20 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-700 rounded-full mix-blend-screen filter blur-[120px] opacity-20 pointer-events-none"></div>

      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center z-10">
        
        {/* COLUMNA IZQUIERDA: Marca */}
        <div className="space-y-8 flex flex-col items-center lg:items-start text-center lg:text-left">
          <div className="w-32 h-32 relative drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] transform transition hover:scale-105">
             <img src="/logo.png" alt="OmniTech Logo" className="w-full h-full object-contain" />
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]">
              OmniTech
              <span className="block text-3xl md:text-4xl text-white mt-1">Solutions</span>
            </h1>
            <p className="text-cyan-100/60 font-light text-lg max-w-md">
              Soporte IT Premium, Seguridad y Mantenimiento a Domicilio.
            </p>
          </div>
          <div className="w-full max-w-md h-56 relative rounded-2xl overflow-hidden border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)] group">
            <img 
              src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop" 
              alt="Tecnología Avanzada" 
              className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all duration-700 group-hover:scale-110"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent"></div>
          </div>
        </div>

        {/* COLUMNA DERECHA: Formulario */}
        <div className="bg-[#0a1120]/80 p-8 md:p-10 rounded-3xl border border-cyan-500/40 backdrop-blur-xl shadow-[0_0_40px_rgba(6,182,212,0.2)] relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_20px_rgba(34,211,238,0.8)]"></div>

          <h2 className="text-3xl font-bold mb-1 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">
            Solicitar Diagnóstico
          </h2>
          <p className="text-cyan-400 mb-6 text-sm font-bold tracking-widest drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">
            ATENCIÓN FINES DE SEMANA
          </p>
          
          <form className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-cyan-500/80 mb-1 uppercase tracking-wider">Nombre Completo</label>
                <input type="text" value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} className="w-full bg-[#030712] border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-cyan-500/80 mb-1 uppercase tracking-wider">Nro. WhatsApp</label>
                <input type="tel" value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value})} className="w-full bg-[#030712] border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-cyan-500/80 mb-1 uppercase tracking-wider">Fecha</label>
                <input type="date" value={formData.fecha} onChange={handleDateChange} className={`w-full bg-[#030712] border ${dateError ? 'border-red-500' : 'border-slate-800'} rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition-all [&::-webkit-calendar-picker-indicator]:invert`} />
              </div>
              <div>
                <label className="block text-xs font-semibold text-cyan-500/80 mb-1 uppercase tracking-wider">Hora</label>
                <input type="time" min="08:00" max="20:00" value={formData.hora} onChange={(e) => setFormData({...formData, hora: e.target.value})} className="w-full bg-[#030712] border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition-all [&::-webkit-calendar-picker-indicator]:invert" />
              </div>
            </div>

            {/* MÓDULO DE DIRECCIÓN Y GPS */}
            <div className="bg-[#030712] p-4 rounded-lg border border-slate-800 space-y-3">
              <label className="block text-xs font-semibold text-cyan-500/80 uppercase tracking-wider">Lugar de Intervención</label>
              
              <input 
                type="text" 
                placeholder="Dirección, Zona o Referencia detallada..."
                value={formData.direccion} 
                onChange={(e) => setFormData({...formData, direccion: e.target.value})} 
                className="w-full bg-[#0a1120] border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all" 
              />
              
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <button 
                  type="button"
                  onClick={capturarUbicacion}
                  disabled={obteniendoUbicacion || formData.coordenadas !== ""}
                  className={`w-full sm:w-auto px-4 py-2 rounded text-xs font-bold tracking-widest flex items-center justify-center transition-all ${
                    formData.coordenadas 
                    ? "bg-green-950/50 border border-green-500 text-green-400 cursor-default" 
                    : "bg-cyan-950/50 border border-cyan-700 hover:bg-cyan-900 text-cyan-400"
                  }`}
                >
                  {obteniendoUbicacion ? (
                    <span className="animate-pulse">RASTREANDO SEÑAL...</span>
                  ) : formData.coordenadas ? (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                      COORDENADAS GUARDADAS
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                      ENVIAR UBICACIÓN GPS
                    </>
                  )}
                </button>
                {formData.coordenadas && (
                  <span className="text-[10px] font-mono text-slate-500 hidden sm:block">DATA: {formData.coordenadas}</span>
                )}
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-cyan-500/80 mb-1 uppercase tracking-wider">Descripción del Problema</label>
              <textarea rows={2} value={formData.descripcion} onChange={(e) => setFormData({...formData, descripcion: e.target.value})} className="w-full bg-[#030712] border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition-all resize-none"></textarea>
            </div>
            
            {/* INTERRUPTOR DE PAGO */}
            <div className="bg-slate-900/50 p-4 rounded-lg border border-cyan-900/30">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={formData.adelanto} 
                  onChange={(e) => {
                    setFormData({...formData, adelanto: e.target.checked});
                    if(!e.target.checked) setPagoVerificado(false); 
                  }} 
                  className="w-5 h-5 accent-cyan-500 cursor-pointer"
                />
                <span className="text-cyan-400 font-bold text-sm tracking-wide">AÑADIR ADELANTO (Reserva Prioritaria)</span>
              </label>
              
              {formData.adelanto && (
                <div className="mt-4 animate-fade-in-up">
                  <label className="block text-xs font-semibold text-cyan-500/80 mb-1 uppercase tracking-wider">Monto a depositar (Bs.)</label>
                  <input 
                    type="number" 
                    placeholder="Ej. 50"
                    value={formData.montoAdelanto} 
                    onChange={(e) => setFormData({...formData, montoAdelanto: e.target.value})} 
                    className="w-full bg-[#030712] border border-cyan-700/50 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all" 
                  />
                </div>
              )}
            </div>

            {dateError && <p className="text-red-400 text-xs font-bold mt-1 text-center bg-red-950/50 py-2 rounded border border-red-900/50">{dateError}</p>}

            <button 
              type="button" 
              disabled={!isFormValid}
              onClick={() => setShowModal(true)}
              className={`w-full mt-4 py-4 px-8 rounded-lg font-extrabold text-lg transform transition-all ${
                isFormValid 
                ? "bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:-translate-y-1" 
                : "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50"
              }`}
            >
              {isFormValid ? "CONTINUAR" : "COMPLETE TODOS LOS DATOS"}
            </button>
          </form>
        </div>
      </div>

      {/* MODAL PRINCIPAL DE CONFIRMACIÓN (Sin Cambios Estructurales) */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#030712]/95 backdrop-blur-xl overflow-y-auto">
          <div className="bg-[#0a1120] border border-cyan-500/50 p-6 md:p-8 rounded-2xl max-w-lg w-full shadow-[0_0_80px_rgba(34,211,238,0.2)] my-8 relative">
            
            <h3 className="text-2xl font-black text-white mb-4 text-center tracking-widest border-b border-slate-800 pb-4">
              {formData.adelanto ? "PASARELA DE PAGO" : "CONFIRMACIÓN DE CITA"}
            </h3>
            
            {formData.adelanto && !pagoVerificado && (
              <div className="mb-6">
                <p className="text-center text-cyan-400 text-sm font-bold tracking-widest mb-4">
                  ESCANEE PARA DEPOSITAR {formData.montoAdelanto} Bs.
                </p>
                <div 
                  className="relative w-64 h-72 mx-auto mb-2 transform hover:scale-105 transition-all duration-300 cursor-pointer group"
                  onClick={() => setQrZoomed(true)}
                >
                  <div className="absolute inset-0 bg-cyan-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                  <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl p-1 shadow-[0_0_40px_rgba(34,211,238,0.4)]">
                    <div className="w-full h-full bg-[#0a1120] rounded-xl overflow-hidden flex flex-col items-center justify-center p-1 relative">
                      <img src="/qr.png" alt="Código QR" className="w-full h-full object-contain" 
                        onError={(e) => { e.currentTarget.src = "https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg"; }}
                      />
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="bg-[#030712]/80 border border-cyan-500 text-cyan-400 px-4 py-2 rounded-lg flex flex-col items-center backdrop-blur-sm shadow-[0_0_20px_rgba(34,211,238,0.3)]">
                          <svg className="w-6 h-6 mb-1 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg>
                          <span className="font-bold tracking-widest text-xs">AMPLIAR QR</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-center text-slate-400 text-[11px] font-mono mb-6 uppercase tracking-widest animate-pulse">
                  [ Toque la imagen para ver en pantalla completa ]
                </p>

                <div className="bg-[#030712] p-4 rounded-xl border border-cyan-900/50">
                  <label className="block text-xs font-bold text-cyan-500 mb-2 uppercase text-center">Nro. de Comprobante / Transacción</label>
                  <div className="flex space-x-2">
                    <input 
                      type="text" 
                      placeholder="Ej. 98765432"
                      value={comprobante}
                      onChange={(e) => setComprobante(e.target.value)}
                      className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-400 text-center tracking-widest font-mono"
                    />
                    <button 
                      type="button"
                      onClick={verificarTransferencia}
                      disabled={validandoPago}
                      className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-all"
                    >
                      {validandoPago ? "..." : "VERIFICAR"}
                    </button>
                  </div>
                  {validandoPago && <p className="text-cyan-400 text-xs text-center mt-2 animate-pulse font-mono">Conectando con red bancaria...</p>}
                </div>
              </div>
            )}

            {formData.adelanto && pagoVerificado && (
              <div className="bg-emerald-950/30 border border-emerald-500 p-6 rounded-xl text-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                </div>
                <h4 className="text-emerald-400 font-black text-xl mb-1">PAGO VERIFICADO</h4>
                <p className="text-emerald-100/70 text-sm font-mono">Comprobante #{comprobante}</p>
              </div>
            )}

            <div className="bg-[#030712] p-4 rounded-lg border border-slate-800 mb-6 space-y-2 text-sm text-slate-300">
              <p><span className="text-slate-500 font-mono text-xs">CLIENTE:</span> <br/><span className="font-bold text-white text-base">{formData.nombre}</span></p>
              <div className="flex justify-between border-t border-slate-800 pt-2 mt-2">
                <p><span className="text-slate-500 font-mono text-xs">DIRECCIÓN:</span> <br/><span className="text-cyan-400 font-bold">{formData.direccion}</span></p>
                <p className="text-right"><span className="text-slate-500 font-mono text-xs">GPS:</span> <br/><span className="text-cyan-400 font-bold">{formData.coordenadas ? "CAPTURADO" : "MANUAL"}</span></p>
              </div>
            </div>

            <div className="flex space-x-4">
              <button 
                onClick={() => { setShowModal(false); setPagoVerificado(false); setComprobante(""); }}
                className="w-1/3 py-3 rounded-lg border border-slate-700 text-slate-400 font-bold hover:bg-slate-800 hover:text-white transition-all"
              >
                Cancelar
              </button>
              
              <button 
                onClick={confirmarYGuardar}
                disabled={isSubmitting || !puedeConfirmar}
                className={`w-2/3 py-3 rounded-lg font-black tracking-widest transition-all ${
                  !puedeConfirmar 
                  ? "bg-slate-800 text-slate-600 cursor-not-allowed" 
                  : isSubmitting 
                    ? "bg-slate-600 text-slate-400 cursor-wait" 
                    : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_20px_rgba(34,211,238,0.5)]"
                }`}
              >
                {!puedeConfirmar ? "REQUIERE PAGO" : isSubmitting ? "PROCESANDO..." : "SÍ, AGENDAR CITA"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* VISOR QR */}
      {qrZoomed && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl cursor-zoom-out animate-fade-in" onClick={() => setQrZoomed(false)}>
          <button className="absolute top-6 right-6 text-slate-400 hover:text-cyan-400 transition-colors z-[110]" onClick={() => setQrZoomed(false)}>
            <svg className="w-10 h-10 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
          </button>
          <div className="w-full max-w-3xl max-h-screen p-2 flex flex-col items-center">
             <p className="text-cyan-400 font-mono tracking-widest mb-4 font-bold animate-pulse text-center bg-black/50 px-4 py-2 rounded-full border border-cyan-900">[ MODO DE ESCANEO ACTIVO ]</p>
             <img src="/qr.png" alt="Código QR Ampliado" className="w-full h-auto max-h-[80vh] object-contain rounded-xl drop-shadow-[0_0_40px_rgba(34,211,238,0.2)] border border-cyan-900/50" onError={(e) => { e.currentTarget.src = "https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg"; }} />
          </div>
        </div>
      )}

      <Link href="/admin" className="absolute bottom-6 right-6 z-40 bg-[#0a1120] text-slate-500 hover:text-cyan-400 border border-slate-800 hover:border-cyan-500/50 px-4 py-2 rounded-full font-mono text-xs font-bold tracking-widest flex items-center space-x-2 transition-all hover:shadow-[0_0_15px_rgba(34,211,238,0.2)] group">
        <svg className="w-3.5 h-3.5 group-hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
        <span>ACCESO SOC</span>
      </Link>
    </main>
  );
}