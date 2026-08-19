// 현재는 캠퍼스별 1개 식당만 통계에 노출 (자연캠 행단골식당 / 인사캠 은행골식당)
const ACTIVE_CAFETERIAS = ["행단골식당 (자과캠 학생회관 1층)", "은행골식당 (인사캠 600주년기념관 지하1층)"];

const CRITERIA_LABELS = {
  winrate: ["승", "패", "승률"],
  championship: ["우승", "출전", "우승률"],
};

function collectMenuItems(menus, cafeteria) {
  const seen = new Set();
  const items = [];
  for (const m of menus) {
    if (m.cafeteria !== cafeteria) continue;
    const id = menuId(m);
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({ id, name: m.main_item });
  }
  return items;
}

// 승률 기준: 개별 매치 승/패로 계산한 승률로 정렬, 기존 S~F 임계값으로 티어 매김
function buildWinRateItems(menus, cafeteria, statsById) {
  const items = collectMenuItems(menus, cafeteria).map(({ name, id }) => {
    const s = statsById.get(id);
    const wins = s ? s.wins : 0;
    const losses = s ? s.losses : 0;
    const total = wins + losses;
    const rate = total > 0 ? wins / total : null;
    return { name, a: wins, b: losses, rate };
  });

  items.sort((x, y) => {
    if (x.rate === null && y.rate === null) return 0;
    if (x.rate === null) return 1;
    if (y.rate === null) return -1;
    return y.rate - x.rate;
  });

  items.forEach(it => { it.tier = it.rate === null ? "-" : tierFor(it.rate); });
  return items;
}

// 우승횟수 기준: 대진을 끝까지 완주해 최종 우승한 횟수(championships)로 정렬.
// 우승 경험이 있는 메뉴만 상위 3개씩 끊어 A/B/C/D/F 티어를 매기고, 우승 0회는 "-"로 표시.
function buildChampionshipItems(menus, cafeteria, statsById) {
  const items = collectMenuItems(menus, cafeteria).map(({ name, id }) => {
    const s = statsById.get(id);
    const championships = s ? (s.championships || 0) : 0;
    const appearances = s ? (s.appearances || 0) : 0;
    const rate = appearances > 0 ? championships / appearances : null;
    return { name, a: championships, b: appearances, rate, championships };
  });

  items.sort((x, y) => {
    if (x.championships !== y.championships) return y.championships - x.championships;
    if (x.rate === null && y.rate === null) return 0;
    if (x.rate === null) return 1;
    if (y.rate === null) return -1;
    return y.rate - x.rate;
  });

  const RANK_TIERS = ["A", "B", "C", "D"];
  const CHUNK_SIZE = 3;
  let rank = 0;
  items.forEach(it => {
    if (it.championships > 0) {
      const tierIndex = Math.floor(rank / CHUNK_SIZE);
      it.tier = tierIndex < RANK_TIERS.length ? RANK_TIERS[tierIndex] : "F";
      rank++;
    } else {
      it.tier = "-";
    }
  });
  return items;
}

function rowHtml(item) {
  const rateText = item.rate === null ? "데이터 없음" : `${(item.rate * 100).toFixed(1)}%`;
  return `
    <tr>
      <td><span class="tier-badge tier-${item.tier}">${item.tier}</span></td>
      <td class="cafeteria-name">${item.name}</td>
      <td>${item.a}</td>
      <td>${item.b}</td>
      <td>${rateText}</td>
    </tr>
  `;
}

async function renderMenuStats() {
  const loadingEl = document.getElementById("menuStatsLoading");
  const wrapEl = document.getElementById("menuStatsTableWrap");
  const bodyEl = document.getElementById("menuStatsBody");
  const selectEl = document.getElementById("menuCafeteriaSelect");
  const toggleEl = document.getElementById("statsCriteriaToggle");
  const colHeaderEls = ["statColA", "statColB", "statColC"].map(id => document.getElementById(id));

  renderFeedbackWidget(document.getElementById("statsFeedback"), "stats", () => selectEl.value);

  let menus, statRows;
  try {
    const [menusRes, stats] = await Promise.all([
      fetch("data/menus.json", { cache: "no-store" }).then(r => r.json()),
      fetchMenuStats(),
    ]);
    menus = menusRes;
    statRows = stats;
  } catch (err) {
    loadingEl.textContent = "메뉴 통계를 불러오지 못했어요. 잠시 후 다시 시도해주세요.";
    return;
  }

  const statsById = new Map(statRows.map(s => [s.id, s]));
  const cafeterias = ACTIVE_CAFETERIAS.filter(c => menus.some(m => m.cafeteria === c));

  selectEl.innerHTML = cafeterias.map(c => `<option value="${c}">${c}</option>`).join("");

  let currentCriteria = "winrate";

  function render() {
    const cafeteria = selectEl.value;
    const items = currentCriteria === "winrate"
      ? buildWinRateItems(menus, cafeteria, statsById)
      : buildChampionshipItems(menus, cafeteria, statsById);
    CRITERIA_LABELS[currentCriteria].forEach((label, i) => { colHeaderEls[i].textContent = label; });
    bodyEl.innerHTML = items.map(rowHtml).join("");
  }

  selectEl.addEventListener("change", render);
  toggleEl.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-criteria]");
    if (!btn || btn.classList.contains("active")) return;
    toggleEl.querySelectorAll("button").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentCriteria = btn.dataset.criteria;
    render();
  });

  render();

  loadingEl.classList.add("hidden");
  wrapEl.classList.remove("hidden");
}

renderMenuStats();
