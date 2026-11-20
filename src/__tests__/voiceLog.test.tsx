import { act, cleanup, fireEvent, render } from '@testing-library/preact';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import FeedbackModal from '../components/FeedbackModal';
import { createNewProfile } from '../lib/storage';
import { clearVoiceLog, getVoiceLog, isVoiceDebugOn, voiceLog } from '../lib/voiceDebug';
import { requireButton } from './helpers/dom';

// « Micro buggy sur iPhone » (avis du 16/11/2026) : le journal vocal ne se
// tenait qu'après un geste caché et ne vivait qu'en mémoire, donc un parent
// n'avait jamais rien à envoyer. Il se tient désormais toujours, sur l'appareil,
// et ne sort qu'avec un avis, case cochée.

beforeEach(() => {
  localStorage.setItem('multiplix-lang', 'fr');
  clearVoiceLog();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('journal du micro', () => {
  it('se tient sans le flag de debug, sans bandeau ni console', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    expect(isVoiceDebugOn()).toBe(false);
    voiceLog('reco:final', '["trente-six"]');
    expect(getVoiceLog()).toHaveLength(1);
    expect(getVoiceLog()[0]).toMatch(/ reco:final \["trente-six"\]$/);
    expect(document.body.textContent).not.toContain('Copier le journal vocal');
    expect(debug).not.toHaveBeenCalled();
  });

  it('survit à un rechargement de l’app', async () => {
    voiceLog('reco:error', 'not-allowed');
    vi.resetModules();
    const reloaded = await import('../lib/voiceDebug');
    expect(reloaded.getVoiceLog()).toEqual([expect.stringMatching(/ reco:error not-allowed$/)]);
  });

  it('ne garde que les 400 dernières lignes', () => {
    for (let i = 0; i < 405; i++) voiceLog('reco:interim', String(i));
    const log = getVoiceLog();
    expect(log).toHaveLength(400);
    expect(log[0]).toMatch(/ reco:interim 5$/);
    expect(JSON.parse(localStorage.getItem('multiplix-voice-log')!)).toHaveLength(400);
  });
});

describe('avis : la case « Joindre le journal du micro »', () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
  });

  const renderModal = () =>
    render(<FeedbackModal profile={createNewProfile('Sacha')} onClose={() => {}} />);
  const voiceBox = () =>
    [...document.querySelectorAll('.feedback-checkbox')].find((l) =>
      l.textContent?.includes('journal du micro'),
    );
  const send = async () => {
    fireEvent.input(document.querySelector('textarea')!, { target: { value: 'le micro bugue' } });
    await act(async () => {
      fireEvent.click(requireButton(/^Envoyer$/));
    });
    const call = fetchMock.mock.calls.find((c) => String(c[0]).includes('/feedback'));
    expect(call, 'aucun POST de feedback intercepté').toBeDefined();
    return JSON.parse(String((call![1] as RequestInit).body)).context;
  };

  it('absente quand le journal est vide', () => {
    renderModal();
    expect(document.querySelector('.feedback-checkbox')).not.toBeNull();
    expect(voiceBox()).toBeUndefined();
  });

  it('décochée par défaut : le journal reste sur l’appareil', async () => {
    voiceLog('reco:error', 'not-allowed');
    renderModal();
    expect(voiceBox()).toBeDefined();
    const context = await send();
    expect(context.voice_log).toBeUndefined();
    expect(getVoiceLog()).toHaveLength(1);
  });

  it('cochée : le journal part avec l’avis, puis s’efface de l’appareil', async () => {
    voiceLog('reco:error', 'not-allowed');
    renderModal();
    fireEvent.click(voiceBox()!.querySelector('input')!);
    const context = await send();
    expect(context.voice_log).toEqual([expect.stringMatching(/ reco:error not-allowed$/)]);
    expect(getVoiceLog()).toEqual([]);
    expect(localStorage.getItem('multiplix-voice-log')).toBeNull();
  });
});
