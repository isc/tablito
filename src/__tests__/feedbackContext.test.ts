import { describe, it, expect } from 'vitest';
import { buildContext } from '../lib/feedback';
import { createNewProfile } from '../lib/storage';

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

  it('ne joint rien du tout quand la case n\'est pas cochée', () => {
    const ctx = buildContext(createNewProfile('Zoé'), false);
    expect(ctx.profile_snapshot).toBeUndefined();
    // Les stats agrégées, elles, partent toujours (anonymes).
    expect(ctx.stats).toBeDefined();
  });
});
