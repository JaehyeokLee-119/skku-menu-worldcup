// 현재는 캠퍼스별 1개 식당만 통계에 노출 (자연캠 행단골식당 / 인사캠 은행골식당)
const ACTIVE_CAFETERIAS = ["행단골식당", "은행골식당"];

const TIER_THRESHOLDS = [
  { tier: "S", min: 0.70 },
  { tier: "A", min: 0.60 },
  { tier: "B", min: 0.50 },
  { tier: "C", min: 0.40 },
  { tier: "D", min: 0.30 },
  { tier: "F", min: 0 },
];

function tierFor(winRate) {
  for (const t of TIER_THRESHOLDS) {
    if (winRate >= t.min) return t.tier;
  }
  return "F";
}

function withRate(rows) {
  return rows.map(r => {
    const total = r.wins + r.losses;
    const winRate = total > 0 ? r.wins / total : null;
    return { ...r, total, winRate };
  }).sort((a, b) => {
    if (a.winRate === null && b.winRate === null) return 0;
    if (a.winRate === null) return 1;
    if (b.winRate === null) return -1;
    return b.winRate - a.winRate;
  });
}

function tierRow(cells) {
  const tier = cells.winRate === null ? "-" : tierFor(cells.winRate);
  const rateText = cells.winRate === null ? "데이터 없음" : `${(cells.winRate * 100).toFixed(1)}%`;
  return `
    <tr>
      <td><span class="tier-badge tier-${tier}">${tier}</span></td>
      <td class="cafeteria-name">${cells.name}</td>
      <td>${cells.wins}</td>
      <td>${cells.losses}</td>
      <td>${rateText}</td>
    </tr>
  `;
}

async function renderCafeteriaStats() {
  const loadingEl = document.getElementById("statsLoading");
  const wrapEl = document.getElementById("statsTableWrap");
  const bodyEl = document.getElementById("statsBody");

  let rows;
  try {
    rows = await fetchCafeteriaStats();
  } catch (err) {
    loadingEl.textContent = "통계를 불러오지 못했어요. 잠시 후 다시 시도해주세요.";
    return;
  }

  const filtered = rows.filter(r => ACTIVE_CAFETERIAS.includes(r.cafeteria));

  bodyEl.innerHTML = withRate(filtered)
    .map(r => tierRow({ name: r.cafeteria, wins: r.wins, losses: r.losses, winRate: r.winRate }))
    .join("");

  loadingEl.classList.add("hidden");
  wrapEl.classList.remove("hidden");
}

async function renderMenuStats() {
  const loadingEl = document.getElementById("menuStatsLoading");
  const wrapEl = document.getElementById("menuStatsTableWrap");
  const bodyEl = document.getElementById("menuStatsBody");
  const selectEl = document.getElementById("menuCafeteriaSelect");

  let menus, statRows;
  try {
    const [menusRes, stats] = await Promise.all([
      fetch("data/menus.json").then(r => r.json()),
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

  function renderFor(cafeteria) {
    const seen = new Set();
    const items = [];
    for (const m of menus) {
      if (m.cafeteria !== cafeteria) continue;
      const id = menuId(m);
      if (seen.has(id)) continue;
      seen.add(id);
      const s = statsById.get(id);
      items.push({
        name: m.main_item,
        wins: s ? s.wins : 0,
        losses: s ? s.losses : 0,
        winRate: s && (s.wins + s.losses) > 0 ? s.wins / (s.wins + s.losses) : null,
      });
    }
    items.sort((a, b) => {
      if (a.winRate === null && b.winRate === null) return 0;
      if (a.winRate === null) return 1;
      if (b.winRate === null) return -1;
      return b.winRate - a.winRate;
    });
    bodyEl.innerHTML = items.map(tierRow).join("");
  }

  selectEl.addEventListener("change", () => renderFor(selectEl.value));
  renderFor(cafeterias[0]);

  loadingEl.classList.add("hidden");
  wrapEl.classList.remove("hidden");
}

renderCafeteriaStats();
renderMenuStats();
