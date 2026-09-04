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

  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const [fotoProblema, setFotoProblema] = useState<string | null>(null);
  const [fotoComprobante, setFotoComprobante] = useState<string | null>(null);

  const [pagoVerificado, setPagoVerificado] = useState(false);
  const [validandoPago, setValidandoPago] = useState(false);
  const [qrZoomed, setQrZoomed] = useState(false); 
  const [obteniendoUbicacion, setObteniendoUbicacion] = useState(false); 

  const [showSplash, setShowSplash] = useState(true);
  const [showThankYouToast, setShowThankYouToast] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isSplashFading, setIsSplashFading] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) {
      alert("Para instalar en iOS: Presione 'Compartir' y 'Agregar a inicio'. Si ya la tiene, presione 'Versión Web'.");
      return;
    }
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    if (outcome === 'accepted') {
      cerrarSplash();
      setShowThankYouToast(true);
      setTimeout(() => setShowThankYouToast(false), 7000);
    }
    setDeferredPrompt(null);
  };

  const cerrarSplash = () => {
    setIsSplashFading(true);
    setTimeout(() => { setShowSplash(false); }, 800); 
  };

  const handleFotoProblema = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const imgUrl = URL.createObjectURL(e.target.files[0]);
      setFotoProblema(imgUrl);
    }
  };

  const handleFotoComprobante = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setValidandoPago(true);
      const imgUrl = URL.createObjectURL(e.target.files[0]);
      
      setTimeout(() => {
        setFotoComprobante(imgUrl);
        setPagoVerificado(true);
        setValidandoPago(false);
      }, 1500);
    }
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const seleccion = e.target.value; setFormData({ ...formData, fecha: seleccion });
    if (seleccion) {
      const [year, month, day] = seleccion.split('-'); const dateObj = new Date(Number(year), Number(month) - 1, Number(day)); const dayOfWeek = dateObj.getDay(); 
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { setDateError("Atención exclusiva fines de semana. Por favor, seleccione Sábado o Domingo."); } else { setDateError(""); }
    } else { setDateError(""); }
  };

  // === MODIFICADO: VALIDACIÓN ESTRICTA DE NÚMERO DE BOLIVIA ===
  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Solo permite números
    const value = e.target.value.replace(/\D/g, '');
    setFormData({ ...formData, telefono: value });
  };

  const isFormValid = formData.nombre && formData.telefono && formData.telefono.length >= 8 && formData.descripcion && formData.fecha && formData.hora && formData.direccion && !dateError && (!formData.adelanto || (formData.adelanto && formData.montoAdelanto));

  const capturarUbicacion = () => {
    setObteniendoUbicacion(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => { setFormData({ ...formData, coordenadas: `${position.coords.latitude},${position.coords.longitude}` }); setObteniendoUbicacion(false); },
        (error) => { alert("No se pudo obtener la ubicación. Verifique el GPS."); setObteniendoUbicacion(false); }
      );
    } else { alert("GPS no soportado."); setObteniendoUbicacion(false); }
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
        coordenadas: formData.coordenadas, 
        estado: "Pendiente", 
        adelantoRealizado: formData.adelanto, 
        montoAdelanto: formData.adelanto ? formData.montoAdelanto : "0", 
        nroComprobante: formData.adelanto && fotoComprobante ? "FOTO_ADJUNTA" : "N/A", 
        evidenciaProblema: fotoProblema ? "FOTO_ADJUNTA" : "N/A",
        fechaRegistro: new Date().toISOString()
      });
      
      setFormData({ nombre: "", telefono: "", descripcion: "", fecha: "", hora: "", direccion: "", coordenadas: "", adelanto: false, montoAdelanto: "" }); 
      setFotoProblema(null); setFotoComprobante(null); setPagoVerificado(false); 
      setShowModal(false); 
      
      setShowSuccessModal(true);

    } catch (error) { alert("❌ Error de red."); } finally { setIsSubmitting(false); }
  };

  const puedeConfirmar = formData.adelanto ? pagoVerificado : true;

  const enlaceWACorporativo = "https://api.whatsapp.com/send?phone=59174267273&text=Hola%20OmniTech%20Solutions%2C%20vengo%20de%20la%20p%C3%A1gina%20web%20y%20deseo%20iniciar%20la%20coordinaci%C3%B3n%20de%20mi%20soporte%20t%C3%A9cnico.";

  return (
    <main className="min-h-screen bg-[#030712] text-white flex flex-col items-center justify-center p-4 md:p-8 selection:bg-cyan-500 selection:text-black relative overflow-x-hidden">
      
      {/* 1. SPLASH SCREEN */}
      {showSplash && (
        <div className={`fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[#030712] transition-opacity duration-1000 ease-in-out ${isSplashFading ? 'opacity-0' : 'opacity-100'}`}>
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-cyan-900 rounded-full mix-blend-screen filter blur-[150px] opacity-30 animate-pulse"></div>
          
          <div className="relative z-10 flex flex-col items-center p-8 max-w-md w-full text-center">
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
              <button onClick={handleInstallApp} className="w-full py-4 rounded-xl font-black tracking-widest bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-[0_0_30px_rgba(34,211,238,0.4)] hover:shadow-[0_0_40px_rgba(34,211,238,0.6)] transition-all flex items-center justify-center transform hover:-translate-y-1">
                <svg className="w-5 h-5 mr-3 animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                SÍ, INSTALAR APP
              </button>
              <button onClick={cerrarSplash} className="w-full py-3 rounded-xl font-bold tracking-widest text-slate-400 hover:text-white border border-transparent hover:border-slate-800 hover:bg-slate-900/50 transition-all text-xs">
                SOLO ACCEDER A LA VERSIÓN WEB
              </button>
            </div>
          </div>
        </div>
      )}

      {/* INTERFAZ PRINCIPAL DEL SISTEMA */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-cyan-600 rounded-full mix-blend-screen filter blur-[120px] opacity-20 pointer-events-none"></div>
      <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-blue-700 rounded-full mix-blend-screen filter blur-[120px] opacity-20 pointer-events-none"></div>

      <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center z-10 my-auto">
        
        <div className="space-y-8 flex flex-col items-center lg:items-start text-center lg:text-left">
          <div className="w-32 h-32 relative drop-shadow-[0_0_15px_rgba(34,211,238,0.5)] transform transition hover:scale-105">
             <img src="/logo.png" alt="OmniTech Logo" className="w-full h-full object-contain" />
          </div>
          <div className="space-y-2">
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-indigo-500 drop-shadow-[0_0_10px_rgba(34,211,238,0.3)]">
              OmniTech<span className="block text-3xl md:text-4xl text-white mt-1">Solutions</span>
            </h1>
            <p className="text-cyan-100/60 font-light text-lg max-w-md">Soporte IT Premium y Mantenimiento Avanzado.</p>
            
            {/* === MODIFICADO: DOBLE ETIQUETA === */}
            <div className="flex flex-col items-center lg:items-start mt-4 space-y-3">
              <div className="inline-flex items-center bg-cyan-950/30 border border-cyan-800/50 px-4 py-2 rounded-full">
                <svg className="w-4 h-4 text-cyan-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                <span className="text-xs font-bold tracking-widest text-cyan-400">COBERTURA: LA PAZ Y EL ALTO</span>
              </div>
              <div className="inline-flex items-center bg-purple-950/30 border border-purple-800/50 px-4 py-2 rounded-full">
                <svg className="w-4 h-4 text-purple-400 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                <span className="text-xs font-bold tracking-widest text-purple-400">CITAS TÉCNICAS SOLO FINES DE SEMANA</span>
              </div>
            </div>
            
            <a href={enlaceWACorporativo} target="_blank" rel="noopener noreferrer" className="mt-8 flex items-center justify-center bg-green-900/30 hover:bg-green-600 text-green-400 hover:text-white border border-green-500/50 px-6 py-3 rounded-xl font-bold tracking-widest transition-all shadow-[0_0_15px_rgba(34,197,94,0.2)] hover:shadow-[0_0_25px_rgba(34,197,94,0.4)] transform hover:-translate-y-1 w-max mx-auto lg:mx-0">
              <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
              COMUNÍCATE CON OMNITECH
            </a>
          </div>
        </div>

        <div className="bg-[#0a1120]/80 p-8 md:p-10 rounded-3xl border border-cyan-500/40 backdrop-blur-xl shadow-[0_0_40px_rgba(6,182,212,0.2)] relative mb-12 lg:mb-0">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_20px_rgba(34,211,238,0.8)]"></div>
          <h2 className="text-3xl font-bold mb-1 text-white drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">Solicitar Diagnóstico</h2>
          <p className="text-cyan-400 mb-6 text-sm font-bold tracking-widest drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]">ATENCIÓN FINES DE SEMANA</p>
          
          <form className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div><label className="block text-xs font-semibold text-cyan-500/80 mb-1 uppercase tracking-wider">Nombre Completo</label><input type="text" value={formData.nombre} onChange={(e) => setFormData({...formData, nombre: e.target.value})} className="w-full bg-[#030712] border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition-all" /></div>
              
              {/* === MODIFICADO: VALIDACIÓN ESTRICTA DE NÚMERO Y CÓDIGO BOLIVIA === */}
              <div>
                <label className="block text-xs font-semibold text-cyan-500/80 mb-1 uppercase tracking-wider">Nro. WhatsApp</label>
                <div className="flex">
                  <span className="inline-flex items-center px-3 text-sm text-slate-400 bg-slate-900 border border-r-0 border-slate-800 rounded-l-md font-mono font-bold">
                    +591
                  </span>
                  <input type="tel" placeholder="Ej. 70000000" maxLength={8} value={formData.telefono} onChange={handlePhoneChange} className="w-full bg-[#030712] border border-slate-800 rounded-r-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition-all font-mono" />
                </div>
              </div>

            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* === MODIFICADO: ETIQUETA DE FECHA === */}
              <div><label className="block text-[10px] sm:text-[11px] font-semibold text-cyan-500/80 mb-1 uppercase tracking-wider">FECHA PARA LA CITA TÉCNICA SOLO FINES DE SEMANA</label><input type="date" value={formData.fecha} onChange={handleDateChange} className={`w-full bg-[#030712] border ${dateError ? 'border-red-500' : 'border-slate-800'} rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition-all [&::-webkit-calendar-picker-indicator]:invert`} /></div>
              <div><label className="block text-[10px] sm:text-[11px] font-semibold text-cyan-500/80 mb-1 uppercase tracking-wider">Hora</label><input type="time" min="08:00" max="20:00" value={formData.hora} onChange={(e) => setFormData({...formData, hora: e.target.value})} className="w-full bg-[#030712] border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition-all [&::-webkit-calendar-picker-indicator]:invert" /></div>
            </div>

            <div className="bg-[#030712] p-4 rounded-lg border border-slate-800 space-y-3">
              <label className="block text-xs font-semibold text-cyan-500/80 uppercase tracking-wider">Lugar de Intervención (La Paz / El Alto)</label>
              <input type="text" placeholder="Dirección, Zona o Referencia detallada..." value={formData.direccion} onChange={(e) => setFormData({...formData, direccion: e.target.value})} className="w-full bg-[#0a1120] border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 transition-all" />
              <button type="button" onClick={capturarUbicacion} disabled={obteniendoUbicacion || formData.coordenadas !== ""} className={`w-full px-4 py-2 rounded text-xs font-bold tracking-widest flex items-center justify-center transition-all ${formData.coordenadas ? "bg-green-950/50 border border-green-500 text-green-400 cursor-default" : "bg-cyan-950/50 border border-cyan-700 hover:bg-cyan-900 text-cyan-400"}`}>
                {obteniendoUbicacion ? <span className="animate-pulse">RASTREANDO SEÑAL...</span> : formData.coordenadas ? <> <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> GPS GUARDADO</> : <> <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> ENVIAR RASTREO GPS</>}
              </button>
            </div>
            
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-cyan-500/80 uppercase tracking-wider">Descripción de la Falla</label>
              <textarea rows={2} value={formData.descripcion} onChange={(e) => setFormData({...formData, descripcion: e.target.value})} className="w-full bg-[#030712] border border-slate-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 resize-none"></textarea>
              
              <div className="relative w-full border-2 border-dashed border-slate-700 hover:border-cyan-500/50 bg-[#030712] rounded-lg p-4 text-center transition-all cursor-pointer group overflow-hidden">
                <input type="file" accept="image/*" onChange={handleFotoProblema} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                {fotoProblema ? (
                  <div className="flex flex-col items-center space-y-2">
                    <img src={fotoProblema} alt="Problema" className="h-16 rounded object-cover border border-cyan-500/50" />
                    <span className="text-cyan-400 text-[10px] font-bold tracking-widest">IMAGEN CARGADA • CAMBIAR</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-1 opacity-70 group-hover:opacity-100 transition-opacity">
                    <svg className="w-6 h-6 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                    <span className="text-slate-400 text-[10px] font-bold tracking-widest">ADJUNTAR FOTO DEL PROBLEMA (OPCIONAL)</span>
                  </div>
                )}
              </div>
            </div>

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

      {/* MODAL DE PASARELA DE PAGO / CONFIRMACIÓN */}
      {showModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-[#030712]/95 backdrop-blur-xl overflow-y-auto">
          <div className="bg-[#0a1120] border border-cyan-500/50 p-6 md:p-8 rounded-2xl max-w-lg w-full shadow-[0_0_80px_rgba(34,211,238,0.2)] my-8 relative">
            <h3 className="text-2xl font-black text-white mb-4 text-center tracking-widest border-b border-slate-800 pb-4">{formData.adelanto ? "PASARELA DE PAGO" : "CONFIRMACIÓN DE CITA"}</h3>
            
            {formData.adelanto && !pagoVerificado && (
              <div className="mb-6 animate-fade-in-up">
                <p className="text-center text-cyan-400 text-sm font-bold tracking-widest mb-4">ESCANEE PARA DEPOSITAR {formData.montoAdelanto} Bs.</p>
                <div className="relative w-48 h-56 mx-auto mb-6 transform hover:scale-105 transition-all duration-300 cursor-pointer group" onClick={() => setQrZoomed(true)}>
                  <div className="absolute inset-0 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-2xl p-1 shadow-[0_0_40px_rgba(34,211,238,0.4)]">
                    <div className="w-full h-full bg-[#0a1120] rounded-xl overflow-hidden p-1 relative">
                      <img src="/qr.png" alt="Código QR" className="w-full h-full object-contain" onError={(e) => { e.currentTarget.src = "https://upload.wikimedia.org/wikipedia/commons/d/d0/QR_code_for_mobile_English_Wikipedia.svg"; }} />
                    </div>
                  </div>
                </div>
                
                <div className="bg-[#030712] p-4 rounded-xl border border-cyan-900/50 text-center relative overflow-hidden group">
                  {validandoPago ? (
                    <div className="py-2 text-cyan-400 font-mono text-xs font-bold animate-pulse">
                      [ VERIFICANDO HASH DEL COMPROBANTE... ]
                    </div>
                  ) : (
                    <>
                      <input type="file" accept="image/*" onChange={handleFotoComprobante} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                      <div className="flex flex-col items-center justify-center py-2 transition-transform group-hover:scale-105">
                        <svg className="w-8 h-8 text-cyan-500 mb-2 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                        <span className="text-white text-xs font-black tracking-widest bg-cyan-600 px-4 py-2 rounded shadow-[0_0_15px_rgba(34,211,238,0.4)]">SUBIR CAPTURA DEL DEPÓSITO</span>
                        <span className="text-slate-500 text-[9px] mt-2 font-mono uppercase">*Obligatorio para verificar la transacción*</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            )}

            {formData.adelanto && pagoVerificado && fotoComprobante && (
              <div className="bg-emerald-950/30 border border-emerald-500 p-6 rounded-xl text-center mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)] animate-fade-in-up">
                <div className="w-16 h-16 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_20px_rgba(16,185,129,0.5)]"><svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg></div>
                <h4 className="text-emerald-400 font-black text-xl mb-2 tracking-widest">PAGO VERIFICADO</h4>
                <div className="w-full flex justify-center mt-3">
                  <img src={fotoComprobante} alt="Comprobante" className="h-20 rounded border border-emerald-500/50 object-cover" />
                </div>
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
              <button onClick={() => { setShowModal(false); setPagoVerificado(false); setFotoComprobante(null); }} className="w-1/3 py-3 rounded-lg border border-slate-700 text-slate-400 font-bold hover:bg-slate-800 hover:text-white transition-all flex items-center justify-center text-xs tracking-widest">ATRÁS</button>
              
              <button onClick={confirmarYGuardar} disabled={isSubmitting || !puedeConfirmar} className={`w-2/3 py-3 rounded-lg font-black tracking-widest transition-all flex items-center justify-center ${!puedeConfirmar ? "bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700" : isSubmitting ? "bg-slate-600 text-slate-400 cursor-wait" : "bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_20px_rgba(34,211,238,0.5)]"}`}>
                {!puedeConfirmar ? (
                  <>
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>
                    ESPERANDO PAGO
                  </>
                ) : isSubmitting ? "PROCESANDO..." : "SÍ, AGENDAR CITA"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EMBUDO DE ÉXITO DE WHATSAPP */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4 bg-[#030712]/95 backdrop-blur-xl animate-fade-in-up">
          <div className="bg-[#0a1120] border border-green-500/50 p-8 rounded-3xl max-w-md w-full shadow-[0_0_80px_rgba(34,197,94,0.2)] text-center relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-2 bg-gradient-to-r from-transparent via-green-500 to-transparent shadow-[0_0_30px_rgba(34,197,94,1)]"></div>
            
            <div className="w-20 h-20 bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-6 border border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.4)] animate-pulse">
              <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
            </div>
            
            <h3 className="text-3xl font-black text-white mb-2 tracking-widest uppercase">¡CITA REGISTRADA!</h3>
            <p className="text-slate-300 mb-8 text-sm leading-relaxed">Paso final: Haz clic abajo para iniciar la coordinación técnica de tu servicio en nuestro canal oficial.</p>
            
            <a href={enlaceWACorporativo} target="_blank" rel="noopener noreferrer" onClick={() => setShowSuccessModal(false)} className="w-full bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white font-black text-lg py-5 rounded-xl transition-all shadow-[0_0_30px_rgba(34,197,94,0.5)] hover:shadow-[0_0_50px_rgba(34,197,94,0.8)] flex items-center justify-center transform hover:-translate-y-1">
              <svg className="w-7 h-7 mr-3" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/></svg>
              COORDINAR POR WHATSAPP
            </a>
            
            <button onClick={() => setShowSuccessModal(false)} className="mt-6 text-slate-500 hover:text-slate-300 text-xs font-bold tracking-widest border-b border-transparent hover:border-slate-500 transition-all pb-1">
              CERRAR Y VOLVER AL INICIO
            </button>
          </div>
        </div>
      )}

      {qrZoomed && (
        <div className="fixed inset-0 z-[400] flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl cursor-zoom-out animate-fade-in" onClick={() => setQrZoomed(false)}>
          <button className="absolute top-6 right-6 text-slate-400 hover:text-cyan-400 transition-colors z-[110]" onClick={() => setQrZoomed(false)}><svg className="w-10 h-10 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
          <div className="w-full max-w-3xl max-h-screen p-2 flex flex-col items-center">
             <img src="/qr.png" alt="Código QR Ampliado" className="w-full h-auto max-h-[80vh] object-contain rounded-xl drop-shadow-[0_0_40px_rgba(34,211,238,0.2)] border border-cyan-900/50" />
          </div>
        </div>
      )}

      <Link href="/admin" className="absolute bottom-6 right-6 z-40 bg-[#0a1120] text-slate-500 hover:text-cyan-400 border border-slate-800 hover:border-cyan-500/50 px-4 py-2 rounded-full font-mono text-xs font-bold tracking-widest flex items-center space-x-2 transition-all hover:shadow-[0_0_15px_rgba(34,211,238,0.2)]"><svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg><span>SALA NOC</span></Link>
    </main>
  );
}