
const OFFICIAL_GROUP_TIMES = [
  "2026-06-03T20:30",
  "2026-06-03T21:30",
  "2026-06-03T22:30",
  "2026-06-03T23:30",
  "2026-06-04T00:30",
  "2026-06-04T01:30",
  "2026-06-04T02:30",

  "2026-06-04T16:00",
  "2026-06-04T17:00",
  "2026-06-04T18:00",
  "2026-06-04T19:00",
  "2026-06-04T20:00",
  "2026-06-04T21:00",
  "2026-06-04T22:00",
  "2026-06-04T23:00",

  "2026-06-05T19:00",
  "2026-06-05T20:00",
  "2026-06-05T21:00",
  "2026-06-05T22:00",
  "2026-06-05T23:00"
];

const OFFICIAL_KNOCKOUT_TIMES = {
  qf1: "2026-06-06T00:30",
  qf2: "2026-06-06T01:30",
  sf1: "2026-06-06T17:30",
  sf2: "2026-06-06T18:30",
  third: "2026-06-06T21:45",
  final: "2026-06-06T22:45"
};

function applyOfficialGroupTimes(matches){
  matches.forEach((m, i) => {
    if(OFFICIAL_GROUP_TIMES[i]) m.datetime = OFFICIAL_GROUP_TIMES[i];
  });
}

function applyOfficialKnockoutTimes(knockout){
  if(!knockout) return;
  if(knockout.qf && knockout.qf[0]) knockout.qf[0].datetime = OFFICIAL_KNOCKOUT_TIMES.qf1;
  if(knockout.qf && knockout.qf[1]) knockout.qf[1].datetime = OFFICIAL_KNOCKOUT_TIMES.qf2;
  if(knockout.sf && knockout.sf[0]) knockout.sf[0].datetime = OFFICIAL_KNOCKOUT_TIMES.sf1;
  if(knockout.sf && knockout.sf[1]) knockout.sf[1].datetime = OFFICIAL_KNOCKOUT_TIMES.sf2;
  if(knockout.final && knockout.final[0]) knockout.final[0].datetime = OFFICIAL_KNOCKOUT_TIMES.third;
  if(knockout.final && knockout.final[1]) knockout.final[1].datetime = OFFICIAL_KNOCKOUT_TIMES.final;
}

function applyOfficialSchedule(){
  const data = loadData();
  if(data.matches && data.matches.length) applyOfficialGroupTimes(data.matches);
  if(data.knockout) applyOfficialKnockoutTimes(data.knockout);
  saveData(data);
  renderAdmin();
  alert("Horários oficiais aplicados.");
}



const STORAGE_KEY = "viverAlmeidaTorneioV6";

function loadData(){
  return JSON.parse(localStorage.getItem(STORAGE_KEY) || JSON.stringify({
    teams:[], groups:{A:[],B:[]}, matches:[], knockout:{qf:[], sf:[], final:[], champion:""}, createdAt:null
  }));
}
function saveData(data){ localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }

function shuffle(arr){
  return arr.map(v=>[Math.random(),v]).sort((a,b)=>a[0]-b[0]).map(x=>x[1]);
}

function createRoundRobin(groupName, teams){
  const jogos = [];
  for(let i=0;i<teams.length;i++){
    for(let j=i+1;j<teams.length;j++){
      jogos.push({
        id: makeId(), type:"group", round:"Grupo", group: groupName,
        teamA: teams[i], teamB: teams[j],
        goalsA: "", goalsB: "", datetime: "", played: false
      });
    }
  }
  return jogos;
}

function makeId(){
  return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random());
}




function createBalancedRoundRobin(groupName, teams){
  // Calendário por rondas.
  // Em cada ronda, cada equipa joga no máximo 1 vez.
  // Com 5 equipas, há sempre 1 equipa de folga por ronda.
  const list = [...teams, "FOLGA"];
  const rounds = [];
  const n = list.length;

  for(let r = 0; r < n - 1; r++){
    const round = [];

    for(let i = 0; i < n / 2; i++){
      const teamA = list[i];
      const teamB = list[n - 1 - i];

      if(teamA !== "FOLGA" && teamB !== "FOLGA"){
        round.push({
          id: makeId(),
          type: "group",
          round: `Ronda ${r + 1}`,
          group: groupName,
          teamA,
          teamB,
          goalsA: "",
          goalsB: "",
          datetime: "",
          played: false
        });
      }
    }

    rounds.push(round);

    // Rotação clássica do round-robin:
    // fixa a primeira equipa e roda as restantes.
    const fixed = list[0];
    const rest = list.slice(1);
    rest.unshift(rest.pop());
    list.splice(0, list.length, fixed, ...rest);
  }

  return rounds;
}

function buildBalancedCalendar(groupA, groupB){
  const roundsA = createBalancedRoundRobin("A", groupA);
  const roundsB = createBalancedRoundRobin("B", groupB);
  const calendar = [];

  for(let r = 0; r < Math.max(roundsA.length, roundsB.length); r++){
    const a = roundsA[r] || [];
    const b = roundsB[r] || [];

    // Intercalado por rondas:
    // A1, B1, A2, B2.
    // Assim evita o caso de "Cubo", "Garagem", etc. repetirem logo nos primeiros jogos.
    if(a[0]) calendar.push(a[0]);
    if(b[0]) calendar.push(b[0]);
    if(a[1]) calendar.push(a[1]);
    if(b[1]) calendar.push(b[1]);
  }

  return calendar;
}


function generateStandings(groupTeams, matches, groupName){
  const table = {};
  groupTeams.forEach(t => table[t] = {team:t, J:0,V:0,E:0,D:0,GM:0,GS:0,DG:0,Pts:0});
  matches.filter(m => m.group === groupName && m.played).forEach(m => {
    const a = table[m.teamA], b = table[m.teamB];
    const ga = Number(m.goalsA), gb = Number(m.goalsB);
    if(!a || !b || Number.isNaN(ga) || Number.isNaN(gb)) return;
    a.J++; b.J++;
    a.GM += ga; a.GS += gb; a.DG = a.GM-a.GS;
    b.GM += gb; b.GS += ga; b.DG = b.GM-b.GS;
    if(ga > gb){ a.V++; b.D++; a.Pts += 3; }
    else if(ga < gb){ b.V++; a.D++; b.Pts += 3; }
    else { a.E++; b.E++; a.Pts++; b.Pts++; }
  });
  return Object.values(table).sort((x,y)=> y.Pts-x.Pts || y.DG-x.DG || y.GM-x.GM || x.team.localeCompare(y.team));
}

function tableHTML(rows){
  return `<table>
    <thead><tr><th>Equipa</th><th>J</th><th>V</th><th>E</th><th>D</th><th>GM</th><th>GS</th><th>DG</th><th>Pts</th></tr></thead>
    <tbody>${rows.map(r=>`<tr><td><strong>${r.team}</strong></td><td>${r.J}</td><td>${r.V}</td><td>${r.E}</td><td>${r.D}</td><td>${r.GM}</td><td>${r.GS}</td><td>${r.DG}</td><td><strong>${r.Pts}</strong></td></tr>`).join("")}</tbody>
  </table>`;
}

function matchCard(m){
  const score = m.played ? `${m.goalsA} - ${m.goalsB}` : "vs";
  const status = m.played ? "TERMINADO" : (m.datetime ? new Date(m.datetime).toLocaleString("pt-PT") : "POR MARCAR");
  let label;
  if(m.type === "knockout"){
    if(m.name && m.name.includes("3.º / 4.º")) label = "3.º/4.º";
    else label = m.round;
  } else {
    label = `Grupo ${m.group}`;
  }
  return `<div class="match">
    <div class="teamA">${m.teamA || "A definir"}</div>
    <div class="score">${score}<br><span class="badge ${m.type === "knockout" ? "ko" : ""}">${label}</span></div>
    <div class="teamB">${m.teamB || "A definir"}</div>
    <small style="grid-column:1/-1;text-align:center;color:#b8c7c0">${status}</small>
  </div>`;
}

function allMatches(data){
  return [
    ...data.matches,
    ...(data.knockout?.qf || []),
    ...(data.knockout?.sf || []),
    ...(data.knockout?.final || [])
  ];
}

function renderPublic(){
  const data = loadData();
  if(!document.getElementById("groups")) return;

  document.getElementById("groups").innerHTML = data.groups.A.length ? `
    <div class="grid">
      <div class="group"><h3>Grupo A</h3>${data.groups.A.map(t=>`<div class="team">⚽ ${t}</div>`).join("")}</div>
      <div class="group"><h3>Grupo B</h3>${data.groups.B.map(t=>`<div class="team">⚽ ${t}</div>`).join("")}</div>
    </div>` : `<p>Ainda não existem grupos criados.</p>`;

  const upcoming = allMatches(data)
    .filter(m => !m.played)
    .sort((a,b) => {
      if(a.datetime && b.datetime) return new Date(a.datetime) - new Date(b.datetime);
      if(a.datetime) return -1;
      if(b.datetime) return 1;
      return 0;
    })
    .slice(0,4);
  document.getElementById("upcoming").innerHTML = upcoming.length ? upcoming.map(matchCard).join("") : "<p>Sem próximos jogos.</p>";
  const calendarMatches = allMatches(data);
  document.getElementById("calendar").innerHTML = calendarMatches.length ? calendarMatches.map(matchCard).join("") : "<p>Ainda não existe calendário.</p>";

  document.getElementById("standings").innerHTML = data.groups.A.length ? `
    <div class="grid">
      <div class="tablebox"><h3>Classificação Grupo A</h3>${tableHTML(generateStandings(data.groups.A, data.matches, "A"))}</div>
      <div class="tablebox"><h3>Classificação Grupo B</h3>${tableHTML(generateStandings(data.groups.B, data.matches, "B"))}</div>
    </div>` : "<p>A classificação aparece quando existirem grupos.</p>";

  renderKnockoutPublic();
}

function koWinner(m){
  if(!m || !m.played) return "";
  const a = Number(m.goalsA), b = Number(m.goalsB);
  if(a > b) return m.teamA;
  if(b > a) return m.teamB;
  return "";
}

function koMatchHTML(m){
  if(!m) return "";
  const w = koWinner(m);
  return `<div class="ko-card">
    <h4>${m.name}</h4>
    <div class="${w === m.teamA ? "winner" : "loser"}">${m.teamA || "A definir"} ${m.played ? m.goalsA : ""}</div>
    <div class="${w === m.teamB ? "winner" : "loser"}">${m.teamB || "A definir"} ${m.played ? m.goalsB : ""}</div>
  </div>`;
}

function renderKnockoutPublic(){
  const area = document.getElementById("knockout");
  if(!area) return;
  const data = loadData();
  const ko = data.knockout || {qf:[],sf:[],final:[],champion:""};
  area.innerHTML = ko.qf.length ? `
    <div class="bracket">
      <div><h3 class="round-title">Quartos de Final</h3>${ko.qf.map(koMatchHTML).join("")}</div>
      <div><h3 class="round-title">Meias-Finais</h3>${ko.sf.map(koMatchHTML).join("")}</div>
      <div><h3 class="round-title">Final</h3>${ko.final.map(koMatchHTML).join("")}
        <div class="ko-card champion"><h3>🏆 Campeão</h3><h2>${ko.champion || "A definir"}</h2></div>
      </div>
    </div>` : `<p>A fase final ainda não foi criada pelo admin.</p>`;
}

function renderAdmin(){
  const data = loadData();
  const teamInputs = document.getElementById("teamInputs");
  if(!teamInputs) return;

  teamInputs.innerHTML = "";
  for(let i=0;i<10;i++){
    teamInputs.innerHTML += `<input id="team${i}" placeholder="Equipa ${i+1}" value="${data.teams[i] || ""}">`;
  }

  renderPublic();
  renderAdminMatches();
  renderAdminKnockout();
}

function renderAdminMatches(){
  const data = loadData();
  const adminMatches = document.getElementById("adminMatches");
  if(!adminMatches) return;
  adminMatches.innerHTML = data.matches.length ? data.matches.map(m => resultRow(m)).join("") : "<p>Gera o calendário primeiro.</p>";
}

function resultRow(m){
  return `<div class="admin-row">
    <div class="admin-team admin-team-a">${m.teamA || "A definir"}</div>
    <input class="score-input score-a" type="number" min="0" id="ga-${m.id}" value="${m.goalsA}" placeholder="0">
    <span class="score-separator">-</span>
    <input class="score-input score-b" type="number" min="0" id="gb-${m.id}" value="${m.goalsB}" placeholder="0">
    <div class="admin-team admin-team-b">${m.teamB || "A definir"}</div>

    <button class="save-btn" onclick="saveResult('${m.id}')">Guardar</button>

    <div class="move-controls">
      <button class="secondary mini" onclick="moveMatch('${m.id}', -1)">⬆️ Subir</button>
      <button class="secondary mini" onclick="moveMatch('${m.id}', 1)">⬇️ Descer</button>
    </div>

    <input class="datetime-input" type="datetime-local" id="dt-${m.id}" value="${m.datetime || ""}" onchange="saveDateTime('${m.id}')" title="Data e hora do jogo">
    <small>${m.type === "knockout" ? m.round : "Grupo " + m.group} · Ao subir/descer, a hora muda automaticamente pela ordem</small>
  </div>`;
}

function renderAdminKnockout(){
  const data = loadData();
  const adminKO = document.getElementById("adminKnockout");
  if(!adminKO) return;
  const koMatches = [...(data.knockout.qf || []), ...(data.knockout.sf || []), ...(data.knockout.final || [])];
  adminKO.innerHTML = koMatches.length ? koMatches.map(m => resultRow(m)).join("") : "<p>Cria primeiro a fase final.</p>";
}

function submitTeams(){
  const teams = [];
  for(let i=0;i<10;i++){
    const name = document.getElementById("team"+i).value.trim();
    if(!name){ alert("Preenche as 10 equipas."); return; }
    teams.push(name);
  }
  const mixed = shuffle(teams);
  const data = loadData();
  data.teams = teams;
  data.groups = {A:mixed.slice(0,5), B:mixed.slice(5)};
  data.matches = [];
  data.knockout = {qf:[], sf:[], final:[], champion:""};
  data.createdAt = new Date().toISOString();
  saveData(data);
  renderAdmin();
  alert("Grupos criados. Agora podes gerar o calendário.");
}

function generateCalendar(){
  const data = loadData();
  if(!data.groups.A.length){ alert("Cria primeiro os grupos."); return; }

  // Calendário equilibrado: evita que a mesma equipa jogue jogos seguidos.
  const intercalado = buildBalancedCalendar(data.groups.A, data.groups.B);

  data.matches = intercalado;
  applyOfficialGroupTimes(data.matches);

  // Cria logo a chave da fase final, mesmo antes dos resultados.
  buildKnockoutSkeleton(data);

  saveData(data);
  renderAdmin();
}

function saveDateTime(id){
  const data = loadData();
  let m = allMatches(data).find(x=>x.id===id);
  if(!m) return;
  m.datetime = document.getElementById("dt-"+id).value;
  saveData(data);
  renderAdmin();
}

function saveResult(id){
  const data = loadData();
  let m = allMatches(data).find(x=>x.id===id);
  if(!m) return;
  const ga = document.getElementById("ga-"+id).value;
  const gb = document.getElementById("gb-"+id).value;
  if(ga === "" || gb === ""){ alert("Mete os dois resultados."); return; }
  if(m.type === "knockout" && Number(ga) === Number(gb)){ alert("Na fase final não pode haver empate."); return; }
  const dt = document.getElementById("dt-"+id);
  if(dt) m.datetime = dt.value;
  m.goalsA = Number(ga);
  m.goalsB = Number(gb);
  m.played = true;

  if(m.type === "group"){
    const koPlayed = data.knockout && allMatches({matches:[], knockout:data.knockout}).some(x => x.played);
    if(!koPlayed) buildKnockoutSkeleton(data);
  }

  updateKnockoutProgress(data);
  saveData(data);
  renderAdmin();
}


function buildKnockoutSkeleton(data){
  if(!data.groups.A.length || !data.groups.B.length) return;

  const a = generateStandings(data.groups.A, data.matches, "A");
  const b = generateStandings(data.groups.B, data.matches, "B");

  // Mesmo sem resultados, a tabela devolve uma ordem provisória com as equipas atuais.
  if(a.length < 3 || b.length < 3) return;

  data.knockout = {
    qf: [
      koGame("QF1", "Quartos 1", a[1].team, b[2].team),
      koGame("QF2", "Quartos 2", b[1].team, a[2].team)
    ],
    sf: [
      koGame("SF1", "Meia-final 1", a[0].team, "Vencedor QF2"),
      koGame("SF2", "Meia-final 2", b[0].team, "Vencedor QF1")
    ],
    final: [
      koGame("3RD", "3.º / 4.º Lugar", "Derrotado SF1", "Derrotado SF2"),
      koGame("F", "Final", "Vencedor SF1", "Vencedor SF2")
    ],
    champion:""
  };

  applyOfficialKnockoutTimes(data.knockout);
  updateKnockoutProgress(data);
}


function createKnockout(){
  const data = loadData();
  if(!data.groups.A.length || !data.groups.B.length){ alert("Cria primeiro os grupos."); return; }

  buildKnockoutSkeleton(data);

  saveData(data);
  renderAdmin();
  alert("Fase final atualizada conforme a classificação atual.");
}

function koGame(code, name, teamA, teamB){
  return {id:makeId(), type:"knockout", code, name, round:name.includes("Quartos")?"Quartos":name.includes("Meia")?"Meias":"Final", group:"KO", teamA, teamB, goalsA:"", goalsB:"", played:false, datetime:""};
}

function updateKnockoutProgress(data){
  const ko = data.knockout;
  if(!ko || !ko.qf.length) return;

  const w1 = koWinner(ko.qf[0]);
  const w2 = koWinner(ko.qf[1]);

  // Meia 1: 1.º Grupo A vs vencedor do quarto 2
  // Meia 2: 1.º Grupo B vs vencedor do quarto 1
  if(w2) ko.sf[0].teamB = w2;
  if(w1) ko.sf[1].teamB = w1;

  const s1 = koWinner(ko.sf[0]);
  const s2 = koWinner(ko.sf[1]);

  const loser1 = ko.sf[0].played ? (s1 === ko.sf[0].teamA ? ko.sf[0].teamB : ko.sf[0].teamA) : "Derrotado SF1";
  const loser2 = ko.sf[1].played ? (s2 === ko.sf[1].teamA ? ko.sf[1].teamB : ko.sf[1].teamA) : "Derrotado SF2";

  // Jogo 3.º / 4.º lugar
  ko.final[0].teamA = loser1;
  ko.final[0].teamB = loser2;

  // Final
  if(s1) ko.final[1].teamA = s1;
  if(s2) ko.final[1].teamB = s2;

  const champ = koWinner(ko.final[1]);
  if(champ) ko.champion = champ;
}


function autoScheduleFinalPhase(){
  const data = loadData();
  const ko = [...(data.knockout.qf || []), ...(data.knockout.sf || []), ...(data.knockout.final || [])];
  if(!ko.length){ alert("Cria primeiro a fase final."); return; }

  const groupTimes = data.matches.map(m => m.datetime).filter(Boolean).sort();
  let start;

  if(groupTimes.length){
    start = new Date(groupTimes[groupTimes.length - 1]);
    start.setMinutes(start.getMinutes() + 60);
  } else {
    start = new Date();
    start.setHours(start.getHours() + 1, 0, 0, 0);
  }

  ko.forEach((m, index) => {
    const d = new Date(start);
    d.setMinutes(start.getMinutes() + index * 60);
    m.datetime = toLocalInputValue(d);
  });

  saveData(data);
  renderAdmin();
  alert("Datas da fase final colocadas automaticamente a seguir aos jogos dos grupos.");
}

function toLocalInputValue(date){
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}


function reapplyTimesByCurrentOrder(){
  const data = loadData();
  if(data.matches && data.matches.length) applyOfficialGroupTimes(data.matches);
  if(data.knockout) applyOfficialKnockoutTimes(data.knockout);
  saveData(data);
  renderAdmin();
}

function moveMatch(id, direction){
  const data = loadData();

  let listName = "matches";
  let list = data.matches;
  let index = list.findIndex(m => m.id === id);

  if(index === -1 && data.knockout){
    const koLists = ["qf", "sf", "final"];
    for(const key of koLists){
      const found = data.knockout[key].findIndex(m => m.id === id);
      if(found !== -1){
        listName = key;
        list = data.knockout[key];
        index = found;
        break;
      }
    }
  }

  if(index === -1) return;

  const newIndex = index + direction;
  if(newIndex < 0 || newIndex >= list.length) return;

  const temp = list[index];
  list[index] = list[newIndex];
  list[newIndex] = temp;

  // Ao mudar a ordem, as horas são novamente aplicadas pela ordem nova.
  if(listName === "matches") applyOfficialGroupTimes(data.matches);
  if(data.knockout) applyOfficialKnockoutTimes(data.knockout);

  saveData(data);
  renderAdmin();
}


function resetTournament(){
  if(confirm("Tens a certeza que queres apagar o torneio todo? Esta ação não pode ser anulada.")){
    localStorage.removeItem(STORAGE_KEY);
    renderAdmin();
  }
}

function login(){
  const pass = document.getElementById("pass").value;
  if(pass === "admin2026"){
    sessionStorage.setItem("adminOK","1");
    location.href = "painel.html";
  } else {
    document.getElementById("loginMsg").innerText = "Password errada.";
  }
}

function protectAdmin(){
  if(sessionStorage.getItem("adminOK") !== "1"){
    location.href = "admin.html";
  }
}

function showTab(id){
  document.querySelectorAll(".tab-content").forEach(x=>x.classList.add("hidden"));
  document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
  document.getElementById(id).classList.remove("hidden");
  document.querySelector(`[data-tab="${id}"]`).classList.add("active");
}


function toggleMobileMenu(){
  const tabs = document.getElementById("mobileTabs");
  if(tabs){
    tabs.classList.toggle("open");
  }
}
