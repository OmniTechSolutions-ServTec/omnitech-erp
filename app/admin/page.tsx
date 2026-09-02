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

  // ==========================================================
  // WHATSAPP: MENÚ DESPLEGABLE CON OPCIONES DE INGRESO Y FINALIZADO
  // ==========================================================
  const generarEnlaceWA = (cita: any, tipo: 'ingreso' | 'finalizado') => {
    const num = cita.telefono.replace(/\D/g, ''); 
    const prefijo = num.length === 8 ? '591' : '';
    let texto = "";

    if (tipo === 'ingreso') {
      texto = `Hola ${cita.nombre}, nos comunicamos de *OmniTech Solutions*.\n\nSu solicitud ha sido registrada exitosamente en nuestra Sala de Control. En un momento le adjuntaremos su *Comprobante de Servicio Solicitado* en formato PDF para su respaldo.\n\nID del Ticket: *${cita.id.toUpperCase()}*\n\n¡Gracias por elegirnos, estamos a su servicio!`;
    } else {
      texto = `Hola ${cita.nombre}, le informamos desde *OmniTech Solutions* que el servicio técnico en su equipo ha concluido con éxito.\n\nEn un momento le enviaremos su *Certificado de Finalización Operativa* (PDF) con el detalle del trabajo y saldos.\n\nQuedamos a su entera disposición.`;
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
    if (!cierreData.trabajoRealizado || !cierreData.costoTotal) { alert("Complete los datos."); return; }
    setGuardandoCierre(true);
    try {
      await updateDoc(doc(db, "citas", citaActiva.id), { 
        estado: "Completado", trabajoFinal: cierreData.trabajoRealizado, costoFinal: cierreData.costoTotal, 
        modalidad: cierreData.modalidad, conformidadDigital: cierreData.modalidad === "En Domicilio" ? "Pendiente" : "N/A", 
        fechaCierre: new Date().toISOString()
      });
      registrarAuditoria(`Cerró ticket [${citaActiva.nombre}] por ${cierreData.costoTotal} Bs. Mod: ${cierreData.modalidad}`);
      setShowCloseModal(false); setCierreData({ trabajoRealizado: "", costoTotal: "", modalidad: "Laboratorio" }); setCitaActiva(null);
    } catch (error) { alert("Error."); } finally { setGuardandoCierre(false); }
  };

  const copiarID = (id: string) => { navigator.clipboard.writeText(id); setCopiedId(id); setTimeout(() => setCopiedId(""), 2000); };

  const exportarCSV = () => {
    const encabezados = ["ID_Ticket", "Fecha_Cita", "Cliente", "Telefono", "Estado", "Modalidad", "Costo_Total"];
    const filas = citas.map(c => [c.id, c.fecha, `"${c.nombre}"`, c.telefono, c.estado, c.modalidad || "N/A", c.costoFinal || "0"]);
    const contenidoCSV = [encabezados.join(","), ...filas.map(f => f.join(","))].join("\n");
    const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.setAttribute("download", `OmniTech_Reporte.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const totalTickets = citas.length;
  const ticketsCompletados = citas.filter(c => c.estado === "Completado").length;
  const porcentajeExito = totalTickets === 0 ? 0 : Math.round((ticketsCompletados / totalTickets) * 100);
  const ingresosTotales = citas.reduce((acc, c) => (c.estado === "Completado" && c.costoFinal) ? acc + parseFloat(c.costoFinal) : acc, 0);
  const adelantosFlotantes = citas.reduce((acc, c) => (c.estado !== "Completado" && c.adelantoRealizado && c.montoAdelanto) ? acc + parseFloat(c.montoAdelanto) : acc, 0);
  const citasFiltradas = citas.filter(cita => cita.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || cita.id.toLowerCase().includes(searchTerm.toLowerCase()));

  // ==========================================================
  // GENERADORES DE PDF - ÉPICO Y FUTURISTA
  // ==========================================================

  const sanitizarTelefono = (tel: string) => {
    if (!tel) return "No registrado";
    const limpio = tel.replace(/@.*$/, ''); 
    return limpio.startsWith('591') && limpio.length > 8 ? `+591 ${limpio.substring(3)}` : limpio;
  };

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
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(texto)}&margin=1`;
    });
  };

  const drawHUDCorners = (doc: any, x: number, y: number, w: number, h: number, color: number[]) => {
    doc.setDrawColor(color[0], color[1], color[2]);
    doc.setLineWidth(0.4);
    const l = 4;
    doc.line(x, y, x + l, y); doc.line(x, y, x, y + l); 
    doc.line(x + w, y, x + w - l, y); doc.line(x + w, y, x + w, y + l); 
    doc.line(x, y + h, x + l, y + h); doc.line(x, y + h, x, y + h - l); 
    doc.line(x + w, y + h, x + w - l, y + h); doc.line(x + w, y + h, x + w, y + h - l); 
  };

  // 1. PDF DE INGRESO
  const generarPDFIngreso = async (cita: any) => {
    const doc = new jsPDF();
    const telLimpio = sanitizarTelefono(cita.telefono);

    // Cabecera Épica (Sin códigos de barra)
    doc.setFillColor(6, 11, 25); 
    doc.rect(0, 0, 210, 50, 'F');
    doc.setFillColor(34, 211, 238); // Cian
    doc.rect(0, 50, 210, 2, 'F');

    doc.setTextColor(34, 211, 238);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("OMNITECH SOLUTIONS", 105, 25, { align: "center" });

    doc.setTextColor(148, 163, 184);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("COMPROBANTE DE SERVICIO SOLICITADO", 105, 32, { align: "center" }); // TEXTO CORREGIDO

    // ID Badge
    doc.setFillColor(15, 23, 42); 
    doc.setDrawColor(34, 211, 238);
    doc.setLineWidth(0.3);
    doc.roundedRect(65, 38, 80, 7, 1, 1, 'FD');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont("courier", "bold"); 
    doc.text(`TICKET_ID :: ${cita.id.toUpperCase()}`, 105, 43, { align: "center" });

    // HUD Datos
    doc.setFillColor(250, 252, 255);
    doc.rect(14, 62, 182, 28, 'F'); 
    drawHUDCorners(doc, 14, 62, 182, 28, [34, 211, 238]);

    doc.setFillColor(15, 23, 42); 
    doc.rect(14, 62, 182, 7, 'F'); 
    doc.setTextColor(34, 211, 238); doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("[ PARÁMETROS DEL SOLICITANTE ]", 18, 67);
    
    doc.setTextColor(0, 0, 0); doc.setFontSize(9);
    doc.setFont("helvetica", "bold"); doc.text("CLIENTE:", 18, 76); doc.setFont("helvetica", "normal"); doc.text(cita.nombre, 40, 76);
    doc.setFont("helvetica", "bold"); doc.text("CONTACTO:", 115, 76); doc.setFont("courier", "bold"); doc.text(telLimpio, 138, 76);
    doc.setFont("helvetica", "bold"); doc.text("UBICACIÓN:", 18, 84); 
    let dirBreve = cita.direccion || "No especificada";
    if (dirBreve.length > 80) dirBreve = dirBreve.substring(0, 80) + "...";
    doc.setFont("courier", "normal"); doc.text(dirBreve, 45, 84);

    // Tabla
    autoTable(doc, { 
      startY: 96, 
      headStyles: { fillColor: [6, 11, 25], textColor: [34, 211, 238], fontStyle: 'bold', fontSize: 9 }, 
      bodyStyles: { fillColor: [250, 252, 255], textColor: [10, 10, 10], fontSize: 9 },
      head: [['[ REPORTE DE INCIDENCIA PRELIMINAR ]']], 
      body: [[cita.descripcion]], 
      theme: 'grid',
      styles: { cellPadding: 6 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15; 
    
    // Financiero
    doc.setFillColor(245, 248, 250);
    doc.rect(14, finalY, 182, 12, 'F');
    doc.setDrawColor(34, 211, 238); doc.setLineWidth(1.5); doc.line(14, finalY, 14, finalY + 12); 
    
    doc.setFontSize(10); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold");
    doc.text("ESTADO FINANCIERO:", 18, finalY + 8);
    
    if (cita.adelantoRealizado) { 
      doc.setTextColor(16, 185, 129); doc.text(`ADELANTO CONFIRMADO: ${cita.montoAdelanto} Bs. (Ref: ${cita.nroComprobante})`, 65, finalY + 8); 
    } else { 
      doc.setTextColor(220, 38, 38); doc.text(">> PAGO PENDIENTE DE ASIGNACIÓN", 65, finalY + 8); 
    }

    // FOOTER: QR aislado a la izquierda, Firmas al centro y derecha
    const footerY = 250;
    const qrText = `[ OMNITECH SOLUTIONS - RED DE ÉLITE ]\n====================================\nTICKET: ${cita.id}\nTITULAR: ${cita.nombre}\nFECHA: ${cita.fecha}\nESTADO: REGISTRADO\n====================================\n¡Gracias por elegir OmniTech Solutions!\nInfraestructura tecnológica a su servicio.`;
    const base64QR = await generarQRBase64(qrText);
    
    if (base64QR) {
      doc.addImage(base64QR, 'PNG', 14, footerY - 15, 32, 32);
      doc.setFontSize(6); doc.setTextColor(100); doc.setFont("courier", "bold");
      doc.text("SELLO CRIPTOGRÁFICO", 30, footerY + 21, { align: "center" });
    }

    // Firma Cliente (Centro) - SIN LA PALABRA LABORATORIO
    doc.setDrawColor(100); doc.setLineWidth(0.4);
    doc.line(75, footerY + 10, 125, footerY + 10);
    doc.setTextColor(0); doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("FIRMA DEL CLIENTE", 100, footerY + 15, { align: "center" });
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
    doc.text("Conformidad de Recepción de Equipo", 100, footerY + 19, { align: "center" });

    // Firma Autoridad (Derecha)
    doc.line(145, footerY + 10, 195, footerY + 10);
    doc.setTextColor(0); doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("MIGUEL ANGEL CUENCA C.", 170, footerY + 15, { align: "center" });
    doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
    doc.text("Director Operativo NOC - OmniTech", 170, footerY + 19, { align: "center" });

    doc.save(`OmniTech_Ingreso_${cita.nombre.replace(/\s+/g, '_')}.pdf`);
  };

  // 2. PDF DE ENTREGA
  const generarPDFEntrega = async (cita: any) => {
    const doc = new jsPDF();
    const costoFinal = parseFloat(cita.costoFinal || "0"); 
    const adelanto = parseFloat(cita.montoAdelanto || "0"); 
    const saldo = costoFinal - adelanto;
    const telLimpio = sanitizarTelefono(cita.telefono);

    // Cabecera Épica
    doc.setFillColor(6, 11, 25); 
    doc.rect(0, 0, 210, 50, 'F');
    doc.setFillColor(16, 185, 129); // Verde Esmeralda
    doc.rect(0, 50, 210, 2, 'F');

    doc.setTextColor(34, 211, 238);
    doc.setFontSize(28);
    doc.setFont("helvetica", "bold");
    doc.text("OMNITECH SOLUTIONS", 105, 25, { align: "center" });

    doc.setTextColor(200, 200, 200); 
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text("CERTIFICADO DE FINALIZACIÓN TÉCNICA", 105, 32, { align: "center" });

    doc.setFillColor(15, 23, 42); 
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(0.3);
    doc.roundedRect(65, 38, 80, 7, 1, 1, 'FD');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8); doc.setFont("courier", "bold");
    doc.text(`TICKET_ID :: ${cita.id.toUpperCase()}`, 105, 43, { align: "center" });

    // HUD Datos
    doc.setFillColor(250, 252, 255);
    doc.rect(14, 62, 182, 22, 'F'); 
    drawHUDCorners(doc, 14, 62, 182, 22, [16, 185, 129]);

    doc.setFillColor(15, 23, 42); 
    doc.rect(14, 62, 182, 7, 'F'); 
    doc.setTextColor(16, 185, 129); doc.setFontSize(8); doc.setFont("helvetica", "bold");
    doc.text("[ DATOS DE RESOLUCIÓN ]", 18, 67);
    
    doc.setTextColor(0, 0, 0); doc.setFontSize(9);
    doc.setFont("helvetica", "bold"); doc.text("TITULAR:", 18, 76); doc.setFont("helvetica", "normal"); doc.text(cita.nombre, 40, 76);
    doc.setFont("helvetica", "bold"); doc.text("CONTACTO:", 115, 76); doc.setFont("courier", "bold"); doc.text(telLimpio, 138, 76);
    doc.setFont("helvetica", "bold"); doc.text("CIERRE NOC:", 18, 82); doc.setFont("courier", "normal"); doc.text(new Date().toLocaleDateString(), 45, 82);
    doc.setFont("helvetica", "bold"); doc.text("MODALIDAD:", 115, 82); doc.setFont("courier", "normal"); doc.text(cita.modalidad.toUpperCase(), 138, 82);

    // Tabla Trabajo Realizado
    autoTable(doc, { 
      startY: 90, 
      headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 }, 
      bodyStyles: { fillColor: [250, 252, 255], textColor: [15, 23, 42], fontSize: 9 },
      head: [['[ REPORTE TÁCTICO DE INTERVENCIÓN - SOLUCIÓN ]']], 
      body: [[cita.trabajoFinal]], 
      theme: 'grid',
      styles: { cellPadding: 6 }
    });

    const finalY = (doc as any).lastAutoTable.finalY + 15; 

    // Módulo Financiero
    doc.setFillColor(248, 250, 252);
    doc.rect(14, finalY, 182, 35, 'F');
    drawHUDCorners(doc, 14, finalY, 182, 35, [15, 23, 42]);
    
    doc.setFillColor(15, 23, 42); 
    doc.rect(14, finalY, 182, 8, 'F');
    doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold");
    doc.text("[ MATRIZ DE LIQUIDACIÓN Y SALDOS ]", 18, finalY + 5.5);

    doc.setTextColor(0, 0, 0); doc.setFontSize(10);
    doc.setFont("helvetica", "bold"); doc.text("Costo Total de Operación:", 18, finalY + 16); doc.setFont("courier", "bold"); doc.text(`${costoFinal.toFixed(2)} Bs.`, 160, finalY + 16, { align: "right" });
    doc.setFont("helvetica", "bold"); doc.text("Adelanto Registrado a Cuenta:", 18, finalY + 23); doc.setFont("courier", "bold"); doc.text(`- ${adelanto.toFixed(2)} Bs.`, 160, finalY + 23, { align: "right" });
    
    doc.setDrawColor(200); doc.line(18, finalY + 27, 160, finalY + 27);
    
    doc.setFont("helvetica", "black"); doc.setFontSize(11);
    doc.text("SALDO FINAL A CANCELAR:", 18, finalY + 32); 
    doc.setFontSize(14); doc.setTextColor(220, 38, 38); 
    doc.text(`${saldo > 0 ? saldo.toFixed(2) : "0.00"} Bs.`, 160, finalY + 33, { align: "right" });

    // FOOTER
    const footerY = 250;
    const qrText = `[ OMNITECH SOLUTIONS - RED DE ÉLITE ]\n====================================\nID TRANSACCIÓN: ${cita.id}\nTITULAR: ${cita.nombre}\nFECHA CIERRE: ${new Date().toLocaleDateString()}\nCOSTO FINAL: ${costoFinal} Bs.\n====================================\n¡Gracias por confiar en OmniTech Solutions!\nSu seguridad e infraestructura están en las mejores manos.`;
    const base64QR = await generarQRBase64(qrText);
    
    if (base64QR) {
      doc.addImage(base64QR, 'PNG', 14, footerY - 15, 32, 32);
      doc.setFontSize(6); doc.setTextColor(100); doc.setFont("courier", "bold");
      doc.text("HASH VERIFICADO", 30, footerY + 21, { align: "center" });
    }

    if (cita.modalidad === "En Domicilio") {
      doc.setFillColor(241, 245, 249); 
      doc.rect(70, footerY - 5, 125, 25, 'F'); 
      doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(0);
      doc.text("[ VALIDACIÓN TÉCNICA REMOTA ]", 132.5, footerY + 2, { align: "center" });
      doc.setFontSize(8); doc.setFont("helvetica", "normal"); 
      doc.text("Certificación procesada vía enlace telemático en domicilio.", 132.5, footerY + 8, { align: "center" });
      doc.setTextColor(16, 185, 129); doc.setFont("courier", "bold");
      doc.text(`ESTADO DE RED: ${cita.conformidadDigital ? cita.conformidadDigital.toUpperCase() : "PENDIENTE DIGITAL"}`, 132.5, footerY + 14, { align: "center" });
    } else { 
      // Firma Cliente (Centro) - SIN LABORATORIO
      doc.setDrawColor(100); doc.setLineWidth(0.4);
      doc.line(75, footerY + 10, 125, footerY + 10);
      doc.setTextColor(0); doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text("FIRMA DEL CLIENTE", 100, footerY + 15, { align: "center" });
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
      doc.text("Conformidad de Finalización", 100, footerY + 19, { align: "center" });

      // Firma Autoridad (Derecha)
      doc.line(145, footerY + 10, 195, footerY + 10);
      doc.setTextColor(0); doc.setFontSize(9); doc.setFont("helvetica", "bold");
      doc.text("MIGUEL ANGEL CUENCA C.", 170, footerY + 15, { align: "center" });
      doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(100);
      doc.text("Director Operativo NOC - OmniTech", 170, footerY + 19, { align: "center" });
    }

    doc.save(`OmniTech_Entrega_${cita.nombre.replace(/\s+/g, '_')}.pdf`);
  };

  // ==========================================
  // RENDERIZADO DEL DASHBOARD HTML
  // ==========================================
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
      
      <div className="max-w-[1400px] mx-auto relative z-10">
        <header className="flex flex-col md:flex-row justify-between items-center bg-[#0a1120]/90 border border-slate-800 p-6 rounded-2xl backdrop-blur-xl mb-6 shadow-[0_0_30px_rgba(34,211,238,0.1)]">
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 tracking-wider uppercase">
              OMNITECH SOLUTIONS
            </h1>
            <p className="text-slate-400 text-sm mt-1 font-mono tracking-widest">
              Nivel de Acceso: <span className="ml-2 px-2 py-0.5 rounded font-bold bg-amber-900/50 text-amber-400 border border-amber-500">ADMINISTRADOR MAESTRO</span>
            </p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center space-x-4">
            <Link href="/radar" className="px-4 py-2 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-900/30 rounded-lg text-xs font-bold tracking-widest transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)] flex items-center">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-ping mr-2"></span> RADAR NOC
            </Link>
            <Link href="/academia" className="px-4 py-2 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-900/30 rounded-lg text-xs font-bold tracking-widest transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center">
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
          <button onClick={() => setActiveTab("analitica")} className={`px-6 py-3 rounded-lg text-xs font-bold tracking-widest transition-all whitespace-nowrap ${activeTab === "analitica" ? "bg-purple-600/20 text-purple-400 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)]" : "text-slate-500 hover:text-slate-300"}`}>ANALÍTICA FINANCIERA</button>
          <button onClick={() => setActiveTab("configuracion")} className={`px-6 py-3 rounded-lg text-xs font-bold tracking-widest transition-all whitespace-nowrap ${activeTab === "configuracion" ? "bg-amber-600/20 text-amber-400 border border-amber-500/30 shadow-[0_0_15px_rgba(245,158,11,0.15)]" : "text-slate-500 hover:text-slate-300"}`}>SALA DE CONTROL</button>
        </div>

        {activeTab === "monitoreo" && (
          <div className="animate-fade-in-up">
            <div className="mb-4 flex flex-col sm:flex-row items-center justify-between bg-[#0a1120]/80 p-4 rounded-2xl border border-cyan-900/40 backdrop-blur-md shadow-lg gap-4">
              <div className="relative w-full sm:max-w-md">
                <input type="text" placeholder="Buscar por Nombre o ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#030712] border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 text-sm font-mono" />
              </div>
            </div>
            <div className="bg-[#0a1120]/80 rounded-2xl border border-cyan-500/30 overflow-hidden backdrop-blur-md shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-slate-900/80 border-b border-cyan-500/30 text-cyan-500 uppercase text-[10px] font-black tracking-widest">
                      <th className="p-4">Cliente / Despliegue</th>
                      <th className="p-4">Diagnóstico Previo</th>
                      <th className="p-4">Finanzas</th>
                      <th className="p-4">Estado Operativo</th>
                      <th className="p-4 text-center">Acciones Tácticas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {citasFiltradas.map((cita: any) => (
                      <tr key={cita.id} className="hover:bg-slate-800/30 transition-colors group">
                        <td className="p-4">
                          <p className="font-bold text-white text-base mb-1">{cita.nombre}</p>
                          <p className="text-[10px] text-slate-400 font-mono mb-2">ID: {cita.id}</p>
                          <span className="text-slate-400 text-xs font-mono bg-slate-950 px-2 py-1 rounded border border-slate-800">{cita.fecha} | {cita.hora}</span>
                        </td>
                        <td className="p-4"><p className="text-slate-300 text-sm max-w-xs truncate">{cita.descripcion}</p></td>
                        <td className="p-4">
                          {cita.adelantoRealizado ? (
                            <div className="bg-emerald-950/30 border border-emerald-900/50 p-2 rounded w-max"><p className="text-emerald-400 font-bold text-xs">+ {cita.montoAdelanto} Bs.</p></div>
                          ) : <span className="text-slate-600 text-xs font-mono font-bold">PAGO PENDIENTE</span>}
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1.5 rounded text-[10px] font-black tracking-wider border block w-max mb-2 ${cita.estado === "Pendiente" ? "bg-amber-950/50 border-amber-500/50 text-amber-400" : cita.estado === "En Reparación" ? "bg-blue-950/50 border-blue-500/50 text-blue-400" : "bg-emerald-950/50 border-emerald-500/50 text-emerald-400"}`}>{cita.estado ? cita.estado.toUpperCase() : "PENDIENTE"}</span>
                          <select className="block w-full bg-[#030712] border border-slate-700 text-slate-300 text-[10px] rounded px-1 py-1 focus:outline-none focus:border-cyan-500 cursor-pointer" value={cita.estado || "Pendiente"} onChange={(e) => handleEstadoChange(cita, e.target.value)}>
                            <option value="Pendiente">Marcar Pendiente</option>
                            <option value="En Reparación">Iniciar Reparación</option>
                            <option value="Completado">Finalizar Equipo</option>
                          </select>
                        </td>
                        <td className="p-4 text-center space-y-2">
                          
                          {/* BOTÓN WHATSAPP DESPLEGABLE */}
                          <div className="relative group w-full">
                            <button className="w-full bg-green-600/20 hover:bg-green-500 hover:text-black text-green-400 text-[10px] font-bold px-3 py-2 rounded transition-all border border-green-500/30 flex items-center justify-center text-center cursor-pointer shadow-[0_0_10px_rgba(34,197,94,0.1)]">
                              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"></path></svg>
                              ENVIAR POR WA ▼
                            </button>
                            <div className="absolute right-0 top-full mt-1 w-full bg-[#0a1120] border border-green-500/30 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 overflow-hidden flex flex-col">
                              <a href={generarEnlaceWA(cita, 'ingreso')} target="_blank" rel="noopener noreferrer" className="px-3 py-3 text-[9px] font-bold text-green-400 hover:bg-green-900/50 border-b border-green-900/30 transition-colors">
                                MSJ INGRESO
                              </a>
                              {cita.estado === "Completado" && (
                                <a href={generarEnlaceWA(cita, 'finalizado')} target="_blank" rel="noopener noreferrer" className="px-3 py-3 text-[9px] font-bold text-green-400 hover:bg-green-900/50 transition-colors">
                                  MSJ FINALIZADO
                                </a>
                              )}
                            </div>
                          </div>

                          <button onClick={() => generarPDFIngreso(cita)} className="w-full bg-cyan-900/30 hover:bg-cyan-600 text-cyan-400 hover:text-white text-[10px] font-bold px-3 py-2 rounded transition-all border border-cyan-700/50">PDF INGRESO</button>
                          {cita.estado === "Completado" && (
                            <button onClick={() => generarPDFEntrega(cita)} className="w-full bg-emerald-900/30 hover:bg-emerald-600 text-emerald-400 hover:text-white text-[10px] font-bold px-3 py-2 rounded transition-all border border-emerald-700/50">PDF FINALIZADO</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* MÓDULOS DE RELLENO */}
        {activeTab === "analitica" && <div className="text-center p-10 text-slate-500">MÓDULO ANALÍTICO ACTIVO</div>}
        {activeTab === "configuracion" && <div className="text-center p-10 text-slate-500">SALA DE CONTROL ACTIVA</div>}
      </div>

      {showCloseModal && citaActiva && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#030712]/95 backdrop-blur-xl">
          <div className="bg-[#0a1120] border border-cyan-500/50 p-6 rounded-2xl max-w-lg w-full shadow-[0_0_80px_rgba(34,211,238,0.2)] transform animate-fade-in-up relative">
            <h3 className="text-xl font-black text-white mb-4 tracking-widest border-b border-slate-800 pb-3 flex items-center pr-8">
              <span className="w-2 h-2 bg-cyan-500 rounded-full mr-3 animate-pulse"></span> 
              REPORTE DE FINALIZACIÓN
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-cyan-500 mb-1 uppercase">Trabajo Realmente Ejecutado</label>
                <textarea rows={3} value={cierreData.trabajoRealizado} onChange={(e) => setCierreData({...cierreData, trabajoRealizado: e.target.value})} className="w-full bg-[#030712] border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-400 text-sm resize-none"></textarea>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-cyan-500 mb-1 uppercase">Costo Total (Bs.)</label>
                  <input type="number" value={cierreData.costoTotal} onChange={(e) => setCierreData({...cierreData, costoTotal: e.target.value})} className="w-full bg-[#030712] border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-400 text-sm font-mono" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-cyan-500 mb-1 uppercase">Modalidad</label>
                  <select value={cierreData.modalidad} onChange={(e) => setCierreData({...cierreData, modalidad: e.target.value})} className="w-full bg-[#030712] border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-400 text-sm cursor-pointer">
                    <option value="Laboratorio">En Laboratorio</option>
                    <option value="En Domicilio">En Domicilio</option>
                  </select>
                </div>
              </div>
              <div className="flex space-x-4 pt-4 mt-4 border-t border-slate-800">
                <button onClick={() => setShowCloseModal(false)} className="flex-1 py-3 rounded-lg border border-slate-700 text-slate-400 font-bold hover:bg-slate-800 hover:text-white transition-all text-xs tracking-widest">CANCELAR</button>
                <button onClick={confirmarCierre} disabled={guardandoCierre} className="flex-1 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all text-xs tracking-widest">{guardandoCierre ? "GUARDANDO..." : "SELLAR"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}