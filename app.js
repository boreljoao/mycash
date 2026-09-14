const seed={
transactions:[
{id:"t1",description:"Recebimento de projeto",category:"Receitas",account:"Conta principal",date:"2026-09-13",amount:8500,type:"income"},
{id:"t2",description:"Supermercado",category:"Alimentação",account:"Banco digital",date:"2026-09-12",amount:684.32,type:"expense"},
{id:"t3",description:"Aporte mensal",category:"Investimentos",account:"Investimentos",date:"2026-09-11",amount:3000,type:"transfer"},
{id:"t4",description:"Software de trabalho",category:"Assinaturas",account:"Banco digital",date:"2026-09-10",amount:124,type:"expense"},
{id:"t5",description:"Restaurante",category:"Lazer",account:"Conta principal",date:"2026-09-09",amount:386.9,type:"expense"},
{id:"t6",description:"Serviço recorrente",category:"Receitas",account:"Conta principal",date:"2026-09-08",amount:4000,type:"income"},
{id:"t7",description:"Transporte por aplicativo",category:"Transporte",account:"Banco digital",date:"2026-09-07",amount:73.45,type:"expense"}
],
accounts:[
{id:"a1",name:"Conta principal",type:"Conta digital",balance:48250,color:"#15804f",initials:"CP"},
{id:"a2",name:"Banco digital",type:"Conta corrente",balance:21930,color:"#e87931",initials:"BD"},
{id:"a3",name:"Carteira",type:"Dinheiro",balance:4720,color:"#26382e",initials:"$"}
],
cards:[
{id:"c1",name:"Cartão principal",brand:"VISA",last:"4821",limit:15000,invoice:3420,due:18,color:"#173c2c"},
{id:"c2",name:"Cartão secundário",brand:"VISA",last:"7304",limit:8000,invoice:1617.8,due:12,color:"#252a37"}
],
contributions:[
{id:"i1",date:"2026-09-11",description:"Aporte mensal",amount:3000},
{id:"i2",date:"2026-09-03",description:"Atualização de patrimônio",amount:2500},
{id:"i3",date:"2026-08-15",description:"Aporte mensal",amount:2000}
],
investmentTotal:53500
};
let state=JSON.parse(localStorage.getItem("meucaixa-state")||"null")||structuredClone(seed);
const money=v=>new Intl.NumberFormat("pt-BR",{style:"currency",currency:"BRL"}).format(v);
const shortDate=s=>new Intl.DateTimeFormat("pt-BR",{day:"2-digit",month:"short"}).format(new Date(s+"T12:00:00"));
const uid=()=>Math.random().toString(36).slice(2)+Date.now().toString(36);
const save=()=>localStorage.setItem("meucaixa-state",JSON.stringify(state));
const categoryIcons={Receitas:"↗",Alimentação:"◒",Investimentos:"⌁",Assinaturas:"◫",Lazer:"✦",Transporte:"◆",Moradia:"⌂",Saúde:"＋",Compras:"◇",Empresa:"▦",Outros:"•"};
const categoryColors={"Alimentação":"#1d7a55","Lazer":"#e49a57","Compras":"#8d78c8","Transporte":"#6b9eb5","Outros":"#d5dcd8"};
function toast(message){const el=document.getElementById("toast");el.textContent=message;el.classList.add("show");clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>el.classList.remove("show"),2600)}
function escapeHtml(v){const d=document.createElement("div");d.textContent=v;return d.innerHTML}
function navigate(id){
 document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===id));
 document.querySelectorAll(".nav-item[data-page]").forEach(b=>b.classList.toggle("active",b.dataset.page===id));
 const names={dashboard:"Meu Caixa",transactions:"Movimentações",accounts:"Contas",cards:"Cartões",budget:"Orçamento",investments:"Investimentos"};
 document.getElementById("pageTitle").textContent=names[id];document.querySelector(".sidebar").classList.remove("open");window.scrollTo(0,0);if(id==="transactions")renderTransactions()
}
document.querySelectorAll("[data-page]").forEach(b=>b.onclick=()=>navigate(b.dataset.page));
document.querySelectorAll("[data-go]").forEach(b=>b.onclick=()=>navigate(b.dataset.go));
document.getElementById("menuBtn").onclick=()=>document.querySelector(".sidebar").classList.toggle("open");
function renderMetrics(){
 const incomes=state.transactions.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0),expenses=state.transactions.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0),rate=incomes?Math.round((incomes-expenses)/incomes*100):0;
 const data=[["↗","Entradas no mês",money(incomes),"+12,8% versus agosto",""],["↘","Saídas no mês",money(expenses),"8,2% abaixo de agosto","negative"],["◈","Geração de caixa",money(incomes-expenses),"Média mensal demonstrativa",""],["◎","Taxa de poupança",rate+"%","Meta mensal: 60%",""]];
 document.getElementById("metrics").innerHTML=data.map(x=>`<article class="metric"><div class="metric-top"><span>${x[1]}</span><span class="metric-icon">${x[0]}</span></div><strong>${x[2]}</strong><small class="${x[4]}">${x[3]}</small></article>`).join("")
}
function transactionMarkup(t){return `<div class="transaction"><span class="transaction-icon">${categoryIcons[t.category]||"•"}</span><span class="transaction-info"><strong>${escapeHtml(t.description)}</strong><small>${t.category} · ${t.account}</small></span><span class="transaction-value ${t.type==="income"?"positive":t.type==="expense"?"negative":""}">${t.type==="income"?"+":t.type==="expense"?"−":""} ${money(t.amount)}<small>${shortDate(t.date)}</small></span></div>`}
function renderRecent(){document.getElementById("recentTransactions").innerHTML=[...state.transactions].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,5).map(transactionMarkup).join("")}
function renderBills(){const bills=[["18","SET","Fatura cartão principal","Cartão final 4821",3420],["22","SET","Software de trabalho","Assinatura mensal",124],["05","OUT","Aluguel","Despesa recorrente",1850]];document.getElementById("upcomingBills").innerHTML=bills.map(b=>`<div class="bill"><span class="bill-date"><span><strong>${b[0]}</strong>${b[1]}</span></span><span class="bill-info"><strong>${b[2]}</strong><small>${b[3]}</small></span><strong>${money(b[4])}</strong></div>`).join("")}
function renderCategories(){const cats=[["Alimentação",35],["Lazer",22],["Compras",18],["Transporte",14],["Outros",11]];document.getElementById("categoryLegend").innerHTML=cats.map(c=>`<div class="legend-row"><i class="legend-dot" style="background:${categoryColors[c[0]]}"></i><span>${c[0]}</span><strong>${c[1]}%</strong></div>`).join("")}
function renderChart(months=6){
 const all=[42,47,45,51,55,59,62,66,69,71,73,75],vals=all.slice(-months),w=700,h=210,pad=20,max=Math.max(...vals)*1.08,min=Math.min(...vals)*.88,pts=vals.map((v,i)=>[pad+i*(w-pad*2)/(vals.length-1),h-pad-(v-min)/(max-min)*(h-pad*2)]),labels=["ABR","MAI","JUN","JUL","AGO","SET","OUT","NOV","DEZ","JAN","FEV","MAR"].slice(-months);
 document.getElementById("cashChart").innerHTML=`<defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#42a77d" stop-opacity=".24"/><stop offset="1" stop-color="#42a77d" stop-opacity="0"/></linearGradient></defs>${[30,80,130,180].map(y=>`<line class="grid-line" x1="20" y1="${y}" x2="680" y2="${y}"/>`).join("")}<path class="area" d="M${pts[0][0]},${h} L${pts.map(p=>p.join(",")).join(" L")} L${pts.at(-1)[0]},${h} Z"/><path class="line" d="M${pts.map(p=>p.join(",")).join(" L")}"/>${pts.map(p=>`<circle class="point" cx="${p[0]}" cy="${p[1]}" r="3.5"/>`).join("")}${pts.map((p,i)=>`<text class="axis-label" x="${p[0]}" y="231" text-anchor="middle">${labels[i]}</text>`).join("")}`
}
function renderTransactions(){
 const q=document.getElementById("searchInput").value.toLowerCase(),type=document.getElementById("typeFilter").value,list=[...state.transactions].filter(t=>(!q||t.description.toLowerCase().includes(q)||t.category.toLowerCase().includes(q))&&(!type||t.type===type)).sort((a,b)=>b.date.localeCompare(a.date));
 document.getElementById("resultsCount").textContent=list.length+" lançamentos";
 document.getElementById("transactionsTable").innerHTML=list.map(t=>`<tr><td><strong>${escapeHtml(t.description)}</strong></td><td><span class="category-badge">${t.category}</span></td><td>${t.account}</td><td>${new Date(t.date+"T12:00:00").toLocaleDateString("pt-BR")}</td><td class="right ${t.type==="income"?"positive":t.type==="expense"?"negative":""}"><strong>${t.type==="income"?"+":t.type==="expense"?"−":""} ${money(t.amount)}</strong></td><td><button class="delete-btn" data-delete="${t.id}" title="Excluir">×</button></td></tr>`).join("")||'<tr><td colspan="6">Nenhuma movimentação encontrada.</td></tr>';
 document.querySelectorAll("[data-delete]").forEach(b=>b.onclick=()=>{if(confirm("Excluir esta movimentação?")){state.transactions=state.transactions.filter(t=>t.id!==b.dataset.delete);save();renderAll();toast("Movimentação excluída")}})
}
function renderAccounts(){const total=state.accounts.reduce((s,a)=>s+a.balance,0);document.getElementById("accountsGrid").innerHTML=state.accounts.map(a=>`<article class="account-card"><div class="account-brand"><span class="bank-icon" style="background:${a.color}">${a.initials}</span><button class="ghost">•••</button></div><strong>${money(a.balance)}</strong><small>${a.name} · ${a.type}</small><div class="account-footer"><span>${Math.round(a.balance/total*100)}% do caixa</span><span>Atualizado hoje</span></div></article>`).join("")}
function renderCards(){document.getElementById("cardsGrid").innerHTML=state.cards.map(c=>`<article class="credit-wrap"><div class="credit-card" style="background:linear-gradient(145deg,${c.color},#315b48)"><div class="cc-top"><strong>${c.name}</strong><span>${c.brand}</span></div><div class="cc-number">•••• •••• •••• ${c.last}</div><div class="cc-bottom"><span>TITULAR</span><span>12/31</span></div></div><div class="card-details"><div><small>Fatura atual</small><strong>${money(c.invoice)}</strong></div><div><small>Limite disponível</small><strong>${money(c.limit-c.invoice)}</strong></div><div><small>Vencimento</small><strong>Dia ${c.due}</strong></div></div></article>`).join("")}
function renderBudget(){const budgets=[["Alimentação",2000,1350],["Lazer",1800,1120],["Compras",2500,1680],["Transporte",1000,640],["Assinaturas",700,390],["Viagens",4000,2760]];document.getElementById("budgetList").innerHTML=budgets.map(b=>{const pct=Math.round(b[2]/b[1]*100);return `<div class="budget-row"><strong>${b[0]}</strong><div class="mini-progress ${pct>100?"over":""}"><i style="width:${Math.min(pct,100)}%"></i></div><span class="budget-values"><strong>${pct}%</strong><br>${money(b[2])}</span></div>`}).join("")}
function renderInvestments(){document.getElementById("investmentTotal").textContent=money(state.investmentTotal);document.getElementById("contributionsList").innerHTML=state.contributions.map(i=>`<div class="transaction"><span class="transaction-icon">⌁</span><span class="transaction-info"><strong>${i.description}</strong><small>${shortDate(i.date)}</small></span><span class="transaction-value positive">+ ${money(i.amount)}</span></div>`).join("")}
function renderAll(){renderMetrics();renderRecent();renderTransactions();renderAccounts();renderCards();renderBudget();renderInvestments()}
const transactionModal=document.getElementById("transactionModal"),importModal=document.getElementById("importModal");
document.getElementById("newTransactionBtn").onclick=()=>{document.querySelector('[name="date"]').value=new Date().toISOString().slice(0,10);transactionModal.showModal()};
document.getElementById("importBtn").onclick=()=>importModal.showModal();
document.querySelectorAll(".close-modal").forEach(b=>b.onclick=()=>b.closest("dialog").close());
document.querySelectorAll("dialog").forEach(d=>d.onclick=e=>{if(e.target===d)d.close()});
document.getElementById("transactionForm").onsubmit=e=>{e.preventDefault();const fd=new FormData(e.target);state.transactions.push({id:uid(),description:fd.get("description").trim(),amount:Number(fd.get("amount")),date:fd.get("date"),category:fd.get("category"),account:fd.get("account"),type:fd.get("type"),note:fd.get("note")});save();renderAll();e.target.reset();transactionModal.close();toast("Movimentação adicionada com sucesso")};
document.getElementById("searchInput").oninput=renderTransactions;document.getElementById("typeFilter").onchange=renderTransactions;document.getElementById("chartPeriod").onchange=e=>renderChart(Number(e.target.value));
document.getElementById("importForm").onsubmit=async e=>{e.preventDefault();const file=document.getElementById("csvFile").files[0];if(!file)return toast("Escolha um arquivo CSV");const text=await file.text(),lines=text.trim().split(/\r?\n/);let added=0;lines.slice(1).forEach(line=>{const cols=line.split(/[;,]/).map(x=>x.trim().replace(/^"|"$/g,""));if(cols.length<3)return;const raw=cols[2].replace(/R\$\s?/,"").replace(/\./g,"").replace(",",".");const amount=Math.abs(Number(raw));if(!amount)return;let date=cols[0];if(date.includes("/")){const [d,m,y]=date.split("/");date=`${y}-${m.padStart(2,"0")}-${d.padStart(2,"0")}`}state.transactions.push({id:uid(),date,description:cols[1]||"Importado",amount,category:cols[3]||"Outros",account:cols[4]||"Cartão importado",type:Number(raw)<0?"income":"expense"});added++});save();renderAll();importModal.close();e.target.reset();toast(added+" lançamentos importados")};
document.getElementById("exportBtn").onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"}),a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download="meu-caixa-backup.json";a.click();URL.revokeObjectURL(a.href);toast("Backup exportado")};
document.getElementById("updateInvestmentBtn").onclick=()=>{const val=prompt("Qual é o patrimônio investido atual?",state.investmentTotal);if(val===null)return;const n=Number(val.replace?.(",",".")||val);if(!Number.isFinite(n)||n<0)return toast("Informe um valor válido");state.investmentTotal=n;state.contributions.unshift({id:uid(),date:new Date().toISOString().slice(0,10),description:"Atualização de patrimônio",amount:n});save();renderInvestments();toast("Patrimônio atualizado")};
document.querySelector('[data-open="accountModal"]').onclick=()=>{const name=prompt("Nome da nova conta:");if(!name)return;const balance=Number(prompt("Saldo atual:","0")?.replace(",","."));if(!Number.isFinite(balance))return toast("Saldo inválido");state.accounts.push({id:uid(),name,type:"Conta",balance,color:"#1d7a55",initials:name.slice(0,2).toUpperCase()});save();renderAccounts();toast("Conta adicionada")};
document.querySelector("#cards .btn.primary").onclick=()=>{const name=prompt("Nome do cartão:");if(!name)return;const limit=Number(prompt("Limite total:","0")?.replace(",","."));state.cards.push({id:uid(),name,brand:"VISA",last:"0000",limit:Number.isFinite(limit)?limit:0,invoice:0,due:10,color:"#173c2c"});save();renderCards();toast("Cartão adicionado")};
let hidden=false;document.getElementById("toggleBalance").onclick=()=>{hidden=!hidden;document.querySelectorAll("[data-money]").forEach(el=>el.textContent=hidden?"R$ ••••••":money(Number(el.dataset.money)))};
renderAll();renderCategories();renderBills();renderChart();