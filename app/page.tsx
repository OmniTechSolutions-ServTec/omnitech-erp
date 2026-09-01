"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, addDoc } from "firebase/firestore";
import { db } from "../firebase"; 

export default function Home() {
  const [formData, setFormData] = useState({
    nombre: "", telefono: "", descripcion: "", fecha: "", hora: "", direccion: "", coordenadas: "", adelanto: false, montoAdelanto: "",
  });

  const [dateError, setDateError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [comprobante, setComprobante] = useState("");
  const [pagoVerificado, setPagoVerificado] = useState(false);
  const [validandoPago, setValidandoPago] = useState(false);
  const [qrZoomed, setQrZoomed] = useState(false); 
  const [obteniendoUbicacion, setObteniendoUbicacion] = useState(false); 

  // ==========================================================
  // NUEVO MOTOR: SPLASH SCREEN Y PWA INSTALL
  // ==========================================================
  const [showSplash, setShowSplash] = useState(true);
  const [showThankYouToast, setShowThankYouToast] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isSplashFading, setIsSplashFading] = useState(false);

  useEffect(() => {
    // Intercepta la señal del navegador que permite instalar la app
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      // Si el navegador es iOS (iPhone) o la app ya está instalada, mostramos un aviso elegante.
      alert("Para instalar en dispositivos Apple (iOS): Presione el ícono 'Compartir' en su navegador y seleccione 'Agregar a inicio'. Si ya posee la aplicación, presione 'Acceder a la Versión Web'.");
      return;
    }
    // Mostramos la ventana nativa de instalación del celular
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      // Si el cliente instala la app, activamos el mensaje de agradecimiento
      cerrarSplash();
      setShowThankYouToast(true);
      // El mensaje desaparecerá solo después de 7 segundos
      setTimeout(() => setShowThankYouToast(false), 7000);
    }
    setDeferredPrompt(null);
  };

  const cerrarSplash = () => {
    setIsSplashFading(true);
    setTimeout(() => {
      setShowSplash(false);
    }, 800); // Tiempo que dura la animación de desvanecimiento
  };

  // ==========================================================
  // LÓGICA DEL FORMULARIO
  // ==========================================================
  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seleccion = e.target.value; setFormData({ ...formData, fecha: seleccion });
    if (seleccion) {
      const [year, month, day] = seleccion.split('-'); const dateObj = new Date(Number(year), Number(month) - 1, Number(day)); const dayOfWeek = dateObj.getDay(); 
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { setDateError("Atención exclusiva fines de semana. Por favor, seleccione un Sábado o Domingo."); } else { setDateError(""); }
    } else { setDateError(""); }
  };

  const isFormValid = formData.nombre && formData.telefono && formData.descripcion && formData.fecha && formData.hora && formData.direccion && !dateError && (!formData.adelanto || (formData.adelanto && formData.montoAdelanto));

  const capturarUbicacion = () => {
    setObteniendoUbicacion(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => { setFormData({ ...formData, coordenadas: `${position.coords.latitude},${position.coords.longitude}` }); setObteniendoUbicacion(false); },
        (error) => { alert("No se pudo obtener la ubicación. Verifique el GPS."); setObteniendoUbicacion(false); }
      );
    } else { alert("GPS no soportado."); setObteniendoUbicacion(false); }
  };

  const verificarTransferencia = () => {
    if (comprobante.length < 4) { alert("Ingrese un Nro. de comprobante válido."); return; }
    setValidandoPago(true); setTimeout(() => { setValidandoPago(false); setPagoVerificado(true); }, 2000);
  };

  const confirmarYGuardar = async () => {
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "citas"), {
        nombre: formData.nombre, telefono: formData.telefono, descripcion: formData.descripcion, fecha: formData.fecha, hora: formData.hora, direccion: formData.direccion, coordenadas: formData.coordenadas, estado: "Pendiente", adelantoRealizado: formData.adelanto, montoAdelanto: formData.adelanto ? formData.montoAdelanto : "0", nroComprobante: formData.adelanto ? comprobante : "N/A", fechaRegistro: new Date().toISOString()
      });
      alert("✅ Asistencia programada. Nos contactaremos a la brevedad.");
      setFormData({ nombre: "", telefono: "", descripcion: "", fecha: "", hora: "", direccion: "", coordenadas: "", adelanto: false, montoAdelanto: "" }); setComprobante(""); setPagoVerificado(false); setShowModal(false);
    } catch (error) { alert("❌ Error de red."); } finally { setIsSubmitting(false); }
  };

  const puedeConfirmar = formData.adelanto ? pagoVerificado : true;

  return (
    <main className="min-h-screen bg-[#030712] text-white flex flex-col items-center justify-center p-4 md:p-8 selection:bg-cyan-500 selection:text-black relative overflow-x-hidden">
      
      {/* ========================================================= */}
      {/* 1. SPLASH SCREEN FUTURISTA (PANTALLA DE BIENVENIDA) */}
      {/* ========================================================= */}
      {showSplash && (
        <div className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#030712] transition-opacity duration-1000 ease-in-out ${isSplashFading ? 'opacity-0' : 'opacity-100'}`}>
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-900 rounded-full mix-blend-screen filter blur-[150px] opacity-30 animate-pulse"></div>
          
          <div className="relative z-10 flex flex-col items-center p-8 max-w-md w-full text-center">
            {/* Logo con animación de flotación */}
            <div className="w-32 h-32 mb-6 drop-shadow-[0_0_20px_rgba(34,211,238,0.6)] animate-[bounce_3s_infinite]">
              <img src="/logo.png" alt="OmniTech Logo" className="w-full h-full object-contain" />
            </div>
            
            <h1 className="text-3xl md:text-4xl font-black tracking-widest text-white mb-2 drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
              OMNITECH <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">SOLUTIONS</span>
            </h1>
            <p className="text-cyan-500/80 text-xs font-mono tracking-widest mb-10 uppercase border-b border-cyan-900/50 pb-4">
              Infraestructura Tecnológica Premium
            </p>

            <div className="bg-[#0a1120]/80 border border-cyan-900/50 p-6 rounded-2xl mb-8 backdrop-blur-md shadow-[0_0_30px_rgba(34,211,238,0.1)]">
              <p className="text-sm text-slate-300 leading-relaxed">
                ¿Desea optimizar su experiencia e instalar nuestra aplicación oficial en su dispositivo para un acceso directo y seguro?
              </p>
            </div>

            <div className="flex flex-col space-y-4 w-full">
              <button 
                onClick={handleInstallApp}
                className="w-full py-4 rounded-xl font-black tracking-widest bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:shadow-[0_0_40px_rgba(34,211,238,0.6)] transition-all flex items-center justify-center transform hover:-translate-y-1"
              >
                <svg className="w-5 h-5 mr-3 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                SÍ, INSTALAR APP
              </button>
              
              <button 
                onClick={cerrarSplash}
                className="w-full py-3 rounded-xl font-bold tracking-widest text-slate-400 hover:text-white border border-transparent hover:border-slate-800 hover:bg-slate-900/50 transition-all text-xs"
              >
                SOLO ACCEDER A LA VERSIÓN WEB
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. NOTIFICACIÓN FLOTANTE (TOAST DE AGRADECIMIENTO) */}
      {/* ========================================================= */}
      {showThankYouToast && (
        <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[150] w-full max-w-md px-4 animate-fade-in-up">
          <div className="bg-[#0a1120]/95 border border-emerald-500/50 p-5 rounded-2xl shadow-[0_0_50px_rgba(16,185,129,0.3)] backdrop-blur-xl flex items-start space-x-4">
            <div className="w-10 h-10 bg-emerald-500/20 rounded-full flex items-center justify-center border border-emerald-500 flex-shrink-0 mt-1">
              <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
            </div>
            <div>
              <h4 className="text-emerald-400 font-black tracking-widest text-sm mb-1">INSTALACIÓN EXITOSA</h4>
              <p className="text-slate-300 text-xs leading-relaxed">
                Agradecemos su confianza en nuestra infraestructura. OmniTech Solutions operará ahora con rendimiento nativo y protocolos de máxima seguridad en su dispositivo.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* INTERFAZ PRINCIPAL DEL SISTEMA (Fondo) */}
      {/* ========================================================= */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-cyan-600 rounded-full mix-blend-screen filter blur-[120px] opacity-20 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-700 rounded-full mix-blend-screen filter blur-[120px] opacity-20 pointer-events-none"></div>

      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center z-10 my-auto">
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
              Soporte IT Premium y Mantenimiento Avanzado.
            </p>
            <div className="inline-flex items-center mt-4 bg-cyan-950/30 border border-cyan-800/50 px-4 py-2 rounded-full">
              <svg className="w-4 h-4 text-cyan-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
              <span className="text-xs font-bold tracking-widest text-cyan-400">COBERTURA: LA PAZ Y EL ALTO</span>
            </div>
          </div>
          <div className="w-full max-w-md h-56 relative rounded-2xl overflow-hidden border border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.15)] group">
            <img src="https://images.unsplash.com/photo-1550751827-4bd374c3f58b?q=80&w=2070&auto=format&fit=crop" alt="Tecnología Avanzada" className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-all duration-700 group-hover:scale-110" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#030712] via-transparent to-transparent"></div>
          </div>
        </div>

        <div className="bg-[#0a1120]/80 p-8 md:p-10 rounded-3xl border border-cyan-500/40 backdrop-blur-xl shadow-[0_0_40px_rgba(6,182,212,0.2)] relative mb-12 lg:mb-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_20px_rgba(34,211,238,0.8)]"></div>
          <h2 className="text-3xl font-bold mb-1 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">Solicitar Diagnóstico</h2>
          <p className="text-cyan-400 mb-6 text-sm font-bold tracking-widest drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">ATENCIÓN FINES DE SEMANA</p>
          
          <form className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-cyan-500/80 mb-1 uppercase tracking-wider">Nombre Completo</label><input type="text" value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} className="w-full bg-[#030712] border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition-all" /></div>
              <div><label className="block text-xs font-semibold text-cyan-500/80 mb-1 uppercase tracking-wider">Nro. WhatsApp</label><input type="tel" value={formData.telefono} onChange={(e) => setFormData({...formData, telefono: e.target.value})} className="w-full bg-[#030712] border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition-all" /></div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-cyan-500/80 mb-1 uppercase tracking-wider">Fecha</label><input type="date" value={formData.fecha} onChange={handleDateChange} className={`w-full bg-[#030712] border ${dateError ? 'border-red-500' : 'border-slate-800'} rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition-all [&::-webkit-calendar-picker-indicator]:invert`} /></div>
              <div><label className="block text-xs font-semibold text-cyan-500/80 mb-1 uppercase tracking-wider">Hora</label><input type="time" min="08:00" max="20:00" value={formData.hora} onChange={(e) => setFormData({...formData, hora: e.target.value})} className="w-full bg-[#030712] border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition-all [&::-webkit-calendar-picker-indicator]:invert" /></div>
            </div>
            <div className="bg-[#030712] p-4 rounded-lg border border-slate-800 space-y-3">
              <label className="block text-xs font-semibold text-cyan-500/80 uppercase tracking-wider">Lugar de Intervención (La Paz / El Alto)</label>
              <input type="text" placeholder="Dirección, Zona o Referencia detallada..." value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value})} className="w-full bg-[#0a1120] border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition-all" />
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                <button type="button" onClick={capturarUbicacion} disabled={obteniendoUbicacion || formData.coordenadas !== ""} className={`w-full sm:w-auto px-4 py-2 rounded text-xs font-bold tracking-widest flex items-center justify-center transition-all ${formData.coordenadas ? "bg-green-950/50 border border-green-500 text-green-400 cursor-default" : "bg-cyan-950/50 border border-cyan-700 hover:bg-cyan-900 text-cyan-400"}`}>
                  {obteniendoUbicacion ? <span className="animate-pulse">RASTREANDO SEÑAL...</span> : formData.coordenadas ? <> <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> GPS GUARDADO</> : <> <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> ENVIAR RASTREO GPS</>}
                </button>
              </div>
            </div>
            <div><label className="block text-xs font-semibold text-cyan-500/80 mb-1 uppercase tracking-wider">Descripción de la Falla</label><textarea rows={2} value={formData.descripcion} onChange={(e) => setFormData({...formData, descripcion: e.target.value})} className="w-full bg-[#030712] border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 resize-none"></textarea></div>
            <div className="bg-slate-900/50 p-4 rounded-lg border border-cyan-900/30">
              <label className="flex items-center space-x-3 cursor-pointer">
                <input type="checkbox" checked={formData.adelanto} onChange={(e) => { setFormData({...formData, adelanto: e.target.checked}); if(!e.target.checked) setPagoVerificado(false); }} className="w-5 h-5 accent-cyan-500 cursor-pointer" />
                <span className="text-cyan-400 font-bold text-sm tracking-wide">AÑADIR ADELANTO (Reserva Prioritaria)</span>
              </label>
              {formData.adelanto && (
                <div className="mt-4 animate-fade-in-up">
                  <label className="block text-xs font-semibold text-cyan-500/80 mb-1 uppercase tracking-wider">Monto a depositar (Bs.)</label>
                  <input type="number" placeholder="Ej. 50" value={formData.montoAdelanto} onChange={(e) => setFormData({...formData, montoAdelanto: e.target.value})} className="w-full bg-[#030712] border border-cyan-700/50 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400" />
                </div>
              )}
            </div>
            {dateError && <p className="text-red-400 text-xs font-bold mt-1 text-center bg-red-950/50 py-2 rounded border border-red-900/50">{dateError}</p>}
            <button type="button" disabled={!isFormValid} onClick={() => setShowModal(true)} className={`w-full mt-4 py-4 px-8 rounded-lg font-extrabold text-lg transform transition-all ${isFormValid ? "bg-cyan-500 hover:bg-cyan-400 text-black shadow-[0_0_20px_rgba(34,211,238,0.4)] hover:-translate-y-1" : "bg-slate-800 text-slate-500 cursor-not-allowed opacity-50"}`}>
              {isFormValid ? "CONTINUAR" : "COMPLETE LOS DATOS"}
            </button>
          </form>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-[#030712]/95 backdrop-blur-xl overflow-y-auto">
          <div className="bg-[#0a1120] border border-cyan-500/50 p-6 md:p-8 rounded-2xl max-w-lg w-full shadow-[0_0_80px_rgba(34,211,238,0.2)] my-8 relative">
            <h3 className="text-2xl font-black text-white mb-4 text-center tracking-widest border-b border-slate-800 pb-4">{formData.adelanto ? "PASARELA DE PAGO" : "CONFIRMACIÓN DE CITA"}</h3>
            
            {formData.adelanto && !pagoVerificado && (
              <div className="mb-6">
                <p className="text-center text-cyan-400 text-sm font-bold tracking-widest mb-4">ESCANEE PARA DEPOSITAR {formData.montoAdelanto} Bs.</p>
                <div className="relative w-64 h-72 mx-auto mb-2 transform hover:scale-105 transition-all duration-300 cursor-pointer group" onClick={() => setQrZoomed(true)}>
                  <div className="absolute inset-0 bg-cyan-500 rounded-2xl blur-xl opacity-20 group-hover:opacity-40 transition-opacity"></div>
                  <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl p-1 shadow-[0_0_40px_rgba(34,211,238,0.4)]">
                    <div className="w-full h-full bg-[#0a1120] rounded-xl overflow-hidden flex flex-col items-center justify-center p-1 relative">
                      <img src="/qr.png" alt="Código QR" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.src = "https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg"; }} />
                      <div className="absolute inset-0 bg-black/70 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <div className="bg-[#030712]/80 border border-cyan-500 text-cyan-400 px-4 py-2 rounded-lg flex flex-col items-center backdrop-blur-sm shadow-[0_0_20px_rgba(34,211,238,0.3)]"><svg className="w-6 h-6 mb-1 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"></path></svg><span className="font-bold tracking-widest text-xs">AMPLIAR QR</span></div>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="bg-[#030712] p-4 rounded-xl border border-cyan-900/50 mt-6">
                  <label className="block text-xs font-bold text-cyan-500 mb-2 uppercase text-center">Nro. de Comprobante / Transacción</label>
                  <div className="flex space-x-2">
                    <input type="text" placeholder="Ej. 98765432" value={comprobante} onChange={(e) => setComprobante(e.target.value)} className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-400 text-center tracking-widest font-mono" />
                    <button type="button" onClick={verificarTransferencia} disabled={validandoPago} className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold px-4 py-2 rounded-lg text-sm transition-all">{validandoPago ? "..." : "VERIFICAR"}</button>
                  </div>
                </div>
              </div>
            )}

            {formData.adelanto && pagoVerificado && (
              <div className="bg-emerald-950/30 border border-emerald-500 p-6 rounded-xl text-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4"><svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg></div>
                <h4 className="text-emerald-400 font-black text-xl mb-1">PAGO VERIFICADO</h4>
                <p className="text-emerald-100/70 text-sm font-mono">Comprobante #{comprobante}</p>
              </div>
            )}

            <div className="bg-[#030712] p-4 rounded-lg border border-slate-800 mb-6 space-y-2 text-sm text-slate-300">
              <p><span className="text-slate-500 font-mono text-xs">CLIENTE:</span> <br/><span className="font-bold text-white text-base">{formData.nombre}</span></p>
              <div className="flex justify-between border-t border-slate-800 pt-2 mt-2">
                <p><span className="text-slate-500 font-mono text-xs">UBICACIÓN:</span> <br/><span className="text-cyan-400 font-bold">{formData.direccion}</span></p>
                <p className="text-right"><span className="text-slate-500 font-mono text-xs">AGENDADO:</span> <br/><span className="text-cyan-400 font-bold">{formData.fecha} | {formData.hora}</span></p>
              </div>
            </div>

            <div className="flex space-x-4">
              <button onClick={() => { setShowModal(false); setPagoVerificado(false); setComprobante(""); }} className="w-1/3 py-3 rounded-lg border border-slate-700 text-slate-400 font-bold hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center text-xs tracking-widest"><svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg> ATRÁS</button>
              <button onClick={confirmarYGuardar} disabled={isSubmitting || !puedeConfirmar} className={`w-2/3 py-3 rounded-lg font-black tracking-widest transition-all ${!puedeConfirmar ? "bg-slate-800 text-slate-600 cursor-not-allowed" : isSubmitting ? "bg-slate-600 text-slate-400 cursor-wait" : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_20px_rgba(34,211,238,0.5)]"}`}>{!puedeConfirmar ? "REQUIERE PAGO" : isSubmitting ? "PROCESANDO..." : "SÍ, AGENDAR CITA"}</button>
            </div>
          </div>
        </div>
      )}

      {qrZoomed && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl cursor-zoom-out animate-fade-in" onClick={() => setQrZoomed(false)}>
          <button className="absolute top-6 right-6 text-slate-400 hover:text-cyan-400 transition-colors z-[110]" onClick={() => setQrZoomed(false)}><svg className="w-10 h-10 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
          <div className="w-full max-w-3xl max-h-screen p-2 flex flex-col items-center">
             <p className="text-cyan-400 font-mono tracking-widest mb-4 font-bold animate-pulse text-center bg-black/50 px-4 py-2 rounded-full border border-cyan-900">[ MODO DE ESCANEO ACTIVO ]</p>
             <img src="/qr.png" alt="Código QR Ampliado" className="w-full h-auto max-h-[80vh] object-contain rounded-xl drop-shadow-[0_0_40px_rgba(34,211,238,0.2)] border border-cyan-900/50" onError={(e) => { e.currentTarget.src = "https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg"; }} />
          </div>
        </div>
      )}

      <Link href="/admin" className="absolute bottom-6 right-6 z-40 bg-[#0a1120] text-slate-500 hover:text-cyan-400 border border-slate-800 hover:border-cyan-500/50 px-4 py-2 rounded-full font-mono text-xs font-bold tracking-widest flex items-center space-x-2 transition-all hover:shadow-[0_0_15px_rgba(34,211,238,0.2)] group"><svg className="w-3.5 h-3.5 group-hover:animate-pulse" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg><span>SALA NOC</span></Link>
    </main>
  );
}