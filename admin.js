import { db, auth, CFG, SERVICOS_PADRAO, toMin, toHM, brl, hoje, dataBR, slotsDoDia } from "./config.js";
import { signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { collection, doc, getDocs, onSnapshot, query, where, writeBatch, updateDoc, addDoc, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
const $ = id => document.getElementById(id);
const wa = (tel, msg) => `https://wa.me/55${tel.replace(/\D/g, "")}?text=${encodeURIComponent(msg)}`;
let servicos = [], unsubs = [], primeira = true, ultimoRel = [], selBlq = new Set(), ocup = new Set();

$("entrar").onclick = () => signInWithEmailAndPassword(auth, $("email").value, $("senha").value).catch(() => alert("E-mail ou senha incorretos."));
$("sair").onclick = () => signOut(auth);
onAuthStateChanged(auth, u => { $("login").classList.toggle("hidden", !!u); $("app").classList.toggle("hidden", !u); if (u) iniciar(); });

$("tabs").onclick = e => {
  const t = e.target.dataset.t; if (!t) return;
  document.querySelectorAll("#tabs button").forEach(b => b.classList.toggle("on", b === e.target));
  ["agenda", "catalogo", "rel", "clientes", "link"].forEach(x => $("t-" + x).classList.toggle("hidden", x !== t));
  if (t === "rel") relatorio("dia"); if (t === "clientes") clientes();
};

async function carregarServicos() {
  const q = await getDocs(collection(db, "servicos"));
  servicos = q.docs.map(d => ({ id: d.id, ...d.data() }));
  $("mServ").innerHTML = `<option value="">Corte a definir</option>` + servicos.map(s => `<option value="${s.id}">${s.nome} — ${brl(s.preco)}</option>`).join("");
  $("catLista").innerHTML = servicos.map(s => `<div class="row"><div><b>${s.nome}</b> <span class="tag">${s.ativo === false ? "inativo" : "ativo"}</span><br><small>${brl(s.preco)} • ${s.dur} min</small></div>
  <div class="acoes"><button class="btn mini sec" data-tog="${s.id}">${s.ativo === false ? "Ativar" : "Desativar"}</button><button class="btn mini perigo" data-del="${s.id}">Excluir</button></div></div>`).join("") || `<p class="msg">Nenhum serviço. O site usa os padrões do config.js até você cadastrar.</p>`;
}
$("catLista").onclick = async e => {
  const t = e.target.dataset.tog, d = e.target.dataset.del;
  if (t) { const s = servicos.find(x => x.id === t); await updateDoc(doc(db, "servicos", t), { ativo: s.ativo === false }); }
  if (d && confirm("Excluir serviço?")) await deleteDoc(doc(db, "servicos", d));
  carregarServicos();
};
$("cSalvar").onclick = async () => {
  if (!$("cNome").value || !$("cPreco").value || !$("cDur").value) return alert("Preencha nome, preço e duração.");
  await addDoc(collection(db, "servicos"), { nome: $("cNome").value, desc: $("cDesc").value, preco: +$("cPreco").value, dur: +$("cDur").value, foto: $("cFoto").value, ativo: true });
  ["cNome", "cDesc", "cPreco", "cDur", "cFoto"].forEach(i => $(i).value = ""); carregarServicos();
};
$("cPadrao").onclick = async () => { for (const s of SERVICOS_PADRAO) { const { id, ...r } = s; await addDoc(collection(db, "servicos"), { ...r, ativo: true }); } carregarServicos(); };

function iniciar() {
  const opts = slotsDoDia().map(h => `<option>${h}</option>`).join("");
  $("mHora").innerHTML = opts;
  $("dia").value ||= hoje(); $("rDia").value ||= hoje(); $("rMes").value ||= hoje().slice(0, 7);
  const link = location.href.replace("admin.html", "").split("?")[0];
  $("lnk").textContent = link; $("qr").src = "https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=" + encodeURIComponent(link);
  carregarServicos(); escutarDia();
}
$("dia").onchange = escutarDia;

function beep() { try { const c = new AudioContext(), o = c.createOscillator(); o.connect(c.destination); o.frequency.value = 880; o.start(); o.stop(c.currentTime + .25); } catch {} }
function escutarDia() {
  unsubs.forEach(u => u()); unsubs = []; primeira = true; selBlq.clear(); ocup = new Set(); desenharBlq(); const d = $("dia").value;
  unsubs.push(onSnapshot(query(collection(db, "agendamentos"), where("data", "==", d)), snap => {
    if (!primeira && snap.docChanges().some(c => c.type === "added")) beep(); primeira = false;
    const l = snap.docs.map(x => ({ id: x.id, ...x.data() })).sort((a, b) => a.hora.localeCompare(b.hora));
    $("lista").innerHTML = l.map(a => `<div class="row"><div><b>${a.hora}</b> ${a.nome} <span class="tag ${a.status}">${a.status}</span><br><small>${a.servico}${a.status === "concluido" ? " • " + brl(a.valor) : ""} • ${a.telefone}${a.obs ? " • " + a.obs : ""}</small></div>
    <div class="acoes">
    <a class="btn mini sec" target="_blank" href="${wa(a.telefone, `Olá ${a.nome}! Lembrete: ${a.servico} dia ${dataBR(a.data)} às ${a.hora} na ${CFG.nome}. Pode confirmar?`)}">Lembrar</a>
    ${a.status === "pendente" ? `<button class="btn mini" data-s="confirmado" data-id="${a.id}">Confirmar</button>` : ""}
    ${["pendente", "confirmado"].includes(a.status) ? `<select class="mini-sel" data-sel="${a.id}"><option value="">Corte feito…</option>${servicos.map(v => `<option value="${v.id}" ${v.id === a.servicoId ? "selected" : ""}>${v.nome} ${brl(v.preco)}</option>`).join("")}</select><button class="btn mini" data-s="concluido" data-id="${a.id}">Concluir</button><button class="btn mini sec" data-s="faltou" data-id="${a.id}">Faltou</button><button class="btn mini perigo" data-s="cancelado" data-id="${a.id}">Cancelar</button>` : ""}
    </div></div>`).join("") || `<p class="msg">Nenhum agendamento neste dia.</p>`;
    window._dia = l;
  }));
  unsubs.push(onSnapshot(query(collection(db, "ocupados"), where("data", "==", d)), snap => {
    ocup = new Set(snap.docs.map(x => x.data().hora)); ocup.forEach(h => selBlq.delete(h)); desenharBlq();
  }));
  unsubs.push(onSnapshot(query(collection(db, "ocupados"), where("data", "==", d), where("bloqueio", "==", true)), snap => {
    $("bloqueios").innerHTML = snap.docs.map(x => `<div class="row"><span>Bloqueado: ${x.data().hora}</span><button class="btn mini sec" data-unb="${x.id}">Liberar</button></div>`).join("");
  }));
}
$("lista").onclick = async e => {
  const { s, id } = e.target.dataset; if (!s) return;
  const a = window._dia.find(x => x.id === id);
  if (s === "cancelado" || s === "faltou") { const b = writeBatch(db); (a.slots || []).forEach(h => b.delete(doc(db, "ocupados", `${a.data}_${h}`))); b.update(doc(db, "agendamentos", id), { status: s }); await b.commit(); }
  else if (s === "concluido") {
    const v = servicos.find(x => x.id === document.querySelector(`[data-sel="${id}"]`).value);
    if (!v) return alert("Escolha o corte que foi feito antes de concluir.");
    await updateDoc(doc(db, "agendamentos", id), { status: s, servico: v.nome, servicoId: v.id, valor: +v.preco });
  } else await updateDoc(doc(db, "agendamentos", id), { status: s });
};
$("bloqueios").onclick = e => { if (e.target.dataset.unb) deleteDoc(doc(db, "ocupados", e.target.dataset.unb)); };
function desenharBlq() {
  $("blqHoras").innerHTML = slotsDoDia().map(h => `<button class="hora${selBlq.has(h) ? " sel" : ""}" data-h="${h}" ${ocup.has(h) ? "disabled" : ""}>${h}</button>`).join("");
}
$("blqHoras").onclick = e => {
  const b = e.target.closest(".hora"); if (!b || b.disabled) return;
  const h = b.dataset.h; selBlq.has(h) ? selBlq.delete(h) : selBlq.add(h); b.classList.toggle("sel");
};
$("blqTodos").onclick = () => { slotsDoDia().filter(h => !ocup.has(h)).forEach(h => selBlq.add(h)); desenharBlq(); };
$("blqLimpar").onclick = () => { selBlq.clear(); desenharBlq(); };
$("blq").onclick = async () => {
  if (!selBlq.size) return alert("Selecione ao menos um horário.");
  const d = $("dia").value;
  try {
    const b = writeBatch(db);
    selBlq.forEach(h => b.set(doc(db, "ocupados", `${d}_${h}`), { data: d, hora: h, bloqueio: true }));
    await b.commit(); selBlq.clear(); desenharBlq();
  } catch { alert("Algum horário selecionado acabou de ser ocupado. Confira a lista e tente de novo."); }
};
$("mSalvar").onclick = async () => {
  const s = servicos.find(x => x.id === $("mServ").value), d = $("dia").value, h = $("mHora").value;
  if (!$("mNome").value) return alert("Informe o nome.");
  try {
    const b = writeBatch(db), n = Math.ceil((s ? s.dur : CFG.passo) / CFG.passo), slots = [];
    for (let i = 0; i < n; i++) { const x = toHM(toMin(h) + i * CFG.passo); slots.push(x); b.set(doc(db, "ocupados", `${d}_${x}`), { data: d, hora: x }); }
    b.set(doc(collection(db, "agendamentos")), { nome: $("mNome").value, telefone: $("mTel").value.replace(/\D/g, "") || "0000000000", servico: s ? s.nome : "A definir", servicoId: s ? s.id : "", data: d, hora: h, slots, valor: 0, status: "pendente", obs: "", criadoEm: Date.now() });
    await b.commit(); $("mNome").value = ""; $("mTel").value = "";
  } catch { alert("Esse horário já está ocupado."); }
};

async function relatorio(modo) {
  const [a, b] = modo === "dia" ? [$("rDia").value, $("rDia").value] : [$("rMes").value + "-01", $("rMes").value + "-31"];
  const q = await getDocs(query(collection(db, "agendamentos"), where("data", ">=", a), where("data", "<=", b)));
  const l = ultimoRel = q.docs.map(x => x.data()), ok = l.filter(x => x.status === "concluido");
  const fat = ok.reduce((s, x) => s + x.valor, 0), cont = st => l.filter(x => x.status === st).length;
  const agrup = (arr, f, v = () => 1) => Object.entries(arr.reduce((m, x) => (m[f(x)] = (m[f(x)] || 0) + v(x), m), {}));
  const barras = (arr, fmt = x => x) => { const mx = Math.max(1, ...arr.map(x => x[1])); return arr.map(([k, v]) => `<div class="barra"><span style="min-width:110px">${k}</span><i style="width:${v / mx * 55}%"></i><small>${fmt(v)}</small></div>`).join("") || `<p class="msg">Sem dados.</p>`; };
  $("relOut").innerHTML = `<div class="kpis"><div class="kpi"><b>${brl(fat)}</b>Faturamento</div><div class="kpi"><b>${ok.length}</b>Concluídos</div>
  <div class="kpi"><b>${brl(ok.length ? fat / ok.length : 0)}</b>Ticket médio</div><div class="kpi"><b>${cont("cancelado")}</b>Cancelados</div><div class="kpi"><b>${cont("faltou")}</b>Faltas</div></div>
  <h3>Serviços mais vendidos</h3>${barras(agrup(ok, x => x.servico).sort((x, y) => y[1] - x[1]))}
  <h3 style="margin-top:14px">Horários de pico</h3>${barras(agrup(l.filter(x => x.status !== "cancelado"), x => x.hora).sort())}
  ${modo === "mes" ? `<h3 style="margin-top:14px">Faturamento por dia</h3>${barras(agrup(ok, x => dataBR(x.data).slice(0, 5), x => x.valor).sort(), brl)}` : ""}`;
}
$("rBtnDia").onclick = () => relatorio("dia"); $("rBtnMes").onclick = () => relatorio("mes");
$("rCsv").onclick = () => {
  const csv = "data;hora;nome;telefone;servico;valor;status\n" + ultimoRel.map(x => [x.data, x.hora, x.nome, x.telefone, x.servico, x.valor, x.status].join(";")).join("\n");
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv" })); a.download = "relatorio.csv"; a.click();
};

async function clientes() {
  const q = await getDocs(collection(db, "agendamentos")), m = {};
  q.docs.forEach(d => { const x = d.data(), c = m[x.telefone] ||= { nome: x.nome, tel: x.telefone, visitas: 0, gasto: 0, ultima: "" }; if (x.status === "concluido") { c.visitas++; c.gasto += x.valor; } if (x.data > c.ultima) c.ultima = x.data; });
  $("cliOut").innerHTML = Object.values(m).sort((a, b) => b.visitas - a.visitas).map(c => `<div class="row"><div><b>${c.nome}</b> ${c.visitas && c.visitas % 10 === 0 ? `<span class="tag concluido">Ganhou corte grátis</span>` : ""}<br>
  <small>${c.visitas} visitas • ${brl(c.gasto)} • última: ${dataBR(c.ultima)} • faltam ${10 - c.visitas % 10} p/ fidelidade</small></div>
  <a class="btn mini zap" target="_blank" href="${wa(c.tel, `Olá ${c.nome}! Aqui é da ${CFG.nome}. Que tal agendar seu próximo corte?`)}">WhatsApp</a></div>`).join("") || `<p class="msg">Sem clientes ainda.</p>`;
}