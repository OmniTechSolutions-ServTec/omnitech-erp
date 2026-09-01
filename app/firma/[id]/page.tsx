"use client";
import { useEffect, useState, use } from "react";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from "../../../firebase"; 
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function PortalCliente({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  
  const [cita, setCita] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [firmando, setFirmando] = useState(false);

  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comentario, setComentario] = useState("");

  useEffect(() => {
    const fetchCita = async () => {
      try {
        const docRef = doc(db, "citas", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCita({ id: docSnap.id, ...docSnap.data() });
          if (docSnap.data().calificacion) setRating(docSnap.data().calificacion);
          if (docSnap.data().comentarioCliente) setComentario(docSnap.data().comentarioCliente);
        } else { setError(true); }
      } catch (err) { setError(true); } 
      finally { setLoading(false); }
    };
    if (id) fetchCita();
  }, [id]);

  const firmarDocumento = async () => {
    if (rating === 0) { alert("Por favor, seleccione una calificación de 1 a 5 estrellas."); return; }
    setFirmando(true);
    try {
      const fechaActual = new Date().toISOString();
      await updateDoc(doc(db, "citas", id), {
        conformidadDigital: "Firmado", fechaFirma: fechaActual, calificacion: rating, comentarioCliente: comentario
      });
      setCita({ ...cita, conformidadDigital: "Firmado", fechaFirma: fechaActual, calificacion: rating, comentarioCliente: comentario });
    } catch (error) { alert("Error de red. Intente nuevamente."); } 
    finally { setFirmando(false); }
  };

  // ==========================================================
  // MOTOR DE AUTODESCARGA PDF (Para el Cliente)
  // ==========================================================
  const descargarComprobanteOficial = () => {
    const doc = new jsPDF();
    const costoFinalNum = parseFloat(cita.costoFinal || "0"); const adelantoNum = parseFloat(cita.montoAdelanto || "0"); const saldoFinal = costoFinalNum - adelantoNum;
    
    doc.setFillColor(10, 17, 32); doc.rect(0, 0, 210, 45, 'F');
    doc.setTextColor(34, 211, 238); doc.setFontSize(22); doc.setFont("helvetica", "black"); doc.text("OMNITECH SOLUTIONS", 105, 20, { align: "center" });
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text("COMPROBANTE OFICIAL DE GARANTÍA", 105, 28, { align: "center" });
    doc.setFontSize(8); doc.setTextColor(148, 163, 184); doc.text(`HASH DE OPERACIÓN: CLOSE-${cita.id.substring(0,6).toUpperCase()} | FECHA: ${new Date(cita.fechaCierre).toLocaleDateString()}`, 105, 36, { align: "center" });
    
    doc.setTextColor(0, 0, 0); doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text(`CLIENTE: ${cita.nombre}`, 14, 55); 
    autoTable(doc, { startY: 65, headStyles: { fillColor: [16, 185, 129], textColor: [0, 0, 0], fontStyle: 'bold' }, head: [['TRABAJO TÉCNICO REALIZADO']], body: [[cita.trabajoFinal]], theme: 'grid' });
    
    const finalY = (doc as any).lastAutoTable.finalY + 15; 
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("LIQUIDACIÓN FINANCIERA", 14, finalY); doc.setFontSize(10); doc.setFont("helvetica", "normal");
    doc.text(`Costo Total del Servicio:`, 14, finalY + 8); doc.text(`${costoFinalNum.toFixed(2)} Bs.`, 80, finalY + 8); 
    doc.text(`Adelanto Registrado:`, 14, finalY + 15); doc.text(`- ${adelantoNum.toFixed(2)} Bs.`, 80, finalY + 15);
    doc.setFont("helvetica", "bold"); doc.text(`TOTAL PAGADO:`, 14, finalY + 25); doc.setFontSize(14); doc.setTextColor(16, 185, 129); doc.text(`${saldoFinal > 0 ? saldoFinal.toFixed(2) : "0.00"} Bs.`, 80, finalY + 25);
    
    doc.setTextColor(0, 0, 0);
    doc.setFillColor(240, 248, 255); doc.rect(14, finalY + 40, 182, 25, 'F'); doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text("VALIDACIÓN DE CONFORMIDAD DIGITAL", 105, finalY + 47, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.text(`El cliente certificó su conformidad el día ${new Date(cita.fechaFirma).toLocaleString()}`, 105, finalY + 54, { align: "center" });
    doc.text(`Calificación otorgada: ${cita.calificacion} de 5 Estrellas.`, 105, finalY + 59, { align: "center" });
    
    doc.setDrawColor(100); doc.line(120, 260, 190, 260); doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.text("Miguel Angel Cuenca", 155, 265, { align: "center" }); doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.text("Firma Autorizada", 155, 270, { align: "center" });
    doc.save(`OmniTech_Comprobante_${cita.nombre.replace(/\s+/g, '_')}.pdf`);
  };

  if (loading) return <div className="min-h-screen bg-[#030712] flex items-center justify-center"><div className="text-cyan-500 flex flex-col items-center"><div className="w-12 h-12 border-4 border-cyan-900 border-t-cyan-400 rounded-full animate-spin mb-4"></div><p className="font-mono tracking-widest text-sm animate-pulse">CARGANDO PORTAL...</p></div></div>;
  if (error || !cita) return <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4"><div className="bg-red-950/30 border border-red-900 p-8 rounded-2xl max-w-md w-full text-center shadow-[0_0_30px_rgba(220,38,38,0.2)] animate-fade-in-up"><h2 className="text-red-400 font-black text-xl tracking-widest mb-2">REGISTRO NO ENCONTRADO</h2><p className="text-slate-400 text-sm">El enlace proporcionado es inválido.</p></div></div>;

  const costoFinalNum = parseFloat(cita.costoFinal || "0"); const adelantoNum = parseFloat(cita.montoAdelanto || "0"); const saldoFinal = costoFinalNum - adelantoNum;

  return (
    <main className="min-h-screen bg-[#030712] text-white flex items-center justify-center p-4 selection:bg-cyan-500 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-lg h-96 bg-cyan-900 rounded-full mix-blend-screen filter blur-[150px] opacity-20 pointer-events-none"></div>

      <div className="bg-[#0a1120]/90 border border-cyan-900/50 p-6 md:p-8 rounded-3xl max-w-md w-full shadow-[0_0_50px_rgba(34,211,238,0.1)] relative z-10 backdrop-blur-xl animate-fade-in-up">
        
        <div className="text-center mb-6 border-b border-slate-800 pb-6">
          <div className="w-16 h-16 mx-auto mb-3 relative drop-shadow-[0_0_10px_rgba(34,211,238,0.4)]"><img src="/logo.png" alt="OmniTech" className="w-full h-full object-contain" /></div>
          <h1 className="text-2xl font-black tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">OMNITECH</h1>
          <p className="text-slate-400 text-[10px] font-mono tracking-widest mt-1">PORTAL WEB DEL CLIENTE</p>
        </div>

        {/* ==================================================== */}
        {/* RADAR DE TRAZABILIDAD (NUEVO) */}
        {/* ==================================================== */}
        <div className="mb-8">
          <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-3 text-center">Estado del Equipo</p>
          <div className="flex items-center justify-between relative">
            <div className="absolute top-1/2 left-0 w-full h-1 bg-slate-800 -translate-y-1/2 z-0"></div>
            
            {/* Paso 1: Ingresado */}
            <div className="relative z-10 flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-cyan-600 flex items-center justify-center border-4 border-[#0a1120] shadow-[0_0_10px_rgba(34,211,238,0.5)]">
                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
              </div>
              <p className="text-[9px] font-bold text-cyan-400 mt-2">RECIBIDO</p>
            </div>

            {/* Paso 2: En Reparación */}
            <div className="relative z-10 flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-[#0a1120] transition-colors ${cita.estado === "En Reparación" || cita.estado === "Completado" ? "bg-cyan-600 shadow-[0_0_10px_rgba(34,211,238,0.5)]" : "bg-slate-800"}`}>
                {cita.estado === "En Reparación" || cita.estado === "Completado" ? <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg> : <span className="text-slate-500 text-xs font-bold">2</span>}
              </div>
              <p className={`text-[9px] font-bold mt-2 ${cita.estado === "En Reparación" || cita.estado === "Completado" ? "text-cyan-400" : "text-slate-600"}`}>TALLER</p>
            </div>

            {/* Paso 3: Listo */}
            <div className="relative z-10 flex flex-col items-center">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center border-4 border-[#0a1120] transition-colors ${cita.estado === "Completado" ? "bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" : "bg-slate-800"}`}>
                {cita.estado === "Completado" ? <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg> : <span className="text-slate-500 text-xs font-bold">3</span>}
              </div>
              <p className={`text-[9px] font-bold mt-2 ${cita.estado === "Completado" ? "text-emerald-400" : "text-slate-600"}`}>COMPLETADO</p>
            </div>
          </div>
        </div>

        {/* Si aún no está completado, mostramos el mensaje de espera */}
        {cita.estado !== "Completado" ? (
          <div className="bg-[#030712] p-6 rounded-2xl border border-cyan-900/50 text-center animate-pulse">
            <svg className="w-12 h-12 text-cyan-500/50 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
            <h3 className="text-cyan-400 font-bold tracking-widest text-sm mb-1">EQUIPO EN PROCESO</h3>
            <p className="text-slate-400 text-xs">Su equipo está siendo atendido por nuestros especialistas. Guarde este enlace para hacer seguimiento.</p>
          </div>
        ) : (
          /* Si está completado, habilitamos el módulo financiero y firma */
          <div className="animate-fade-in-up">
            <div className="space-y-4 mb-6">
              <div className="bg-[#030712] p-4 rounded-xl border border-slate-800">
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-1">Trabajo Realizado</p>
                <p className="text-slate-300 text-sm leading-relaxed">{cita.trabajoFinal}</p>
              </div>

              <div className="bg-[#030712] p-4 rounded-xl border border-slate-800">
                <p className="text-slate-500 text-[10px] uppercase font-bold tracking-widest mb-3">Liquidación Financiera</p>
                <div className="flex justify-between text-sm mb-1"><span className="text-slate-400">Costo Total:</span><span className="text-white">{costoFinalNum.toFixed(2)} Bs.</span></div>
                <div className="flex justify-between text-sm mb-3 pb-3 border-b border-slate-800"><span className="text-slate-400">Adelanto:</span><span className="text-emerald-400">- {adelantoNum.toFixed(2)} Bs.</span></div>
                <div className="flex justify-between items-center"><span className="font-bold text-cyan-500 tracking-widest">SALDO A PAGAR:</span><span className="text-xl font-black text-white">{saldoFinal > 0 ? saldoFinal.toFixed(2) : "0.00"} Bs.</span></div>
              </div>
            </div>

            {/* FIRMA Y DESCARGA */}
            {cita.conformidadDigital === "Firmado" ? (
              <div className="bg-emerald-950/20 border border-emerald-900/50 p-6 rounded-2xl text-center shadow-[0_0_30px_rgba(16,185,129,0.1)] animate-fade-in">
                <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-3 border border-emerald-500"><svg className="w-8 h-8 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg></div>
                <h3 className="text-emerald-400 font-black tracking-widest mb-1">FIRMA REGISTRADA</h3>
                
                {/* BOTÓN DE AUTODESCARGA PDF */}
                <button 
                  onClick={descargarComprobanteOficial}
                  className="mt-6 w-full py-4 rounded-xl font-black tracking-widest bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_20px_rgba(34,211,238,0.4)] transition-all flex items-center justify-center group"
                >
                  <svg className="w-5 h-5 mr-2 group-hover:animate-bounce" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                  DESCARGAR COMPROBANTE (PDF)
                </button>
              </div>
            ) : (
              <div className="bg-[#030712] p-5 rounded-2xl border border-cyan-900/50">
                <h4 className="text-center text-cyan-400 text-xs font-bold tracking-widest mb-3">¿CÓMO CALIFICA NUESTRO SERVICIO?</h4>
                <div className="flex justify-center space-x-2 mb-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button key={star} type="button" onClick={() => setRating(star)} onMouseEnter={() => setHoverRating(star)} onMouseLeave={() => setHoverRating(0)} className="transition-transform hover:scale-110 focus:outline-none">
                      <svg className={`w-8 h-8 transition-colors duration-200 ${(hoverRating || rating) >= star ? "text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.8)]" : "text-slate-700"}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                    </button>
                  ))}
                </div>
                <div className="mb-4"><textarea rows={2} placeholder="Comentario opcional..." value={comentario} onChange={(e) => setComentario(e.target.value)} className="w-full bg-[#0a1120] border border-slate-700 rounded-lg p-3 text-white text-xs focus:outline-none focus:border-cyan-400 resize-none transition-colors"></textarea></div>
                <button onClick={firmarDocumento} disabled={firmando || rating === 0} className={`w-full py-4 rounded-xl font-black tracking-widest transition-all flex items-center justify-center ${firmando || rating === 0 ? "bg-slate-800 text-slate-500 cursor-not-allowed" : "bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-[0_0_20px_rgba(34,211,238,0.4)]"}`}>
                  {firmando ? "ENCRIPTANDO DATOS..." : "ACEPTAR Y FIRMAR"}
                </button>
              </div>
            )}
          </div>
        )}

      </div>
    </main>
  );
}