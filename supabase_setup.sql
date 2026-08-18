-- 식당별 승/패 집계 테이블
create table cafeteria_stats (
  cafeteria text primary key,
  wins integer not null default 0,
  losses integer not null default 0
);

insert into cafeteria_stats (cafeteria, wins, losses) values
  ('패컬티식당', 0, 0),
  ('은행골식당', 0, 0),
  ('법고을식당', 0, 0),
  ('금잔디식당', 0, 0),
  ('행단골식당', 0, 0),
  ('구시재식당', 0, 0),
  ('해오름식당', 0, 0),
  ('THE S LOUNGE', 0, 0);

-- 동시 요청에도 안전하게 +1 하는 함수
create or replace function record_match(winner text, loser text)
returns void as $$
begin
  update cafeteria_stats set wins = wins + 1 where cafeteria = winner;
  update cafeteria_stats set losses = losses + 1 where cafeteria = loser;
end;
$$ language plpgsql security definer;

-- RLS 활성화: 익명 사용자는 읽기 + record_match 호출만 가능 (직접 UPDATE/DELETE 불가)
alter table cafeteria_stats enable row level security;

create policy "public can read stats"
  on cafeteria_stats for select
  to anon
  using (true);

grant execute on function record_match(text, text) to anon;

-- 개별 메뉴 승/패 집계 테이블 (식당별 메뉴 티어표용)
create table menu_stats (
  id text primary key,
  cafeteria text not null,
  main_item text not null,
  wins integer not null default 0,
  losses integer not null default 0
);

alter table menu_stats enable row level security;

create policy "public can read menu stats"
  on menu_stats for select
  to anon
  using (true);

-- 처음 나온 메뉴는 upsert로 자동 생성, 이후엔 +1
create or replace function record_menu_match(
  winner_id text, winner_cafeteria text, winner_main text,
  loser_id text, loser_cafeteria text, loser_main text
)
returns void as $$
begin
  insert into menu_stats (id, cafeteria, main_item, wins, losses)
  values (winner_id, winner_cafeteria, winner_main, 1, 0)
  on conflict (id) do update set wins = menu_stats.wins + 1;

  insert into menu_stats (id, cafeteria, main_item, wins, losses)
  values (loser_id, loser_cafeteria, loser_main, 0, 1)
  on conflict (id) do update set losses = menu_stats.losses + 1;
end;
$$ language plpgsql security definer;

grant execute on function record_menu_match(text, text, text, text, text, text) to anon;

-- 랭킹(티어표) 신뢰도 피드백. client_id는 브라우저 localStorage에 저장된
-- 익명 식별자로, 동일인의 반복 클릭을 구분하기 위한 용도 (개인정보 아님).
create table ranking_feedback (
  id bigint generated always as identity primary key,
  client_id text not null,
  page text not null,
  cafeteria text,
  answer text not null check (answer in ('yes', 'no')),
  created_at timestamptz not null default now()
);

alter table ranking_feedback enable row level security;

-- anon은 쓰기만 가능, 읽기는 불가 (관리자는 Supabase 대시보드에서 조회)
create policy "anon can insert feedback"
  on ranking_feedback for insert
  to anon
  with check (true);

-- 개별 매치 승패와 별개로, "최종 우승(챔피언)" 비율을 추적하기 위한 컬럼.
-- appearances: 이 메뉴가 포함된 대진이 시작된 횟수
-- championships: 그 대진에서 최종 우승한 횟수
-- 우승률 = championships / appearances
alter table menu_stats add column if not exists appearances integer not null default 0;
alter table menu_stats add column if not exists championships integer not null default 0;

-- 대진 시작 시 그 대진에 포함된 모든 메뉴의 appearances를 +1
create or replace function record_bracket_start(menu_ids text[], menu_cafeterias text[], menu_names text[])
returns void as $$
declare
  i int;
begin
  for i in 1..array_length(menu_ids, 1) loop
    insert into menu_stats (id, cafeteria, main_item, appearances)
    values (menu_ids[i], menu_cafeterias[i], menu_names[i], 1)
    on conflict (id) do update set appearances = menu_stats.appearances + 1;
  end loop;
end;
$$ language plpgsql security definer;

-- 대진 완주 시 최종 우승 메뉴의 championships를 +1
create or replace function record_championship(winner_id text, winner_cafeteria text, winner_main text)
returns void as $$
begin
  insert into menu_stats (id, cafeteria, main_item, championships)
  values (winner_id, winner_cafeteria, winner_main, 1)
  on conflict (id) do update set championships = menu_stats.championships + 1;
end;
$$ language plpgsql security definer;

grant execute on function record_bracket_start(text[], text[], text[]) to anon;
grant execute on function record_championship(text, text, text) to anon;
