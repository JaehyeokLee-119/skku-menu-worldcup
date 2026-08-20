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

-- 배포 버전(latest/v2/v1)별로 "시작" 대비 "끝까지 완주" 비율을 비교하기 위한 이벤트 로그.
-- 한 번의 월드컵 플레이마다 시작 시 1행(event_type='start'), 완주 시 1행(event_type='complete')이 쌓인다.
create table worldcup_progress (
  id bigint generated always as identity primary key,
  version text not null,
  event_type text not null check (event_type in ('start', 'complete')),
  bracket_size integer not null,
  created_at timestamptz not null default now()
);

alter table worldcup_progress enable row level security;

-- anon은 쓰기만 가능 (개별 행 조회는 불가, 집계는 아래 RPC로만 가능)
create policy "anon can insert progress"
  on worldcup_progress for insert
  to anon
  with check (true);

create or replace function record_worldcup_progress(p_version text, p_event_type text, p_bracket_size integer)
returns void as $$
begin
  insert into worldcup_progress (version, event_type, bracket_size)
  values (p_version, p_event_type, p_bracket_size);
end;
$$ language plpgsql security definer;

grant execute on function record_worldcup_progress(text, text, integer) to anon;

-- version별/규모별 시작·완주 건수 집계. 완주율 = complete_count / start_count.
create or replace function get_worldcup_completion_stats()
returns table (version text, bracket_size integer, start_count bigint, complete_count bigint) as $$
  select
    coalesce(s.version, c.version) as version,
    coalesce(s.bracket_size, c.bracket_size) as bracket_size,
    coalesce(s.cnt, 0) as start_count,
    coalesce(c.cnt, 0) as complete_count
  from
    (select version, bracket_size, count(*) as cnt from worldcup_progress where event_type = 'start' group by version, bracket_size) s
    full outer join
    (select version, bracket_size, count(*) as cnt from worldcup_progress where event_type = 'complete' group by version, bracket_size) c
    on s.version = c.version and s.bracket_size = c.bracket_size
  order by version, bracket_size;
$$ language sql security definer;

grant execute on function get_worldcup_completion_stats() to anon;

-- 티어표 신뢰도 피드백("이 티어표가 좀 맞는 것 같나요?") 집계.
-- ranking_feedback은 anon이 쓰기만 가능해서(원본 응답 보호), 페이지/식당/답변별 건수만 집계해서 보여준다.
create or replace function get_ranking_feedback_stats()
returns table (page text, cafeteria text, answer text, cnt bigint) as $$
  select page, cafeteria, answer, count(*) as cnt
  from ranking_feedback
  group by page, cafeteria, answer
  order by page, cafeteria, answer;
$$ language sql security definer;

grant execute on function get_ranking_feedback_stats() to anon;

-- worldcup_progress에 client_id(ranking_feedback과 같은 브라우저 localStorage
-- 익명 식별자)를 추가. 이제부터 쌓이는 데이터는 어떤 익명 클라이언트가
-- 유독 여러 번 플레이했는지(개발자 테스트/헤비유저 등 이상치) 구분할 수 있다.
-- 이 컬럼 추가 이전 기존 행은 client_id가 비어있다(소급 적용 불가).
alter table worldcup_progress add column if not exists client_id text;

-- 예전 3-인자 버전은 삭제하고 client_id 인자가 추가된 버전으로 교체
drop function if exists record_worldcup_progress(text, text, integer);

create or replace function record_worldcup_progress(p_version text, p_event_type text, p_bracket_size integer, p_client_id text default null)
returns void as $$
begin
  insert into worldcup_progress (version, event_type, bracket_size, client_id)
  values (p_version, p_event_type, p_bracket_size, p_client_id);
end;
$$ language plpgsql security definer;

grant execute on function record_worldcup_progress(text, text, integer, text) to anon;

-- client_id별 시작/완주 건수. 유독 많이 찍힌 client_id를 찾아서 그 사람의
-- 기여분을 빼고 완주율을 다시 계산하는 데 쓴다.
create or replace function get_worldcup_progress_by_client()
returns table (client_id text, version text, start_count bigint, complete_count bigint) as $$
  select
    coalesce(s.client_id, c.client_id) as client_id,
    coalesce(s.version, c.version) as version,
    coalesce(s.cnt, 0) as start_count,
    coalesce(c.cnt, 0) as complete_count
  from
    (select client_id, version, count(*) as cnt from worldcup_progress where event_type = 'start' group by client_id, version) s
    full outer join
    (select client_id, version, count(*) as cnt from worldcup_progress where event_type = 'complete' group by client_id, version) c
    on s.client_id = c.client_id and s.version = c.version
  order by start_count desc;
$$ language sql security definer;

grant execute on function get_worldcup_progress_by_client() to anon;
