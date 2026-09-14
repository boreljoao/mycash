-- Meu Caixa: tabela única que guarda o estado do app por código de sincronização.
-- Cole este script no SQL Editor do Supabase e clique em Run.

create table if not exists public.mycash_state (
  key text primary key,
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.mycash_state enable row level security;

-- O app acessa a tabela com a chave "anon". A linha só é encontrada por quem
-- conhece o código de sincronização (armazenado como hash SHA-256 na coluna key).
drop policy if exists "mycash anon read" on public.mycash_state;
drop policy if exists "mycash anon insert" on public.mycash_state;
drop policy if exists "mycash anon update" on public.mycash_state;

create policy "mycash anon read"   on public.mycash_state for select to anon using (true);
create policy "mycash anon insert" on public.mycash_state for insert to anon with check (true);
create policy "mycash anon update" on public.mycash_state for update to anon using (true) with check (true);
