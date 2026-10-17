// 1) Cole aqui a config do seu projeto Firebase (Console > Configurações do projeto > Seus apps > Web)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const app = initializeApp({
  apiKey: "AIzaSyBvSEOrDzxChr5i1Xp6VUUQpy8oXF2Eyww",
  authDomain: "barbearia-58eba.firebaseapp.com",
  projectId: "barbearia-58eba",
  storageBucket: "barbearia-58eba.firebasestorage.app",
  messagingSenderId: "306112726852",
  appId: "1:306112726852:web:42c224886a661341cdf911",
  measurementId: "G-QHE41YHZBX"
});
export const db = getFirestore(app);
export const auth = getAuth(app);

// 2) Dados da barbearia
export const CFG = {
  nome: "Barbearia do Zé",
  whatsapp: "5582999731253",
  abre: "09:00", fecha: "19:00", passo: 30, // minutos por bloco
  folga: [0]                                // 0 = domingo
};
// Serviços padrão (usados se a coleção "servicos" estiver vazia)
export const SERVICOS_PADRAO = [
  { id: "p1", nome: "Corte social", desc: "Tesoura e máquina, acabamento na navalha", preco: 35, dur: 30, foto: "" },
  { id: "p2", nome: "Degradê", desc: "Degradê navalhado com finalização", preco: 40, dur: 30, foto: "" },
  { id: "p3", nome: "Barba", desc: "Toalha quente e navalha", preco: 25, dur: 30, foto: "" },
  { id: "p4", nome: "Corte + Barba", desc: "O combo completo", preco: 60, dur: 60, foto: "" },
  { id: "p5", nome: "Sobrancelha", desc: "Alinhamento na navalha", preco: 10, dur: 30, foto: "" }
];
export const toMin = h => { const [a, b] = h.split(":"); return +a * 60 + +b; };
export const toHM = m => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(m % 60).padStart(2, "0");
export const brl = v => Number(v).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const hoje = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
export const dataBR = s => s.split("-").reverse().join("/");
export const slotsDoDia = () => { const r = []; for (let m = toMin(CFG.abre); m < toMin(CFG.fecha); m += CFG.passo) r.push(toHM(m)); return r; };
