const SUPABASE_URL = "https://nvzjplsawkwrtmegcpel.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_hdH2l6B5QatY5wnxnaTlLw_CZU-ahVV";

function menuId(entry) {
  return `${entry.cafeteria}::${entry.main_item}::${entry.side_items.join("|")}`;
}

async function recordMatch(winner, loser) {
  if (winner.cafeteria !== loser.cafeteria) {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_match`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ winner: winner.cafeteria, loser: loser.cafeteria }),
      });
    } catch (err) {
      console.warn("cafeteria match record failed", err);
    }
  }

  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_menu_match`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        winner_id: menuId(winner),
        winner_cafeteria: winner.cafeteria,
        winner_main: winner.main_item,
        loser_id: menuId(loser),
        loser_cafeteria: loser.cafeteria,
        loser_main: loser.main_item,
      }),
    });
  } catch (err) {
    console.warn("menu match record failed", err);
  }
}

async function fetchCafeteriaStats() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/cafeteria_stats?select=*`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`cafeteria stats fetch failed: ${res.status}`);
  return res.json();
}

async function fetchMenuStats() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/menu_stats?select=*`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`menu stats fetch failed: ${res.status}`);
  return res.json();
}

async function fetchMenuStatById(id) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/menu_stats?id=eq.${encodeURIComponent(id)}&select=*`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) throw new Error(`menu stat fetch failed: ${res.status}`);
  const rows = await res.json();
  return rows[0] || null;
}

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

// 브라우저에 저장되는 익명 식별자 - 동일인의 반복 응답을 구분하기 위한
// 용도일 뿐, 개인정보는 아님 (로그인/이메일/기기정보 등을 담지 않음)
function getClientId() {
  const KEY = "skku_menu_client_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(KEY, id);
  }
  return id;
}

async function submitRankingFeedback(page, cafeteria, answer) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/ranking_feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        client_id: getClientId(),
        page,
        cafeteria: cafeteria || null,
        answer,
      }),
    });
  } catch (err) {
    console.warn("feedback submit failed", err);
  }
}

// container: 위젯을 그려넣을 빈 엘리먼트
// page: 'result' | 'stats' (어느 화면에서 응답했는지)
// getCafeteria: 클릭 시점에 호출해서 현재 보고 있는 식당 이름을 반환하는 함수
function renderFeedbackWidget(container, page, getCafeteria) {
  container.innerHTML = `
    <div class="feedback-widget">
      <span class="feedback-question">이 랭킹이 좀 맞는 것 같나요?</span>
      <div class="feedback-buttons">
        <button class="feedback-btn" data-answer="yes">네</button>
        <button class="feedback-btn" data-answer="no">아뇨</button>
      </div>
    </div>
  `;
  const widget = container.querySelector(".feedback-widget");
  widget.querySelectorAll(".feedback-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const answer = btn.dataset.answer;
      const cafeteria = typeof getCafeteria === "function" ? getCafeteria() : getCafeteria;
      widget.innerHTML = `<span class="feedback-thanks">감사합니다!</span>`;
      submitRankingFeedback(page, cafeteria, answer);
    });
  });
}
