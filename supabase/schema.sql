-- Lloyd step 2: question/answer log with full-text search and 12-month purge.
-- Run once in Supabase: Dashboard -> SQL Editor -> paste -> Run.

create table if not exists public.exchanges (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  question    text not null,
  answer      text not null,
  fts         tsvector generated always as (
                to_tsvector('english', coalesce(question, '') || ' ' || coalesce(answer, ''))
              ) stored
);

create index if not exists exchanges_fts_idx     on public.exchanges using gin (fts);
create index if not exists exchanges_created_idx on public.exchanges (created_at desc);

-- Lock the table. RLS on with no policies means only the server's service-role key can touch it.
alter table public.exchanges enable row level security;

-- Search used by the search_history tool.
create or replace function public.search_exchanges(
  q            text,
  since        timestamptz default null,
  until        timestamptz default null,
  max_results  int default 8
)
returns table (id bigint, created_at timestamptz, question text, answer text, rank real)
language sql
stable
security invoker
as $$
  select e.id, e.created_at, e.question, e.answer,
         ts_rank(e.fts, websearch_to_tsquery('english', q)) as rank
  from public.exchanges e
  where e.fts @@ websearch_to_tsquery('english', q)
    and (since is null or e.created_at >= since)
    and (until is null or e.created_at <  until)
  order by rank desc, e.created_at desc
  limit least(greatest(max_results, 1), 20);
$$;

-- Supabase exposes functions to the public API keys by default. Close that.
revoke execute on function public.search_exchanges(text, timestamptz, timestamptz, int) from public, anon, authenticated;

-- Daily purge of anything older than 12 months (07:15 UTC, roughly 3am Eastern).
create extension if not exists pg_cron;
select cron.unschedule('lloyd-purge-12mo')
  where exists (select 1 from cron.job where jobname = 'lloyd-purge-12mo');
select cron.schedule(
  'lloyd-purge-12mo',
  '15 7 * * *',
  $$ delete from public.exchanges where created_at < now() - interval '12 months' $$
);
