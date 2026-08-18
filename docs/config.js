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
