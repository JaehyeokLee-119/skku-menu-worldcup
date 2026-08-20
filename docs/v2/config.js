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

// 브라우저에 저장되는 익명 식별자 - 개발자 테스트/헤비유저처럼 동일 클라이언트가
// 유독 많이 남긴 기록을 구분해서 완주율에서 빼볼 수 있게 하기 위한 용도.
function getClientId() {
  const KEY = "skku_menu_client_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    localStorage.setItem(KEY, id);
  }
  return id;
}

async function recordWorldcupProgress(version, eventType, bracketSize) {
  try {
    await fetch(`${SUPABASE_URL}/rest/v1/rpc/record_worldcup_progress`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        p_version: version,
        p_event_type: eventType,
        p_bracket_size: bracketSize,
        p_client_id: getClientId(),
      }),
    });
  } catch (err) {
    console.warn("worldcup progress record failed", err);
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
