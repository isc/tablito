import { cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, describe, expect, it } from 'vitest';

import HomeScreen from '../screens/HomeScreen';
import ProgressScreen from '../screens/ProgressScreen';
import { LangProvider } from '../i18n/LangProvider';
import { addBadges, checkBadges, visibleBadgeDefinitions } from '../lib/badges';
import {
  CONJ_GROUP2_BADGE_ID,
  CONJ_MAINTENANCE_CAP,
  CONJ_TENSE_BADGE_ID,
  composeConjSession,
  conjVerbBadgeId,
  hasNewConjLevel,
  isConjLevel2Unlocked,
  judgeConjAnswer,
  withConjLevel2Facts,
} from '../lib/conjugationComposer';
import {
  conjFactDefsOfLevel,
  conjFactsOfTense,
  conjGrid,
  createInitialConjFacts,
  requireConjFactDef,
  resolveConjQuestion,
} from '../lib/conjugationFacts';
import { ezRole, canConjCoexist, conjKeysInterfere } from '../lib/conjugationInterference';
import { getConjStrategy, metConjRules } from '../lib/conjugationStrategies';
import { FINIR_RULE, POUVOIR_VOULOIR_RULE, PRENDRE_RULE } from '../lib/conjugationRules';
import { createNewProfile, importProfile, exportProfile, normalizeProfile } from '../lib/storage';
import { mergeProfiles } from '../lib/syncMerge';
import type { Badge, BoxLevel, ConjFact, UserProfile } from '../types';

// Le niveau 2 de la conjugaison (specs §15.3, §15.7, §15.8) : inventaire,
// ouverture, séance, badges, image.

const TODAY = '2026-11-04';
const LEVEL1_KEYS = new Set(conjFactDefsOfLevel(1).map((d) => d.key));
const TENSE_BADGES = Object.values(CONJ_TENSE_BADGE_ID).map((id) => ({ id, earnedDate: '2026-10-01' })) as Badge[];

/** Le niveau 1 entièrement maîtrisé, rien de dû : la situation à l'ouverture. */
function masteredLevel1(state: Partial<ConjFact> = {}): ConjFact[] {
  return createInitialConjFacts().map((f) => ({
    ...f,
    introduced: true,
    box: 5 as BoxLevel,
    lastSeen: '2026-10-20',
    nextDue: '2099-12-31',
    ...state,
  }));
}

/** Matière ouverte ; les faits du niveau 2 y entrent si les badges l'ouvrent. */
function profileWith(conjFacts: ConjFact[], badges: Badge[] = TENSE_BADGES): UserProfile {
  const profile: UserProfile = { ...createNewProfile('Test'), hasSeenConjIntro: true, badges, conjFacts };
  return { ...profile, conjFacts: withConjLevel2Facts(profile) };
}

function unlockedProfile(state: Partial<ConjFact> = {}): UserProfile {
  return profileWith(masteredLevel1(state));
}

function setLevel2(profile: UserProfile, update: (f: ConjFact, i: number) => ConjFact): UserProfile {
  let i = 0;
  return {
    ...profile,
    conjFacts: profile.conjFacts!.map((f) => (LEVEL1_KEYS.has(f.key) ? f : update(f, i++))),
  };
}

function formsOf(key: string): string[] {
  const def = requireConjFactDef(key);
  return def.carriers.map((_, i) => resolveConjQuestion(def, i).form);
}

describe('inventaire du niveau 2', () => {
  const defs = conjFactDefsOfLevel(2);

  it('compte 23 faits : 6 terminaisons, 15 formes du présent, 2 radicaux du futur', () => {
    expect(defs).toHaveLength(23);
    expect(defs.filter((d) => d.kind === 'ending')).toHaveLength(6);
    expect(defs.filter((d) => d.kind === 'irregular')).toHaveLength(15);
    expect(defs.filter((d) => d.kind === 'stem').map((d) => d.stem)).toEqual(['pourr', 'voudr']);
  });

  it('n’entre pas dans les faits d’un enfant qui commence la matière', () => {
    expect(createInitialConjFacts()).toHaveLength(63);
    expect(createInitialConjFacts().every((f) => LEVEL1_KEYS.has(f.key))).toBe(true);
  });

  it('conjugue pouvoir, vouloir et prendre', () => {
    expect(formsOf('pres-pouvoir-jetu')).toEqual(['peux', 'peux']);
    expect(formsOf('pres-pouvoir-il')).toEqual(['peut', 'peut']);
    expect(formsOf('pres-pouvoir-ils')).toEqual(['peuvent', 'peuvent']);
    expect(formsOf('pres-vouloir-nous')).toEqual(['voulons', 'voulons']);
    expect(formsOf('pres-vouloir-ils')).toEqual(['veulent', 'veulent']);
    expect(formsOf('pres-prendre-jetu')).toEqual(['prends', 'prends']);
    expect(formsOf('pres-prendre-il')).toEqual(['prend', 'prend']);
    expect(formsOf('pres-prendre-ils')).toEqual(['prennent', 'prennent']);
    expect(formsOf('fut-pouvoir')).toEqual(['pourrai', 'pourrons', 'pourront']);
    expect(formsOf('fut-vouloir')).toEqual(['voudrai', 'voudras', 'voudront']);
  });

  it('au 2e groupe, affiche le radical et fait taper la terminaison, -iss- compris', () => {
    const view = resolveConjQuestion(requireConjFactDef('pres-g2-nous'), 0);
    expect(view.displayedStem).toBe('fin');
    expect(view.expected).toBe('issons');
    expect(view.sentence).toBe('En ce moment, nous finissons le puzzle.');
    expect(formsOf('pres-g2-il')).toEqual(['finit', 'obéit', 'rougit']);
    expect(formsOf('pres-g2-ils')).toEqual(['grandissent', 'finissent', 'applaudissent']);
  });

  it('juge une réponse du 2e groupe', () => {
    const view = resolveConjQuestion(requireConjFactDef('pres-g2-nous'), 0);
    expect(judgeConjAnswer(view, 'issons').verdict).toBe('correct');
    // Le malentendu de consigne reste toléré : la forme entière est juste.
    expect(judgeConjAnswer(view, 'finissons').verdict).toBe('correct');
    expect(judgeConjAnswer(view, 'ons')).toEqual({ verdict: 'ending', blamedKeys: ['pres-g2-nous'] });
  });

  it('tient dans sa grille carrée, avec les cases bonus au bout', () => {
    expect(conjGrid(1).size).toBe(8);
    const grid = conjGrid(2);
    expect(grid.size).toBe(5);
    expect(grid.viewAt(0, 0)?.def.key).toBe('pres-g2-je');
    expect(grid.viewAt(4, 2)?.def.key).toBe('fut-vouloir');
    expect(grid.viewAt(4, 3)).toBeUndefined();
  });
});

describe('interférences du niveau 2', () => {
  it('sépare les formes qui se ressemblent ou s’entendent pareil', () => {
    expect(conjKeysInterfere('pres-pouvoir-jetu', 'pres-vouloir-jetu')).toBe(true);
    expect(conjKeysInterfere('pres-pouvoir-jetu', 'pres-pouvoir-il')).toBe(true);
    expect(conjKeysInterfere('pres-pouvoir-ils', 'pres-vouloir-ils')).toBe(true);
    expect(conjKeysInterfere('pres-prendre-jetu', 'pres-prendre-il')).toBe(true);
    expect(conjKeysInterfere('pres-g2-tu', 'pres-g2-il')).toBe(true);
    expect(conjKeysInterfere('fut-pouvoir', 'fut-voir')).toBe(true);
    expect(conjKeysInterfere('fut-vouloir', 'fut-venir')).toBe(true);
  });

  it('range vous finissez du côté de la règle -ez, en conflit avec vous êtes', () => {
    expect(ezRole(requireConjFactDef('pres-g2-vous'))).toBe('regular');
    expect(conjKeysInterfere('pres-g2-vous', 'pres-etre-vous')).toBe(true);
  });

  it('laisse cohabiter deux faits confusibles une fois consolidés', () => {
    const fact = (key: string, box: BoxLevel) => ({ key, box });
    expect(canConjCoexist(fact('pres-pouvoir-il', 2), fact('pres-vouloir-il', 4))).toBe(false);
    expect(canConjCoexist(fact('pres-pouvoir-il', 3), fact('pres-vouloir-il', 4))).toBe(true);
  });
});

describe('ouverture du niveau 2', () => {
  it('demande les trois badges de temps', () => {
    expect(isConjLevel2Unlocked([])).toBe(false);
    expect(isConjLevel2Unlocked(TENSE_BADGES.slice(0, 2))).toBe(false);
    expect(isConjLevel2Unlocked(TENSE_BADGES)).toBe(true);
  });

  it('ajoute les 23 faits à l’ouverture, une seule fois, sans toucher au reste', () => {
    const before = { badges: TENSE_BADGES, conjFacts: masteredLevel1() };
    const after = withConjLevel2Facts(before)!;
    expect(after).toHaveLength(86);
    expect(after.slice(0, 63)).toEqual(before.conjFacts);
    expect(after.slice(63).every((f) => !f.introduced && f.box === 1)).toBe(true);
    expect(withConjLevel2Facts({ badges: TENSE_BADGES, conjFacts: after })).toBe(after);
  });

  it('ne change rien avant l’ouverture, ni à une matière jamais commencée', () => {
    const conjFacts = masteredLevel1();
    expect(withConjLevel2Facts({ badges: [], conjFacts })).toBe(conjFacts);
    expect(withConjLevel2Facts({ badges: TENSE_BADGES, conjFacts: undefined })).toBeUndefined();
  });

  it('ouvre le niveau au chargement d’un profil qui a déjà les trois badges', () => {
    const profile: UserProfile = { ...createNewProfile('Test'), badges: TENSE_BADGES, conjFacts: masteredLevel1() };
    const restored = importProfile(exportProfile(profile))!;
    expect(restored.conjFacts).toHaveLength(86);
  });

  it('l’ouvre quand le dernier badge tombe', () => {
    const profile = profileWith(masteredLevel1(), TENSE_BADGES.slice(0, 2));
    expect(profile.conjFacts).toHaveLength(63);
    addBadges(profile, [TENSE_BADGES[2]]);
    expect(profile.conjFacts).toHaveLength(86);
  });

  it('récupère les faits d’un autre appareil par la synchro', () => {
    const local = profileWith(masteredLevel1(), []);
    expect(mergeProfiles(local, unlockedProfile(), null).conjFacts).toHaveLength(86);
  });

  it('les crée si l’autre appareil n’a transmis que les badges (version plus ancienne)', () => {
    const local = profileWith(masteredLevel1(), []);
    const remote: UserProfile = { ...local, badges: TENSE_BADGES };
    expect(normalizeProfile(mergeProfiles(local, remote, null)).conjFacts).toHaveLength(86);
  });

  it('allume la pastille tant qu’aucun fait du niveau n’a été introduit', () => {
    expect(hasNewConjLevel(profileWith(masteredLevel1(), []))).toBe(false);
    const profile = unlockedProfile();
    expect(hasNewConjLevel(profile)).toBe(true);
    expect(hasNewConjLevel(setLevel2(profile, (f, i) => (i === 0 ? { ...f, introduced: true } : f)))).toBe(false);
  });
});

describe('séance avec le niveau 2 ouvert', () => {
  it('introduit deux faits du niveau 2, en commençant par la règle du 2e groupe', () => {
    const questions = composeConjSession(unlockedProfile(), TODAY);
    expect(questions.filter((q) => q.isIntroduction).map((q) => q.fact.key)).toEqual(['pres-g2-je', 'pres-g2-tu']);
  });

  it('n’introduit jamais ensemble deux faits confusibles', () => {
    const profile = setLevel2(unlockedProfile(), (f) =>
      f.key === 'pres-g2-je' ? { ...f, introduced: true, box: 3, nextDue: '2099-12-31' } : f,
    );
    const intros = composeConjSession(profile, TODAY).filter((q) => q.isIntroduction).map((q) => q.fact.key);
    expect(intros).toContain('pres-g2-tu');
    expect(intros).not.toContain('pres-g2-il');
  });

  it('fait passer le niveau 2, plus fragile, avant le niveau 1', () => {
    const due = { nextDue: '2026-11-01' };
    // Niveau 1 dû en entier, niveau 2 : dû et plus fragile.
    const profile = setLevel2(unlockedProfile(due), (f) => ({
      ...f,
      introduced: true,
      box: 2,
      lastSeen: '2026-10-30',
      ...due,
    }));
    const questions = composeConjSession(profile, TODAY).filter((q) => !q.isBonusReview);
    expect(questions.length).toBeGreaterThan(CONJ_MAINTENANCE_CAP);
    expect(questions.filter((q) => LEVEL1_KEYS.has(q.fact.key))).toEqual([]);
  });

  it('plafonne l’entretien du niveau 1, futur compris : ce n’est plus le temps actif', () => {
    const futur = conjFactDefsOfLevel(1).filter((d) => d.tense === 'futur').map((d) => d.key);
    const profile = unlockedProfile();
    const dueFutur = {
      ...profile,
      conjFacts: profile.conjFacts!.map((f) =>
        LEVEL1_KEYS.has(f.key) && (futur.includes(f.key) || f.key.startsWith('pres-g1')) ? { ...f, nextDue: '2026-11-01' } : f,
      ),
    };
    const level1 = composeConjSession(dueFutur, TODAY)
      .filter((q) => !q.isBonusReview && LEVEL1_KEYS.has(q.fact.key));
    expect(level1.length).toBeLessThanOrEqual(CONJ_MAINTENANCE_CAP);
  });

  it('mesure la pile fragile et la fin de parcours sur le seul niveau 2', () => {
    // 6 faits du niveau 2 en boîte 1, 17 restants : au-dessus du plafond de
    // fragiles, et loin du dernier cinquième de CE niveau. Rapporté aux 86 faits,
    // 17 restants passeraient pour une fin de parcours (≤ 86 / 5).
    const profile = setLevel2(unlockedProfile(), (f, i) =>
      i < 6 ? { ...f, introduced: true, box: 1, nextDue: '2099-12-31' } : f,
    );
    expect(composeConjSession(profile, TODAY).filter((q) => q.isIntroduction)).toEqual([]);
  });
});

describe('règles du niveau 2', () => {
  it('montre la règle de sa famille, à tous les temps', () => {
    const rule = (key: string) => getConjStrategy(resolveConjQuestion(requireConjFactDef(key), 0));
    expect(rule('pres-g2-il')).toBe(FINIR_RULE);
    expect(rule('pres-pouvoir-il')).toBe(POUVOIR_VOULOIR_RULE);
    expect(rule('pres-vouloir-ils')).toBe(POUVOIR_VOULOIR_RULE);
    expect(rule('fut-pouvoir')).toBe(POUVOIR_VOULOIR_RULE);
    expect(rule('pres-prendre-il')).toBe(PRENDRE_RULE);
  });

  it('ne révèle ces règles qu’une fois un fait de la famille introduit', () => {
    expect(metConjRules(masteredLevel1())).not.toContain(FINIR_RULE);
    expect(metConjRules([{ key: 'pres-prendre-il', introduced: true }])).toEqual([PRENDRE_RULE]);
  });
});

describe('badges du niveau 2', () => {
  const ids = (p: UserProfile) => checkBadges(p).map((b) => b.id);

  it('les cache tant que le niveau n’est pas ouvert', () => {
    const before = profileWith(masteredLevel1(), []);
    expect(visibleBadgeDefinitions(before).map((d) => d.id)).not.toContain(CONJ_GROUP2_BADGE_ID);
    const visible = visibleBadgeDefinitions(unlockedProfile()).map((d) => d.id);
    expect(visible).toContain(CONJ_GROUP2_BADGE_ID);
    expect(visible).toContain(conjVerbBadgeId('prendre'));
  });

  it('décerne un badge par verbe et un pour le 2e groupe, famille par famille', () => {
    const master = (prefix: string[]) =>
      setLevel2(unlockedProfile(), (f) =>
        prefix.some((p) => f.key.startsWith(p)) ? { ...f, introduced: true, box: 4 } : f,
      );
    const group2 = ids(master(['pres-g2-']));
    expect(group2).toContain(CONJ_GROUP2_BADGE_ID);
    expect(group2).not.toContain(conjVerbBadgeId('pouvoir'));
    // pouvoir couvre aussi son futur.
    expect(ids(master(['pres-pouvoir-']))).not.toContain(conjVerbBadgeId('pouvoir'));
    expect(ids(master(['pres-pouvoir-', 'fut-pouvoir']))).toContain(conjVerbBadgeId('pouvoir'));
  });

  it('ne fait pas dépendre les badges de temps du niveau 2', () => {
    const profile = unlockedProfile();
    expect(ids({ ...profile, badges: [] })).toContain(CONJ_TENSE_BADGE_ID.present);
    // Leur barre de progression non plus : 44 faits au présent, pas 59.
    expect(conjFactsOfTense(profile.conjFacts!, 'present')).toHaveLength(44);
  });
});

describe('image du niveau 2', () => {
  function renderProgress(profile: UserProfile) {
    return render(
      <LangProvider>
        <ProgressScreen profile={profile} onBack={() => {}} initialView="conj" />
      </LangProvider>,
    );
  }
  afterEach(cleanup);

  it('ouvre sur le niveau en cours, une grille de 25 cases', () => {
    renderProgress(unlockedProfile());
    expect(document.querySelectorAll('.mystery-cell')).toHaveLength(25);
    expect(document.querySelector('.progress-stats-summary')?.textContent).toContain('23');
  });

  it('garde l’image du niveau 1 dans son onglet, avec ses 63 faits', () => {
    renderProgress(unlockedProfile());
    const tab = [...document.querySelectorAll('.progress-tab')].find((b) => b.textContent === 'Conjugaison')!;
    fireEvent.click(tab);
    expect(document.querySelectorAll('.mystery-cell')).toHaveLength(64);
    expect(document.querySelector('.progress-stats-summary')?.textContent).toContain('63');
  });

  it('n’a pas d’onglet avant l’ouverture', () => {
    renderProgress(profileWith(masteredLevel1(), []));
    expect([...document.querySelectorAll('.progress-tab')].map((b) => b.textContent)).not.toContain('Conjugaison 2');
    expect(document.querySelectorAll('.mystery-cell')).toHaveLength(64);
  });

  it('tire une image distincte de celle du niveau 1', () => {
    const profile = createNewProfile('Test');
    expect(profile.conj2MysteryTheme).toBeDefined();
    expect(profile.conj2MysteryTheme).not.toBe(profile.conjMysteryTheme);
  });
});

describe('pastille d’accueil', () => {
  afterEach(cleanup);
  it('revient sur la tuile quand le niveau 2 attend', () => {
    const props = {
      profile: unlockedProfile(),
      conjAvailable: true,
      hasConjSessionAvailable: true,
      conjVisible: true,
      onStartConj: () => {},
    } as unknown as Parameters<typeof HomeScreen>[0];
    const { rerender } = render(<LangProvider><HomeScreen {...props} conjHasNewLevel /></LangProvider>);
    expect(document.querySelector('.home-subject-dot')).not.toBeNull();
    rerender(<LangProvider><HomeScreen {...props} conjHasNewLevel={false} /></LangProvider>);
    expect(document.querySelector('.home-subject-dot')).toBeNull();
  });
});
