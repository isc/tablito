import { describe, it, expect } from 'vitest';
import { buildContext } from '../lib/feedback';
import { createNewProfile } from '../lib/storage';

// Question d'un parent qui suit un enfant à distance : « joindre l'historique
// détaillé du profil » envoie-t-il aussi le profil suivi ? Non — buildContext
// ne connaît qu'UN profil, celui que l'espace parent lui passe (le profil local
// en cours). Les profils suivis à distance ne vivent qu'en mémoire côté
// affichage (lib/watch), et les autres profils locaux ne sont jamais lus ici.
// Verrouillé par un test : la case à cocher promet explicitement « ce profil
// uniquement » dans son libellé.
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

  it('ne joint rien du tout quand la case n\'est pas cochée', () => {
    const ctx = buildContext(createNewProfile('Zoé'), false);
    expect(ctx.profile_snapshot).toBeUndefined();
    // Les stats agrégées, elles, partent toujours (anonymes).
    expect(ctx.stats).toBeDefined();
  });
});
