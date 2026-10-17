import { db, CFG, SERVICOS_PADRAO, toMin, brl, hoje, dataBR, slotsDoDia } from "./config.js";
import { collection, getDocs, query, where, doc, writeBatch } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const $ = id => document.getElementById(id);
const S = { data: hoje(), hora: "", servico: new URLSearchParams(location.search).get("corte") || "" };
$("marca").textContent = CFG.nome; document.title = "Agendar | " + CFG.nome;

let servicos = SERVICOS_PADRAO;
try {
  const q = await getDocs(collection(db, "servicos"));
  const l = q.docs.map(d => ({ id: d.id, ...d.data() })).filter(s => s.ativo !== false);
  if (l.length) servicos = l;
} catch (e) { console.warn(e); }
if (!servicos.some(s => s.id === S.servico)) S.servico = "";

// Catálogo de escolha: só aparece ao clicar no botão
$("servicos").innerHTML = servicos.map(s => `<div class="card" role="button" tabindex="0" data-id="${s.id}">
  ${s.foto ? `<img src="${s.foto}" alt="">` : `<div class="ph" aria-hidden="true"></div>`}<h3>${s.nome}</h3>
  <div><span class="preco">${brl(s.preco)}</span> <small>${s.dur} min</small></div></div>`).join("");

const atual = () => servicos.find(x => x.id === S.servico);
function atualizar() {
  const s = atual();
  document.querySelectorAll("#servicos .card").forEach(c => c.classList.toggle("sel", c.dataset.id === S.servico));
  $("abrirCortes").textContent = s ? `Corte: ${s.nome} (alterar)` : "Escolher o corte (opcional)";
  $("resumo").innerHTML = `Horário: <b>${S.hora ? dataBR(S.data) + " às " + S.hora : "—"}</b><br>Corte: <b>${s ? s.nome + " • " + brl(s.preco) : "a decidir na hora"}</b>`;
}
$("abrirCortes").onclick = () => {
  const aberto = $("painelCortes").classList.toggle("hidden") === false;
  $("abrirCortes").setAttribute("aria-expanded", aberto);
};
const escolher = c => { if (!c) return; S.servico = S.servico === c.dataset.id ? "" : c.dataset.id; atualizar(); };
$("servicos").onclick = e => escolher(e.target.closest(".card"));
$("servicos").onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); escolher(e.target.closest(".card")); } };

$("data").min = hoje(); $("data").value = hoje();
$("data").onchange = e => { S.data = e.target.value; S.hora = ""; $("s4").classList.add("hidden"); carregarHoras(); };

async function carregarHoras() {
  const dia = new Date(S.data + "T12:00").getDay();
  if (CFG.folga.includes(dia)) { $("horas").innerHTML = `<p class="msg">Fechado neste dia. Escolha outra data.</p>`; return; }
  $("horas").innerHTML = `<p class="msg">Carregando…</p>`;
  const q = await getDocs(query(collection(db, "ocupados"), where("data", "==", S.data)));
  const oc = new Set(q.docs.map(d => d.data().hora)), agora = new Date();
  $("horas").innerHTML = slotsDoDia().map(hr => {
    let ok = !oc.has(hr);
    if (S.data === hoje() && toMin(hr) <= agora.getHours() * 60 + agora.getMinutes()) ok = false;
    return `<button class="hora${S.hora === hr ? " sel" : ""}" data-h="${hr}" ${ok ? "" : "disabled"}>${hr}</button>`;
  }).join("");
}
carregarHoras(); atualizar();
$("horas").onclick = e => {
  const b = e.target.closest(".hora"); if (!b || b.disabled) return;
  S.hora = b.dataset.h; document.querySelectorAll(".hora").forEach(x => x.classList.toggle("sel", x === b));
  atualizar(); $("s4").classList.remove("hidden"); $("s4").scrollIntoView({ behavior: "smooth" });
};
$("tel").oninput = e => {
  let v = e.target.value.replace(/\D/g, "").slice(0, 11);
  e.target.value = v.length > 6 ? `(${v.slice(0, 2)}) ${v.slice(2, v.length > 10 ? 7 : 6)}-${v.slice(v.length > 10 ? 7 : 6)}` : v.length > 2 ? `(${v.slice(0, 2)}) ${v.slice(2)}` : v;
};
$("enviar").onclick = async () => {
  const nome = $("nomeCli").value.trim(), tel = $("tel").value.replace(/\D/g, "");
  if (nome.length < 2) return alert("Digite seu nome.");
  if (tel.length < 10) return alert("Digite um telefone válido com DDD.");
  const s = atual();
  $("enviar").disabled = true;
  try {
    const b = writeBatch(db);
    b.set(doc(db, "ocupados", `${S.data}_${S.hora}`), { data: S.data, hora: S.hora }); // falha se já existir
    b.set(doc(collection(db, "agendamentos")), {
      nome, telefone: tel, servico: s ? s.nome : "A definir", servicoId: s ? s.id : "", interesse: !!s,
      data: S.data, hora: S.hora, slots: [S.hora], valor: 0, status: "pendente", criadoEm: Date.now()
    });
    await b.commit();
    const t = `Olá! Sou ${nome} e reservei um horário para ${dataBR(S.data)} às ${S.hora}.` + (s ? ` Corte escolhido: ${s.nome} (${brl(s.preco)}).` : " Vou escolher o corte na hora.");
    location.href = `https://wa.me/${CFG.whatsapp}?text=${encodeURIComponent(t)}`;
  } catch (e) {
    console.error(e); alert("Esse horário acabou de ser reservado. Escolha outro.");
    $("enviar").disabled = false; carregarHoras();
  }
};
