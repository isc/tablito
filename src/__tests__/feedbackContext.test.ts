import { describe, it, expect } from 'vitest';
import { buildContext } from '../lib/feedback';
import { createNewProfile, loadProfile, saveProfile } from '../lib/storage';

// `buildContext` ne connaît qu'UN profil : celui que l'espace parent lui passe,
// c'est-à-dire celui qu'il AFFICHE — profil local, ou enfant suivi à distance si
// c'est son onglet qui est ouvert (cf. remoteFollow.test.tsx, qui verrouille ce
// choix côté appelant). Jamais deux, jamais les autres profils de l'appareil :
// c'est la promesse « ce profil uniquement » du libellé de la case.
describe('buildContext — ce que joint la case « historique détaillé »', () => {
  it('joint un seul profil, celui passé en argument', () => {
    const profile = createNewProfile('Zoé');
    const ctx = buildContext(profile, true);
    expect(ctx.profile_snapshot).toBeDefined();
    expect(ctx.profile_snapshot?.facts).toHaveLength(profile.facts.length);
  });

  it('retire le prénom du snapshot', () => {
    const ctx = buildContext(createNewProfile('Zoé'), true);
    expect(ctx.profile_snapshot).not.toHaveProperty('name');
    expect(JSON.stringify(ctx.profile_snapshot)).not.toContain('Zoé');
  });

  // Le snapshot doit dire QUELLE VERSION l'a produit : depuis qu'un avis peut
  // joindre le profil d'un enfant suivi à distance, l'appareil qui envoie n'est
  // plus celui qui a joué. Sans ça, un « ça ne marche toujours pas » oblige à
  // reconstituer la séance question par question pour savoir si l'enfant avait
  // seulement reçu le correctif (vécu le 17/09/2026).
  it("estampille le profil LOCAL de la version qui tourne", () => {
    const ctx = buildContext(createNewProfile('Zoé'), true, { kind: 'local' });
    expect(ctx.profile_snapshot?.appVersion).toBe('dev');
  });

  it("garde l'estampille du blob pour un profil SUIVI, sans la réécrire", () => {
    // Elle vient de l'appareil de l'enfant, posée à la publication : la
    // réécrire avec la version du parent effacerait la seule information utile.
    const remote = { ...createNewProfile('Zoé'), appVersion: '20260101000000' };
    const ctx = buildContext(remote, true, { kind: 'watched' });
    expect(ctx.profile_snapshot?.appVersion).toBe('20260101000000');
  });

  it("n'écrit JAMAIS l'estampille dans le profil stocké", () => {
    // Estampillée à l'écriture, elle décrirait le boot précédent — donc
    // l'ANCIENNE version juste après une mise à jour, le contresens exact
    // qu'elle doit éviter.
    saveProfile(createNewProfile('Zoé'));
    expect(loadProfile()).not.toHaveProperty('appVersion');
  });

  it('ne joint rien du tout quand la case n\'est pas cochée', () => {
    const ctx = buildContext(createNewProfile('Zoé'), false);
    expect(ctx.profile_snapshot).toBeUndefined();
    // Les stats agrégées, elles, partent toujours (anonymes).
    expect(ctx.stats).toBeDefined();
  });
});
