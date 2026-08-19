const state = {
  data: [],
  pool: [],
  bracket: [],
  round: 0,
  matchIndex: 0,
  nextRound: [],
};

const el = {
  cafeteriaButtons: document.getElementById("cafeteriaButtons"),
  sizeButtons: document.getElementById("sizeButtons"),
  dataInfo: document.getElementById("dataInfo"),
  screenSelect: document.getElementById("screen-select"),
  screenGame: document.getElementById("screen-game"),
  screenResult: document.getElementById("screen-result"),
  roundLabel: document.getElementById("roundLabel"),
  matchLabel: document.getElementById("matchLabel"),
  cardLeft: document.getElementById("cardLeft"),
  cardRight: document.getElementById("cardRight"),
  backBtn: document.getElementById("backBtn"),
  winnerCard: document.getElementById("winnerCard"),
  winnerStatsBody: document.getElementById("winnerStatsBody"),
  winnerStatsTableBody: document.getElementById("winnerStatsTableBody"),
  resultFeedback: document.getElementById("resultFeedback"),
  restartBtn: document.getElementById("restartBtn"),
};

let selectedSize = null;

// 카카오톡 인앱 브라우저 등에서 100dvh가 실제로 보이는 영역과 어긋나는 경우가
// 있어서, window.innerHeight(그 브라우저가 실제로 그리는 높이)를 직접 재서
// --app-vh 커스텀 속성으로 넘겨준다. 세로 배치 대결 화면의 높이 계산에 쓰인다.
function setAppVh() {
  document.documentElement.style.setProperty("--app-vh", `${window.innerHeight}px`);
}
setAppVh();
window.addEventListener("resize", setAppVh);
window.addEventListener("orientationchange", setAppVh);
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", setAppVh);
}

// 현재는 캠퍼스별 1개 식당만 제공 (자연캠 행단골식당 / 인사캠 은행골식당)
const ACTIVE_CAFETERIAS = ["행단골식당 (자과캠 학생회관 1층)", "은행골식당 (인사캠 600주년기념관 지하1층)"];

const CAFETERIA_INFO = {
  "행단골식당 (자과캠 학생회관 1층)": { shortName: "행단골식당", image: "images/cafeterias/haengdangol.jpg" },
  "은행골식당 (인사캠 600주년기념관 지하1층)": { shortName: "은행골식당", image: "images/cafeterias/eunhaenggol.jpg" },
};

async function init() {
  const res = await fetch("data/menus.json", { cache: "no-store" });
  const all = (await res.json()).map((e, i) => ({ ...e, id: i }));
  state.data = all.filter(e => ACTIVE_CAFETERIAS.includes(e.cafeteria));
  buildCafeteriaButtons();
  updateSizeButtons();
  el.dataInfo.textContent = `총 ${state.data.length}개 메뉴 수집됨 (식당 ${new Set(state.data.map(d => d.cafeteria)).size}곳)`;

  preselectCafeteriaFromQuery();
}

// 오늘의 메뉴 화면의 "이 식당으로 월드컵 하기" 링크(?cafeteria=짧은이름)로 들어왔으면 바로 시작
function preselectCafeteriaFromQuery() {
  const shortName = new URLSearchParams(location.search).get("cafeteria");
  if (!shortName) return;
  const fullName = ACTIVE_CAFETERIAS.find(c => CAFETERIA_INFO[c]?.shortName === shortName);
  if (!fullName) return;
  const names = [...new Set(state.data.map(d => d.cafeteria))];
  const idx = names.indexOf(fullName);
  const btn = el.cafeteriaButtons.children[idx];
  if (btn) onCafeteriaClick(fullName, btn);
}

function buildCafeteriaButtons() {
  const names = [...new Set(state.data.map(d => d.cafeteria))];
  el.cafeteriaButtons.innerHTML = "";
  for (const name of names) {
    const info = CAFETERIA_INFO[name] || { shortName: name, image: "" };
    const location = name.match(/\(([^)]+)\)/)?.[1] || "";
    const btn = document.createElement("button");
    btn.className = "cafeteria-btn";
    btn.innerHTML = `
      <img src="${info.image}" alt="${info.shortName}">
      <span class="cafeteria-btn-label">
        <span class="cafeteria-btn-name">${info.shortName}</span>
        ${location ? `<span class="cafeteria-btn-location">${location}</span>` : ""}
      </span>
    `;
    btn.addEventListener("click", () => onCafeteriaClick(name, btn));
    el.cafeteriaButtons.appendChild(btn);
  }
}

function preloadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = resolve;
    img.onerror = resolve;
    img.src = src;
  });
}

function preloadCafeteriaImages(cafeteria) {
  const pool = state.data.filter(d => d.cafeteria === cafeteria);
  return Promise.all(pool.filter(e => e.image).map(e => preloadImage(e.image)));
}

async function onCafeteriaClick(name, btn) {
  const buttons = [...el.cafeteriaButtons.children];
  buttons.forEach(b => (b.disabled = true));
  const labelEl = btn.querySelector(".cafeteria-btn-name");
  const originalLabel = labelEl.textContent;
  labelEl.textContent = "불러오는 중...";

  await preloadCafeteriaImages(name);

  labelEl.textContent = originalLabel;
  buttons.forEach(b => (b.disabled = false));
  startGame(name);
}

function commonPoolSize() {
  const counts = ACTIVE_CAFETERIAS.map(c => state.data.filter(d => d.cafeteria === c).length);
  return Math.min(...counts);
}

function updateSizeButtons() {
  const available = commonPoolSize();
  const options = [4, 8, 16, 32, 64];
  el.sizeButtons.innerHTML = "";
  let pickedDefault = null;
  for (const n of options) {
    const btn = document.createElement("button");
    btn.className = "size-btn";
    btn.textContent = `${n}강`;
    btn.disabled = available < n;
    if (!btn.disabled) pickedDefault = n;
    btn.addEventListener("click", () => {
      selectedSize = n;
      [...el.sizeButtons.children].forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
    });
    el.sizeButtons.appendChild(btn);
  }
  // keep the user's previous choice if it's still valid for this cafeteria,
  // only fall back to the largest available size otherwise
  if (!selectedSize || selectedSize > available) {
    selectedSize = pickedDefault;
  }
  if (selectedSize) {
    [...el.sizeButtons.children].find(b => b.textContent === `${selectedSize}강`)?.classList.add("active");
  }
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function startGame(cafeteria) {
  const pool = state.data.filter(d => d.cafeteria === cafeteria);
  if (!selectedSize || pool.length < selectedSize) {
    alert("선택한 규모만큼 메뉴가 충분하지 않습니다.");
    return;
  }
  state.bracket = shuffle(pool).slice(0, selectedSize);
  state.round = 1;
  state.matchIndex = 0;
  state.nextRound = [];
  state.startedCafeteria = cafeteria;
  state.startedSize = selectedSize;

  recordBracketStart(state.bracket);
  recordWorldcupProgress("latest", "start", selectedSize);

  if (typeof gtag === "function") {
    gtag("event", "worldcup_start", {
      cafeteria,
      bracket_size: selectedSize,
      version: "latest",
    });
  }

  el.screenSelect.classList.add("hidden");
  el.screenResult.classList.add("hidden");
  el.screenGame.classList.remove("hidden");
  renderMatch();
}

function totalRounds() {
  return Math.log2(state.bracket.length);
}

function roundName(size) {
  if (size === 2) return "결승";
  if (size === 4) return "준결승";
  return `${size}강`;
}

function renderMatch() {
  const roundSize = state.bracket.length;
  el.roundLabel.textContent = roundName(roundSize);
  if (state.matchIndex === 0) {
    el.roundLabel.classList.remove("pulse");
    void el.roundLabel.offsetWidth; // restart the animation
    el.roundLabel.classList.add("pulse");
  }
  const totalMatches = roundSize / 2;
  el.matchLabel.textContent = `${state.matchIndex + 1} / ${totalMatches}`;

  const left = state.bracket[state.matchIndex * 2];
  const right = state.bracket[state.matchIndex * 2 + 1];
  fillCard(el.cardLeft, left);
  fillCard(el.cardRight, right);
  el.cardLeft.classList.remove("shake");
  el.cardRight.classList.remove("shake");

  el.cardLeft.onclick = () => selectCard(el.cardLeft, left, right);
  el.cardRight.onclick = () => selectCard(el.cardRight, right, left);
}

function selectCard(cardEl, winner, loser) {
  el.cardLeft.onclick = null;
  el.cardRight.onclick = null;
  cardEl.classList.add("shake");
  setTimeout(() => pick(winner, loser), 200);
}

function fillCard(cardEl, entry) {
  cardEl.innerHTML = `
    <div class="card-image">
      ${entry.image
        ? `<img src="${entry.image}" alt="${entry.main_item}">`
        : `<div class="image-placeholder">🍽️</div>`}
    </div>
    <div class="card-meta">
      ${entry.corner ? `<span class="corner-tag">${entry.corner}</span>` : ""}
      <span class="main-item">${entry.main_item}</span>
      ${entry.price ? `<span class="price">${entry.price}원</span>` : ""}
    </div>
  `;
}

function pick(winner, loser) {
  recordMatch(winner, loser);

  state.nextRound.push(winner);
  state.matchIndex++;

  if (state.matchIndex * 2 >= state.bracket.length) {
    if (state.nextRound.length === 1) {
      showResult(state.nextRound[0]);
      return;
    }
    state.bracket = state.nextRound;
    state.nextRound = [];
    state.matchIndex = 0;
    state.round++;
  }
  renderMatch();
}

function showResult(winner) {
  el.screenGame.classList.add("hidden");
  el.screenResult.classList.remove("hidden");
  el.resultFeedback.classList.remove("hidden");
  fillCard(el.winnerCard, winner);
  loadWinnerStats(winner);
  renderFeedbackWidget(el.resultFeedback, "result", () => winner.cafeteria);
  recordChampionship(winner);
  recordWorldcupProgress("latest", "complete", state.startedSize);

  if (typeof gtag === "function") {
    gtag("event", "worldcup_complete", {
      cafeteria: state.startedCafeteria,
      bracket_size: state.startedSize,
      winner: winner.main_item,
      version: "latest",
    });
  }
}

async function loadWinnerStats(winner) {
  el.winnerStatsTableBody.innerHTML = "";
  const winnerId = menuId(winner);

  try {
    const [statRows] = await Promise.all([fetchMenuStats()]);
    const statsById = new Map(statRows.map(s => [s.id, s]));

    const seen = new Set();
    const items = [];
    for (const m of state.data) {
      if (m.cafeteria !== winner.cafeteria) continue;
      const id = menuId(m);
      if (seen.has(id)) continue;
      seen.add(id);
      const s = statsById.get(id);
      const wins = s ? s.wins : 0;
      const losses = s ? s.losses : 0;
      const winRate = (wins + losses) > 0 ? wins / (wins + losses) : null;
      items.push({ id, name: m.main_item, winRate });
    }
    items.sort((a, b) => {
      if (a.winRate === null && b.winRate === null) return 0;
      if (a.winRate === null) return 1;
      if (b.winRate === null) return -1;
      return b.winRate - a.winRate;
    });

    el.winnerStatsTableBody.innerHTML = items.map(item => {
      const tier = item.winRate === null ? "-" : tierFor(item.winRate);
      const rateText = item.winRate === null ? "-" : `${(item.winRate * 100).toFixed(1)}%`;
      const isWinner = item.id === winnerId;
      return `
        <tr class="${isWinner ? "winner-row" : ""}">
          <td><span class="tier-badge tier-${tier}">${tier}</span></td>
          <td>${item.name}</td>
          <td>${rateText}</td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    el.winnerStatsBody.textContent = "통계를 불러오지 못했어요.";
  }
}

el.backBtn.addEventListener("click", () => {
  el.screenGame.classList.add("hidden");
  el.screenSelect.classList.remove("hidden");
});
el.restartBtn.addEventListener("click", () => {
  el.screenResult.classList.add("hidden");
  el.resultFeedback.classList.add("hidden");
  el.screenSelect.classList.remove("hidden");
});

init();
