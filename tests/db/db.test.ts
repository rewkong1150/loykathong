import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

const stub = readFileSync(resolve(__dirname, 'auth-stub.sql'), 'utf8');
const schema = readFileSync(resolve(__dirname, '../../supabase/schema.sql'), 'utf8');

type U = { id: string; email: string; name: string };
const ADMIN: U = { id: '00000000-0000-0000-0000-00000000000a', email: 'Patomporn.K@VillaCarteGroup.com', name: 'Patomporn' };
const ALICE: U = { id: '00000000-0000-0000-0000-000000000001', email: 'alice@villacartegroup.com', name: 'Alice' };
const BOB: U = { id: '00000000-0000-0000-0000-000000000002', email: 'bob@villacartegroup.com', name: 'Bob' };
const CAROL: U = { id: '00000000-0000-0000-0000-000000000003', email: 'carol@villacartegroup.com', name: 'Carol' };
const OUTSIDER: U = { id: '00000000-0000-0000-0000-000000000009', email: 'x@gmail.com', name: 'X' };

let db: PGlite;

async function su() {
  await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`);
}
async function as(u: U) {
  await su();
  const claims = JSON.stringify({ sub: u.id, email: u.email }).replace(/'/g, "''");
  await db.exec(`select set_config('request.jwt.claims', '${claims}', false); set role authenticated;`);
}
async function flag(name: string, v: boolean) {
  await su();
  await db.exec(`update public.settings set ${name} = ${v} where id = 1`);
}
const q = (sql: string, params: unknown[] = []) => db.query<any>(sql, params);

async function costumeEntry(u: U) {
  await flag('costume_registration_open', true);
  await as(u);
  const r = await q('select public.save_costume_entry($1, $2, $3) as id', ['Look', `${u.id}/c.jpg`, u.name]);
  return r.rows[0].id as string;
}
function members(...us: U[]) {
  return JSON.stringify(us.map((u) => ({ name: u.name, email: u.email })));
}
async function team(owner: U, ...rest: U[]) {
  await flag('krathong_registration_open', true);
  await as(owner);
  const r = await q('select public.save_krathong_team(null, $1, $2::jsonb, $3, $4) as id', [
    `Team ${owner.name}`, members(owner, ...rest), `${owner.id}/k.jpg`, `${owner.id}/t.jpg`,
  ]);
  return r.rows[0].id as string;
}

beforeEach(async () => {
  db = new PGlite();
  await db.exec(stub);
  await db.exec(schema);
});

describe('access', () => {
  it('rejects non-company signup', async () => {
    await expect(q(`insert into auth.users(email) values ('x@gmail.com')`)).rejects.toThrow('NOT_COMPANY');
    await q(`insert into auth.users(email) values ('Someone@VillaCarteGroup.com')`);
  });

  it('non-company jwt cannot read settings', async () => {
    await as(OUTSIDER);
    expect((await q('select * from public.settings')).rows).toHaveLength(0);
    await as(ALICE);
    expect((await q('select * from public.settings')).rows).toHaveLength(1);
  });

  it('non-company jwt cannot call rpcs', async () => {
    await flag('costume_registration_open', true);
    await as(OUTSIDER);
    await expect(q("select public.save_costume_entry('a', $1, 'X')", [`${OUTSIDER.id}/a.jpg`])).rejects.toThrow('NOT_COMPANY');
  });

  it('no direct table reads or writes', async () => {
    await costumeEntry(ALICE);
    await as(BOB);
    await expect(q('select * from public.votes')).rejects.toThrow(/permission denied/);
    await expect(q('select admin_adjustment from public.costume_entries')).rejects.toThrow(/permission denied/);
    await expect(q('select * from public.krathong_team_members')).rejects.toThrow(/permission denied/);
    await expect(q('update public.settings set costume_voting_open = true')).rejects.toThrow(/permission denied/);
  });
});

describe('switches', () => {
  it('register blocked when closed', async () => {
    await as(ALICE);
    await expect(q("select public.save_costume_entry('a', $1, 'Alice')", [`${ALICE.id}/a.jpg`])).rejects.toThrow('REGISTRATION_CLOSED');
  });

  it('cannot use an image outside own folder', async () => {
    await flag('costume_registration_open', true);
    await as(ALICE);
    await expect(q("select public.save_costume_entry('a', $1, 'Alice')", [`${BOB.id}/a.jpg`])).rejects.toThrow('BAD_IMAGE');
  });

  it('vote blocked when closed, works when open', async () => {
    const id = await costumeEntry(ALICE);
    await as(BOB);
    await expect(q("select public.cast_vote('costume', $1)", [id])).rejects.toThrow('VOTING_CLOSED');
    await flag('costume_voting_open', true);
    await as(BOB);
    await q("select public.cast_vote('costume', $1)", [id]);
  });

  it('non-admin cannot set flag; admin can (mixed-case email)', async () => {
    await as(ALICE);
    await expect(q("select public.admin_set_flag('costume_voting_open', true)")).rejects.toThrow('NOT_ADMIN');
    await as(ADMIN);
    await q("select public.admin_set_flag('costume_voting_open', true)");
    expect((await q('select costume_voting_open from public.settings')).rows[0].costume_voting_open).toBe(true);
  });

  it('admin_set_flag rejects unknown flag', async () => {
    await as(ADMIN);
    await expect(q("select public.admin_set_flag('data_version', true)")).rejects.toThrow('BAD_FLAG');
  });
});

describe('voting rules', () => {
  it('one vote per contest', async () => {
    const a = await costumeEntry(ALICE);
    const b = await costumeEntry(BOB);
    const t = await team(ALICE);
    await flag('costume_voting_open', true);
    await flag('krathong_voting_open', true);
    await as(CAROL);
    await q("select public.cast_vote('costume', $1)", [a]);
    await expect(q("select public.cast_vote('costume', $1)", [b])).rejects.toThrow('ALREADY_VOTED');
    await q("select public.cast_vote('krathong', $1)", [t]);
    const mine = await q('select * from public.get_my_votes() order by contest');
    expect(mine.rows).toEqual([{ contest: 'costume', entry_id: a }, { contest: 'krathong', entry_id: t }]);
  });

  it('cannot vote own costume entry', async () => {
    const a = await costumeEntry(ALICE);
    await flag('costume_voting_open', true);
    await as(ALICE);
    await expect(q("select public.cast_vote('costume', $1)", [a])).rejects.toThrow('OWN_ENTRY');
  });

  it('cannot vote own team (member email, mixed case)', async () => {
    const t = await team(ALICE, BOB);
    await flag('krathong_voting_open', true);
    await as({ ...BOB, email: 'BOB@VillaCarteGroup.com' });
    await expect(q("select public.cast_vote('krathong', $1)", [t])).rejects.toThrow('OWN_ENTRY');
  });

  it('vote for missing entry', async () => {
    await flag('costume_voting_open', true);
    await as(ALICE);
    await expect(q("select public.cast_vote('costume', $1)", ['00000000-0000-0000-0000-0000000000ff'])).rejects.toThrow('NOT_FOUND');
  });
});

describe('scores and results', () => {
  it('scores hidden until published', async () => {
    const a = await costumeEntry(ALICE);
    await costumeEntry(BOB);
    await flag('costume_voting_open', true);
    await as(CAROL);
    await q("select public.cast_vote('costume', $1)", [a]);

    const hidden = await q("select * from public.get_leaderboard('costume')");
    expect(hidden.rows).toHaveLength(2);
    expect(hidden.rows.every((r: any) => r.score === null && r.rank === null)).toBe(true);

    await as(ADMIN);
    const adminView = await q("select * from public.get_leaderboard('costume')");
    expect(adminView.rows[0]).toMatchObject({ id: a, score: 10, rank: 1 });

    await flag('costume_results_published', true);
    await as(CAROL);
    const shown = await q("select * from public.get_leaderboard('costume')");
    expect(shown.rows[0]).toMatchObject({ id: a, score: 10, rank: 1, name: 'Alice' });
    expect(shown.rows[1]).toMatchObject({ score: 0, rank: 2 });
  });

  it('member emails only visible to members and admin', async () => {
    await team(ALICE, BOB);
    await as(CAROL);
    const r = await q("select members, is_mine from public.get_leaderboard('krathong')");
    expect(r.rows[0].is_mine).toBe(false);
    expect(r.rows[0].members.every((m: any) => m.email === undefined)).toBe(true);
    await as(BOB);
    const r2 = await q("select members, is_mine from public.get_leaderboard('krathong')");
    expect(r2.rows[0].is_mine).toBe(true);
    expect(r2.rows[0].members.map((m: any) => m.email).sort()).toEqual([ALICE.email, BOB.email]);
  });

  it('admin adjust adds to score', async () => {
    const a = await costumeEntry(ALICE);
    await flag('costume_voting_open', true);
    await as(BOB);
    await q("select public.cast_vote('costume', $1)", [a]);
    await as(ADMIN);
    await q("select public.admin_adjust_score('costume', $1, 5)", [a]);
    const r = await q("select score from public.get_leaderboard('costume')");
    expect(r.rows[0].score).toBe(15);
  });

  it('admin delete cascades votes', async () => {
    const a = await costumeEntry(ALICE);
    const b = await costumeEntry(BOB);
    await flag('costume_voting_open', true);
    await as(CAROL);
    await q("select public.cast_vote('costume', $1)", [a]);
    await as(ADMIN);
    await q("select public.admin_delete_entry('costume', $1)", [a]);
    await as(CAROL);
    expect((await q('select * from public.get_my_votes()')).rows).toHaveLength(0);
    await q("select public.cast_vote('costume', $1)", [b]);
  });

  it('admin_stats counts entries and votes', async () => {
    const a = await costumeEntry(ALICE);
    await flag('costume_voting_open', true);
    await as(BOB);
    await q("select public.cast_vote('costume', $1)", [a]);
    await as(ALICE);
    await expect(q('select * from public.admin_stats()')).rejects.toThrow('NOT_ADMIN');
    await as(ADMIN);
    const r = await q('select * from public.admin_stats() order by contest');
    expect(r.rows).toEqual([
      { contest: 'costume', entries: 1, votes: 1 },
      { contest: 'krathong', entries: 0, votes: 0 },
    ]);
  });

  it('data_version bumps on vote', async () => {
    const a = await costumeEntry(ALICE);
    await flag('costume_voting_open', true);
    await su();
    const before = Number((await q('select data_version from public.settings')).rows[0].data_version);
    await as(BOB);
    await q("select public.cast_vote('costume', $1)", [a]);
    await su();
    const after = Number((await q('select data_version from public.settings')).rows[0].data_version);
    expect(after).toBeGreaterThan(before);
  });
});

describe('entries', () => {
  it('costume save twice updates the same entry', async () => {
    const a1 = await costumeEntry(ALICE);
    const a2 = await costumeEntry(ALICE);
    expect(a2).toBe(a1);
  });

  it('entries locked after registration closes', async () => {
    await costumeEntry(ALICE);
    await flag('costume_registration_open', false);
    await as(ALICE);
    await expect(q('select public.delete_my_costume_entry()')).rejects.toThrow('REGISTRATION_CLOSED');
  });

  it('member in other team rejected', async () => {
    await team(ALICE, BOB);
    await expect(team(CAROL, BOB)).rejects.toThrow('MEMBER_IN_OTHER_TEAM');
  });

  it('creator already in a team cannot create another', async () => {
    await team(ALICE, BOB);
    await expect(team(BOB)).rejects.toThrow('ALREADY_IN_TEAM');
  });

  it('non-company member rejected', async () => {
    await flag('krathong_registration_open', true);
    await as(ALICE);
    await expect(q('select public.save_krathong_team(null, $1, $2::jsonb, $3, $4)', [
      'T', members(ALICE, OUTSIDER), `${ALICE.id}/k.jpg`, `${ALICE.id}/t.jpg`,
    ])).rejects.toThrow('NOT_COMPANY_MEMBER');
  });

  it('update dropping creator rejected; owner can change members; others cannot edit', async () => {
    const t = await team(ALICE, BOB);
    await as(ALICE);
    await expect(q('select public.save_krathong_team($1, $2, $3::jsonb, $4, $5)', [
      t, 'T2', members(BOB), `${ALICE.id}/k.jpg`, `${ALICE.id}/t.jpg`,
    ])).rejects.toThrow('CREATOR_REQUIRED');
    await q('select public.save_krathong_team($1, $2, $3::jsonb, $4, $5)', [
      t, 'T2', members(ALICE, CAROL), `${ALICE.id}/k.jpg`, `${ALICE.id}/t.jpg`,
    ]);
    await as(CAROL);
    await expect(q('select public.save_krathong_team($1, $2, $3::jsonb, $4, $5)', [
      t, 'T3', members(CAROL), `${CAROL.id}/k.jpg`, `${CAROL.id}/t.jpg`,
    ])).rejects.toThrow('NOT_OWNER');
    // Bob was removed, so he is free to join another team now.
    await team(BOB);
  });
});
