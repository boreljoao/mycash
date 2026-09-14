/* ===========================================================
   Meu Caixa — app.js
   Estado local (localStorage) + sincronização opcional (Supabase)
   =========================================================== */
"use strict";

// ---------- utilidades ----------
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
const todayISO = () => new Date().toISOString().slice(0, 10);
const monthKey = d => (d || todayISO()).slice(0, 7);
const pad = n => String(n).padStart(2, "0");
const fmtMoney = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
let hideValues = localStorage.getItem("mycash-hide") === "1";
const money = v => hideValues ? "R$ ••••" : fmtMoney.format(Number(v) || 0);
const moneyAlways = v => fmtMoney.format(Number(v) || 0);
const shortDate = s => new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" }).format(new Date(s + "T12:00:00"));
const fullDate = s => new Date(s + "T12:00:00").toLocaleDateString("pt-BR");
const monthName = key => { const [y, m] = key.split("-"); return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(+y, +m - 1, 1)).replace(/^./, c => c.toUpperCase()); };
const shiftMonth = (key, n) => { const [y, m] = key.split("-").map(Number); const d = new Date(y, m - 1 + n, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
const escapeHtml = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const sum = arr => arr.reduce((s, x) => s + (Number(x) || 0), 0);
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;

function toast(message, kind = "") {
  const el = $("#toast"); el.textContent = message; el.className = "toast show " + kind;
  clearTimeout(window.__toastTimer); window.__toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}
function confirmDialog(text, title = "Confirmar") {
  return new Promise(res => {
    const d = $("#confirmModal"); $("#confirmTitle").textContent = title; $("#confirmText").textContent = text;
    const yes = $("#confirmYes"), no = $("#confirmNo");
    const done = v => { d.close(); yes.onclick = no.onclick = null; res(v); };
    yes.onclick = () => done(true); no.onclick = () => done(false); d.onclose = () => res(false);
    d.showModal();
  });
}
const animate = (el, keyframes, opts) => { try { window.__motion?.animate?.(el, keyframes, opts); } catch (e) { /* sem animação */ } };

// ---------- categorias padrão ----------
const DEFAULT_CATEGORIES = [
  { name: "Alimentação", icon: "🍽", color: "#1d7a55", kind: "expense" },
  { name: "Moradia", icon: "🏠", color: "#6b9eb5", kind: "expense" },
  { name: "Transporte", icon: "🚗", color: "#e49a57", kind: "expense" },
  { name: "Saúde", icon: "💊", color: "#ce5a5a", kind: "expense" },
  { name: "Lazer", icon: "🎉", color: "#8d78c8", kind: "expense" },
  { name: "Compras", icon: "🛍", color: "#c97fb0", kind: "expense" },
  { name: "Assinaturas", icon: "📱", color: "#4f8fb8", kind: "expense" },
  { name: "Educação", icon: "📚", color: "#b58a3c", kind: "expense" },
  { name: "Contas", icon: "🧾", color: "#7c8a83", kind: "expense" },
  { name: "Cartão", icon: "💳", color: "#3f5f52", kind: "expense" },
  { name: "Empresa", icon: "💼", color: "#2f4858", kind: "expense" },
  { name: "Impostos", icon: "🏛", color: "#9a6b4f", kind: "expense" },
  { name: "Outros", icon: "•", color: "#b7c0bb", kind: "expense" },
  { name: "Salário", icon: "💰", color: "#1d7a55", kind: "income" },
  { name: "Receitas", icon: "↗", color: "#42a77d", kind: "income" },
  { name: "Rendimentos", icon: "📈", color: "#2b8f6a", kind: "income" },
  { name: "Investimentos", icon: "⌁", color: "#1b6b4b", kind: "transfer" },
  { name: "Transferência", icon: "⇄", color: "#7c8a83", kind: "transfer" }
];

function freshState() {
  const a1 = uid(), a2 = uid(), c1 = uid(), i1 = uid();
  return {
    version: 2, updatedAt: new Date().toISOString(),
    accounts: [
      { id: a1, name: "Conta principal", type: "Conta corrente", initialBalance: 0, color: "#15804f" },
      { id: a2, name: "Carteira", type: "Dinheiro", initialBalance: 0, color: "#26382e" }
    ],
    cards: [{ id: c1, name: "Cartão principal", brand: "VISA", last: "0000", limit: 5000, due: 10, closing: 3, color: "#173c2c", accountId: a1 }],
    transactions: [], bills: [], budgets: {}, categories: structuredClone(DEFAULT_CATEGORIES),
    investments: [{ id: i1, name: "Reserva de emergência", type: "Renda fixa", institution: "", invested: 0, current: 0, color: "#1b6b4b", history: [] }],
    goal: { target: 100000 }
  };
}

// ---------- migração do formato antigo ----------
function migrate(s) {
  if (!s) return freshState();
  if (s.version >= 2) { s.categories ||= structuredClone(DEFAULT_CATEGORIES); s.bills ||= []; s.budgets ||= {}; s.investments ||= []; s.goal ||= { target: 100000 }; return s; }
  const n = freshState(); n.accounts = []; n.cards = []; n.investments = [];
  (s.accounts || []).forEach(a => n.accounts.push({ id: a.id || uid(), name: a.name, type: a.type || "Conta", initialBalance: Number(a.balance) || 0, color: a.color || "#1d7a55" }));
  if (!n.accounts.length) n.accounts.push({ id: uid(), name: "Conta principal", type: "Conta corrente", initialBalance: 0, color: "#15804f" });
  const byName = name => n.accounts.find(a => a.name === name)?.id || n.accounts[0].id;
  (s.cards || []).forEach(c => n.cards.push({ id: c.id || uid(), name: c.name, brand: c.brand || "VISA", last: c.last || "0000", limit: Number(c.limit) || 0, due: c.due || 10, closing: Math.max(1, (c.due || 10) - 7), color: c.color || "#173c2c", accountId: n.accounts[0].id }));
  (s.transactions || []).forEach(t => {
    const tx = { id: t.id || uid(), type: t.type, description: t.description, amount: Number(t.amount) || 0, date: t.date, category: t.category || "Outros", note: t.note || "", accountId: byName(t.account) };
    // saldo inicial antigo já incluía as movimentações; neutraliza o efeito
    const acc = n.accounts.find(a => a.id === tx.accountId);
    if (acc && t.type === "income") acc.initialBalance -= tx.amount;
    if (acc && t.type === "expense") acc.initialBalance += tx.amount;
    if (t.type === "transfer") { tx.category = "Investimentos"; tx.toInvestment = true; if (acc) acc.initialBalance += tx.amount; }
    n.transactions.push(tx);
  });
  const inv = { id: uid(), name: "Carteira de investimentos", type: "Outro", institution: "", invested: sum((s.contributions || []).map(c => c.amount)), current: Number(s.investmentTotal) || 0, color: "#1b6b4b", history: (s.contributions || []).map(c => ({ id: uid(), date: c.date, kind: "aporte", amount: Number(c.amount) || 0 })) };
  n.investments.push(inv);
  return n;
}

const hadLocal = !!(localStorage.getItem("mycash-state") || localStorage.getItem("meucaixa-state"));
let state = migrate(JSON.parse(localStorage.getItem("mycash-state") || localStorage.getItem("meucaixa-state") || "null"));
if (!hadLocal) state.updatedAt = "1970-01-01T00:00:00.000Z"; // aparelho novo: a nuvem prevalece
let currentMonth = monthKey();

function save(opts = {}) {
  state.updatedAt = new Date().toISOString();
  localStorage.setItem("mycash-state", JSON.stringify(state));
  if (!opts.silent) sync.schedulePush();
}

// ---------- cálculos ----------
const catInfo = name => state.categories.find(c => c.name === name) || { name, icon: "•", color: "#b7c0bb", kind: "expense" };
const accountById = id => state.accounts.find(a => a.id === id);
const cardById = id => state.cards.find(c => c.id === id);
const sourceName = t => t.cardId ? (cardById(t.cardId)?.name || "Cartão") : (accountById(t.accountId)?.name || "Conta");

function accountBalance(acc, untilDate) {
  let b = Number(acc.initialBalance) || 0;
  for (const t of state.transactions) {
    if (untilDate && t.date > untilDate) continue;
    if (t.type === "income" && t.accountId === acc.id) b += t.amount;
    else if (t.type === "expense" && !t.cardId && t.accountId === acc.id) b -= t.amount;
    else if (t.type === "transfer") { if (t.accountId === acc.id) b -= t.amount; if (t.toAccountId === acc.id) b += t.amount; }
  }
  return b;
}
const cashTotal = until => sum(state.accounts.map(a => accountBalance(a, until)));
const investTotal = () => sum(state.investments.map(i => i.current));
const cardOpen = card => sum(state.transactions.filter(t => t.cardId === card.id && t.type === "expense" && !t.paid).map(t => t.amount));
const cardsOpenTotal = () => sum(state.cards.map(cardOpen));
const netWorth = () => cashTotal() + investTotal() - cardsOpenTotal();
const monthTx = (key = currentMonth) => state.transactions.filter(t => t.date.startsWith(key));
const monthIncome = key => sum(monthTx(key).filter(t => t.type === "income").map(t => t.amount));
const monthExpense = key => sum(monthTx(key).filter(t => t.type === "expense" && t.category !== "Cartão").map(t => t.amount));
const monthByCategory = key => { const m = {}; monthTx(key).filter(t => t.type === "expense" && t.category !== "Cartão").forEach(t => m[t.category] = (m[t.category] || 0) + t.amount); return Object.entries(m).sort((a, b) => b[1] - a[1]); };
const billPaid = (bill, key) => (bill.paidMonths || []).includes(key);

// ---------- navegação ----------
const PAGES = {
  dashboard: ["VISÃO GERAL", "Meu Caixa"], transactions: ["LANÇAMENTOS", "Movimentações"], expenses: ["DESPESAS", "Gastos & Contas"],
  accounts: ["PATRIMÔNIO", "Contas & Cartões"], investments: ["PATRIMÔNIO", "Investimentos"], settings: ["CONFIGURAÇÃO", "Ajustes & Sincronização"]
};
let currentPage = "dashboard";
function navigate(id) {
  currentPage = id;
  $$(".page").forEach(p => p.classList.toggle("active", p.id === id));
  $$("[data-page]").forEach(b => b.classList.toggle("active", b.dataset.page === id));
  $("#pageEyebrow").textContent = PAGES[id][0]; $("#pageTitle").textContent = PAGES[id][1];
  $("#monthNav").classList.toggle("hidden", !["dashboard", "transactions", "expenses"].includes(id));
  closeSidebar(); window.scrollTo({ top: 0 });
  render();
  animate(`#${id}`, { opacity: [0, 1], y: [8, 0] }, { duration: .18, easing: "ease-out" });
}
const closeSidebar = () => { $("#sidebar").classList.remove("open"); $("#sidebarBackdrop").classList.remove("show"); };
$$("[data-page]").forEach(b => b.onclick = () => navigate(b.dataset.page));
$$("[data-go]").forEach(b => b.onclick = () => navigate(b.dataset.go));
$("#menuBtn").onclick = () => { $("#sidebar").classList.toggle("open"); $("#sidebarBackdrop").classList.toggle("show"); };
$("#sidebarBackdrop").onclick = closeSidebar;
$("#prevMonth").onclick = () => { currentMonth = shiftMonth(currentMonth, -1); render(); };
$("#nextMonth").onclick = () => { currentMonth = shiftMonth(currentMonth, 1); render(); };
$("#monthLabel").onclick = () => { currentMonth = monthKey(); render(); toast("Mês atual"); };

// ---------- render: dashboard ----------
function renderDashboard() {
  $("#monthLabel").textContent = monthName(currentMonth);
  const nw = netWorth(), cash = cashTotal(), inv = investTotal(), open = cardsOpenTotal();
  $("#netWorth").textContent = money(nw); $("#cashTotal").textContent = money(cash); $("#investTotalHero").textContent = money(inv); $("#cardsOpenHero").textContent = money(open);
  const d30 = new Date(); d30.setDate(d30.getDate() - 30);
  const before = cashTotal(d30.toISOString().slice(0, 10)), diff = cash - before;
  $("#netWorthChange").innerHTML = `${diff >= 0 ? "↗" : "↘"} ${money(Math.abs(diff))} <span>no caixa nos últimos 30 dias</span>`;
  $("#netWorthChange").className = "change " + (diff >= 0 ? "positive" : "negative-soft");

  // meta e projeção
  const months = [...new Set(state.transactions.map(t => t.date.slice(0, 7)))].sort().slice(-6);
  const avg = months.length ? sum(months.map(k => monthIncome(k) - monthExpense(k))) / months.length : 0;
  const target = state.goal.target || 0, proj = nw + avg * 12;
  $("#projectionValue").textContent = money(proj);
  $("#projectionNote").textContent = avg >= 0 ? `Projeção em 12 meses com geração média de ${money(avg)}/mês` : `Atenção: média mensal negativa de ${money(Math.abs(avg))}`;
  $("#goalProgress").style.width = Math.min(100, Math.max(0, pct(nw, target))) + "%";
  $("#goalNow").textContent = "Hoje · " + money(nw); $("#goalTarget").textContent = "Meta · " + money(target);

  // métricas do mês
  const inc = monthIncome(currentMonth), exp = monthExpense(currentMonth), prevInc = monthIncome(shiftMonth(currentMonth, -1)), prevExp = monthExpense(shiftMonth(currentMonth, -1));
  const rate = inc ? Math.round((inc - exp) / inc * 100) : 0;
  const cmp = (cur, prev, invert) => { if (!prev) return ["Sem base no mês anterior", ""]; const p = Math.round((cur - prev) / prev * 100); const good = invert ? p <= 0 : p >= 0; return [`${p > 0 ? "+" : ""}${p}% versus mês anterior`, good ? "positive" : "negative"]; };
  const mi = cmp(inc, prevInc), me = cmp(exp, prevExp, true);
  const data = [["↗", "Entradas no mês", money(inc), ...mi], ["↘", "Saídas no mês", money(exp), ...me], ["◈", "Saldo do mês", money(inc - exp), inc - exp >= 0 ? "Você gastou menos do que ganhou" : "Gastos acima das entradas", inc - exp >= 0 ? "positive" : "negative"], ["◎", "Taxa de poupança", rate + "%", rate >= 20 ? "Ótimo! Acima de 20%" : "Meta sugerida: 20%", rate >= 20 ? "positive" : ""]];
  $("#metrics").innerHTML = data.map(x => `<article class="metric"><div class="metric-top"><span>${x[1]}</span><span class="metric-icon">${x[0]}</span></div><strong>${x[2]}</strong><small class="${x[4]}">${x[3]}</small></article>`).join("");

  // categorias
  $("#categoriesMonth").textContent = monthName(currentMonth);
  const cats = monthByCategory(currentMonth), total = sum(cats.map(c => c[1]));
  $("#donutTotal").textContent = money(total);
  if (!cats.length) { $("#donut").style.background = "#edf0ee"; $("#categoryLegend").innerHTML = `<div class="empty small">Nenhum gasto neste mês.</div>`; }
  else {
    let acc = 0; const stops = cats.map(([n, v]) => { const from = acc; acc += v / total * 100; return `${catInfo(n).color} ${from}% ${acc}%`; });
    $("#donut").style.background = `conic-gradient(${stops.join(",")})`;
    $("#categoryLegend").innerHTML = cats.slice(0, 6).map(([n, v]) => `<div class="legend-row"><i class="legend-dot" style="background:${catInfo(n).color}"></i><span>${escapeHtml(n)}</span><strong>${pct(v, total)}%</strong></div>`).join("");
  }

  $("#recentTransactions").innerHTML = [...state.transactions].sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id)).slice(0, 6).map(transactionMarkup).join("") || `<div class="empty">Nenhuma movimentação ainda. Toque em <strong>＋</strong> ou no <strong>🎤</strong> para começar.</div>`;
  bindTxClicks("#recentTransactions");

  // compromissos
  const today = todayISO(); const items = [];
  state.bills.forEach(b => { if (!billPaid(b, currentMonth)) { const d = `${currentMonth}-${pad(Math.min(b.dueDay, 28))}`; items.push({ date: d, title: b.description, sub: b.recurring ? "Conta recorrente" : "Conta única", amount: b.amount, late: d < today, id: b.id, kind: "bill" }); } });
  state.cards.forEach(c => { const open = cardOpen(c); if (open > 0) { items.push({ date: `${currentMonth}-${pad(Math.min(c.due, 28))}`, title: `Fatura ${c.name}`, sub: `Cartão final ${c.last}`, amount: open, kind: "card", id: c.id }); } });
  items.sort((a, b) => a.date.localeCompare(b.date));
  $("#upcomingBills").innerHTML = items.slice(0, 6).map(b => `<div class="bill ${b.late ? "late" : ""}"><span class="bill-date"><span><strong>${b.date.slice(8)}</strong>${new Date(b.date + "T12:00:00").toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase()}</span></span><span class="bill-info"><strong>${escapeHtml(b.title)}</strong><small>${b.late ? "⚠ Vencida · " : ""}${b.sub}</small></span><strong>${money(b.amount)}</strong></div>`).join("") || `<div class="empty">Sem compromissos pendentes neste mês. 🎉</div>`;

  renderChart(Number($("#chartPeriod").value));
}

function renderChart(months = 6) {
  const keys = []; for (let i = months - 1; i >= 0; i--) keys.push(shiftMonth(monthKey(), -i));
  const vals = keys.map(k => { const [y, m] = k.split("-").map(Number); const last = new Date(y, m, 0).toISOString().slice(0, 10); return cashTotal(last); });
  const w = 700, h = 210, padX = 20, max = Math.max(...vals, 1) * 1.08, min = Math.min(...vals, 0) * (Math.min(...vals) < 0 ? 1.1 : .88);
  const pts = vals.map((v, i) => [padX + i * (w - padX * 2) / Math.max(1, vals.length - 1), h - padX - (v - min) / ((max - min) || 1) * (h - padX * 2)]);
  const labels = keys.map(k => new Date(k + "-01T12:00:00").toLocaleDateString("pt-BR", { month: "short" }).replace(".", "").toUpperCase());
  $("#chartNow").textContent = money(vals.at(-1));
  const first = vals[0], delta = first ? Math.round((vals.at(-1) - first) / Math.abs(first) * 100) : 0;
  $("#chartDelta").textContent = (delta >= 0 ? "+" : "") + delta + "%"; $("#chartDelta").className = delta >= 0 ? "positive" : "negative";
  $("#cashChart").innerHTML = `<defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#42a77d" stop-opacity=".24"/><stop offset="1" stop-color="#42a77d" stop-opacity="0"/></linearGradient></defs>${[30, 80, 130, 180].map(y => `<line class="grid-line" x1="20" y1="${y}" x2="680" y2="${y}"/>`).join("")}<path class="area" d="M${pts[0][0]},${h} L${pts.map(p => p.join(",")).join(" L")} L${pts.at(-1)[0]},${h} Z"/><path class="line" d="M${pts.map(p => p.join(",")).join(" L")}"/>${pts.map((p, i) => `<g class="pt"><circle class="point" cx="${p[0]}" cy="${p[1]}" r="4"/><title>${labels[i]}: ${moneyAlways(vals[i])}</title></g>`).join("")}${pts.map((p, i) => `<text class="axis-label" x="${p[0]}" y="231" text-anchor="middle">${labels[i]}</text>`).join("")}`;
}

// ---------- render: movimentações ----------
function sign(t) { return t.type === "income" ? "+" : t.type === "expense" ? "−" : ""; }
function cls(t) { return t.type === "income" ? "positive" : t.type === "expense" ? "negative" : ""; }
function transactionMarkup(t) {
  const c = catInfo(t.category);
  const inst = t.installment ? ` · ${t.installment.n}/${t.installment.total}` : "";
  return `<div class="transaction clickable" data-tx="${t.id}"><span class="transaction-icon" style="background:${c.color}22;color:${c.color}">${c.icon}</span><span class="transaction-info"><strong>${escapeHtml(t.description)}</strong><small>${escapeHtml(t.category)} · ${escapeHtml(sourceName(t))}${inst}</small></span><span class="transaction-value ${cls(t)}">${sign(t)} ${money(t.amount)}<small>${shortDate(t.date)}</small></span></div>`;
}
function bindTxClicks(scope) { $$("[data-tx]", $(scope)).forEach(el => el.onclick = () => openTransactionModal(state.transactions.find(t => t.id === el.dataset.tx))); }

function fillFilters() {
  const cf = $("#categoryFilter"), af = $("#accountFilter"), cv = cf.value, av = af.value;
  cf.innerHTML = `<option value="">Todas as categorias</option>` + state.categories.map(c => `<option>${escapeHtml(c.name)}</option>`).join("");
  af.innerHTML = `<option value="">Todas as contas</option>` + state.accounts.map(a => `<option value="a:${a.id}">${escapeHtml(a.name)}</option>`).join("") + state.cards.map(c => `<option value="c:${c.id}">💳 ${escapeHtml(c.name)}</option>`).join("");
  cf.value = cv; af.value = av;
}
function renderTransactions() {
  fillFilters();
  const q = $("#searchInput").value.toLowerCase().trim(), type = $("#typeFilter").value, cat = $("#categoryFilter").value, acc = $("#accountFilter").value, all = $("#allMonths").checked;
  const list = state.transactions.filter(t => (all || t.date.startsWith(currentMonth)) && (!q || t.description.toLowerCase().includes(q) || t.category.toLowerCase().includes(q) || sourceName(t).toLowerCase().includes(q)) && (!type || t.type === type) && (!cat || t.category === cat) && (!acc || (acc.startsWith("a:") ? (t.accountId === acc.slice(2) && !t.cardId) || t.toAccountId === acc.slice(2) : t.cardId === acc.slice(2)))).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  const inc = sum(list.filter(t => t.type === "income").map(t => t.amount)), exp = sum(list.filter(t => t.type === "expense").map(t => t.amount));
  $("#txSummary").innerHTML = `<article><small>ENTRADAS</small><strong class="positive">${money(inc)}</strong></article><article><small>SAÍDAS</small><strong class="negative">${money(exp)}</strong></article><article><small>RESULTADO</small><strong class="${inc - exp >= 0 ? "positive" : "negative"}">${money(inc - exp)}</strong></article><article><small>LANÇAMENTOS</small><strong>${list.length}</strong></article>`;
  $("#resultsCount").textContent = `${list.length} lançamento${list.length === 1 ? "" : "s"}`;
  $("#transactionsTable").innerHTML = list.map(t => { const c = catInfo(t.category); return `<tr class="clickable" data-tx="${t.id}"><td><strong>${escapeHtml(t.description)}</strong>${t.installment ? `<small class="muted"> ${t.installment.n}/${t.installment.total}</small>` : ""}${t.note ? `<br><small class="muted">${escapeHtml(t.note)}</small>` : ""}</td><td><span class="category-badge" style="background:${c.color}22;color:${c.color}">${c.icon} ${escapeHtml(t.category)}</span></td><td>${t.cardId ? "💳 " : ""}${escapeHtml(sourceName(t))}${t.type === "transfer" && t.toAccountId ? ` → ${escapeHtml(accountById(t.toAccountId)?.name || "")}` : ""}${t.toInvestment ? " → Investimentos" : ""}</td><td>${fullDate(t.date)}</td><td class="right ${cls(t)}"><strong>${sign(t)} ${money(t.amount)}</strong></td><td><button class="edit-btn" title="Editar">✎</button></td></tr>`; }).join("") || '<tr><td colspan="6" class="empty">Nenhuma movimentação encontrada neste período.</td></tr>';
  $("#transactionsMobile").innerHTML = list.map(transactionMarkup).join("") || `<div class="empty">Nenhuma movimentação encontrada neste período.</div>`;
  bindTxClicks("#transactionsTable"); bindTxClicks("#transactionsMobile");
}
["searchInput", "typeFilter", "categoryFilter", "accountFilter", "allMonths"].forEach(id => $("#" + id).addEventListener("input", renderTransactions));

// ---------- render: gastos & contas ----------
function renderExpenses() {
  const exp = monthExpense(currentMonth), budgetTotal = sum(Object.values(state.budgets)), billsTotal = sum(state.bills.map(b => b.amount)), billsPaid = sum(state.bills.filter(b => billPaid(b, currentMonth)).map(b => b.amount));
  const fixed = billsTotal, variable = Math.max(0, exp - billsPaid);
  $("#expenseSummary").innerHTML = `<article><small>GASTO NO MÊS</small><strong class="negative">${money(exp)}</strong></article><article><small>ORÇAMENTO</small><strong>${money(budgetTotal)}</strong><small class="${exp > budgetTotal && budgetTotal ? "negative" : "positive"}">${budgetTotal ? (exp > budgetTotal ? "Estourou em " + money(exp - budgetTotal) : "Sobram " + money(budgetTotal - exp)) : "Defina limites ao lado"}</small></article><article><small>CONTAS FIXAS</small><strong>${money(fixed)}</strong><small>${money(billsPaid)} já pagas</small></article><article><small>GASTOS VARIÁVEIS</small><strong>${money(variable)}</strong></article>`;

  const today = todayISO();
  $("#billsList").innerHTML = [...state.bills].sort((a, b) => a.dueDay - b.dueDay).map(b => { const paid = billPaid(b, currentMonth), due = `${currentMonth}-${pad(Math.min(b.dueDay, 28))}`, late = !paid && due < today; const c = catInfo(b.category); return `<div class="bill-row ${paid ? "paid" : ""} ${late ? "late" : ""}"><span class="transaction-icon" style="background:${c.color}22;color:${c.color}">${c.icon}</span><span class="bill-info clickable" data-bill="${b.id}"><strong>${escapeHtml(b.description)}</strong><small>Vence dia ${b.dueDay} · ${escapeHtml(b.category)}${b.recurring ? " · mensal" : ""}${late ? " · <b class='negative'>vencida</b>" : ""}${paid ? " · <b class='positive'>paga</b>" : ""}</small></span><strong class="bill-amount">${money(b.amount)}</strong><button class="btn ${paid ? "secondary" : "primary"} sm" data-pay="${b.id}">${paid ? "Desfazer" : "✓ Pagar"}</button></div>`; }).join("") || `<div class="empty">Cadastre aluguel, luz, internet e assinaturas para não esquecer nenhum vencimento.</div>`;
  $$("[data-pay]").forEach(b => b.onclick = () => toggleBillPaid(b.dataset.pay));
  $$("[data-bill]").forEach(el => el.onclick = () => openBillModal(state.bills.find(b => b.id === el.dataset.bill)));

  const byCat = Object.fromEntries(monthByCategory(currentMonth));
  const rows = state.categories.filter(c => c.kind === "expense" && (state.budgets[c.name] || byCat[c.name])).sort((a, b) => (byCat[b.name] || 0) - (byCat[a.name] || 0));
  $("#budgetList").innerHTML = rows.map(c => { const spent = byCat[c.name] || 0, lim = state.budgets[c.name] || 0, p = lim ? pct(spent, lim) : 0; return `<div class="budget-row"><span class="budget-name"><i style="background:${c.color}"></i>${c.icon} ${escapeHtml(c.name)}</span><div class="mini-progress ${p > 100 ? "over" : p > 80 ? "warn" : ""}"><i style="width:${lim ? Math.min(p, 100) : 0}%"></i></div><span class="budget-values"><strong>${lim ? p + "%" : "—"}</strong><br>${money(spent)}${lim ? " / " + money(lim) : ""}</span></div>`; }).join("") || `<div class="empty">Sem gastos ou limites neste mês. Clique em <strong>Editar limites</strong>.</div>`;

  const list = monthTx(currentMonth).filter(t => t.type === "expense").sort((a, b) => b.date.localeCompare(a.date));
  $("#monthExpensesList").innerHTML = list.map(transactionMarkup).join("") || `<div class="empty">Nenhum gasto lançado em ${monthName(currentMonth)}.</div>`;
  bindTxClicks("#monthExpensesList");
}
function toggleBillPaid(id) {
  const b = state.bills.find(x => x.id === id); if (!b) return;
  b.paidMonths ||= [];
  if (billPaid(b, currentMonth)) {
    b.paidMonths = b.paidMonths.filter(m => m !== currentMonth);
    state.transactions = state.transactions.filter(t => !(t.billId === id && t.date.startsWith(currentMonth)));
    toast("Pagamento desfeito");
  } else {
    b.paidMonths.push(currentMonth);
    const [src, sid] = (b.source || "").split(":");
    const day = Math.min(b.dueDay, 28), date = currentMonth === monthKey() ? todayISO() : `${currentMonth}-${pad(day)}`;
    state.transactions.push({ id: uid(), type: "expense", description: b.description, amount: b.amount, date, category: b.category, accountId: src === "c" ? cardById(sid)?.accountId : (sid || state.accounts[0]?.id), cardId: src === "c" ? sid : undefined, billId: id, note: "Conta a pagar" });
    toast("Conta marcada como paga ✓", "ok");
    if (!b.recurring) { /* conta única permanece marcada */ }
  }
  save(); render();
}

// ---------- render: contas & cartões ----------
function renderAccounts() {
  const total = cashTotal();
  $("#accountsGrid").innerHTML = state.accounts.map(a => { const b = accountBalance(a); return `<article class="account-card clickable" data-account="${a.id}"><div class="account-brand"><span class="bank-icon" style="background:${a.color}">${escapeHtml(a.name.slice(0, 2).toUpperCase())}</span><button class="edit-btn" title="Editar">✎</button></div><strong class="${b < 0 ? "negative" : ""}">${money(b)}</strong><small>${escapeHtml(a.name)} · ${escapeHtml(a.type)}</small><div class="account-footer"><span>${total > 0 ? pct(Math.max(b, 0), total) : 0}% do caixa</span><span>${(()=>{const n=state.transactions.filter(t=>t.accountId===a.id||t.toAccountId===a.id).length;return n+" lançamento"+(n===1?"":"s")})()}</span></div></article>`; }).join("") + `<button class="account-card add-card" data-open="accountModal">＋<span>Adicionar conta</span></button>`;
  $$("[data-account]").forEach(el => el.onclick = () => openAccountModal(accountById(el.dataset.account)));

  $("#cardsGrid").innerHTML = state.cards.map(c => { const open = cardOpen(c), avail = c.limit - open, use = pct(open, c.limit); return `<article class="credit-wrap"><div class="credit-card clickable" data-card="${c.id}" style="background:linear-gradient(145deg,${c.color},#315b48)"><div class="cc-top"><strong>${escapeHtml(c.name)}</strong><span>${escapeHtml(c.brand)}</span></div><div class="cc-number">•••• •••• •••• ${escapeHtml(c.last || "0000")}</div><div class="cc-bottom"><span>FECHA DIA ${c.closing}</span><span>VENCE DIA ${c.due}</span></div></div><div class="card-details"><div><small>Fatura em aberto</small><strong class="${open ? "negative" : ""}">${money(open)}</strong></div><div><small>Limite disponível</small><strong>${money(avail)}</strong><div class="mini-progress ${use > 90 ? "over" : use > 70 ? "warn" : ""}"><i style="width:${Math.min(use, 100)}%"></i></div></div><div class="btn-group"><button class="btn secondary sm" data-card-expense="${c.id}">＋ Gasto</button><button class="btn primary sm" data-pay-card="${c.id}" ${open ? "" : "disabled"}>✓ Pagar fatura</button></div></div></article>`; }).join("") || `<div class="empty">Nenhum cartão cadastrado.</div>`;
  $$("[data-card]").forEach(el => el.onclick = () => openCardModal(cardById(el.dataset.card)));
  $$("[data-card-expense]").forEach(b => b.onclick = () => openTransactionModal(null, { type: "expense", source: "c:" + b.dataset.cardExpense }));
  $$("[data-pay-card]").forEach(b => b.onclick = () => payCard(b.dataset.payCard));
}
async function payCard(id) {
  const c = cardById(id), open = cardOpen(c); if (!open) return;
  const acc = accountById(c.accountId) || state.accounts[0];
  if (!await confirmDialog(`Pagar a fatura de ${moneyAlways(open)} do ${c.name} usando ${acc?.name || "sua conta"}?`, "Pagar fatura")) return;
  state.transactions.forEach(t => { if (t.cardId === id && t.type === "expense" && !t.paid) t.paid = true; });
  state.transactions.push({ id: uid(), type: "expense", description: `Pagamento fatura ${c.name}`, amount: open, date: todayISO(), category: "Cartão", accountId: acc?.id, note: "Fatura do cartão" });
  save(); render(); toast("Fatura paga ✓", "ok");
}

// ---------- render: investimentos ----------
function renderInvestments() {
  const cur = investTotal(), inv = sum(state.investments.map(i => i.invested)), res = cur - inv;
  $("#investmentTotal").textContent = money(cur); $("#investedTotal").textContent = money(inv);
  $("#investResult").textContent = (res >= 0 ? "+ " : "− ") + money(Math.abs(res)); $("#investResult").className = "money " + (res >= 0 ? "positive-light" : "negative-light");
  $("#investYield").textContent = (inv ? (res / inv * 100).toFixed(1).replace(".", ",") : "0") + "%";
  const monthAport = sum(state.investments.flatMap(i => i.history || []).filter(h => h.kind === "aporte" && h.date.startsWith(monthKey())).map(h => h.amount));
  $("#investmentMonthNote").textContent = monthAport ? `+ ${money(monthAport)} em aportes este mês` : "Nenhum aporte este mês ainda";
  $("#investmentsGrid").innerHTML = state.investments.map(i => { const r = i.current - i.invested, share = pct(i.current, cur); return `<article class="invest-card clickable" data-invest="${i.id}"><div class="account-brand"><span class="bank-icon" style="background:${i.color}">⌁</span><span class="pill">${escapeHtml(i.type)}</span></div><strong>${money(i.current)}</strong><small>${escapeHtml(i.name)}${i.institution ? " · " + escapeHtml(i.institution) : ""}</small><div class="invest-meta"><span>Aportado <b>${money(i.invested)}</b></span><span class="${r >= 0 ? "positive" : "negative"}">${r >= 0 ? "+" : "−"} ${money(Math.abs(r))} (${i.invested ? (r / i.invested * 100).toFixed(1).replace(".", ",") : "0"}%)</span></div><div class="mini-progress"><i style="width:${share}%;background:${i.color}"></i></div><div class="account-footer"><span>${share}% da carteira</span><button class="link-btn" data-contrib="${i.id}">Aportar / atualizar →</button></div></article>`; }).join("") + `<button class="invest-card add-card" data-open="investmentModal">＋<span>Nova conta de investimento</span></button>`;
  $$("[data-invest]").forEach(el => el.onclick = e => { if (e.target.closest("[data-contrib]")) return; openInvestmentModal(state.investments.find(i => i.id === el.dataset.invest)); });
  $$("[data-contrib]").forEach(b => b.onclick = e => { e.stopPropagation(); openContributionModal(b.dataset.contrib); });
  const hist = state.investments.flatMap(i => (i.history || []).map(h => ({ ...h, inv: i }))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30);
  const label = { aporte: ["↑ Aporte", "positive"], resgate: ["↓ Resgate", "negative"], atualizacao: ["↻ Atualização", ""] };
  $("#contributionsList").innerHTML = hist.map(h => `<div class="transaction"><span class="transaction-icon" style="background:${h.inv.color}22;color:${h.inv.color}">⌁</span><span class="transaction-info"><strong>${label[h.kind]?.[0] || h.kind} · ${escapeHtml(h.inv.name)}</strong><small>${fullDate(h.date)}</small></span><span class="transaction-value ${label[h.kind]?.[1] || ""}">${h.kind === "atualizacao" ? "= " : h.kind === "resgate" ? "− " : "+ "}${money(h.amount)}</span></div>`).join("") || `<div class="empty">Nenhum movimento registrado. Use <strong>Novo aporte</strong> para começar.</div>`;
}

// ---------- render: ajustes ----------
function renderSettings() {
  $("#categoryChips").innerHTML = state.categories.map(c => `<span class="chip cat" style="border-color:${c.color}"><i style="background:${c.color}"></i>${c.icon} ${escapeHtml(c.name)}<small>${c.kind === "income" ? "receita" : c.kind === "transfer" ? "transf." : "gasto"}</small><button data-del-cat="${escapeHtml(c.name)}" title="Remover">×</button></span>`).join("");
  $$("[data-del-cat]").forEach(b => b.onclick = async () => { const n = b.dataset.delCat; if (state.transactions.some(t => t.category === n)) return toast("Categoria em uso por lançamentos"); if (await confirmDialog(`Remover a categoria "${n}"?`)) { state.categories = state.categories.filter(c => c.name !== n); delete state.budgets[n]; save(); render(); } });
  const f = $("#syncForm"), cfg = sync.cfg();
  f.url.value = cfg.url; f.key.value = cfg.key; f.code.value = cfg.code;
  sync.renderStatus();
}

function render() {
  $("#monthLabel").textContent = monthName(currentMonth);
  ({ dashboard: renderDashboard, transactions: renderTransactions, expenses: renderExpenses, accounts: renderAccounts, investments: renderInvestments, settings: renderSettings })[currentPage]?.();
}

// ---------- modais: movimentação ----------
const txModal = $("#transactionModal"), txForm = $("#transactionForm");
function fillSources(sel, allowCards = true, value) {
  sel.innerHTML = state.accounts.map(a => `<option value="a:${a.id}">${escapeHtml(a.name)}</option>`).join("") + (allowCards ? state.cards.map(c => `<option value="c:${c.id}">💳 ${escapeHtml(c.name)}</option>`).join("") : "");
  if (value) sel.value = value;
}
function fillCategories(sel, type, value) {
  const kinds = type === "income" ? ["income"] : type === "transfer" ? ["transfer"] : ["expense"];
  sel.innerHTML = state.categories.filter(c => kinds.includes(c.kind)).map(c => `<option>${escapeHtml(c.name)}</option>`).join("");
  if (value && [...sel.options].some(o => o.value === value)) sel.value = value;
}
function syncTxForm() {
  const type = txForm.type.value;
  fillCategories($("#txCategory"), type, $("#txCategory").value);
  $("#destLabel").hidden = type !== "transfer";
  $("#installmentsLabel").hidden = type !== "expense";
  $("#sourceLabel").firstChild.textContent = type === "expense" ? "Pagar com" : type === "income" ? "Receber em" : "Da conta";
  fillSources($("#txSource"), type === "expense", $("#txSource").value);
  fillSources($("#txDest"), false, $("#txDest").value);
  if (type === "transfer") { $("#txDest").insertAdjacentHTML("beforeend", `<option value="inv">⌁ Investimentos (aporte)</option>`); }
}
$$('input[name="type"]', txForm).forEach(r => r.onchange = syncTxForm);
function openTransactionModal(tx = null, preset = {}) {
  txForm.reset(); $("#voiceHint").hidden = true; $("#txDeleteBtn").hidden = !tx;
  $("#txModalTitle").textContent = tx ? "Editar movimentação" : "Nova movimentação";
  const t = tx || { type: "expense", date: todayISO(), ...preset };
  txForm.elements.id.value = tx?.id || ""; txForm.type.value = t.type || "expense"; syncTxForm();
  txForm.description.value = t.description || ""; txForm.amount.value = t.amount || ""; txForm.date.value = t.date || todayISO(); txForm.note.value = t.note || "";
  if (t.category) { fillCategories($("#txCategory"), t.type, t.category); }
  const src = t.source || (t.cardId ? "c:" + t.cardId : t.accountId ? "a:" + t.accountId : null); if (src) $("#txSource").value = src;
  if (t.toInvestment) $("#txDest").value = "inv"; else if (t.toAccountId) $("#txDest").value = "a:" + t.toAccountId;
  txForm.recurring.checked = !!t.recurring;
  if (preset.voice) { $("#voiceHint").hidden = false; $("#voiceHint").innerHTML = `🎤 Entendi: <em>“${escapeHtml(preset.voice)}”</em>. Confira os campos e salve.`; }
  txModal.showModal();
  animate(txForm, { opacity: [0, 1], scale: [.97, 1] }, { duration: .2 });
}
txForm.onsubmit = e => {
  e.preventDefault();
  const fd = new FormData(txForm), type = fd.get("type"), [srcKind, srcId] = String(fd.get("source")).split(":");
  const base = { type, description: String(fd.get("description")).trim(), amount: Number(fd.get("amount")), date: fd.get("date"), category: fd.get("category") || (type === "income" ? "Receitas" : type === "transfer" ? "Transferência" : "Outros"), note: String(fd.get("note") || "").trim(), accountId: srcKind === "c" ? cardById(srcId)?.accountId : srcId, cardId: srcKind === "c" ? srcId : undefined };
  if (!base.amount || base.amount <= 0) return toast("Informe um valor válido");
  if (type === "transfer") { const d = fd.get("dest"); if (d === "inv") base.toInvestment = true; else base.toAccountId = String(d).slice(2); if (base.toAccountId === base.accountId) return toast("Escolha contas diferentes"); }
  const id = fd.get("id");
  if (id) { const i = state.transactions.findIndex(t => t.id === id); const prev = state.transactions[i]; state.transactions[i] = { ...prev, ...base, cardId: base.cardId, toAccountId: base.toAccountId, toInvestment: base.toInvestment }; toast("Movimentação atualizada ✓", "ok"); }
  else {
    const n = type === "expense" ? Number(fd.get("installments")) || 1 : 1;
    if (n > 1) { const each = Math.round(base.amount / n * 100) / 100; for (let k = 0; k < n; k++) { const d = new Date(base.date + "T12:00:00"); d.setMonth(d.getMonth() + k); state.transactions.push({ ...base, id: uid(), amount: each, date: d.toISOString().slice(0, 10), installment: { n: k + 1, total: n } }); } toast(`${n} parcelas de ${moneyAlways(each)} criadas ✓`, "ok"); }
    else { state.transactions.push({ ...base, id: uid() }); toast(type === "income" ? "Entrada registrada ✓" : type === "transfer" ? "Transferência registrada ✓" : "Gasto registrado ✓", "ok"); }
    if (fd.get("recurring") && type === "expense") { state.bills.push({ id: uid(), description: base.description, amount: base.amount, dueDay: Number(base.date.slice(8)), category: base.category, source: fd.get("source"), recurring: true, paidMonths: [base.date.slice(0, 7)] }); }
    if (base.toInvestment && state.investments[0]) { const inv = state.investments[0]; inv.invested += base.amount; inv.current += base.amount; (inv.history ||= []).push({ id: uid(), date: base.date, kind: "aporte", amount: base.amount }); }
  }
  save(); txModal.close(); render();
};
$("#txDeleteBtn").onclick = async () => { const id = txForm.elements.id.value; if (await confirmDialog("Excluir esta movimentação? Essa ação não pode ser desfeita.", "Excluir")) { state.transactions = state.transactions.filter(t => t.id !== id); save(); txModal.close(); render(); toast("Movimentação excluída"); } };
$("#newTransactionBtn").onclick = () => openTransactionModal();
$("#fabBtn").onclick = () => openTransactionModal();
$("#newExpenseBtn").onclick = () => openTransactionModal(null, { type: "expense" });

// ---------- modais: conta a pagar ----------
const billModal = $("#billModal"), billForm = $("#billForm");
function openBillModal(bill = null, preset = {}) {
  billForm.reset(); $("#billDeleteBtn").hidden = !bill; $("#billModalTitle").textContent = bill ? "Editar conta" : "Nova conta a pagar";
  fillCategories($("#billCategory"), "expense", bill?.category || preset.category); fillSources($("#billSource"), true, bill?.source || preset.source);
  billForm.elements.id.value = bill?.id || ""; billForm.description.value = bill?.description || preset.description || ""; billForm.amount.value = bill?.amount || preset.amount || ""; billForm.dueDay.value = bill?.dueDay || preset.dueDay || 10; billForm.recurring.checked = bill ? !!bill.recurring : true;
  billModal.showModal();
}
billForm.onsubmit = e => {
  e.preventDefault(); const fd = new FormData(billForm);
  const b = { description: String(fd.get("description")).trim(), amount: Number(fd.get("amount")), dueDay: Math.min(31, Math.max(1, Number(fd.get("dueDay")))), category: fd.get("category"), source: fd.get("source"), recurring: !!fd.get("recurring") };
  if (!b.amount) return toast("Informe um valor válido");
  const id = fd.get("id");
  if (id) { const i = state.bills.findIndex(x => x.id === id); state.bills[i] = { ...state.bills[i], ...b }; } else state.bills.push({ id: uid(), paidMonths: [], ...b });
  save(); billModal.close(); render(); toast("Conta salva ✓", "ok");
};
$("#billDeleteBtn").onclick = async () => { if (await confirmDialog("Excluir esta conta a pagar?", "Excluir")) { state.bills = state.bills.filter(b => b.id !== billForm.elements.id.value); save(); billModal.close(); render(); } };

// ---------- modal: orçamento ----------
const budgetModal = $("#budgetModal");
$("#budgetForm").onsubmit = e => { e.preventDefault(); const fd = new FormData(e.target); state.budgets = {}; for (const [k, v] of fd.entries()) if (Number(v) > 0) state.budgets[k] = Number(v); save(); budgetModal.close(); render(); toast("Limites salvos ✓", "ok"); };
function openBudgetModal() { $("#budgetFields").innerHTML = state.categories.filter(c => c.kind === "expense").map(c => `<label><span><i style="background:${c.color}"></i>${c.icon} ${escapeHtml(c.name)}</span><input name="${escapeHtml(c.name)}" type="number" inputmode="decimal" step="0.01" min="0" placeholder="Sem limite" value="${state.budgets[c.name] || ""}"></label>`).join(""); budgetModal.showModal(); }

// ---------- modal: conta bancária ----------
const accountModal = $("#accountModal"), accountForm = $("#accountForm");
function openAccountModal(acc = null) { accountForm.reset(); $("#accountDeleteBtn").hidden = !acc; $("#accountModalTitle").textContent = acc ? "Editar conta" : "Nova conta"; accountForm.elements.id.value = acc?.id || ""; accountForm.elements.name.value = acc?.name || ""; accountForm.type.value = acc?.type || "Conta corrente"; accountForm.initialBalance.value = acc?.initialBalance ?? 0; accountForm.color.value = acc?.color || "#1d7a55"; accountForm.querySelector('[name="initialBalance"]').parentElement.firstChild.textContent = acc ? "Saldo inicial (ajuste) (R$)" : "Saldo atual (R$)"; accountModal.showModal(); }
accountForm.onsubmit = e => { e.preventDefault(); const fd = new FormData(accountForm), a = { name: String(fd.get("name")).trim(), type: fd.get("type"), initialBalance: Number(fd.get("initialBalance")) || 0, color: fd.get("color") }; const id = fd.get("id"); if (id) { const i = state.accounts.findIndex(x => x.id === id); state.accounts[i] = { ...state.accounts[i], ...a }; } else state.accounts.push({ id: uid(), ...a }); save(); accountModal.close(); render(); toast("Conta salva ✓", "ok"); };
$("#accountDeleteBtn").onclick = async () => { const id = accountForm.elements.id.value; if (state.accounts.length === 1) return toast("Mantenha ao menos uma conta"); if (state.transactions.some(t => t.accountId === id || t.toAccountId === id)) return toast("Conta possui lançamentos. Exclua-os antes."); if (await confirmDialog("Excluir esta conta?", "Excluir")) { state.accounts = state.accounts.filter(a => a.id !== id); save(); accountModal.close(); render(); } };

// ---------- modal: cartão ----------
const cardModal = $("#cardModal"), cardForm = $("#cardForm");
function openCardModal(card = null) { cardForm.reset(); $("#cardDeleteBtn").hidden = !card; $("#cardModalTitle").textContent = card ? "Editar cartão" : "Novo cartão"; $("#cardAccount").innerHTML = state.accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join(""); cardForm.elements.id.value = card?.id || ""; cardForm.elements.name.value = card?.name || ""; cardForm.brand.value = card?.brand || "VISA"; cardForm.last.value = card?.last || ""; cardForm.limit.value = card?.limit || ""; cardForm.due.value = card?.due || 10; cardForm.closing.value = card?.closing || 3; if (card?.accountId) cardForm.accountId.value = card.accountId; cardForm.color.value = card?.color || "#173c2c"; cardModal.showModal(); }
cardForm.onsubmit = e => { e.preventDefault(); const fd = new FormData(cardForm), c = { name: String(fd.get("name")).trim(), brand: fd.get("brand"), last: String(fd.get("last") || "0000").replace(/\D/g, "").slice(-4) || "0000", limit: Number(fd.get("limit")) || 0, due: Number(fd.get("due")) || 10, closing: Number(fd.get("closing")) || 1, accountId: fd.get("accountId"), color: fd.get("color") }; const id = fd.get("id"); if (id) { const i = state.cards.findIndex(x => x.id === id); state.cards[i] = { ...state.cards[i], ...c }; } else state.cards.push({ id: uid(), ...c }); save(); cardModal.close(); render(); toast("Cartão salvo ✓", "ok"); };
$("#cardDeleteBtn").onclick = async () => { const id = cardForm.elements.id.value; if (state.transactions.some(t => t.cardId === id)) return toast("Cartão possui lançamentos. Exclua-os antes."); if (await confirmDialog("Excluir este cartão?", "Excluir")) { state.cards = state.cards.filter(c => c.id !== id); save(); cardModal.close(); render(); } };

// ---------- modal: investimento ----------
const investmentModal = $("#investmentModal"), investmentForm = $("#investmentForm");
function openInvestmentModal(inv = null) { investmentForm.reset(); $("#investmentDeleteBtn").hidden = !inv; $("#investmentModalTitle").textContent = inv ? "Editar investimento" : "Nova conta de investimento"; investmentForm.elements.id.value = inv?.id || ""; investmentForm.elements.name.value = inv?.name || ""; investmentForm.type.value = inv?.type || "Renda fixa"; investmentForm.institution.value = inv?.institution || ""; investmentForm.invested.value = inv?.invested ?? 0; investmentForm.current.value = inv?.current ?? 0; investmentForm.color.value = inv?.color || "#1b6b4b"; investmentModal.showModal(); }
investmentForm.onsubmit = e => { e.preventDefault(); const fd = new FormData(investmentForm), v = { name: String(fd.get("name")).trim(), type: fd.get("type"), institution: String(fd.get("institution") || "").trim(), invested: Number(fd.get("invested")) || 0, current: Number(fd.get("current")) || 0, color: fd.get("color") }; const id = fd.get("id"); if (id) { const i = state.investments.findIndex(x => x.id === id); state.investments[i] = { ...state.investments[i], ...v }; } else state.investments.push({ id: uid(), history: [], ...v }); save(); investmentModal.close(); render(); toast("Investimento salvo ✓", "ok"); };
$("#investmentDeleteBtn").onclick = async () => { if (await confirmDialog("Excluir esta conta de investimento e seu histórico?", "Excluir")) { state.investments = state.investments.filter(i => i.id !== investmentForm.elements.id.value); save(); investmentModal.close(); render(); } };

const contributionModal = $("#contributionModal"), contributionForm = $("#contributionForm");
function openContributionModal(invId) { if (!state.investments.length) return toast("Crie uma conta de investimento primeiro"); contributionForm.reset(); $("#contribInvestment").innerHTML = state.investments.map(i => `<option value="${i.id}">${escapeHtml(i.name)}</option>`).join(""); if (invId) $("#contribInvestment").value = invId; $("#contribAccount").innerHTML = `<option value="">Não movimentar conta</option>` + state.accounts.map(a => `<option value="${a.id}">${escapeHtml(a.name)}</option>`).join(""); contributionForm.date.value = todayISO(); toggleContribAccount(); contributionModal.showModal(); }
const toggleContribAccount = () => { $("#contribAccountLabel").hidden = contributionForm.kind.value === "atualizacao"; };
$$('input[name="kind"]', contributionForm).forEach(r => r.onchange = toggleContribAccount);
$("#newContributionBtn").onclick = () => openContributionModal();
contributionForm.onsubmit = e => {
  e.preventDefault(); const fd = new FormData(contributionForm), inv = state.investments.find(i => i.id === fd.get("investmentId")), amount = Number(fd.get("amount")), kind = fd.get("kind"), date = fd.get("date"), accId = fd.get("accountId");
  if (!inv || !amount) return toast("Informe um valor válido");
  inv.history ||= [];
  if (kind === "aporte") { inv.invested += amount; inv.current += amount; if (accId) state.transactions.push({ id: uid(), type: "transfer", description: `Aporte · ${inv.name}`, amount, date, category: "Investimentos", accountId: accId, toInvestment: true }); }
  else if (kind === "resgate") { inv.invested = Math.max(0, inv.invested - amount); inv.current = Math.max(0, inv.current - amount); if (accId) state.transactions.push({ id: uid(), type: "income", description: `Resgate · ${inv.name}`, amount, date, category: "Rendimentos", accountId: accId }); }
  else inv.current = amount;
  inv.history.push({ id: uid(), date, kind, amount });
  save(); contributionModal.close(); render(); toast("Investimento atualizado ✓", "ok");
};

// ---------- meta, categoria, import/export ----------
$("#editGoalBtn").onclick = () => { $("#goalForm").elements.target.value = state.goal.target || ""; $("#goalModal").showModal(); };
$("#goalForm").onsubmit = e => { e.preventDefault(); state.goal.target = Number(new FormData(e.target).get("target")) || 0; save(); $("#goalModal").close(); render(); toast("Meta atualizada ✓", "ok"); };
$("#addCategoryBtn").onclick = () => { $("#categoryForm").reset(); $("#categoryModal").showModal(); };
$("#categoryForm").onsubmit = e => { e.preventDefault(); const fd = new FormData(e.target), name = String(fd.get("name")).trim(); if (!name) return; if (state.categories.some(c => c.name.toLowerCase() === name.toLowerCase())) return toast("Categoria já existe"); state.categories.push({ name, kind: fd.get("kind"), icon: fd.get("icon") || "•", color: fd.get("color") }); save(); $("#categoryModal").close(); render(); toast("Categoria adicionada ✓", "ok"); };
$$("[data-open]").forEach(b => b.onclick = () => ({ billModal: () => openBillModal(), budgetModal: openBudgetModal, accountModal: () => openAccountModal(), cardModal: () => openCardModal(), investmentModal: () => openInvestmentModal() })[b.dataset.open]?.());
document.addEventListener("click", e => { const b = e.target.closest("[data-open]"); if (b && !b.onclick) ({ accountModal: () => openAccountModal(), investmentModal: () => openInvestmentModal() })[b.dataset.open]?.(); });
$$(".close-modal").forEach(b => b.onclick = () => b.closest("dialog").close());
$$("dialog").forEach(d => d.addEventListener("click", e => { if (e.target === d) d.close(); }));

const exportBackup = () => { const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }), a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `meu-caixa-backup-${todayISO()}.json`; a.click(); URL.revokeObjectURL(a.href); toast("Backup exportado ✓", "ok"); };
$("#exportBtn").onclick = exportBackup; $("#exportBtn2").onclick = exportBackup;
$("#restoreFile").onchange = async e => { const f = e.target.files[0]; if (!f) return; try { const data = JSON.parse(await f.text()); if (!data.transactions) throw 0; if (await confirmDialog("Substituir todos os dados atuais pelo backup?", "Restaurar backup")) { state = migrate(data); save(); render(); toast("Backup restaurado ✓", "ok"); } } catch { toast("Arquivo inválido"); } e.target.value = ""; };
$("#resetBtn").onclick = async () => { if (await confirmDialog("Apagar TODOS os dados deste aparelho (e da nuvem, se sincronizado)? Faça um backup antes.", "Apagar tudo")) { state = freshState(); save(); render(); toast("Dados apagados"); } };
$("#importBtn").onclick = () => $("#importModal").showModal();
$("#csvFile").onchange = e => { $("#csvName").textContent = e.target.files[0]?.name || "ou arraste e solte aqui"; };
$("#importForm").onsubmit = async e => {
  e.preventDefault(); const file = $("#csvFile").files[0]; if (!file) return toast("Escolha um arquivo CSV");
  const lines = (await file.text()).trim().split(/\r?\n/); let added = 0;
  lines.slice(1).forEach(line => { const cols = line.split(/[;,]/).map(x => x.trim().replace(/^"|"$/g, "")); if (cols.length < 3) return; const raw = cols[2].replace(/R\$\s?/, "").replace(/\.(?=\d{3})/g, "").replace(",", "."); const amount = Math.abs(Number(raw)); if (!amount) return; let date = cols[0]; if (date.includes("/")) { const [d, m, y] = date.split("/"); date = `${y.length === 2 ? "20" + y : y}-${pad(m)}-${pad(d)}`; } const acc = state.accounts.find(a => a.name.toLowerCase() === (cols[4] || "").toLowerCase()), card = state.cards.find(c => c.name.toLowerCase() === (cols[4] || "").toLowerCase()); const cat = cols[3] && catInfo(cols[3]) ? cols[3] : "Outros"; if (cols[3] && !state.categories.some(c => c.name === cols[3])) state.categories.push({ name: cols[3], icon: "•", color: "#6b9eb5", kind: Number(raw) < 0 ? "income" : "expense" }); state.transactions.push({ id: uid(), date, description: cols[1] || "Importado", amount, category: cat, accountId: card ? card.accountId : (acc?.id || state.accounts[0].id), cardId: card?.id, type: Number(raw) < 0 ? "income" : "expense", note: "Importado de CSV" }); added++; });
  save(); render(); $("#importModal").close(); e.target.reset(); $("#csvName").textContent = "ou arraste e solte aqui"; toast(`${added} lançamentos importados ✓`, "ok");
};
$("#chartPeriod").onchange = e => renderChart(Number(e.target.value));
$("#toggleBalance").onclick = () => { hideValues = !hideValues; localStorage.setItem("mycash-hide", hideValues ? "1" : "0"); render(); };

// ---------- VOZ ----------
const NUM = { zero: 0, um: 1, uma: 1, dois: 2, duas: 2, tres: 3, "três": 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10, onze: 11, doze: 12, treze: 13, quatorze: 14, catorze: 14, quinze: 15, dezesseis: 16, dezessete: 17, dezoito: 18, dezenove: 19, vinte: 20, trinta: 30, quarenta: 40, cinquenta: 50, sessenta: 60, setenta: 70, oitenta: 80, noventa: 90, cem: 100, cento: 100, duzentos: 200, trezentos: 300, quatrocentos: 400, quinhentos: 500, seiscentos: 600, setecentos: 700, oitocentos: 800, novecentos: 900, meio: .5, meia: .5 };
function wordsToNumber(tokens) {
  let total = 0, cur = 0, found = false;
  for (const w of tokens) {
    if (w in NUM) { cur += NUM[w]; found = true; }
    else if (w === "mil") { total += (cur || 1) * 1000; cur = 0; found = true; }
    else if (/^milh/.test(w)) { total += (cur || 1) * 1e6; cur = 0; found = true; }
    else if (w === "e") continue; else break;
  }
  return found ? total + cur : null;
}
const KEYWORDS = [
  ["Alimentação", ["mercado", "supermercado", "comida", "almoço", "almoco", "jantar", "lanche", "ifood", "restaurante", "padaria", "café", "cafe", "pizza", "hamburguer", "hambúrguer", "feira", "açougue", "acougue", "delivery", "marmita", "sorvete", "doce"]],
  ["Transporte", ["uber", "99", "táxi", "taxi", "gasolina", "combustível", "combustivel", "ônibus", "onibus", "metrô", "metro", "estacionamento", "pedágio", "pedagio", "carro", "moto", "passagem", "corrida"]],
  ["Moradia", ["aluguel", "luz", "energia", "água", "agua", "internet", "condomínio", "condominio", "gás", "gas", "iptu", "wifi", "faxina", "diarista"]],
  ["Saúde", ["farmácia", "farmacia", "remédio", "remedio", "médico", "medico", "dentista", "academia", "consulta", "exame", "hospital", "plano de saúde", "psicólogo", "terapia"]],
  ["Assinaturas", ["netflix", "spotify", "assinatura", "prime", "disney", "youtube", "hbo", "globoplay", "icloud", "chatgpt", "mensalidade"]],
  ["Lazer", ["cinema", "bar", "cerveja", "show", "festa", "viagem", "hotel", "passeio", "jogo", "balada", "ingresso", "lazer", "praia", "churrasco"]],
  ["Compras", ["roupa", "tênis", "tenis", "sapato", "shopping", "amazon", "shopee", "mercado livre", "compra", "presente", "celular", "eletrônico", "loja"]],
  ["Educação", ["curso", "faculdade", "escola", "livro", "aula", "material"]],
  ["Impostos", ["imposto", "taxa", "multa", "das", "inss", "darf"]],
  ["Empresa", ["empresa", "fornecedor", "cliente", "nota fiscal", "contador", "software"]],
  ["Salário", ["salário", "salario", "pagamento", "holerite", "adiantamento"]],
  ["Receitas", ["freela", "freelance", "projeto", "venda", "vendi", "comissão", "comissao", "bônus", "bonus", "pix recebido", "recebi"]],
  ["Rendimentos", ["rendimento", "dividendo", "juros", "lucro"]],
  ["Investimentos", ["investi", "investimento", "aporte", "apliquei", "aplicação", "aplicacao", "tesouro", "cdb", "ações", "acoes", "bitcoin", "cripto", "poupança", "poupanca", "guardei"]]
];
function parseVoice(raw) {
  const text = raw.toLowerCase().replace(/r\$/g, " reais ").replace(/[,.](?=\s|$)/g, " ").replace(/\s+/g, " ").trim();
  const tokens = text.split(" ");
  // valor
  let amount = null, amountText = "";
  let m = text.match(/(\d{1,3}(?:\.\d{3})+|\d+)(?:[,.](\d{1,2}))?\s*(mil|milhão|milhao)?/);
  if (m) {
    amount = Number(m[1].replace(/\./g, "")) + (m[2] ? Number("0." + m[2]) : 0);
    if (m[3]) amount *= m[3] === "mil" ? 1000 : 1e6;
    amountText = m[0];
    const cents = text.slice(text.indexOf(m[0]) + m[0].length).match(/^\s*(?:reais?)?\s*(?:e|com)\s*(\d{1,2})\s*centavos?/);
    if (cents) { amount += Number(cents[1]) / 100; amountText += cents[0]; }
  } else {
    let best = null;
    for (let i = 0; i < tokens.length; i++) { if (tokens[i] in NUM || tokens[i] === "mil") { let j = i; while (j < tokens.length && (tokens[j] in NUM || tokens[j] === "mil" || /^milh/.test(tokens[j]) || tokens[j] === "e")) j++; while (tokens[j - 1] === "e") j--; const v = wordsToNumber(tokens.slice(i, j)); if (v !== null && (best === null || v > best.v)) best = { v, i, j }; i = j; } }
    if (best) { amount = best.v; amountText = tokens.slice(best.i, best.j).join(" "); const after = tokens.slice(best.j).join(" ").match(/^\s*(?:reais?)?\s*(?:e|com)\s+((?:\w+\s?){1,3}?)\s*centavos/); if (after) { const c = wordsToNumber(after[1].trim().split(" ")); if (c !== null) amount += c / 100; } }
  }
  // tipo
  let type = "expense";
  if (/\b(recebi|ganhei|entrou|caiu|receita|me pagaram|vendi|recebimento|rendeu)\b/.test(text)) type = "income";
  else if (/\b(transferi|transferência|transferencia|apliquei|investi|aporte|guardei|apliquei|mandei .* pra poupan)\b/.test(text)) type = "transfer";
  // data
  let date = todayISO();
  const d = new Date();
  if (/\bontem\b/.test(text)) { d.setDate(d.getDate() - 1); date = d.toISOString().slice(0, 10); }
  else if (/\banteontem\b/.test(text)) { d.setDate(d.getDate() - 2); date = d.toISOString().slice(0, 10); }
  else { const dm = text.match(/\bdia (\d{1,2})\b/); if (dm) { date = `${monthKey()}-${pad(Math.min(31, Number(dm[1])))}`; } }
  // categoria
  let category = null, hit = "";
  for (const [cat, words] of KEYWORDS) { for (const w of words) { if (new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(text)) { const ck = catInfo(cat).kind; if ((type === "expense" && ck === "expense") || (type === "income" && ck === "income") || (type === "transfer" && ck === "transfer") || !category) { category = cat; hit = w; } if (ck === (type === "expense" ? "expense" : type === "income" ? "income" : "transfer")) break; } } if (category && catInfo(category).kind === (type === "expense" ? "expense" : type === "income" ? "income" : "transfer")) break; }
  if (!category) category = type === "income" ? "Receitas" : type === "transfer" ? "Investimentos" : "Outros";
  // fonte
  let source = null; if (/\b(cart[ãa]o|cr[ée]dito)\b/.test(text) && state.cards[0]) source = "c:" + state.cards[0].id;
  const recurring = /\b(todo m[êe]s|mensal|mensalmente|recorrente|fixa|fixo)\b/.test(text);
  // descrição
  let desc = " " + text + " ";
  desc = desc.replace(amountText ? new RegExp(amountText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g") : /$^/, " ");
  desc = desc.replace(/\b(reais?|real|conto|pila|centavos?|gastei|paguei|comprei|recebi|ganhei|entrou|caiu|transferi|apliquei|investi|guardei|hoje|ontem|anteontem|dia \d{1,2}|no|na|nos|nas|em|de|do|da|dos|das|com|para|pra|pro|o|a|os|as|um|uma|e|que|foi|fiz|uns|umas|meu|minha|no cart[ãa]o|cart[ãa]o|cr[ée]dito|d[ée]bito|pix|dinheiro|todo m[êe]s|mensal|mensalmente|recorrente|fixa|fixo|valor|mil|milhão|milhao)\b/g, " ").replace(/\s+/g, " ").trim();
  if (!desc || desc.length < 3) desc = hit || category;
  desc = desc.replace(/^./, c => c.toUpperCase());
  return { type, amount, date, category, description: desc, source, recurring };
}

const voiceModal = $("#voiceModal"), micBtn = $("#micBtn"), transcriptEl = $("#voiceTranscript"), visual = $("#voiceVisual");
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null, listening = false;
function openVoice() { transcriptEl.textContent = SR ? "Toque no microfone e comece a falar…" : "Seu navegador não suporta reconhecimento de voz. Digite a frase abaixo."; $("#voiceSupport").textContent = SR ? "Funciona melhor no Chrome (computador e Android) e no Safari (iPhone)." : "Dica: use o Chrome no Android ou o Safari no iPhone."; micBtn.disabled = !SR; voiceModal.showModal(); if (SR) startListening(); }
function startListening() {
  if (!SR || listening) return;
  recognition = new SR(); recognition.lang = "pt-BR"; recognition.interimResults = true; recognition.maxAlternatives = 1; recognition.continuous = false;
  let finalText = "";
  recognition.onstart = () => { listening = true; micBtn.classList.add("on"); visual.classList.add("on"); transcriptEl.textContent = "Ouvindo…"; };
  recognition.onresult = e => { let interim = ""; for (const r of e.results) { if (r.isFinal) finalText += r[0].transcript; else interim += r[0].transcript; } transcriptEl.textContent = (finalText || interim || "Ouvindo…"); };
  recognition.onerror = e => { transcriptEl.textContent = e.error === "not-allowed" ? "Permita o acesso ao microfone nas configurações do navegador." : e.error === "no-speech" ? "Não ouvi nada. Toque no microfone e tente de novo." : "Erro: " + e.error; };
  recognition.onend = () => { listening = false; micBtn.classList.remove("on"); visual.classList.remove("on"); if (finalText.trim()) handleVoice(finalText.trim()); };
  try { recognition.start(); } catch (e) { listening = false; }
}
function handleVoice(text) {
  const p = parseVoice(text);
  if (!p.amount) { transcriptEl.innerHTML = `Entendi “${escapeHtml(text)}”, mas não encontrei o <strong>valor</strong>. Tente: “gastei 50 reais no mercado”.`; return; }
  voiceModal.close();
  openTransactionModal(null, { ...p, voice: text });
}
micBtn.onclick = () => { if (listening) recognition?.stop(); else startListening(); };
$("#voiceBtn").onclick = openVoice; $("#voiceFab").onclick = openVoice;
$("#voiceParseBtn").onclick = () => { const t = $("#voiceText").value.trim(); if (t) handleVoice(t); };
$("#voiceText").onkeydown = e => { if (e.key === "Enter") { e.preventDefault(); $("#voiceParseBtn").click(); } };
$$(".voice-examples .chip").forEach(b => b.onclick = () => handleVoice(b.textContent));
voiceModal.addEventListener("close", () => { try { recognition?.abort(); } catch { } listening = false; });

// ---------- SINCRONIZAÇÃO (Supabase REST) ----------
const sync = {
  timer: null, status: "off", lastError: "",
  cfg() { const c = window.MYCASH_CONFIG || {}; return { url: (localStorage.getItem("mycash-sb-url") || c.SUPABASE_URL || "").trim().replace(/\/$/, ""), key: (localStorage.getItem("mycash-sb-key") || c.SUPABASE_ANON_KEY || "").trim(), code: (localStorage.getItem("mycash-sync-code") || "").trim() }; },
  ready() { const c = this.cfg(); return !!(c.url && c.key && c.code); },
  async keyHash() { const code = "mycash::" + this.cfg().code; if (crypto?.subtle) { const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(code)); return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, "0")).join(""); } let h = 0; for (const ch of code) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return "fallback-" + h.toString(16); },
  headers() { const c = this.cfg(); return { apikey: c.key, Authorization: "Bearer " + c.key, "Content-Type": "application/json" }; },
  setStatus(s, err = "") { this.status = s; this.lastError = err; const b = $("#syncBadge"); const map = { off: "Somente neste aparelho", syncing: "Sincronizando…", ok: "Sincronizado na nuvem", error: "Erro de sincronização" }; b.className = "sync-badge " + s; b.querySelector("span").textContent = map[s]; if (currentPage === "settings") this.renderStatus(); },
  renderStatus() { const el = $("#syncStatus"); if (!el) return; const map = { off: ["⚪", "Não conectado. Os dados ficam apenas neste navegador."], syncing: ["🔄", "Sincronizando…"], ok: ["🟢", `Conectado. Última sincronização: ${new Date(state.updatedAt).toLocaleString("pt-BR")}`], error: ["🔴", "Erro: " + this.lastError] }; const [i, t] = map[this.status]; el.innerHTML = `<span>${i}</span><span>${t}</span>`; el.className = "sync-status " + this.status; },
  async pull() {
    if (!this.ready()) return; this.setStatus("syncing");
    try {
      const key = await this.keyHash(), c = this.cfg();
      const r = await fetch(`${c.url}/rest/v1/mycash_state?key=eq.${key}&select=data,updated_at`, { headers: this.headers() });
      if (!r.ok) throw new Error(await this.err(r));
      const rows = await r.json();
      if (rows.length) {
        const remote = rows[0].data;
        if (remote && remote.updatedAt && remote.updatedAt > state.updatedAt) { state = migrate(remote); localStorage.setItem("mycash-state", JSON.stringify(state)); render(); toast("Dados atualizados da nuvem ☁", "ok"); }
        else if (remote?.updatedAt !== state.updatedAt) await this.push(true);
      } else await this.push(true);
      this.setStatus("ok");
    } catch (e) { this.setStatus("error", e.message); }
  },
  async push(now = false) {
    if (!this.ready()) return;
    try {
      this.setStatus("syncing");
      const key = await this.keyHash(), c = this.cfg();
      const r = await fetch(`${c.url}/rest/v1/mycash_state`, { method: "POST", headers: { ...this.headers(), Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify([{ key, data: state, updated_at: state.updatedAt }]) });
      if (!r.ok) throw new Error(await this.err(r));
      this.setStatus("ok");
    } catch (e) { this.setStatus("error", e.message); if (!now) toast("Falha ao sincronizar: " + e.message); }
  },
  async err(r) { try { const j = await r.json(); return j.message || j.hint || r.statusText; } catch { return r.status === 404 ? "Tabela não encontrada. Rode o SQL no Supabase." : r.statusText || "HTTP " + r.status; } },
  schedulePush() { if (!this.ready()) return; clearTimeout(this.timer); this.timer = setTimeout(() => this.push(), 900); },
  startPolling() { setInterval(() => { if (document.visibilityState === "visible" && this.ready() && this.status !== "syncing") this.pull(); }, 30000); document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") this.pull(); }); window.addEventListener("online", () => this.pull()); }
};
$("#syncForm").onsubmit = async e => {
  e.preventDefault(); const fd = new FormData(e.target), url = String(fd.get("url")).trim().replace(/\/$/, ""), key = String(fd.get("key")).trim(), code = String(fd.get("code")).trim();
  if (!/^https:\/\/.+\.supabase\.co$/.test(url)) return toast("URL inválida. Formato: https://xxxx.supabase.co");
  if (key.length < 20) return toast("Cole a chave anon completa");
  if (code.length < 4) return toast("Use um código com pelo menos 4 caracteres");
  localStorage.setItem("mycash-sb-url", url); localStorage.setItem("mycash-sb-key", key); localStorage.setItem("mycash-sync-code", code);
  await sync.pull();
  if (sync.status === "ok") toast("Conectado! Seus dados estão na nuvem ☁", "ok"); else toast("Não foi possível conectar: " + sync.lastError);
};
$("#syncDisconnect").onclick = async () => { if (await confirmDialog("Desconectar da nuvem? Os dados continuam neste aparelho.", "Desconectar")) { ["mycash-sb-url", "mycash-sb-key", "mycash-sync-code"].forEach(k => localStorage.removeItem(k)); sync.setStatus("off"); render(); } };
$("#sqlBlock").textContent = `create table if not exists public.mycash_state (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);
alter table public.mycash_state enable row level security;
create policy "mycash anon read"   on public.mycash_state for select to anon using (true);
create policy "mycash anon insert" on public.mycash_state for insert to anon with check (true);
create policy "mycash anon update" on public.mycash_state for update to anon using (true) with check (true);`;
$("#copySql").onclick = async () => { try { await navigator.clipboard.writeText($("#sqlBlock").textContent); toast("SQL copiado ✓", "ok"); } catch { toast("Selecione e copie o texto manualmente"); } };

// ---------- PWA ----------
let installPrompt = null;
window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); installPrompt = e; $("#installBtn").hidden = false; });
$("#installBtn").onclick = async () => { if (!installPrompt) return; installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; $("#installBtn").hidden = true; };

// ---------- atalhos ----------
document.addEventListener("keydown", e => { if (e.target.matches("input,textarea,select")) return; if (e.key === "n") openTransactionModal(); if (e.key === "v") openVoice(); });

// ---------- início ----------
localStorage.setItem("mycash-state", JSON.stringify(state));
render();
sync.pull(); sync.startPolling();
if (!sync.ready()) sync.setStatus("off");
