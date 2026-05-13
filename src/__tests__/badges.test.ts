// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { checkBadges, getBadgeDetail, isRule11Unlocked } from '../lib/badges';
import { createInitialFacts } from '../lib/facts';
import { importProfile } from '../lib/storage';
import type { UserProfile } from '../types';
import { BADGE_IDS } from '../types';

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    name: 'Zoe',
    startDate: '2026-01-01',
    facts: createInitialFacts(),
    totalSessions: 0,
    currentStreak: 0,
    longestStreak: 0,
    lastSessionDate: null,
    badges: [],
    sessionHistory: [],
    hasSeenRulesIntro: true,
    hasSeenRule11: false,
    mysteryTheme: 'market',
    ...overrides,
  };
}

describe('badge "Première case révélée" (1er fait en boîte 4)', () => {
  it("ne se déclenche pas tant qu'aucun fait n'a atteint la boîte 4", () => {
    const profile = makeProfile({ totalSessions: 1 });
    profile.facts[0].box = 3;
    profile.facts[1].box = 3;
    const earned = checkBadges(profile);
    expect(earned.some((b) => b.id === BADGE_IDS.PREMIERE_CASE)).toBe(false);
  });

  it('se déclenche dès qu’un seul fait atteint la boîte 4', () => {
    const profile = makeProfile({ totalSessions: 1 });
    profile.facts[0].box = 4;
    const earned = checkBadges(profile);
    expect(earned.some((b) => b.id === BADGE_IDS.PREMIERE_CASE)).toBe(true);
  });

  it('se déclenche aussi si un fait atteint directement la boîte 5', () => {
    const profile = makeProfile({ totalSessions: 1 });
    profile.facts[0].box = 5;
    const earned = checkBadges(profile);
    expect(earned.some((b) => b.id === BADGE_IDS.PREMIERE_CASE)).toBe(true);
  });

  it('n’est plus rendu si déjà débloqué (anti-doublon)', () => {
    const profile = makeProfile({
      totalSessions: 2,
      badges: [
        {
          id: BADGE_IDS.PREMIERE_CASE,
          name: 'Première case révélée',
          description: 'Une multiplication presque maîtrisée',
          earnedDate: '2026-01-02',
          icon: '🖼️',
        },
      ],
    });
    profile.facts[0].box = 4;
    profile.facts[1].box = 4;
    const earned = checkBadges(profile);
    expect(earned.some((b) => b.id === BADGE_IDS.PREMIERE_CASE)).toBe(false);
  });

  it('progress: 0/1 quand aucun fait en boîte 4', () => {
    const profile = makeProfile();
    profile.facts[0].box = 3;
    const detail = getBadgeDetail(BADGE_IDS.PREMIERE_CASE, profile);
    expect(detail.progress).toEqual({ current: 0, target: 1, unitLabel: 'en boîte 4' });
  });

  it('progress: 1/1 plafonné même si plusieurs faits en boîte 4', () => {
    const profile = makeProfile();
    profile.facts[0].box = 4;
    profile.facts[1].box = 5;
    const detail = getBadgeDetail(BADGE_IDS.PREMIERE_CASE, profile);
    expect(detail.progress).toEqual({ current: 1, target: 1, unitLabel: 'en boîte 4' });
  });
});

describe('badge "Première multiplication maîtrisée" (1er fait en boîte 5)', () => {
  it("ne se déclenche pas tant qu'aucun fait n'a atteint la boîte 5", () => {
    const profile = makeProfile({ totalSessions: 1 });
    profile.facts[0].box = 4;
    profile.facts[1].box = 4;
    const earned = checkBadges(profile);
    expect(earned.some((b) => b.id === BADGE_IDS.PREMIERE_MAITRISE)).toBe(false);
  });

  it('se déclenche dès qu’un seul fait atteint la boîte 5', () => {
    const profile = makeProfile({ totalSessions: 1 });
    profile.facts[0].box = 5;
    const earned = checkBadges(profile);
    expect(earned.some((b) => b.id === BADGE_IDS.PREMIERE_MAITRISE)).toBe(true);
  });

  it('progress: 0/1 quand aucun fait en boîte 5', () => {
    const profile = makeProfile();
    profile.facts[0].box = 4;
    const detail = getBadgeDetail(BADGE_IDS.PREMIERE_MAITRISE, profile);
    expect(detail.progress).toEqual({ current: 0, target: 1, unitLabel: 'en boîte 5' });
  });

  it('progress: 1/1 plafonné même si plusieurs faits en boîte 5', () => {
    const profile = makeProfile();
    profile.facts[0].box = 5;
    profile.facts[1].box = 5;
    const detail = getBadgeDetail(BADGE_IDS.PREMIERE_MAITRISE, profile);
    expect(detail.progress).toEqual({ current: 1, target: 1, unitLabel: 'en boîte 5' });
  });
});

describe('rétro-attribution des badges au chargement du profil', () => {
  it('attribue un badge dont le critère est déjà rempli mais absent du profil (nouveau badge ajouté après coup)', () => {
    const profile = makeProfile({ totalSessions: 3 });
    profile.facts[0].box = 4;
    profile.facts[1].box = 5;

    const loaded = importProfile(JSON.stringify(profile))!;

    const ids = new Set(loaded.badges.map((b) => b.id));
    expect(ids.has(BADGE_IDS.PREMIER_PAS)).toBe(true);
    expect(ids.has(BADGE_IDS.PREMIERE_CASE)).toBe(true);
    expect(ids.has(BADGE_IDS.PREMIERE_MAITRISE)).toBe(true);
  });

  it('ne dédouble pas les badges déjà présents dans le profil', () => {
    const profile = makeProfile({
      totalSessions: 3,
      badges: [
        {
          id: BADGE_IDS.PREMIER_PAS,
          name: 'Premier pas',
          description: 'Terminer la première séance',
          earnedDate: '2026-01-02',
          icon: '🌱',
        },
      ],
    });
    profile.facts[0].box = 4;

    const loaded = importProfile(JSON.stringify(profile))!;

    const premierPasCount = loaded.badges.filter((b) => b.id === BADGE_IDS.PREMIER_PAS).length;
    expect(premierPasCount).toBe(1);
  });
});

function tableBadge(n: number) {
  return {
    id: `${BADGE_IDS.TABLE_PREFIX}${n}`,
    name: `Table de ${n}`,
    description: `Maîtriser la table de ${n}`,
    earnedDate: '2026-01-01',
    icon: `${n}️⃣`,
  };
}

describe('isRule11Unlocked (règle bonus ×11)', () => {
  it('renvoie false sur un profil neuf (aucun badge)', () => {
    expect(isRule11Unlocked(makeProfile())).toBe(false);
  });

  it('renvoie false tant qu\'il manque au moins un badge TABLE_N', () => {
    const badges = [2, 3, 4, 5, 6, 7, 8].map(tableBadge); // 7 sur 8
    expect(isRule11Unlocked(makeProfile({ badges }))).toBe(false);
  });

  it('renvoie true dès que les 8 badges TABLE_N sont obtenus', () => {
    const badges = [2, 3, 4, 5, 6, 7, 8, 9].map(tableBadge);
    expect(isRule11Unlocked(makeProfile({ badges }))).toBe(true);
  });

  it('reste true même si des faits régressent (badges permanents)', () => {
    const badges = [2, 3, 4, 5, 6, 7, 8, 9].map(tableBadge);
    const profile = makeProfile({ badges });
    // Faits ramenés à box 1 — la règle ne doit pas disparaître pour autant.
    profile.facts.forEach((f) => { f.box = 1; });
    expect(isRule11Unlocked(profile)).toBe(true);
  });

  it('ignore les badges non-TABLE_N dans le compte', () => {
    const badges = [
      ...[2, 3, 4, 5, 6, 7, 8, 9].map(tableBadge),
      { id: BADGE_IDS.PREMIER_PAS, name: 'Premier pas', description: '', earnedDate: '2026-01-01', icon: '🌱' },
      { id: BADGE_IDS.GENIE_MATHS, name: 'Génie', description: '', earnedDate: '2026-01-01', icon: '🏆' },
    ];
    expect(isRule11Unlocked(makeProfile({ badges }))).toBe(true);
  });
});

describe('migration UserProfile.hasSeenRule11', () => {
  it('défaut à false pour un profil legacy sans le champ', () => {
    const legacy = makeProfile() as Partial<UserProfile>;
    delete legacy.hasSeenRule11;
    const loaded = importProfile(JSON.stringify(legacy))!;
    expect(loaded.hasSeenRule11).toBe(false);
  });

  it('préserve true si le profil l\'a déjà à true', () => {
    const profile = makeProfile({ hasSeenRule11: true });
    const loaded = importProfile(JSON.stringify(profile))!;
    expect(loaded.hasSeenRule11).toBe(true);
  });
});

describe('intégration : profil legacy déjà au top niveau débloque ×11', () => {
  // Scénario : un utilisateur existant (avant cette feature) a tous ses faits
  // en boîte 4+ ET a déjà les 8 badges TABLE_N dans son profil. Au prochain
  // lancement, la règle bonus doit être révélée immédiatement.
  it('badges déjà présents → isRule11Unlocked true au chargement', () => {
    const badges = [2, 3, 4, 5, 6, 7, 8, 9].map(tableBadge);
    const legacy = makeProfile({ badges }) as Partial<UserProfile>;
    delete legacy.hasSeenRule11;
    const loaded = importProfile(JSON.stringify(legacy))!;
    expect(isRule11Unlocked(loaded)).toBe(true);
    expect(loaded.hasSeenRule11).toBe(false); // pastille à montrer au prochain Home
  });

  // Scénario plus subtil : un profil dont les faits sont tous en box 4+ mais
  // dont la liste de badges est incomplète (ex : profil créé avant l'ajout
  // d'un des badges). Le filet de sécurité de migrateProfile (rétro-attribution
  // via checkBadges) doit combler le trou et débloquer la règle.
  it('faits en box 4+ mais badges manquants → retro-attribution puis déblocage', () => {
    const legacy = makeProfile() as Partial<UserProfile>;
    legacy.facts!.forEach((f) => { f.box = 4; });
    legacy.badges = []; // aucun badge dans le profil
    delete legacy.hasSeenRule11;

    const loaded = importProfile(JSON.stringify(legacy))!;

    const tableBadges = loaded.badges.filter((b) => b.id.startsWith(BADGE_IDS.TABLE_PREFIX));
    expect(tableBadges.length).toBe(8);
    expect(isRule11Unlocked(loaded)).toBe(true);
  });
});
