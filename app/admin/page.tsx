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

  const [showAgenda, setShowAgenda] = useState(false);
  const [agendaDate, setAgendaDate] = useState(() => new Date().toISOString().split('T')[0]);

  const [showChoqueModal, setShowChoqueModal] = useState(false);
  const [choqueInfo, setChoqueInfo] = useState<any>(null);

  const [showCloseModal, setShowCloseModal] = useState(false);
  const [citaActiva, setCitaActiva] = useState<any>(null);
  const [cierreData, setCierreData] = useState({ 
    trabajoRealizado: "", 
    costoTotal: "", 
    modalidad: "Laboratorio" 
  });
  const [guardandoCierre, setGuardandoCierre] = useState(false);

  // === NUEVO: ESTADO PARA CONTROLAR EL MENÚ DE WHATSAPP EN CELULARES ===
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

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

  // === MODIFICADO: MOTOR DE ENLACES WA PROFUNDO (wa.me) ===
  const generarEnlaceWA = (cita: any, tipo: 'coordinacion' | 'ingreso' | 'finalizado') => {
    let numStr = cita.telefono ? String(cita.telefono).replace(/\D/g, '') : '';
    numStr = numStr.replace(/^591/, '');
    let num = '591' + numStr;

    let texto = "";

    if (tipo === 'coordinacion') {
      texto = `Estimado/a ${cita.nombre},\n\nNos comunicamos de *OmniTech Solutions* para coordinar los detalles de su solicitud de servicio técnico.\n\nPor favor, ¿podría confirmarnos su ubicación exacta o enviarnos un punto GPS para programar el servicio técnico?\n\nQuedamos a la espera de su confirmación.`;
    } else if (tipo === 'ingreso') {
      texto = `Estimado/a ${cita.nombre},\n\nLe informamos desde *OmniTech Solutions* que su equipo ha sido registrado formalmente en nuestro sistema bajo el Ticket ID: [ ${cita.id.toUpperCase()} ].\n\nA continuación, le enviaremos su Comprobante de Servicio Solicitado en formato PDF para su respectivo control.\n\nGracias por su confianza.`;
    } else {
      texto = `Estimado/a ${cita.nombre},\n\nDesde *OmniTech Solutions* le comunicamos que el servicio técnico correspondiente a su solicitud ha sido completado.\n\nEn breve le remitiremos el Certificado de Finalización Técnica en formato PDF, detallando el trabajo realizado y la liquidación correspondiente.\n\n*Puede realizar el pago correspondiente escaneando el código QR oficial de pago que viene adjunto en la parte inferior de su PDF.*\n\nQuedamos a su entera disposición.\nGracias por su confianza.`;
    }
    
    // CAMBIO VITAL: Ahora usa el Deep Link oficial wa.me para evadir bloqueos de contacto
    return `https://wa.me/${num}?text=${encodeURIComponent(texto)}`;
  };

  const generarEnlaceCalendario = (cita: any) => {
    if (!cita.fecha || !cita.hora) return "#";
    const [year, month, day] = cita.fecha.split("-");
    const [hour, minute] = cita.hora.split(":");
    
    const startDate = new Date(Number(year), Number(month) - 1, Number(day), Number(hour), Number(minute));
    const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000); 
    
    const formatGoogleDate = (d: Date) => d.toISOString().replace(/-|:|\.\d\d\d/g, "");
    
    const text = encodeURIComponent(`NOC OmniTech: ${cita.nombre}`);
    const details = encodeURIComponent(`Ticket ID: ${cita.id}\nFalla: ${cita.descripcion}\nTeléfono: ${cita.telefono}`);
    const location = encodeURIComponent(cita.direccion || "No especificada");
    
    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${text}&dates=${formatGoogleDate(startDate)}/${formatGoogleDate(endDate)}&details=${details}&location=${location}`;
  };

  const verificarChoqueAgenda = (fecha: string, hora: string) => {
    return citas.find(c => c.estado === "En Reparación" && c.fecha === fecha && c.hora === hora);
  };

  const handleEstadoChange = async (cita: any, nuevoEstado: string, selectElement: HTMLSelectElement) => {
    if (nuevoEstado === "Completado") { 
      setCitaActiva(cita); setShowCloseModal(true); 
    } else if (nuevoEstado === "En Reparación") {
      const choque = verificarChoqueAgenda(cita.fecha, cita.hora);
      if (choque && choque.id !== cita.id) {
        setChoqueInfo({ hora: cita.hora, fecha: cita.fecha, clienteChoque: choque.nombre });
        setShowChoqueModal(true);
        selectElement.value = cita.estado || "Pendiente";
        return; 
      }
      try { 
        await updateDoc(doc(db, "citas", cita.id), { estado: nuevoEstado }); 
        registrarAuditoria(`Selló hora [${cita.hora}] e inició reparación para el ticket [${cita.nombre}]`);
      } catch (error) { alert("Error al actualizar estado."); } 
    } else { 
      try { 
        await updateDoc(doc(db, "citas", cita.id), { estado: nuevoEstado }); 
        registrarAuditoria(`Cambió estado del ticket [${cita.nombre}] a: ${nuevoEstado}`);
      } catch (error) { alert("Error al actualizar estado."); } 
    }
  };

  const actualizarHora = async (citaId: string, nuevaHora: string, nombreCliente: string) => {
    if(!nuevaHora) return;
    try {
      await updateDoc(doc(db, "citas", citaId), { hora: nuevaHora });
      registrarAuditoria(`Hora de intervención actualizada a [${nuevaHora}] para ${nombreCliente}`);
    } catch (error) { console.error("Error al actualizar hora"); }
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
      registrarAuditoria(`Cerró ticket [${citaActiva.nombre}] por ${cierreData.costoTotal} Bs. Liberando hora del Radar.`);
      setShowCloseModal(false); setCierreData({ trabajoRealizado: "", costoTotal: "", modalidad: "Laboratorio" }); setCitaActiva(null);
    } catch (error) { alert("Error."); } finally { setGuardandoCierre(false); }
  };

  const copiarID = (id: string) => { navigator.clipboard.writeText(id); setCopiedId(id); setTimeout(() => setCopiedId(""), 2000); };

  const exportarCSV = () => {
    const encabezados = ["ID_Ticket", "Fecha_Cita", "Cliente", "Telefono", "Estado", "Modalidad", "Costo_Total"];
    const filas = citas.map((c: any) => [c.id, c.fecha, `"${c.nombre}"`, c.telefono, c.estado, c.modalidad || "N/A", c.costoFinal || "0"]);
    const contenidoCSV = [encabezados.join(","), ...filas.map((f: any) => f.join(","))].join("\n");
    const blob = new Blob([contenidoCSV], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.setAttribute("download", `OmniTech_Reporte.csv`);
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  const totalTickets = citas.length;
  const ticketsCompletados = citas.filter((c: any) => c.estado === "Completado").length;
  const porcentajeExito = totalTickets === 0 ? 0 : Math.round((ticketsCompletados / totalTickets) * 100);
  const ingresosTotales = citas.reduce((acc: number, c: any) => (c.estado === "Completado" && c.costoFinal) ? acc + parseFloat(c.costoFinal) : acc, 0);
  const adelantosFlotantes = citas.reduce((acc: number, c: any) => (c.estado !== "Completado" && c.adelantoRealizado && c.montoAdelanto) ? acc + parseFloat(c.montoAdelanto) : acc, 0);
  const citasFiltradas = citas.filter((cita: any) => cita.nombre.toLowerCase().includes(searchTerm.toLowerCase()) || cita.id.toLowerCase().includes(searchTerm.toLowerCase()));

  const citasBloqueadasAgenda = citas
    .filter((c: any) => c.estado === "En Reparación")
    .sort((a, b) => {
      if (a.fecha === b.fecha) { return a.hora.localeCompare(b.hora); }
      return a.fecha.localeCompare(b.fecha);
    });

  // ==========================================================
  // GENERADORES DE PDF (DESCARGA DIRECTA)
  // ==========================================================
  const sanitizarTelefono = (tel: string) => {
    if (!tel) return "No registrado";
    const limpio = tel.replace(/@.*$/, ''); 
    return limpio.startsWith('591') && limpio.length > 8 ? `+591 ${limpio.substring(3)}` : limpio;
  };

  const generarQRBase64 = async (texto: string): Promise<string> => {
    return new Promise((resolve) => {
      const img = new window.Image(); img.crossOrigin = "Anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas"); canvas.width = img.width; canvas.height = img.height;
        const ctx = canvas.getContext("2d"); if(ctx) ctx.drawImage(img, 0, 0); resolve(canvas.toDataURL("image/png"));
      };
      img.onerror = () => resolve(""); 
      img.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(texto)}&margin=1`;
    });
  };

  const drawHUDCorners = (doc: any, x: number, y: number, w: number, h: number, color: number[]) => {
    doc.setDrawColor(color[0], color[1], color[2]); doc.setLineWidth(0.4); const l = 4;
    doc.line(x, y, x + l, y); doc.line(x, y, x, y + l); doc.line(x + w, y, x + w - l, y); doc.line(x + w, y, x + w, y + l); 
    doc.line(x, y + h, x + l, y + h); doc.line(x, y + h, x, y + h - l); doc.line(x + w, y + h, x + w - l, y + h); doc.line(x + w, y + h, x + w, y + h - l); 
  };

  const procesarYCompartirPDF = async (doc: any, nombreArchivo: string) => {
    doc.save(nombreArchivo);
  };

  const generarPDFIngreso = async (cita: any) => {
    const doc = new jsPDF(); const telLimpio = sanitizarTelefono(cita.telefono);
    doc.setFillColor(6, 11, 25); doc.rect(0, 0, 210, 50, 'F'); doc.setFillColor(34, 211, 238); doc.rect(0, 50, 210, 2, 'F');
    doc.setTextColor(34, 211, 238); doc.setFontSize(28); doc.setFont("helvetica", "bold"); doc.text("OMNITECH SOLUTIONS", 105, 25, { align: "center" });
    doc.setTextColor(148, 163, 184); doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text("COMPROBANTE DE SERVICIO SOLICITADO", 105, 32, { align: "center" }); 
    doc.setFillColor(15, 23, 42); doc.setDrawColor(34, 211, 238); doc.setLineWidth(0.3); doc.roundedRect(65, 38, 80, 7, 1, 1, 'FD');
    doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont("courier", "bold"); doc.text(`TICKET_ID :: ${cita.id.toUpperCase()}`, 105, 43, { align: "center" });
    doc.setFillColor(250, 252, 255); doc.rect(14, 62, 182, 28, 'F'); drawHUDCorners(doc, 14, 62, 182, 28, [34, 211, 238]);
    doc.setFillColor(15, 23, 42); doc.rect(14, 62, 182, 7, 'F'); doc.setTextColor(34, 211, 238); doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text("[ PARÁMETROS DEL SOLICITANTE ]", 18, 67);
    doc.setTextColor(0, 0, 0); doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text("CLIENTE:", 18, 76); doc.setFont("helvetica", "normal"); doc.text(cita.nombre, 40, 76);
    doc.setFont("helvetica", "bold"); doc.text("CONTACTO:", 115, 76); doc.setFont("courier", "bold"); doc.text(telLimpio, 138, 76);
    doc.setFont("helvetica", "bold"); doc.text("UBICACIÓN:", 18, 84); let dirBreve = cita.direccion || "No especificada"; if (dirBreve.length > 80) dirBreve = dirBreve.substring(0, 80) + "..."; doc.setFont("courier", "normal"); doc.text(dirBreve, 45, 84);
    autoTable(doc, { startY: 96, headStyles: { fillColor: [6, 11, 25], textColor: [34, 211, 238], fontStyle: 'bold', fontSize: 9 }, bodyStyles: { fillColor: [250, 252, 255], textColor: [10, 10, 10], fontSize: 9 }, head: [['[ REPORTE DE INCIDENCIA PRELIMINAR ]']], body: [[cita.descripcion]], theme: 'grid', styles: { cellPadding: 6 } });
    const finalY = (doc as any).lastAutoTable.finalY + 15; 
    doc.setFillColor(245, 248, 250); doc.rect(14, finalY, 182, 12, 'F'); doc.setDrawColor(34, 211, 238); doc.setLineWidth(1.5); doc.line(14, finalY, 14, finalY + 12); 
    doc.setFontSize(10); doc.setTextColor(15, 23, 42); doc.setFont("helvetica", "bold"); doc.text("ESTADO FINANCIERO:", 18, finalY + 8);
    if (cita.adelantoRealizado) { doc.setTextColor(16, 185, 129); doc.text(`ADELANTO CONFIRMADO: ${cita.montoAdelanto} Bs.`, 65, finalY + 8); } else { doc.setTextColor(220, 38, 38); doc.text(">> PAGO PENDIENTE DE ASIGNACIÓN", 65, finalY + 8); }
    const footerY = 250;
    const qrText = `[ OMNITECH SOLUTIONS ]\n====================================\nTICKET: ${cita.id}\nTITULAR: ${cita.nombre}\nFECHA: ${cita.fecha}\nESTADO: REGISTRADO\n====================================\nSu solicitud se encuentra en proceso.`;
    const base64QR = await generarQRBase64(qrText);
    if (base64QR) { doc.addImage(base64QR, 'PNG', 14, footerY - 15, 32, 32); doc.setFontSize(6); doc.setTextColor(100); doc.setFont("courier", "bold"); doc.text("SELLO CRIPTOGRÁFICO", 30, footerY + 21, { align: "center" }); }
    doc.setDrawColor(100); doc.setLineWidth(0.4); doc.line(75, footerY + 10, 125, footerY + 10); doc.setTextColor(0); doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text("FIRMA DEL CLIENTE", 100, footerY + 15, { align: "center" }); doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(100); doc.text("Conformidad de Solicitud de Servicio", 100, footerY + 19, { align: "center" });
    doc.line(145, footerY + 10, 195, footerY + 10); doc.setTextColor(0); doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text("MIGUEL ANGEL CUENCA C.", 170, footerY + 15, { align: "center" }); doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(100); doc.text("Director Operativo NOC", 170, footerY + 19, { align: "center" });
    await procesarYCompartirPDF(doc, `OmniTech_Ingreso_${cita.nombre.replace(/\s+/g, '_')}.pdf`);
  };

  const generarPDFEntrega = async (cita: any) => {
    const doc = new jsPDF();
    const costoFinal = parseFloat(cita.costoFinal || "0"); const adelanto = parseFloat(cita.montoAdelanto || "0"); const saldo = costoFinal - adelanto; const telLimpio = sanitizarTelefono(cita.telefono);
    doc.setFillColor(6, 11, 25); doc.rect(0, 0, 210, 50, 'F'); doc.setFillColor(16, 185, 129); doc.rect(0, 50, 210, 2, 'F'); doc.setTextColor(34, 211, 238); doc.setFontSize(28); doc.setFont("helvetica", "bold"); doc.text("OMNITECH SOLUTIONS", 105, 25, { align: "center" }); doc.setTextColor(200, 200, 200); doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.text("CERTIFICADO DE FINALIZACIÓN TÉCNICA", 105, 32, { align: "center" });
    doc.setFillColor(15, 23, 42); doc.setDrawColor(16, 185, 129); doc.setLineWidth(0.3); doc.roundedRect(65, 38, 80, 7, 1, 1, 'FD'); doc.setTextColor(255, 255, 255); doc.setFontSize(8); doc.setFont("courier", "bold"); doc.text(`TICKET_ID :: ${cita.id.toUpperCase()}`, 105, 43, { align: "center" });
    doc.setFillColor(250, 252, 255); doc.rect(14, 62, 182, 22, 'F'); drawHUDCorners(doc, 14, 62, 182, 22, [16, 185, 129]); doc.setFillColor(15, 23, 42); doc.rect(14, 62, 182, 7, 'F'); doc.setTextColor(16, 185, 129); doc.setFontSize(8); doc.setFont("helvetica", "bold"); doc.text("[ DATOS DE RESOLUCIÓN ]", 18, 67);
    doc.setTextColor(0, 0, 0); doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text("TITULAR:", 18, 76); doc.setFont("helvetica", "normal"); doc.text(cita.nombre, 40, 76); doc.setFont("helvetica", "bold"); doc.text("CONTACTO:", 115, 76); doc.setFont("courier", "bold"); doc.text(telLimpio, 138, 76); doc.setFont("helvetica", "bold"); doc.text("CIERRE NOC:", 18, 82); doc.setFont("courier", "normal"); doc.text(new Date().toLocaleDateString(), 45, 82); doc.setFont("helvetica", "bold"); doc.text("MODALIDAD:", 115, 82); doc.setFont("courier", "normal"); doc.text(cita.modalidad.toUpperCase(), 138, 82);
    autoTable(doc, { startY: 90, headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 9 }, bodyStyles: { fillColor: [250, 252, 255], textColor: [15, 23, 42], fontSize: 9 }, head: [['[ REPORTE TÁCTICO DE INTERVENCIÓN - SOLUCIÓN ]']], body: [[cita.trabajoFinal]], theme: 'grid', styles: { cellPadding: 6 } });
    const finalY = (doc as any).lastAutoTable.finalY + 15; 
    doc.setFillColor(248, 250, 252); doc.rect(14, finalY, 182, 35, 'F'); drawHUDCorners(doc, 14, finalY, 182, 35, [15, 23, 42]); doc.setFillColor(15, 23, 42); doc.rect(14, finalY, 182, 8, 'F'); doc.setTextColor(255, 255, 255); doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text("[ MATRIZ DE LIQUIDACIÓN Y SALDOS ]", 18, finalY + 5.5);
    doc.setTextColor(0, 0, 0); doc.setFontSize(10); doc.setFont("helvetica", "bold"); doc.text("Costo Total de Operación:", 18, finalY + 16); doc.setFont("courier", "bold"); doc.text(`${costoFinal.toFixed(2)} Bs.`, 160, finalY + 16, { align: "right" }); doc.setFont("helvetica", "bold"); doc.text("Adelanto Registrado a Cuenta:", 18, finalY + 23); doc.setFont("courier", "bold"); doc.text(`- ${adelanto.toFixed(2)} Bs.`, 160, finalY + 23, { align: "right" }); doc.setDrawColor(200); doc.line(18, finalY + 27, 160, finalY + 27); doc.setFont("helvetica", "black"); doc.setFontSize(11); doc.text("SALDO FINAL A CANCELAR:", 18, finalY + 32); doc.setFontSize(14); doc.setTextColor(220, 38, 38); doc.text(`${saldo > 0 ? saldo.toFixed(2) : "0.00"} Bs.`, 160, finalY + 33, { align: "right" });
    const footerY = 250;
    const qrText = `[ OMNITECH SOLUTIONS ]\n====================================\nID TRANSACCIÓN: ${cita.id}\nTITULAR: ${cita.nombre}\nFECHA CIERRE: ${new Date().toLocaleDateString()}\nCOSTO FINAL: ${costoFinal} Bs.\n====================================\nServicio Concluido Exitosamente.`;
    const base64QR = await generarQRBase64(qrText);
    if (base64QR) { doc.addImage(base64QR, 'PNG', 14, footerY - 15, 32, 32); doc.setFontSize(6); doc.setTextColor(100); doc.setFont("courier", "bold"); doc.text("HASH VERIFICADO", 30, footerY + 21, { align: "center" }); }
    if (cita.modalidad === "En Domicilio") {
      doc.setFillColor(241, 245, 249); doc.rect(70, footerY - 5, 125, 25, 'F'); doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.setTextColor(0); doc.text("[ VALIDACIÓN TÉCNICA REMOTA ]", 132.5, footerY + 2, { align: "center" }); doc.setFontSize(8); doc.setFont("helvetica", "normal"); doc.text("Certificación procesada vía enlace telemático en domicilio.", 132.5, footerY + 8, { align: "center" }); doc.setTextColor(16, 185, 129); doc.setFont("courier", "bold"); doc.text(`ESTADO DE RED: PENDIENTE`, 132.5, footerY + 14, { align: "center" });
    } else { 
      doc.setDrawColor(100); doc.setLineWidth(0.4); doc.line(75, footerY + 10, 125, footerY + 10); doc.setTextColor(0); doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text("FIRMA DEL CLIENTE", 100, footerY + 15, { align: "center" }); doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(100); doc.text("Conformidad de Finalización", 100, footerY + 19, { align: "center" });
      doc.line(145, footerY + 10, 195, footerY + 10); doc.setTextColor(0); doc.setFontSize(9); doc.setFont("helvetica", "bold"); doc.text("MIGUEL ANGEL CUENCA C.", 170, footerY + 15, { align: "center" }); doc.setFontSize(7); doc.setFont("helvetica", "normal"); doc.setTextColor(100); doc.text("Director Operativo NOC", 170, footerY + 19, { align: "center" });
    }
    await procesarYCompartirPDF(doc, `OmniTech_Entrega_${cita.nombre.replace(/\s+/g, '_')}.pdf`);
  };

  if (authChecking) return <div className="min-h-screen bg-[#030712] flex items-center justify-center"><p className="text-cyan-500 font-mono animate-pulse tracking-widest">[ VERIFICANDO CREDENCIALES... ]</p></div>;
  if (!user) { 
    return ( 
      <div className="min-h-screen bg-[#030712] flex items-center justify-center p-4 relative overflow-hidden"> 
        <div className="bg-[#0a1120]/90 p-8 md:p-10 rounded-2xl border border-cyan-500/40 backdrop-blur-xl shadow-[0_0_50px_rgba(34,211,238,0.15)] w-full max-w-md relative z-10"> 
          <div className="text-center mb-8"><h1 className="text-3xl font-black text-white tracking-widest">SISTEMA <span className="text-cyan-500">NOC</span></h1><p className="text-red-400 font-mono text-xs mt-2 font-bold tracking-widest border border-red-900/50 bg-red-950/30 py-1 rounded">ACCESO RESTRINGIDO</p></div> 
          <form onSubmit={handleLogin} className="space-y-6"> 
            <div><label className="block text-xs font-mono text-cyan-500 mb-2 uppercase">Credencial</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full bg-[#030712] border border-slate-700 rounded p-3 text-white focus:outline-none focus:border-cyan-500" /></div> 
            <div><label className="block text-xs font-mono text-cyan-500 mb-2 uppercase">Contraseña</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full bg-[#030712] border border-slate-700 rounded p-3 text-white focus:outline-none focus:border-cyan-500 tracking-widest" /></div> 
            {loginError && <p className="text-red-500 text-xs font-bold text-center bg-red-950/50 p-2 rounded">{loginError}</p>} 
            <button type="submit" disabled={isLoggingIn} className="w-full py-4 rounded font-bold tracking-widest bg-cyan-600 hover:bg-cyan-500 text-white shadow-[0_0_20px_rgba(34,211,238,0.3)]">{isLoggingIn ? "AUTENTICANDO..." : "INICIAR SESIÓN"}</button> 
          </form> 
        </div> 
      </div> 
    ); 
  }

  return (
    // === MODIFICADO: overflow-x-hidden AÑADIDO AL MAIN PARA MATAR LA FRANJA BLANCA MÓVIL ===
    <main className="min-h-screen bg-[#030712] text-white p-4 md:p-8 font-sans selection:bg-cyan-500 relative overflow-x-hidden w-full">
      <div className="fixed inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none z-0"></div>
      
      <div className="max-w-[1400px] mx-auto relative z-10">
        <header className="flex flex-col md:flex-row justify-between items-center bg-[#0a1120]/90 border border-slate-800 p-6 rounded-2xl backdrop-blur-xl mb-6 shadow-[0_0_30px_rgba(34,211,238,0.1)]">
          <div>
            <h1 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-600 tracking-wider uppercase">OMNITECH SOLUTIONS</h1>
            <p className="text-slate-400 text-sm mt-1 font-mono tracking-widest">Nivel de Acceso: <span className="ml-2 px-2 py-0.5 rounded font-bold bg-amber-900/50 text-amber-400 border border-amber-500">ADMINISTRADOR MAESTRO</span></p>
          </div>
          <div className="mt-4 md:mt-0 flex items-center space-x-4">
            <Link href="/radar" className="px-4 py-2 border border-cyan-500/50 text-cyan-400 hover:bg-cyan-900/30 rounded-lg text-xs font-bold tracking-widest transition-all shadow-[0_0_15px_rgba(34,211,238,0.2)] flex items-center"><span className="w-2 h-2 bg-red-500 rounded-full animate-ping mr-2"></span> RADAR NOC</Link>
            <Link href="/academia" className="px-4 py-2 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-900/30 rounded-lg text-xs font-bold tracking-widest transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center">ACADEMIA</Link>
            <div className="flex items-center bg-[#030712] border border-cyan-900/50 px-4 py-2 rounded-lg"><div className="w-3 h-3 bg-green-500 rounded-full animate-ping mr-3"></div><span className="text-green-400 text-sm font-bold tracking-widest">{user.email}</span></div>
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
            
            <div className="mb-4 flex flex-col sm:flex-row items-center justify-between bg-[#0a1120]/80 p-4 rounded-2xl border border-cyan-900/40 backdrop-blur-md shadow-lg gap-4 relative z-[200]">
              <div className="w-full sm:max-w-md">
                <input type="text" placeholder="Buscar por Nombre o ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-[#030712] border border-slate-700 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-cyan-400 text-sm font-mono" />
              </div>

              <div className="relative w-full sm:w-auto">
                <button 
                  onClick={() => setShowAgenda(!showAgenda)} 
                  className={`w-full sm:w-auto px-6 py-3 rounded-lg text-xs font-bold tracking-widest transition-all flex items-center justify-center border ${showAgenda ? 'bg-cyan-900/50 border-cyan-400 text-white shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'bg-[#030712] border-slate-700 text-cyan-500 hover:border-cyan-500 hover:bg-cyan-950/30'}`}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                  RADAR DE AGENDA GLOBAL
                </button>

                {showAgenda && (
                  <div className="absolute right-0 top-full mt-2 w-full sm:w-96 bg-[#0a1120] border border-cyan-500/50 rounded-xl shadow-[0_0_50px_rgba(34,211,238,0.3)] p-4 animate-fade-in-up">
                    <label className="block text-[10px] font-bold text-cyan-500 mb-3 uppercase tracking-widest border-b border-slate-800 pb-2">Todas las Citas Selladas Activas</label>
                    
                    <div className="max-h-80 overflow-y-auto pr-1 space-y-3">
                      {citasBloqueadasAgenda.length === 0 ? (
                        <div className="text-center py-4 border border-dashed border-emerald-900 rounded bg-emerald-950/20">
                          <p className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest flex items-center justify-center"><svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path></svg> AGENDA DESPEJADA</p>
                          <p className="text-[9px] text-slate-500 mt-1">No hay reparaciones programadas activas.</p>
                        </div>
                      ) : (
                        citasBloqueadasAgenda.map(c => (
                          <div key={c.id} className="flex flex-col bg-blue-950/30 border border-blue-900/50 p-3 rounded hover:bg-blue-900/40 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                              <div className="flex flex-col">
                                <span className="text-cyan-400 font-bold text-[10px] tracking-widest mb-0.5">{c.fecha}</span>
                                <span className="text-blue-400 font-black text-sm bg-[#030712] px-2 py-0.5 rounded border border-blue-900 w-max">{c.hora}</span>
                              </div>
                              <div className="flex flex-col items-end text-right">
                                <span className="text-slate-200 text-xs font-bold truncate max-w-[150px]">{c.nombre}</span>
                                <span className="text-slate-500 text-[9px] uppercase mt-1">ID: {c.id.substring(0,6)}...</span>
                              </div>
                            </div>
                            
                            <a 
                              href={generarEnlaceCalendario(c)} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="w-full bg-slate-900 hover:bg-blue-600 text-slate-300 hover:text-white border border-slate-700 hover:border-blue-500 text-[9px] font-bold py-1.5 rounded transition-all flex items-center justify-center mt-1"
                            >
                              <svg className="w-3 h-3 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                              SINCRONIZAR ALARMA EN CELULAR
                            </a>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div className="bg-[#0a1120]/80 rounded-2xl border border-cyan-500/30 overflow-visible backdrop-blur-md shadow-2xl relative z-10 w-full">
              <div className="overflow-x-auto w-full pb-32">
                <table className="w-full text-left border-collapse min-w-[1000px]">
                  <thead className="relative z-0">
                    <tr className="bg-slate-900/80 border-b border-cyan-500/30 text-cyan-500 uppercase text-[10px] font-black tracking-widest">
                      <th className="p-4">Cliente / Rastreo GPS</th>
                      <th className="p-4">Diagnóstico Previo</th>
                      <th className="p-4">Finanzas</th>
                      <th className="p-4">Estado Operativo</th>
                      <th className="p-4 text-center">Acciones Tácticas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/50">
                    {citasFiltradas.map((cita: any) => {
                      const isLocked = cita.estado === "En Reparación";
                      return (
                      <tr key={cita.id} className={`hover:bg-slate-800/30 transition-colors group ${isLocked ? 'bg-blue-950/10' : ''}`}>
                        
                        <td className="p-4">
                          <p className="font-bold text-white text-base mb-0.5">{cita.nombre}</p>
                          <p className="text-[10px] text-slate-400 font-mono mb-2">ID: {cita.id}</p>
                          
                          <div className="flex flex-col space-y-2">
                            <div className={`flex items-center space-x-2 text-xs font-mono px-2 py-1 rounded border w-max ${isLocked ? 'bg-blue-950/50 border-blue-900/50 text-blue-400' : 'bg-slate-950 border-slate-800 text-slate-400'}`}>
                              <span>{cita.fecha} |</span>
                              <input 
                                type="time"
                                defaultValue={cita.hora || ""}
                                disabled={isLocked}
                                onBlur={(e) => {
                                  if(!isLocked && e.target.value && e.target.value !== cita.hora) {
                                    actualizarHora(cita.id, e.target.value, cita.nombre);
                                  }
                                }}
                                className={`bg-transparent font-bold focus:outline-none focus:border-cyan-400 border-b border-dashed px-1 [&::-webkit-calendar-picker-indicator]:invert ${isLocked ? 'border-transparent text-blue-400 cursor-not-allowed opacity-80' : 'border-slate-600 text-cyan-400 hover:border-cyan-500 cursor-pointer'}`}
                                title={isLocked ? "Hora Sellada. Imposible modificar durante reparación." : "Modificar Hora Exacta Acordada"}
                              />
                              {isLocked && <svg className="w-3 h-3 text-blue-500 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"></path></svg>}
                            </div>
                            
                            {cita.coordenadas && cita.coordenadas.trim() !== "" ? (
                              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cita.coordenadas)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center bg-blue-900/40 hover:bg-blue-600 text-blue-400 hover:text-white text-[10px] font-bold px-2 py-1.5 rounded transition-all border border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)] w-max"><svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg> VER EN MAPS</a>
                            ) : (
                              <div className="bg-slate-900/50 border border-slate-800 p-1.5 rounded w-max max-w-[200px]"><span className="text-[8px] text-slate-500 uppercase font-bold block mb-0.5">Dirección:</span><span className="text-[10px] text-slate-300 truncate block">{cita.direccion || "No registrada"}</span></div>
                            )}
                          </div>
                        </td>

                        <td className="p-4"><p className="text-slate-300 text-sm max-w-xs truncate">{cita.descripcion}</p></td>
                        <td className="p-4">
                          {cita.adelantoRealizado ? (
                            <div className="bg-emerald-950/30 border border-emerald-900/50 p-2 rounded w-max"><p className="text-emerald-400 font-bold text-xs">+ {cita.montoAdelanto} Bs.</p></div>
                          ) : <span className="text-slate-600 text-xs font-mono font-bold">PAGO PENDIENTE</span>}
                        </td>
                        <td className="p-4">
                          <span className={`px-3 py-1.5 rounded text-[10px] font-black tracking-wider border block w-max mb-2 ${cita.estado === "Pendiente" ? "bg-amber-950/50 text-amber-400" : cita.estado === "En Reparación" ? "bg-blue-950/50 text-blue-400 shadow-[0_0_10px_rgba(59,130,246,0.3)] animate-pulse" : "bg-emerald-950/50 text-emerald-400"}`}>{cita.estado ? cita.estado.toUpperCase() : "PENDIENTE"}</span>
                          <select 
                            className="block w-full bg-[#030712] border border-slate-700 text-slate-300 text-[10px] rounded px-1 py-1 focus:outline-none focus:border-cyan-500 cursor-pointer" 
                            value={cita.estado || "Pendiente"} 
                            onChange={(e) => handleEstadoChange(cita, e.target.value, e.target)}
                          >
                            <option value="Pendiente">Marcar Pendiente</option>
                            <option value="En Reparación">Iniciar Reparación (Sellar Hora)</option>
                            <option value="Completado">Finalizar Equipo</option>
                          </select>
                        </td>
                        <td className="p-4 align-top w-72">
                          <div className="grid grid-cols-2 gap-3 relative">
                            
                            {/* === MODIFICADO: MENÚ DE WHATSAPP REESCRITO PARA CELULARES (ONCLICK REACT) === */}
                            <div className="bg-[#030712] border border-green-900/50 p-2 rounded-lg shadow-inner flex flex-col justify-between">
                              <p className="text-[8px] text-green-500 font-bold uppercase tracking-widest mb-2 text-center">Mensajería WA</p>
                              <div className="flex flex-col space-y-1.5 relative">
                                <button 
                                  onClick={() => setOpenDropdownId(openDropdownId === cita.id ? null : cita.id)}
                                  className="w-full bg-green-900/30 hover:bg-green-600 text-green-400 hover:text-white text-[9px] font-bold px-1 py-1.5 rounded transition-all border border-green-700/50 text-center flex items-center justify-center cursor-pointer shadow-[0_0_10px_rgba(34,197,94,0.1)]"
                                >
                                  ENVIAR POR WA ▼
                                </button>
                                
                                {openDropdownId === cita.id && (
                                  <div className="absolute left-0 top-full mt-1 w-full bg-[#0a1120] border border-green-500/30 rounded-lg shadow-xl z-[100] flex flex-col animate-fade-in-up">
                                    <a href={generarEnlaceWA(cita, 'coordinacion')} target="_blank" rel="noopener noreferrer" className="px-3 py-3 text-[9px] font-bold text-green-400 hover:bg-green-900/50 border-b border-green-900/30 transition-colors text-center">MSJ COORDINAR</a>
                                    <a href={generarEnlaceWA(cita, 'ingreso')} target="_blank" rel="noopener noreferrer" className="px-3 py-3 text-[9px] font-bold text-green-400 hover:bg-green-900/50 border-b border-green-900/30 transition-colors text-center">MSJ INGRESO</a>
                                    {cita.estado === "Completado" && (
                                      <a href={generarEnlaceWA(cita, 'finalizado')} target="_blank" rel="noopener noreferrer" className="px-3 py-3 text-[9px] font-bold text-green-400 hover:bg-green-900/50 transition-colors text-center">MSJ FINALIZADO</a>
                                    )}
                                  </div>
                                )}
                              </div>
                            </div>
                            
                            <div className="bg-[#030712] border border-cyan-900/50 p-2 rounded-lg shadow-inner flex flex-col justify-between">
                              <p className="text-[8px] text-cyan-500 font-bold uppercase tracking-widest mb-2 text-center">Documentos</p>
                              <div className="flex flex-col space-y-1.5 h-full justify-end">
                                <button onClick={() => generarPDFIngreso(cita)} className="w-full bg-cyan-900/30 hover:bg-cyan-600 text-cyan-400 hover:text-white text-[9px] font-bold px-1 py-1.5 rounded transition-all border border-cyan-700/50">PDF INGRESO</button>
                                {cita.estado === "Completado" && (
                                  <button onClick={() => generarPDFEntrega(cita)} className="w-full bg-blue-900/40 hover:bg-blue-600 text-blue-400 hover:text-white text-[9px] font-bold px-1 py-1.5 rounded transition-all border border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.3)]">PDF FINALIZADO</button>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>

                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* RESTAURACIÓN DEL MÓDULO ANALÍTICO */}
        {activeTab === "analitica" && (
          <div className="animate-fade-in-up space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-[#0a1120]/80 p-6 rounded-2xl border border-purple-500/30 backdrop-blur-md shadow-[0_0_20px_rgba(168,85,247,0.15)] relative overflow-hidden group">
                <h3 className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1">Ingresos Consolidados</h3>
                <p className="text-3xl font-black text-white">{ingresosTotales.toFixed(2)} <span className="text-sm text-purple-400">Bs.</span></p>
              </div>
              <div className="bg-[#0a1120]/80 p-6 rounded-2xl border border-emerald-500/30 backdrop-blur-md shadow-[0_0_20px_rgba(16,185,129,0.15)] relative overflow-hidden group">
                <h3 className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1">Adelantos (Flujo)</h3>
                <p className="text-3xl font-black text-white">{adelantosFlotantes.toFixed(2)} <span className="text-sm text-emerald-400">Bs.</span></p>
              </div>
              <div className="bg-[#0a1120]/80 p-6 rounded-2xl border border-cyan-500/30 backdrop-blur-md shadow-[0_0_20px_rgba(34,211,238,0.15)] relative overflow-hidden group">
                <h3 className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1">Éxito Operativo</h3>
                <div className="flex items-end space-x-2"><p className="text-3xl font-black text-white">{porcentajeExito}%</p></div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden"><div className="bg-cyan-500 h-full rounded-full" style={{ width: `${porcentajeExito}%` }}></div></div>
              </div>
              <div className="bg-[#0a1120]/80 p-6 rounded-2xl border border-slate-500/30 backdrop-blur-md shadow-lg relative overflow-hidden group">
                <h3 className="text-slate-400 text-[10px] uppercase font-bold tracking-widest mb-1">Volumen Histórico</h3>
                <p className="text-3xl font-black text-white">{totalTickets}</p>
              </div>
            </div>
            <div className="flex justify-end mt-4">
              <button onClick={exportarCSV} className="bg-[#030712] border border-cyan-800/50 hover:bg-cyan-900/50 hover:border-cyan-500 text-cyan-400 hover:text-white px-6 py-4 rounded-xl font-bold tracking-widest transition-all flex items-center">
                EXPORTAR DATOS A EXCEL
              </button>
            </div>
          </div>
        )}

        {/* RESTAURACIÓN DE LA SALA DE CONTROL */}
        {activeTab === "configuracion" && ( 
          <div className="animate-fade-in-up grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-[#0a1120]/80 p-6 rounded-2xl border border-amber-500/30 backdrop-blur-md shadow-[0_0_20px_rgba(245,158,11,0.1)]">
              <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-4">
                <h2 className="text-lg font-black text-amber-500 tracking-widest">RADAR DE AUDITORÍA OPERATIVA</h2>
                <span className="bg-amber-950/50 text-amber-400 border border-amber-900/50 px-2 py-1 rounded text-[10px] font-mono animate-pulse">LIVE LOGS</span>
              </div>
              <div className="bg-[#030712] border border-slate-800 rounded-xl p-4 h-96 overflow-y-auto font-mono text-xs">
                {logs.length === 0 ? <p className="text-slate-600 text-center mt-10">No hay registros aún.</p> : (
                  logs.map((log: any) => (
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
                <h2 className="text-lg font-black text-white tracking-widest">VARIABLES DE ENTORNO</h2>
              </div>
              <div className="bg-[#030712] p-4 rounded-xl border border-slate-800">
                <label className="block text-xs font-bold text-slate-400 mb-2 uppercase tracking-widest">Nro. WhatsApp Corporativo</label>
                <div className="flex space-x-2">
                  <input type="text" value="+591 7XXXXXXXX" readOnly className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-slate-500 font-mono text-sm cursor-not-allowed" />
                  <button className="bg-slate-800 text-slate-500 px-4 rounded-lg text-xs font-bold cursor-not-allowed">BLOQUEADO</button>
                </div>
              </div>
            </div>
          </div> 
        )}
      </div>

      {showCloseModal && citaActiva && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-[#030712]/95 backdrop-blur-xl">
          <div className="bg-[#0a1120] border border-cyan-500/50 p-6 rounded-2xl max-w-lg w-full shadow-[0_0_80px_rgba(34,211,238,0.2)] transform animate-fade-in-up relative">
            <button onClick={() => setShowCloseModal(false)} className="absolute top-4 right-4 text-slate-500 hover:text-red-500 transition-colors focus:outline-none"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg></button>
            <h3 className="text-xl font-black text-white mb-4 tracking-widest border-b border-slate-800 pb-3 flex items-center pr-8"><span className="w-2 h-2 bg-cyan-500 rounded-full mr-3 animate-pulse"></span> REPORTE DE FINALIZACIÓN</h3>
            <div className="space-y-4">
              <div><label className="block text-xs font-bold text-cyan-500 mb-1 uppercase">Trabajo Realmente Ejecutado</label><textarea rows={3} value={cierreData.trabajoRealizado} onChange={(e) => setCierreData({...cierreData, trabajoRealizado: e.target.value})} className="w-full bg-[#030712] border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-400 text-sm resize-none"></textarea></div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-cyan-500 mb-1 uppercase">Costo Total (Bs.)</label><input type="number" value={cierreData.costoTotal} onChange={(e) => setCierreData({...cierreData, costoTotal: e.target.value})} className="w-full bg-[#030712] border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-400 text-sm font-mono" /></div>
                <div><label className="block text-xs font-bold text-cyan-500 mb-1 uppercase">Modalidad</label><select value={cierreData.modalidad} onChange={(e) => setCierreData({...cierreData, modalidad: e.target.value})} className="w-full bg-[#030712] border border-slate-700 rounded-lg p-3 text-white focus:outline-none focus:border-cyan-400 text-sm cursor-pointer"><option value="Laboratorio">En Laboratorio</option><option value="En Domicilio">En Domicilio</option></select></div>
              </div>
              <div className="flex space-x-4 pt-4 mt-4 border-t border-slate-800">
                <button onClick={() => setShowCloseModal(false)} className="flex-1 py-3 rounded-lg border border-slate-700 text-slate-400 font-bold hover:bg-slate-800 hover:text-white transition-all text-xs tracking-widest">CANCELAR</button>
                <button onClick={confirmarCierre} disabled={guardandoCierre} className="flex-1 py-3 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold shadow-[0_0_15px_rgba(34,211,238,0.4)] transition-all text-xs tracking-widest">{guardandoCierre ? "GUARDANDO..." : "SELLAR"}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL ALERTA ROJA - ESCUDO ANTI CHOQUES === */}
      {showChoqueModal && choqueInfo && (
        <div className="fixed inset-0 z-[600] flex items-center justify-center p-4 bg-red-950/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#030712] border border-red-500 p-8 rounded-2xl max-w-md w-full shadow-[0_0_80px_rgba(239,68,68,0.4)] text-center relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_20px_rgba(239,68,68,1)]"></div>
            <div className="w-20 h-20 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.4)] animate-pulse">
              <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
            </div>
            <h3 className="text-2xl font-black text-red-500 mb-2 tracking-widest uppercase">¡ALERTA DE CHOQUE!</h3>
            <p className="text-slate-300 mb-6 text-sm leading-relaxed">
              El Sistema NOC ha bloqueado esta acción. Ya tienes una intervención sellada a las <strong className="text-white bg-slate-800 px-2 py-0.5 rounded">{choqueInfo.hora}</strong> el día <strong className="text-white">{choqueInfo.fecha}</strong> para el cliente: <br/><br/>
              <strong className="text-red-400 uppercase tracking-widest bg-red-950/50 px-4 py-2 border border-red-900/50 rounded inline-block">{choqueInfo.clienteChoque}</strong>
            </p>
            <p className="text-xs text-slate-500 font-mono mb-8">Por favor, edita la hora de la cita actual antes de iniciar la reparación.</p>
            <button onClick={() => setShowChoqueModal(false)} className="w-full bg-slate-800 hover:bg-red-600 text-white font-bold py-4 rounded-xl transition-all tracking-widest uppercase shadow-[0_0_20px_rgba(239,68,68,0.2)]">ENTENDIDO</button>
          </div>
        </div>
      )}

    </main>
  );
}