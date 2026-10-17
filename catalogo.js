import { db, CFG, SERVICOS_PADRAO, brl } from "./config.js";
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const $ = id => document.getElementById(id);
$("marca").textContent = CFG.nome; document.title = "Catálogo | " + CFG.nome;

let servicos = SERVICOS_PADRAO;
try {
  const q = await getDocs(collection(db, "servicos"));
  const l = q.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.ativo !== false);
  if (l.length) servicos = l;
} catch (e) { console.warn(e); }

$("lista").innerHTML = servicos.map(s => `<article class="card">
  ${s.foto ? `<img src="${s.foto}" alt="${s.nome}">` : `<div class="ph" aria-hidden="true"></div>`}
  <h3>${s.nome}</h3><small>${s.desc || ""}</small>
  <div><span class="preco">${brl(s.preco)}</span> <small>${s.dur} min</small></div>
  <a class="btn mini" href="index.html?corte=${encodeURIComponent(s.id)}#agendar">Agendar este corte</a></article>`).join("");
