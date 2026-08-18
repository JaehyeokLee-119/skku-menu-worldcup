const state = {
  data: [],
  pool: [],
  bracket: [],
  round: 0,
  matchIndex: 0,
  nextRound: [],
};

const el = {
  cafeteriaSelect: document.getElementById("cafeteriaSelect"),
  sizeButtons: document.getElementById("sizeButtons"),
  startBtn: document.getElementById("startBtn"),
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
  restartBtn: document.getElementById("restartBtn"),
};

let selectedSize = null;

// 현재는 캠퍼스별 1개 식당만 제공 (자연캠 행단골식당 / 인사캠 은행골식당)
const ACTIVE_CAFETERIAS = ["행단골식당 (자과캠 학생회관 1층)", "은행골식당 (인사캠 600주년기념관 지하1층)"];

async function init() {
  const res = await fetch("data/menus.json", { cache: "no-store" });
  const all = (await res.json()).map((e, i) => ({ ...e, id: i }));
  state.data = all.filter(e => ACTIVE_CAFETERIAS.includes(e.cafeteria));
  buildCafeteriaOptions();
  updateSizeButtons();
  el.dataInfo.textContent = `총 ${state.data.length}개 메뉴 수집됨 (식당 ${new Set(state.data.map(d => d.cafeteria)).size}곳)`;
}

function buildCafeteriaOptions() {
  const names = [...new Set(state.data.map(d => d.cafeteria))];
  el.cafeteriaSelect.innerHTML = "";
  for (const name of names) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    el.cafeteriaSelect.appendChild(opt);
  }
  el.cafeteriaSelect.addEventListener("change", updateSizeButtons);
}

function currentPoolSize() {
  const val = el.cafeteriaSelect.value;
  return state.data.filter(d => d.cafeteria === val).length;
}

function updateSizeButtons() {
  const available = currentPoolSize();
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
  selectedSize = pickedDefault;
  if (pickedDefault) {
    [...el.sizeButtons.children].find(b => b.textContent === `${pickedDefault}강`)?.classList.add("active");
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

function startGame() {
  const val = el.cafeteriaSelect.value;
  const pool = state.data.filter(d => d.cafeteria === val);
  if (!selectedSize || pool.length < selectedSize) {
    alert("선택한 규모만큼 메뉴가 충분하지 않습니다.");
    return;
  }
  state.bracket = shuffle(pool).slice(0, selectedSize);
  state.round = 1;
  state.matchIndex = 0;
  state.nextRound = [];
  state.startedCafeteria = val;
  state.startedSize = selectedSize;

  recordWorldcupProgress("v2", "start", selectedSize);

  if (typeof gtag === "function") {
    gtag("event", "worldcup_start", {
      cafeteria: val,
      bracket_size: selectedSize,
      version: "v2",
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
  const totalMatches = roundSize / 2;
  el.matchLabel.textContent = `${state.matchIndex + 1} / ${totalMatches}`;

  const left = state.bracket[state.matchIndex * 2];
  const right = state.bracket[state.matchIndex * 2 + 1];
  fillCard(el.cardLeft, left);
  fillCard(el.cardRight, right);

  el.cardLeft.onclick = () => pick(left, right);
  el.cardRight.onclick = () => pick(right, left);
}

function fillCard(cardEl, entry) {
  cardEl.innerHTML = `
    <div class="card-image">
      ${entry.image
        ? `<img src="${entry.image}" alt="${entry.main_item}">`
        : `<div class="image-placeholder">🍽️</div>`}
    </div>
    <div class="cafeteria-tag">${entry.cafeteria} · ${entry.meal_label}</div>
    ${entry.corner ? `<div class="corner-tag">${entry.corner}</div>` : ""}
    <div class="main-item">${entry.main_item}</div>
    ${entry.side_items.length ? `<div class="side-items">${entry.side_items.join(" · ")}</div>` : ""}
    <div class="price">${entry.price ? entry.price + "원" : ""}</div>
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
  fillCard(el.winnerCard, winner);

  recordWorldcupProgress("v2", "complete", state.startedSize);

  if (typeof gtag === "function") {
    gtag("event", "worldcup_complete", {
      cafeteria: state.startedCafeteria,
      bracket_size: state.startedSize,
      winner: winner.main_item,
      version: "v2",
    });
  }
}

el.startBtn.addEventListener("click", startGame);
el.backBtn.addEventListener("click", () => {
  el.screenGame.classList.add("hidden");
  el.screenSelect.classList.remove("hidden");
});
el.restartBtn.addEventListener("click", () => {
  el.screenResult.classList.add("hidden");
  el.screenSelect.classList.remove("hidden");
});

init();
