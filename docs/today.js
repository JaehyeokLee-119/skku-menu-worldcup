// 현재는 캠퍼스별 1개 식당만 노출 (자연캠 행단골식당 / 인사캠 은행골식당)
const ACTIVE_CAFETERIAS = ["행단골식당 (자과캠 학생회관 1층)", "은행골식당 (인사캠 600주년기념관 지하1층)"];

const CAFETERIA_INFO = {
  "행단골식당 (자과캠 학생회관 1층)": { shortName: "행단골식당", image: "images/cafeterias/haengdangol.jpg" },
  "은행골식당 (인사캠 600주년기념관 지하1층)": { shortName: "은행골식당", image: "images/cafeterias/eunhaenggol.jpg" },
};

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

// 승률 기준으로 그 식당 메뉴 전체를 줄세워서, 메뉴 이름 -> {순위, 전체, 티어} 매핑을 만든다
function buildTierLookup(menus, cafeteria, statsById) {
  const seen = new Set();
  const items = [];
  for (const m of menus) {
    if (m.cafeteria !== cafeteria) continue;
    const id = menuId(m);
    if (seen.has(id)) continue;
    seen.add(id);
    const s = statsById.get(id);
    const wins = s ? s.wins : 0;
    const losses = s ? s.losses : 0;
    const total = wins + losses;
    const rate = total > 0 ? wins / total : null;
    items.push({ mainItem: m.main_item, rate });
  }
  items.sort((a, b) => {
    if (a.rate === null && b.rate === null) return 0;
    if (a.rate === null) return 1;
    if (b.rate === null) return -1;
    return b.rate - a.rate;
  });

  const lookup = new Map();
  items.forEach((it, i) => {
    if (!lookup.has(it.mainItem)) {
      lookup.set(it.mainItem, {
        rank: i + 1,
        total: items.length,
        tier: it.rate === null ? "-" : tierFor(it.rate),
      });
    }
  });
  return lookup;
}

function rankBadgeHtml(info) {
  if (!info) {
    return `<span class="today-menu-rank today-menu-rank-empty">티어표 데이터 없음</span>`;
  }
  return `
    <span class="today-menu-rank">
      <span class="tier-badge tier-${info.tier}">${info.tier}</span>
      <span>${info.rank}위 / ${info.total}개 중</span>
    </span>
  `;
}

function menuItemHtml(entry, tierLookup) {
  const sides = entry.side_items && entry.side_items.length
    ? `<div class="today-menu-sides">${entry.side_items.join(", ")}</div>`
    : "";
  return `
    <div class="today-menu-item">
      <div class="today-menu-meta">
        ${entry.meal_label ? `<span class="today-menu-meal">${entry.meal_label}</span>` : ""}
        ${entry.corner ? `<span class="cafeteria-tag">${entry.corner}</span>` : ""}
      </div>
      <div class="today-menu-main">${entry.main_item}</div>
      ${sides}
      ${entry.price ? `<div class="price">${entry.price}원</div>` : ""}
      ${rankBadgeHtml(tierLookup.get(entry.main_item))}
    </div>
  `;
}

function cafeteriaSectionHtml(cafeteria, dayEntries, tierLookup) {
  const info = CAFETERIA_INFO[cafeteria];
  const entriesHtml = dayEntries.length
    ? dayEntries.map(e => menuItemHtml(e, tierLookup)).join("")
    : `<p class="data-info today-menu-empty">오늘 등록된 메뉴 정보가 아직 없어요.</p>`;

  return `
    <section class="today-cafeteria">
      <div class="today-cafeteria-head">
        <img class="today-cafeteria-img" src="${info.image}" alt="${info.shortName}">
        <div class="today-cafeteria-name">${info.shortName}</div>
      </div>
      <div class="today-menu-list">${entriesHtml}</div>
      <a class="text-btn" href="worldcup.html?cafeteria=${encodeURIComponent(info.shortName)}">이 식당으로 월드컵 하기 →</a>
    </section>
  `;
}

async function renderToday() {
  const containerEl = document.getElementById("todayContent");
  const dateLabelEl = document.getElementById("todayDateLabel");

  const now = new Date();
  const weekday = WEEKDAY_LABELS[now.getDay()];
  dateLabelEl.textContent = `${now.getMonth() + 1}월 ${now.getDate()}일 (${weekday})`;

  if (weekday === "토" || weekday === "일") {
    containerEl.innerHTML = `<p class="data-info">주말에는 등록된 메뉴 정보가 없어요. <a href="worldcup.html">월드컵 하러 가기 →</a></p>`;
    return;
  }

  let weekly, menus, statRows;
  try {
    [weekly, menus, statRows] = await Promise.all([
      fetch("data/weekly-menu.json", { cache: "no-store" }).then(r => r.json()),
      fetch("data/menus.json", { cache: "no-store" }).then(r => r.json()),
      fetchMenuStats(),
    ]);
  } catch (err) {
    containerEl.innerHTML = `<p class="data-info">메뉴 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.</p>`;
    return;
  }

  const statsById = new Map(statRows.map(s => [s.id, s]));
  const dayData = (weekly.days && weekly.days[weekday]) || {};

  containerEl.innerHTML = ACTIVE_CAFETERIAS.map(cafeteria => {
    const shortName = CAFETERIA_INFO[cafeteria].shortName;
    const dayEntries = dayData[shortName] || [];
    const tierLookup = buildTierLookup(menus, cafeteria, statsById);
    return cafeteriaSectionHtml(cafeteria, dayEntries, tierLookup);
  }).join("");
}

renderToday();
