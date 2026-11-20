// Dev-only in-memory backend so the UI can be previewed without Supabase.
// Open http://localhost:3000/?demo (voter) or /?demo=admin. Not used in production builds.
import type { Backend, Stats } from './api';
import type { AppUser, Contest, Entry, FlagKey, Member, MyVotes, Settings } from './types';

const pic = (hue: number, kind: 'person' | 'kr') => {
  const fig = kind === 'person'
    ? `<circle cx='200' cy='150' r='60' fill='hsl(${hue},55%,75%)'/><path d='M80 520 Q90 260 200 230 Q310 260 320 520Z' fill='hsl(${hue},55%,70%)'/><path d='M130 280 Q200 350 270 280' fill='none' stroke='%23f7e3a1' stroke-width='8'/>`
    : `<ellipse cx='200' cy='380' rx='160' ry='30' fill='%2314523a'/><path d='M40 370 Q200 440 360 370 L330 320 Q200 380 70 320Z' fill='%233bb57a'/><path d='M80 320 Q200 370 320 320 L290 270 Q200 320 110 270Z' fill='%237be0a8'/><circle cx='150' cy='270' r='22' fill='hsl(${hue},80%,72%)'/><circle cx='200' cy='258' r='26' fill='%23f7e3a1'/><circle cx='250' cy='270' r='22' fill='hsl(${hue + 60},80%,75%)'/><rect x='192' y='150' width='16' height='90' fill='%23fff4dc'/><path d='M200 110 Q216 135 200 152 Q184 135 200 110Z' fill='%23ffb84d'/>`;
  return `data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 500'><defs><radialGradient id='g' cx='50%' cy='30%'><stop offset='0' stop-color='hsl(${hue},45%,28%)'/><stop offset='1' stop-color='hsl(${hue},40%,7%)'/></radialGradient></defs><rect width='400' height='500' fill='url(%23g)'/>${fig}</svg>`;
};

type Row = { id: string; name: string; subtitle: string; img: string; team?: string; members: Member[]; mine: boolean; votes: number; adj: number };

export function makeDemo(admin: boolean): { backend: Backend; user: AppUser } {
  const user: AppUser = admin
    ? { id: 'admin', email: 'patomporn.k@villacartegroup.com', name: 'Patomporn K.', avatarUrl: null }
    : { id: 'me', email: 'pim@villacartegroup.com', name: 'Pimchanok T.', avatarUrl: null };

  const settings: Settings = {
    costume_registration_open: false, costume_voting_open: true, krathong_registration_open: true,
    krathong_voting_open: false, costume_results_published: false, krathong_results_published: false, data_version: 1,
  };
  const names = ['Napat S.', 'Kanya P.', 'Tanawat R.', 'Pimchanok T.', 'Krit W.', 'Supansa L.', 'Arthit M.'];
  const looks = ['Lanna Princess', 'Siamese Silk', 'River Spirit', 'Golden Moon', 'Royal Guard', 'Lotus Dancer', 'Night Garuda'];
  const data: Record<Contest, Row[]> = {
    costume: names.map((n, i) => ({ id: `c${i}`, name: n, subtitle: looks[i], img: pic(i * 47, 'person'), members: [], mine: !admin && i === 3, votes: [24, 19, 15, 12, 9, 6, 3][i], adj: 0 })),
    krathong: ['Finance', 'Sales', 'IT', 'HR', 'Operations'].map((t, i) => ({
      id: `k${i}`, name: `Team ${t}`, subtitle: `${4 + i} members`, img: pic(120 + i * 40, 'kr'), team: pic(i * 60 + 20, 'person'),
      members: [{ name: 'Lead' }, { name: 'Member' }], mine: false, votes: [21, 18, 16, 11, 7][i], adj: 0,
    })),
  };
  const votes: MyVotes = { costume: null, krathong: null };
  const subs = new Set<(s: Settings) => void>();
  const bump = () => { settings.data_version++; subs.forEach((f) => f({ ...settings })); };
  const wait = <T,>(v: T) => new Promise<T>((r) => setTimeout(() => r(v), 250));
  const err = (c: string) => Promise.reject(new Error(c));

  const backend: Backend = {
    getSettings: () => wait({ ...settings }),
    async getLeaderboard(c) {
      const show = admin || settings[`${c}_results_published`];
      const rows = data[c].map((r) => ({ r, sc: r.votes * 10 + r.adj }));
      if (show) rows.sort((a, b) => b.sc - a.sc);
      return wait(rows.map(({ r, sc }, i): Entry => ({
        id: r.id, name: r.name, subtitle: r.subtitle, imagePath: r.img, imageUrl: r.img, teamImagePath: r.team ?? null,
        teamImageUrl: r.team ?? null, members: r.members, isMine: r.mine, score: show ? sc : null, rank: show ? i + 1 : null,
      })));
    },
    getMyVotes: () => wait({ ...votes }),
    castVote(c, id) {
      if (!settings[`${c}_voting_open`]) return err('VOTING_CLOSED');
      if (votes[c]) return err('ALREADY_VOTED');
      const r = data[c].find((x) => x.id === id)!;
      if (r.mine) return err('OWN_ENTRY');
      r.votes++; votes[c] = id; bump();
      return wait(null);
    },
    saveCostumeEntry(title, img, name) {
      let r = data.costume.find((x) => x.mine);
      if (!r) { r = { id: `c${Date.now()}`, name, subtitle: title, img, members: [], mine: true, votes: 0, adj: 0 }; data.costume.push(r); }
      Object.assign(r, { name, subtitle: title, img }); bump();
      return wait(r.id);
    },
    deleteMyCostumeEntry() { data.costume = data.costume.filter((x) => !x.mine); bump(); return wait(null); },
    saveKrathongTeam(id, name, members, k, t) {
      let r = id ? data.krathong.find((x) => x.id === id) : undefined;
      if (!r) { r = { id: `k${Date.now()}`, name, subtitle: '', img: k, team: t, members, mine: true, votes: 0, adj: 0 }; data.krathong.push(r); }
      Object.assign(r, { name, img: k, team: t, members, subtitle: `${members.length} members` }); bump();
      return wait(r.id);
    },
    deleteMyKrathongTeam(id) { data.krathong = data.krathong.filter((x) => x.id !== id); bump(); return wait(null); },
    uploadImage: (file) => wait(URL.createObjectURL(file)),
    adminSetFlag(flag: FlagKey, v) { settings[flag] = v; bump(); return wait(null); },
    adminAdjustScore(c, id, d) { data[c].find((x) => x.id === id)!.adj += d; bump(); return wait(null); },
    adminDeleteEntry(c, id) { data[c] = data[c].filter((x) => x.id !== id); bump(); return wait(null); },
    adminStats: () => wait((['costume', 'krathong'] as Contest[]).map((c) => ({
      contest: c, entries: data[c].length, votes: data[c].reduce((a, r) => a + r.votes, 0),
    })) as Stats),
    subscribe(f) { subs.add(f); return () => subs.delete(f); },
  };
  return { backend, user };
}
