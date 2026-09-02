"use client";
import { useEffect, useState } from "react";
import Link from "next/link"; 
import { collection, query, orderBy, onSnapshot, doc, updateDoc, addDoc } from "firebase/firestore";
import { signInWithEmailAndPassword, onAuthStateChanged, signOut } from "firebase/auth";
import { db, auth } from "../../firebase"; 
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // === SEGURIDAD MAESTRA ===
  const ADMIN_EMAIL = "omnitech.servtec@gmail.com"; 
  const isAdmin = user?.email === ADMIN_EMAIL;

  const [citas, setCitas] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]); 
  const [evaluaciones, setEvaluaciones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState("monitoreo"); 
  const [searchTerm, setSearchTerm] = useState(""); 
  const [copiedId, setCopiedId] = useState("");

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [citaActiva, setCitaActiva] = useState<any>(null);
  const [cierreData, setCierreData] = useState({ 
    trabajoRealizado: "", 
    costoTotal: "", 
    modalidad: "Laboratorio" 
  });
  const [guardandoCierre, setGuardandoCierre] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => { 
      setUser(currentUser); 
      setAuthChecking(false); 
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    let timeoutId: NodeJS.Timeout;
    const tiempoMaximoInactividad = 15 * 60 * 1000;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => { signOut(auth); }, tiempoMaximoInactividad);
    };

    const eventos = ['mousemove', 'keydown', 'mousedown', 'touchstart'];
    eventos.forEach(evento => window.addEventListener(evento, resetTimer));
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      eventos.forEach(evento => window.removeEventListener(evento, resetTimer));
    };
  }, [user]);

  useEffect(() => {
    if (!user) return; 
    const q = query(collection(db, "citas"), orderBy("fechaRegistro", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const citasData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCitas(citasData); 
      setLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    const qLogs = query(collection(db, "logs_auditoria"), orderBy("fecha", "desc"));
    const unsubscribeLogs = onSnapshot(qLogs, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogs(logsData);
    });

    const qEval = query(collection(db, "evaluaciones_tecnicas"), orderBy("fechaEvaluacion", "desc"));
    const unsubscribeEval = onSnapshot(qEval, (snapshot) => {
      const evalData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEvaluaciones(evalData);
    });

    return () => {
      unsubscribeLogs();
      unsubscribeEval();
    };
  }, [user, isAdmin]);

  const registrarAuditoria = async (accion: string) => {
    try { 
      await addDoc(collection(db, "logs_auditoria"), { accion: accion, usuario: user.email, fecha: new Date().toISOString() }); 
    } catch (error) { console.error("Error al registrar log", error); }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault(); setIsLoggingIn(true); setLoginError("");
    try { await signInWithEmailAndPassword(auth, email, password); } 
    catch (error) { setLoginError("Acceso Denegado. Credenciales incorrectas."); } 
    finally { setIsLoggingIn(false); }
  };
  const handleLogout = async () => { await signOut(auth); };

  const generarEnlaceWA = (cita: any) => {
    const num = cita.telefono.replace(/\D/g, ''); 
    const prefijo = num.length === 8 ? '591' : '';
    let texto = "";
    if (cita.estado === "Completado") {
      if (cita.modalidad === "En Domicilio") { 
        texto = `Hola ${cita.nombre}, el trabajo técnico ha concluido. Por favor firme su conformidad y califique nuestro servicio aquí:\n👉 ${window.location.origin}/firma/${cita.id}`; 
      } else { 
        texto = `Hola ${cita.nombre}, su equipo está listo en nuestro Centro de Operaciones. Ya puede pasar a recogerlo.`; 
      }
    } else { 
      texto = `Hola ${cita.nombre}, nos comunicamos de OmniTech Solutions respecto a su solicitud técnica.`; 
    }
    return `https://wa.me/${prefijo}${num}?text=${encodeURIComponent(texto)}`;
  };

  const handleEstadoChange = async (cita: any, nuevoEstado: string) => {
    if (nuevoEstado === "Completado") { 
      setCitaActiva(cita); setShowCloseModal(true); 
    } else { 
      try { 
        await updateDoc(doc(db, "citas", cita.id), { estado: nuevoEstado }); 
        registrarAuditoria(`Cambió estado del ticket [${cita.nombre}] a: ${nuevoEstado}`);
      } catch (error) { alert("Error al actualizar estado."); } 
    }
  };

  const confirmarCierre = async () => {
    if (!cierreData.trabajoRealizado || !cierreData.costoTotal) { 
      alert("Complete los datos."); return; 
    }
    setGuardandoCierre(true);
    try {
      await updateDoc(doc(db, "citas", citaActiva.id), { 
        estado: "Completado", 
        trabajoFinal: cierreData.trabajoRealizado, 
        costoFinal: cierreData.costoTotal, 
        modalidad: cierreData.modalidad, 
        conformidadDigital: cierreData.modalidad === "En Domicilio" ? "Pendiente" : "N/A", 
        fechaCierre: new Date().toISOString()
      });
      registrarAuditoria(`Cerró ticket [${citaActiva.nombre}] por ${cierreData.costoTotal} Bs. Mod: ${cierreData.modalidad}`);
      setShowCloseModal(false); 
      setCierreData({ trabajoRealizado: "", costoTotal: "", modalidad: "Laboratorio" }); 
      setCitaActiva(null);
    } catch (error) { alert("Error."); } finally { setGuardandoCierre(false); }
  };

  const copiarID = (id: string) => { 
    navigator.clipboard.writeText(id); 
    setCopiedId(id); 
    setTimeout(() => setCopiedId(""), 2000); 
  };

  const exportarCSV = () => {
    const encabezados = ["ID_Ticket", "Fecha_Cita", "Cliente", "Telefono", "Estado", "Modalidad", "Costo_Total", "Calificacion", "Comentario"];
    const filas = citas.map(c => [
      c.id, c.fecha, `"${c.nombre}"`, c.telefono, c.estado, c.modalidad || "N/A", c.costoFinal || "0", c.calificacion || "N/A", `"${(c.comentarioCliente || "").replace(/"/g, '""')}"`
    ]);
    const contenidoCSV = [encabezados.join(","), ...filas.map(f => f.join(","))].join("\n");
    const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a"); link.href = url; link.setAttribute("download", `OmniTech_Reporte_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  // ==========================================================
  // GENERADORES DE PDF FUTURISTAS Y LIMPIEZA DE DATOS
  // ==========================================================

  // Limpia el @lid, @c.us y formatea el número
  const sanitizarTelefono = (tel: string) => {
    if (!tel) return "No registrado";
    let limpio = tel.replace(/@lid|@c\.us/g, ''); // Borra las etiquetas de WhatsApp
    const soloNumeros = limpio.replace(/[^0-9+]/g, '');
    return soloNumeros.length > 8 && !soloNumeros.startsWith('+591') ? `+591 ${soloNumeros.replace('591', '')}` : soloNumeros;
  };

  // Motor QR Nativo en Base64
  const generarQRBase64 = async (texto: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        if(ctx) ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(""); 
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(texto)}&margin=1`;
    });
  };

  const generarPDFIngreso = async (cita: any) => {
    const doc = new jsPDF();
    const telLimpio = sanitizarTelefono(cita.telefono);

    // 1. CABECERA FUTURISTA (DARK MODE NOC)
    doc.setFillColor(8, 15, 30); // Color Fondo Cyberpunk
    doc.rect(0, 0, 210, 48, 'F');
    doc.setFillColor(34, 211, 238); // Línea Cian Neón
    doc.rect(0, 48, 210, 2, 'F');

    doc.setTextColor(34, 211, 238);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("OMNITECH SOLUTIONS", 105, 22, { align: "center" });

    doc.setTextColor(200, 200, 200);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("SISTEMA DE DESPLIEGUE Y TELEMÁTICA", 105, 29, { align: "center", letterSpacing: 1 });

    // ID Badge Central
    doc.setFillColor(15, 23, 42); 
    doc.setDrawColor(34, 211, 238);
    doc.setLineWidth(0.4);
    doc.roundedRect(65, 35, 80, 8, 1.5, 1.5, 'FD');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text(`TICKET NOC: ${cita.id.toUpperCase()}`, 105, 40.5, { align: "center" });

    // 2. MÓDULOS DE INFORMACIÓN (Tarjetas de Panel de Control)
    doc.setDrawColor(34, 211, 238);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(14, 60, 88, 35, 2, 2, 'S'); // Borde
    doc.setFillColor(15, 23, 42); 
    doc.roundedRect(14, 60, 88, 8, 2, 2, 'F'); // Cabecera de Tarjeta
    doc.setTextColor(34, 211, 238); doc.setFontSize(9);
    doc.text("IDENTIFICACIÓN DEL SOLICITANTE", 18, 65.5);
    
    doc.setTextColor(0, 0, 0); doc.setFontSize(9);
    doc.setFont("helvetica", "bold"); doc.text("Nombre:", 18, 75); doc.setFont("helvetica", "normal"); doc.text(cita.nombre, 45, 75);
    doc.setFont("helvetica", "bold"); doc.text("Contacto:", 18, 82); doc.setFont("helvetica", "normal"); doc.text(telLimpio, 45, 82);
    doc.setFont("helvetica", "bold"); doc.text("Ubicación:", 18, 89); 
    let dirBreve = cita.direccion || "No especificada";
    if (dirBreve.length > 25) dirBreve = dirBreve.substring(0, 25) + "...";
    doc.setFont("helvetica", "normal"); doc.text(dirBreve, 45, 89);

    // Módulo Operativo
    doc.setDrawColor(34, 211, 238);
    doc.setFillColor(250, 250, 250);
    doc.roundedRect(108, 60, 88, 35, 2, 2, 'S');
    doc.setFillColor(15, 23, 42); 
    doc.roundedRect(108, 60, 88, 8, 2, 2, 'F'); 
    doc.setTextColor(34, 211, 238); doc.setFontSize(9);
    doc.setFont("helvetica", "bold"); doc.text("PARÁMETROS DEL SISTEMA", 112, 65.5);
    
    doc.setTextColor(0, 0, 0); doc.setFontSize(9);
    doc.setFont("helvetica", "bold"); doc.text("Fecha Asignada:", 112, 75); doc.setFont("helvetica", "normal"); doc.text(cita.fecha, 148, 75);
    doc.setFont("helvetica", "bold"); doc.text("Hora de Enlace:", 112, 82); doc.setFont("helvetica", "normal"); doc.text(cita.hora, 148, 82);
    doc.setFont("helvetica", "bold"); doc.text("Estado Actual:", 112, 89); 
    doc.setTextColor(220, 38, 38); doc.setFont("helvetica", "bold"); doc.text(cita.estado.toUpperCase(), 148, 89);

    // 3. TABLA DE DIAGNÓSTICO ESTILIZADA
    autoTable(doc, { 
      startY: 105, 
      headStyles: { fillColor: [8, 15, 30], textColor: [34, 211, 238], fontStyle: 'bold', fontSize: 10 }, 
      bodyStyles: { fillColor: [250, 252, 255], textColor: [10, 10, 10], fontSize: 10 },
      head: [['ANÁLISIS PRELIMINAR (Reporte Táctico)']], 
      body: [[cita.descripcion]], 
      theme: 'grid',
      styles: { cellPadding: 5 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15; 
    
    // 4. MÓDULO FINANCIERO INICIAL
    doc.setFillColor(245, 245, 245);
    doc.roundedRect(14, finalY, 182, 14, 2, 2, 'F');
    doc.setDrawColor(34, 211, 238); doc.setLineWidth(1); doc.line(14, finalY, 14, finalY + 14); 
    
    doc.setFontSize(11); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold");
    doc.text("LIQUIDACIÓN INICIAL:", 18, finalY + 9);
    
    if (cita.adelantoRealizado) { 
      doc.setTextColor(16, 185, 129); doc.text(`ADELANTO CONFIRMADO: ${cita.montoAdelanto} Bs. (Ref: ${cita.nroComprobante})`, 80, finalY + 9); 
    } else { 
      doc.setTextColor(220, 38, 38); doc.text("PAGO PENDIENTE DE ASIGNACIÓN", 80, finalY + 9); 
    }

    // 5. SECCIÓN DE AUDITORÍA Y FIRMAS OFICIALES (Sin mención a Laboratorio)
    doc.setDrawColor(150); doc.setLineWidth(0.5); doc.line(20, 250, 90, 250);
    doc.setTextColor(0, 0, 0); doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text("Firma del Cliente", 55, 255, { align: "center" });
    doc.setFontSize(8); doc.setFont("helvetica", "normal");
    doc.text("Conformidad de Solicitud", 55, 260, { align: "center" });

    // Inyección de tu nombre como Director/Autoridad
    doc.setDrawColor(150); doc.line(120, 250, 190, 250);
    doc.setFontSize(11); doc.setFont("helvetica", "bold");
    doc.text("Miguel Angel Cuenca Corazón", 155, 255, { align: "center" });
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
    doc.text("Director Operativo NOC", 155, 260, { align: "center" });

    // GENERADOR QR NATIVO
    const qrData = `OMNITECH AUTHENTIC\nTICKET: ${cita.id}\nFECHA: ${cita.fecha}\nESTADO: ${cita.estado}`;
    const base64QR = await generarQRBase64(qrData);
    if (base64QR) {
      doc.addImage(base64QR, 'PNG', 160, 205, 35, 35);
      doc.setFontSize(6); doc.setTextColor(150); doc.text("ESCANEO DE SEGURIDAD", 177.5, 243, { align: "center" });
    }

    doc.save(`OmniTech_Ingreso_${cita.nombre.replace(/\s+/g, '_')}.pdf`);
  };

  const generarPDFEntrega = async (cita: any) => {
    const doc = new jsPDF();
    const costoFinal = parseFloat(cita.costoFinal || "0"); 
    const adelanto = parseFloat(cita.montoAdelanto || "0"); 
    const saldo = costoFinal - adelanto;
    const telLimpio = sanitizarTelefono(cita.telefono);

    // 1. CABECERA FUTURISTA DE FINALIZACIÓN (Acento Esmeralda)
    doc.setFillColor(8, 15, 30); 
    doc.rect(0, 0, 210, 48, 'F');
    doc.setFillColor(16, 185, 129); // Línea Verde Éxito
    doc.rect(0, 48, 210, 2, 'F');

    doc.setTextColor(34, 211, 238);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("OMNITECH SOLUTIONS", 105, 22, { align: "center" });

    doc.setTextColor(200, 200, 200); 
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("CERTIFICADO DE FINALIZACIÓN OPERATIVA", 105, 29, { align: "center", letterSpacing: 1 });

    doc.setFillColor(15, 23, 42); 
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.4);
    doc.roundedRect(65, 35, 80, 8, 1.5, 1.5, 'FD');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text(`TICKET NOC: ${cita.id.toUpperCase()}`, 105, 40.5, { align: "center" });

    // 2. BLOQUE DE DATOS LIMPIO
    doc.setTextColor(0, 0, 0); doc.setFontSize(10);
    
    doc.setFont("helvetica", "bold"); doc.text(`CLIENTE / TITULAR:`, 14, 62); 
    doc.setFont("helvetica", "normal"); doc.text(cita.nombre, 55, 62);
    
    doc.setFont("helvetica", "bold"); doc.text(`CONTACTO:`, 14, 69); 
    doc.setFont("helvetica", "normal"); doc.text(telLimpio, 55, 69);

    doc.setFont("helvetica", "bold"); doc.text(`FECHA DE CIERRE:`, 115, 62); 
    doc.setFont("helvetica", "normal"); doc.text(new Date().toLocaleDateString(), 155, 62);
    
    doc.setFont("helvetica", "bold"); doc.text(`MODALIDAD NOC:`, 115, 69); 
    doc.setFont("helvetica", "normal"); doc.text(cita.modalidad.toUpperCase(), 155, 69);

    // 3. TABLA DE TRABAJO REALIZADO
    autoTable(doc, { 
      startY: 78, 
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10 }, 
      bodyStyles: { fillColor: [250, 252, 255], textColor: [15, 23, 42], fontSize: 10 },
      head: [['REPORTE TÁCTICO DE INTERVENCIÓN (Solución Aplicada)']], 
      body: [[cita.trabajoFinal]], 
      theme: 'grid',
      styles: { cellPadding: 5 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15; 

    // 4. MÓDULO FINANCIERO SÓLIDO
    doc.setDrawColor(200); doc.setFillColor(250, 250, 250);
    doc.roundedRect(14, finalY, 182, 38, 2, 2, 'FD');
    doc.setFillColor(15, 23, 42); 
    doc.roundedRect(14, finalY, 182, 9, 2, 2, 'F');
    
    doc.setTextColor(255, 255, 255); doc.setFontSize(10); doc.setFont("helvetica", "bold");
    doc.text("LIQUIDACIÓN Y SALDOS", 18, finalY + 6);

    doc.setTextColor(0, 0, 0); doc.setFontSize(10);
    doc.setFont("helvetica", "bold"); doc.text(`Costo Total de Operación:`, 18, finalY + 18); doc.setFont("helvetica", "normal"); doc.text(`${costoFinal.toFixed(2)} Bs.`, 160, finalY + 18, { align: "right" });
    doc.setFont("helvetica", "bold"); doc.text(`Adelanto Registrado a Cuenta:`, 18, finalY + 25); doc.setFont("helvetica", "normal"); doc.text(`- ${adelanto.toFixed(2)} Bs.`, 160, finalY + 25, { align: "right" });
    
    doc.setDrawColor(200); doc.line(18, finalY + 29, 160, finalY + 29);
    
    doc.setFont("helvetica", "black"); doc.setFontSize(11);
    doc.text(`SALDO FINAL A PAGAR:`, 18, finalY + 34.5); 
    doc.setFontSize(14); doc.setTextColor(220, 38, 38); 
    doc.text(`${saldo > 0 ? saldo.toFixed(2) : "0.00"} Bs.`, 160, finalY + 35, { align: "right" });

    // 5. ZONA DE VALIDACIÓN (Sin mención a Laboratorio)
    doc.setTextColor(0, 0, 0);
    if (cita.modalidad === "En Domicilio") {
      doc.setFillColor(241, 245, 249); 
      doc.roundedRect(14, finalY + 45, 120, 25, 2, 2, 'F'); 
      doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text("VALIDACIÓN TÉCNICA REMOTA", 74, finalY + 52, { align: "center" });
      doc.setFont("helvetica", "normal"); 
      doc.text("Certificación procesada vía enlace telemático.", 74, finalY + 59, { align: "center" });
      doc.setTextColor(16, 185, 129); doc.setFont("helvetica", "bold");
      doc.text(`ESTADO: ${cita.conformidadDigital ? cita.conformidadDigital.toUpperCase() : "PENDIENTE DE FIRMA"}`, 74, finalY + 65, { align: "center" });
    } else { 
      doc.setDrawColor(150); doc.setLineWidth(0.5); doc.line(20, 250, 90, 250); 
      doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
      doc.text("Firma del Cliente", 55, 255, { align: "center" }); 
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
      doc.text(`Conformidad de Entrega`, 55, 260, { align: "center" }); 
    }
    
    // Firma de Autoridad
    doc.setDrawColor(150); doc.setLineWidth(0.5); doc.line(120, 250, 190, 250); 
    doc.setFontSize(11); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
    doc.text("Miguel Angel Cuenca Corazón", 155, 255, { align: "center" }); 
    doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
    doc.text("Director Operativo NOC - OmniTech", 155, 260, { align: "center" });

    // GENERADOR QR NATIVO FINAL
    const qrData = `OMNITECH VERIFIED\nTICKET: ${cita.id}\nCOSTO: ${costoFinal}Bs\nSALDO: ${saldo}Bs\nCIERRE: ${new Date().toLocaleDateString()}`;
    const base64QR = await generarQRBase64(qrData);
    if (base64QR) {
      doc.addImage(base64QR, 'PNG', 14, 235, 30, 30); 
      doc.setFontSize(6); doc.setTextColor(150); doc.setFont("helvetica", "bold");
      doc.text("HASH VERIFICADO", 29, 268, { align: "center" });
    }

    doc.save(`OmniTech_Entrega_${cita.nombre.replace(/\s+/g, '_')}.pdf`);
  };

  if (authChecking) return <div className="min-h-screen bg-[#030712] flex items-center justify-center"><p className="text-cyan-500 font-mono animate-pulse tracking-widest">[ VERIFICANDO CREDENCIALES... ]</p></div>;
  if (!user) { 
    return ( 
      <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4 relative overflow-hidden"> 
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none"></div> 
        <div className="bg-[#0a1120]/90 p-8 md:p-10 rounded-2xl border border-cyan-500/40 backdrop-blur-xl shadow-[0_0_50px_rgba(34,211,238,0.15)] w-full max-w-md relative z-10"> 
          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-white tracking-widest">SISTEMA <span className="text-cyan-500">NOC</span></h1>
            <p className="text-red-400 font-mono text-xs mt-2 font-bold tracking-widest border border-red-900/50 bg-red-950/30 py-1 rounded">ACCESO RESTRINGIDO</p>
          </div> 
          <form onSubmit={handleLogin} className="space-y-6"> 
            <div>
              <label className="block text-xs font-mono text-cyan-500 mb-2 uppercase">Credencial</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-[#030712] border border-slate-700 rounded p-3 text-white focus:outline-none focus:border-cyan-500" />
            </div> 
            <div>
              <label className="block text-xs font-mono text-cyan-500 mb-2 uppercase">Contraseña</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-[#030712] border border-slate-700 rounded p-3 text-white focus:outline-none focus:border-cyan-500 tracking-widest" />
            </div> 
            {loginError && <p className="text-red-500 text-xs font-bold text-center bg-red-950/50 p-2 rounded">{loginError}</p>} 
            <button type="submit" disabled={isLoggingIn} className="w-full py-4 rounded font-bold tracking-widest bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_20px_rgba(34,211,238,0.3)]">{isLoggingIn ? "AUTENTICANDO..." : "INICIAR SESIÓN"}</button> 
          </form> 
        </div> 
      </div> 
    ); 
  }

  return (
    <main className="min-h-screen bg-[#030712] text-white p-4 md:p-8 font-sans selection:bg-cyan-500 relative">
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0"></div>
      <div className="fixed inset-0 z-0 flex items-center justify-center pointer-events-none opacity-[0.03] select-none">
        <img src="/logo.png" alt="Fondo" className="w-[800px] h-[800px] object-contain grayscale" />
      </div>

      <div className="max-w-[1400px] mx-auto relative z-10">
        <header className="flex flex-col md:flex-row justify-between items-center bg-[#0a1120]/90 border border-slate-800 p-6 rounded-2xl backdrop-blur-xl mb-6 shadow-[0_0_30px_rgba(34,211,238,0.1)]">
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 tracking-wider uppercase">
              OMNITECH SOLUTIONS
            </h1>
            <p className="text-slate-400 text-sm mt-1 font-mono tracking-widest">
              Nivel de Acceso: 
              <span className={`ml-2 px-2 py-0.5 rounded font-bold ${isAdmin ? "bg-amber-900/50 text-amber-400 border border-amber-500" : "bg-cyan-900/50 text-cyan-400 border border-cyan-500"}`}>
                {isAdmin ? "ADMINISTRADOR MAESTRO" : "TÉCNICO DE CAMPO"}
              </span>
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center space-x-4">
            <Link href="/radar" className="px-4 py-2 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-900/30 rounded-lg text-xs font-bold tracking-widest transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)] flex items-center">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-ping mr-2"></span>
              RADAR NOC
            </Link>
            
            <Link href="/academia" className="px-4 py-2 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-900/30 rounded-lg text-xs font-bold tracking-widest transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l9-5-9-5-9 5 9 5z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"></path></svg>
              ACADEMIA
            </Link>

            <div className="flex items-center bg-[#030712] border border-cyan-900/50 px-4 py-2 rounded-lg">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-ping mr-3"></div><span className="text-green-400 text-sm font-bold tracking-widest">{user.email}</span>
            </div>
            <button onClick={handleLogout} className="px-4 py-2 bg-red-950/30 border border-red-900 hover:bg-red-900 hover:text-white text-red-500 rounded-lg text-xs font-bold tracking-widest transition-all">SALIR</button>
          </div>
        </header>

        <div className="flex space-x-2 mb-6 bg-[#0a1120]/80 p-1.5 rounded-xl border border-slate-800 w-full md:w-max backdrop-blur-md overflow-x-auto">
          <button onClick={() => setActiveTab("monitoreo")} className={`px-6 py-3 rounded-lg text-xs font-bold tracking-widest transition-all whitespace-nowrap ${activeTab === "monitoreo" ? "bg-cyan-600/20 text-cyan-400 border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.15)]" : "text-slate-500 hover:text-slate-300"}`}>MONITOREO NOC</button>
          {isAdmin && (
            <>
              <button onClick={() => setActiveTab("analitica")} className={`px-6 py-3 rounded-lg text-xs font-bold tracking-widest transition-all whitespace-nowrap ${activeTab === "analitica" ? "bg-purple-600/20 text-purple-400 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]" : "text-slate-500 hover:text-slate-300"}`}>ANALÍTICA FINANCIERA</button>
              <button onClick={() => setActiveTab("evaluaciones")} className={`px-6 py-3 rounded-lg text-xs font-bold tracking-widest transition-all whitespace-nowrap ${activeTab === "evaluaciones" ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.15)]" : "text-slate-500 hover:text-slate-300"}`}>EVALUACIÓN TÉCNICA</button>
              <button onClick={() => setActiveTab("configuracion")} className={`px-6 py-3 rounded-lg text-xs font-bold tracking-widest transition-all whitespace-nowrap ${activeTab === "configuracion" ? "bg-amber-600/20 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]" : "text-slate-500 hover:text-slate-300"}`}>SALA DE CONTROL</button>
            </>
          )}
        </div>

        {activeTab === "monitoreo" && (
          <div className="animate-fade-in-up">
            <div className="mb-4 flex flex-col sm:flex-row items-center justify-between bg-[#0a1120]/80 p-4 rounded-2xl border border-cyan-900/40 backdrop-blur-md shadow-lg gap-4">
              <div className="relative w-full sm:max-w-md">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
                <input type="text" placeholder="Buscar por Nombre o ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#030712] border border-slate-700 rounded-lg pl-11 pr-4 py-3 text-white focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-500 text-sm font-mono transition-all" />
              </div>
              <div className="w-full sm:w-auto text-xs font-mono text-cyan-400 bg-cyan-950/30 px-4 py-3 rounded-lg border border-cyan-800/50 flex items-center justify-center">
                <span className="font-bold mr-2">TICKETS VISIBLES:</span><span className="text-white text-base bg-cyan-600 px-2 py-0.5 rounded">{citasFiltradas.length}</span>
              </div>
            </div>

            <div className="bg-[#0a1120]/80 rounded-2xl border border-cyan-500/30 overflow-hidden backdrop-blur-md shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-slate-900/80 border-b border-cyan-500/30 text-cyan-500 uppercase text-[10px] font-black tracking-widest">
                      <th className="p-4">Cliente / Despliegue</th>
                      <th className="p-4">Diagnóstico Previo</th>
                      {isAdmin && <th className="p-4">Finanzas</th>}
                      <th className="p-4">Estado Operativo</th>
                      <th className="p-4 text-center">Acciones Tácticas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {loading ? ( 
                      <tr><td colSpan={isAdmin ? 5 : 4} className="p-10 text-center text-cyan-600 animate-pulse font-mono">[ INTERCEPTANDO DATOS... ]</td></tr> 
                    ) : citasFiltradas.length === 0 ? ( 
                      <tr><td colSpan={isAdmin ? 5 : 4} className="p-10 text-center text-slate-500 font-mono">NO SE ENCONTRARON REGISTROS</td></tr> 
                    ) : (
                      citasFiltradas.map((cita) => (
                        <tr key={cita.id} className="hover:bg-slate-800/30 transition-colors group">
                          <td className="p-4">
                            <p className="font-bold text-white text-base mb-1">{cita.nombre}</p>
                            <div className="flex items-center space-x-2 mb-2 bg-[#030712] border border-slate-800 rounded px-2 py-1 w-max cursor-pointer hover:border-cyan-500 transition-colors" onClick={() => copiarID(cita.id)}>
                              <p className="text-[10px] text-slate-400 font-mono">ID: {cita.id}</p>
                              {copiedId === cita.id ? (
                                <svg className="w-3 h-3 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg>
                              ) : (
                                <svg className="w-3 h-3 text-slate-500 hover:text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
                              )}
                            </div>
                            <div className="flex flex-col space-y-2">
                              <span className="text-slate-400 text-xs font-mono bg-slate-950 px-2 py-1 rounded inline-block w-max border border-slate-800">{cita.fecha} | {cita.hora}</span>
                              {cita.coordenadas ? (
                                <a href={`https://www.google.com/maps/search/?api=1&query=${cita.coordenadas}`} target="_blank" rel="noopener noreferrer" className="text-[10px] flex items-center bg-blue-950/40 text-blue-400 border border-blue-800/50 px-2 py-1.5 rounded hover:bg-blue-900 hover:text-white transition-all w-max"><svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> VER MAPA</a>
                              ) : <span className="text-[10px] text-slate-500">Dir: {cita.direccion || "N/A"}</span>}
                            </div>
                          </td>
                          <td className="p-4"><p className="text-slate-300 text-sm max-w-xs truncate group-hover:whitespace-normal transition-all">{cita.descripcion}</p></td>
                          {isAdmin && (
                            <td className="p-4">
                              {cita.adelantoRealizado ? (
                                <div className="bg-emerald-950/30 border border-emerald-900/50 p-2 rounded w-max">
                                  <p className="text-emerald-400 font-bold text-xs">+ {cita.montoAdelanto} Bs.</p>
                                  <p className="text-emerald-500/60 text-[10px] font-mono">Ref: {cita.nroComprobante}</p>
                                </div>
                              ) : <span className="text-slate-600 text-xs font-mono font-bold">N/A</span>}
                              {cita.costoFinal && (
                                <div className="mt-2 bg-slate-900 p-2 rounded border border-slate-700 w-max"><p className="text-slate-400 text-[10px] uppercase">Costo Total: <strong className="text-white">{cita.costoFinal} Bs.</strong></p></div>
                              )}
                            </td>
                          )}
                          <td className="p-4">
                            <span className={`px-3 py-1.5 rounded text-[10px] font-black tracking-wider border block w-max mb-2 ${
                              cita.estado === "Pendiente" ? "bg-amber-950/50 border-amber-500/50 text-amber-400" :
                              cita.estado === "En Reparación" ? "bg-blue-950/50 border-blue-500/50 text-blue-400" :
                              "bg-emerald-950/50 border-emerald-500/50 text-emerald-400"
                            }`}>{cita.estado ? cita.estado.toUpperCase() : "PENDIENTE"}</span>
                            {cita.estado === "Completado" && (
                              <div className="mb-2">
                                {cita.modalidad === "En Domicilio" ? (
                                  cita.conformidadDigital === "Firmado" ? (
                                    <div className="flex flex-col space-y-2">
                                      <span className="bg-emerald-900/40 text-emerald-400 border border-emerald-500/50 px-2 py-1 rounded text-[9px] font-bold tracking-widest flex items-center w-max shadow-[0_0_10px_rgba(16,185,129,0.2)]">
                                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> CLIENTE FIRMÓ
                                      </span>
                                      {cita.calificacion && (
                                        <div className="bg-[#030712] border border-amber-900/30 p-2 rounded-lg w-max shadow-[0_0_15px_rgba(251,191,36,0.1)]">
                                          <div className="flex space-x-1 mb-1">
                                            {[1,2,3,4,5].map(star => (
                                              <svg key={star} className={`w-3 h-3 ${star <= cita.calificacion ? "text-amber-400" : "text-slate-700"}`} fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                                            ))}
                                          </div>
                                          {cita.comentarioCliente && <p className="text-[9px] text-slate-400 max-w-[150px] italic leading-tight">"{cita.comentarioCliente}"</p>}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="bg-amber-900/40 text-amber-400 border border-amber-500/50 px-2 py-1 rounded text-[9px] font-bold tracking-widest flex items-center w-max animate-pulse">
                                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> ESPERANDO FIRMA
                                    </span>
                                  )
                                ) : (
                                  <span className="bg-slate-900/40 text-slate-400 border border-slate-500/50 px-2 py-1 rounded text-[9px] font-bold tracking-widest flex items-center w-max">
                                    <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"></path></svg> ENTREGA TALLER
                                  </span>
                                )}
                              </div>
                            )}
                            <select className="block w-full bg-[#030712] border border-slate-700 text-slate-300 text-[10px] rounded px-1 py-1 focus:outline-none focus:border-cyan-500 cursor-pointer" value={cita.estado || "Pendiente"} onChange={(e) => handleEstadoChange(cita, e.target.value)}>
                              <option value="Pendiente">Marcar Pendiente</option>
                              <option value="En Reparación">Iniciar Reparación</option>
                              <option value="Completado">Finalizar Equipo</option>
                            </select>
                          </td>
                          <td className="p-4 text-center space-y-2">
                            <a href={generarEnlaceWA(cita)} target="_blank" rel="noopener noreferrer" className="w-full bg-green-600/20 hover:bg-green-500 hover:text-black text-green-400 text-[10px] font-bold px-3 py-2 rounded transition-all border border-green-500/30 flex items-center justify-center text-center">
                              {cita.estado === "Completado" ? (cita.modalidad === "En Domicilio" ? "ENVIAR ENLACE FIRMA" : "AVISO EQUIPO LISTO") : "CONTACTAR (WA)"}
                            </a>
                            <button onClick={() => generarPDFIngreso(cita)} className="w-full bg-cyan-900/30 hover:bg-cyan-600 text-cyan-400 hover:text-white text-[10px] font-bold px-3 py-2 rounded transition-all border border-cyan-700/50 flex items-center justify-center">PDF INGRESO</button>
                            {cita.estado === "Completado" && (
                              <button onClick={() => generarPDFEntrega(cita)} className="w-full bg-emerald-900/30 hover:bg-emerald-600 text-emerald-400 hover:text-white text-[10px] font-bold px-3 py-2 rounded transition-all border border-emerald-700/50 flex items-center justify-center">PDF FINALIZADO</button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {isAdmin && activeTab === "analitica" && (
          <div className="animate-fade-in-up space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-[#0a1120]/80 p-6 rounded-2xl border border-purple-500/30 backdrop-blur-md shadow-[0_0_20px_rgba(168,85,247,0.15)] relative overflow-hidden group hover:border-purple-500 transition-colors">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600 rounded-full mix-blend-screen filter blur-[50px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <h3 className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1">Ingresos Consolidados</h3>
                <p className="text-3xl font-black text-white">{ingresosTotales.toFixed(2)} <span className="text-sm text-purple-400">Bs.</span></p>
              </div>
              <div className="bg-[#0a1120]/80 p-6 rounded-2xl border border-emerald-500/30 backdrop-blur-md shadow-[0_0_20px_rgba(16,185,129,0.15)] relative overflow-hidden group hover:border-emerald-500 transition-colors">
                <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-600 rounded-full mix-blend-screen filter blur-[50px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <h3 className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1">Adelantos (Flujo de Caja)</h3>
                <p className="text-3xl font-black text-white">{adelantosFlotantes.toFixed(2)} <span className="text-sm text-emerald-400">Bs.</span></p>
              </div>
              <div className="bg-[#0a1120]/80 p-6 rounded-2xl border border-cyan-500/30 backdrop-blur-md shadow-[0_0_20px_rgba(34,211,238,0.15)] relative overflow-hidden group hover:border-cyan-500 transition-colors">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-600 rounded-full mix-blend-screen filter blur-[50px] opacity-20 group-hover:opacity-40 transition-opacity"></div>
                <h3 className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1">Tasa de Éxito Operativo</h3>
                <div className="flex items-end space-x-2"><p className="text-3xl font-black text-white">{porcentajeExito}%</p><p className="text-xs text-cyan-400 mb-1 font-bold">{ticketsCompletados} / {totalTickets}</p></div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden"><div className="bg-cyan-500 h-full rounded-full" style={{ width: `${porcentajeExito}%` }}></div></div>
              </div>
              <div className="bg-[#0a1120]/80 p-6 rounded-2xl border border-slate-500/30 backdrop-blur-md shadow-lg relative overflow-hidden group hover:border-slate-400 transition-colors">
                <div className="absolute top-0 right-0 w-32 h-32 bg-slate-600 rounded-full mix-blend-screen filter blur-[50px] opacity-10 group-hover:opacity-20 transition-opacity"></div>
                <h3 className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1">Volumen Histórico</h3>
                <p className="text-3xl font-black text-white">{totalTickets}</p>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={exportarCSV} className="bg-[#030712] border border-cyan-800/50 hover:bg-cyan-900/50 hover:border-cyan-500 text-cyan-400 hover:text-white px-6 py-4 rounded-xl font-bold tracking-widest transition-all flex items-center shadow-[0_0_15px_rgba(34,211,238,0.1)] hover:shadow-[0_0_25px_rgba(34,211,238,0.3)]">
                <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg> EXPORTAR DATOS A EXCEL
              </button>
            </div>
          </div>
        )}

        {isAdmin && activeTab === "evaluaciones" && (
          <div className="animate-fade-in-up bg-[#0a1120]/80 rounded-2xl border border-emerald-500/30 p-6 backdrop-blur-md shadow-2xl">
            <div className="flex items-center justify-between mb-6 border-b border-slate-800 pb-4">
              <h2 className="text-xl font-black text-emerald-400 tracking-widest uppercase flex items-center">
                <svg className="w-6 h-6 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                MATRIZ DE COMPETENCIAS TÉCNICAS
              </h2>
              <span className="bg-emerald-950/50 text-emerald-400 border border-emerald-900/50 px-3 py-1 rounded text-xs font-mono font-bold">
                AUDITORÍA ACADÉMICA
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900/80 border-b border-slate-800 text-emerald-400 uppercase text-[10px] font-black tracking-widest">
                    <th className="p-4">Técnico Evalúado</th>
                    <th className="p-4">Caso Asignado</th>
                    <th className="p-4">Opción Seleccionada</th>
                    <th className="p-4">Puntaje</th>
                    <th className="p-4">Estado de Competencia</th>
                    <th className="p-4">Fecha de Registro</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50 text-xs font-mono">
                  {evaluaciones.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-slate-500">
                        No hay evaluaciones registradas en el sistema aún.
                      </td>
                    </tr>
                  ) : (
                    evaluaciones.map((ev) => (
                      <tr key={ev.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 font-bold text-white">{ev.tecnico}</td>
                        <td className="p-4 text-slate-400">{ev.casoId}</td>
                        <td className="p-4">
                          <span className="bg-slate-900 border border-slate-700 px-2 py-1 rounded text-cyan-400 font-bold">
                            Opción {ev.respuestaElegida}
                          </span>
                        </td>
                        <td className="p-4 font-bold text-white">{ev.puntaje} / 100</td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded text-[10px] font-black tracking-wider border ${
                            ev.estadoCompetencia === "Aprobado"
                              ? "bg-emerald-950/50 border-emerald-500/50 text-emerald-400"
                              : "bg-red-950/50 border-red-500/50 text-red-400"
                          }`}>
                            {ev.estadoCompetencia ? ev.estadoCompetencia.toUpperCase() : "PENDIENTE"}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500">
                          {new Date(ev.fechaEvaluacion).toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {isAdmin && activeTab === "configuracion" && ( 
          <div className="animate-fade-in-up grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#0a1120]/80 p-6 rounded-2xl border border-amber-500/30 backdrop-blur-md shadow-[0_0_20px_rgba(245,158,11,0.1)]">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-4">
                <h2 className="text-lg font-black text-amber-500 tracking-widest flex items-center"><svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg> RADAR DE AUDITORÍA OPERATIVA</h2>
                <span className="bg-amber-950/50 text-amber-400 border border-amber-900/50 px-2 py-1 rounded text-[10px] font-mono animate-pulse">LIVE SECURE LOGS</span>
              </div>
              <div className="bg-[#030712] border border-slate-800 rounded-xl p-4 h-96 overflow-y-auto font-mono text-xs shadow-inner">
                {logs.length === 0 ? <p className="text-slate-600 text-center mt-10">No hay registros de actividad aún.</p> : (
                  logs.map((log) => (
                    <div key={log.id} className="border-b border-slate-800/50 py-3 flex flex-col space-y-1">
                      <div className="flex justify-between items-center text-[10px] text-slate-500">
                        <span>{new Date(log.fecha).toLocaleString()}</span><span className="bg-slate-900 px-2 py-0.5 rounded text-cyan-600">{log.usuario}</span>
                      </div>
                      <span className="text-slate-300">{log.accion}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="bg-[#0a1120]/80 p-6 rounded-2xl border border-slate-600/30 backdrop-blur-md shadow-lg space-y-6">
              <div className="border-b border-slate-800 pb-4">
                <h2 className="text-lg font-black text-white tracking-widest flex items-center"><svg className="w-5 h-5 mr-2 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> VARIABLES DE ENTORNO</h2>
              </div>
              <div className="bg-[#030712] p-4 rounded-xl border border-slate-800">
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">Nro. WhatsApp Corporativo</label>
                <div className="flex space-x-2">
                  <input type="text" value="+591 7XXXXXXXX" readOnly className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-500 font-mono text-sm cursor-not-allowed" />
                  <button className="bg-slate-800 text-slate-500 px-4 rounded-lg text-xs font-bold cursor-not-allowed">BLOQUEADO</button>
                </div>
              </div>
              <div className="bg-[#030712] p-4 rounded-xl border border-slate-800 flex items-center justify-between opacity-50">
                <div><p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Bóveda Cloud Storage</p><p className="text-[10px] text-slate-500">Respaldo automático de PDFs en la nube</p></div>
                <div className="w-10 h-5 bg-slate-800 rounded-full flex items-center p-1"><div className="w-3 h-3 bg-slate-600 rounded-full"></div></div>
              </div>
            </div>
          </div> 
        )}
      </div>

      {showCloseModal && citaActiva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#030712]/95 backdrop-blur-xl">
          <div className="bg-[#0a1120] border border-cyan-500/50 p-6 rounded-2xl max-w-lg w-full shadow-[0_0_80px_rgba(34,211,238,0.2)] transform animate-fade-in-up relative">
            <button 
              onClick={() => setShowCloseModal(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-red-500 transition-colors focus:outline-none"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
            </button>

            <h3 className="text-xl font-black text-white mb-4 tracking-widest border-b border-slate-800 pb-3 flex items-center pr-8">
              <span className="w-2 h-2 bg-cyan-500 rounded-full mr-3 animate-pulse"></span> 
              REPORTE DE FINALIZACIÓN
            </h3>
            
            <div className="bg-slate-900 p-3 rounded text-xs font-mono text-cyan-400 mb-4 border border-cyan-900/50">
              Cerrando Ticket de: <span className="text-white font-bold">{citaActiva.nombre}</span>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-cyan-500 mb-1 uppercase">Trabajo Realmente Ejecutado</label>
                <textarea rows={3} value={cierreData.trabajoRealizado} onChange={(e) => setCierreData({...cierreData, trabajoRealizado: e.target.value})} placeholder="Ej. Cambio de disco sólido..." className="w-full bg-[#030712] border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-400 text-sm resize-none"></textarea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-cyan-500 mb-1 uppercase">Costo Total (Bs.)</label>
                  <input type="number" value={cierreData.costoTotal} onChange={(e) => setCierreData({...cierreData, costoTotal: e.target.value})} placeholder="Ej. 250" className="w-full bg-[#030712] border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-400 text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-cyan-500 mb-1 uppercase">Modalidad</label>
                  <select value={cierreData.modalidad} onChange={(e) => setCierreData({...cierreData, modalidad: e.target.value})} className="w-full bg-[#030712] border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-400 text-sm cursor-pointer">
                    <option value="Laboratorio">En Laboratorio</option>
                    <option value="En Domicilio">En Domicilio</option>
                  </select>
                </div>
              </div>
              
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-4 pt-4 mt-4 border-t border-slate-800">
                <button 
                  onClick={() => setShowCloseModal(false)} 
                  className="flex-1 py-3 rounded-lg border border-slate-700 text-slate-400 font-bold hover:bg-slate-800 hover:text-white transition-all text-xs tracking-widest flex items-center justify-center"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                  VOLVER ATRÁS
                </button>
                <button 
                  onClick={confirmarCierre} 
                  disabled={guardandoCierre} 
                  className="flex-1 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all text-xs tracking-widest flex items-center justify-center"
                >
                  {guardandoCierre ? "GUARDANDO..." : "SELLAR Y COMPLETAR"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}