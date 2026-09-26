// Réglages de l'accueil de l'espace parent : une ligne par réglage. Les
// réglages rares ouvrent leur page (suivi à distance, profils et sauvegarde,
// aide) ; ceux qu'on bascule d'un geste le font sur place (rappels, langue).
//
// Ce qui est listé dépend de l'APPAREIL, pas du profil affiché : les
// profils et le rappel quotidien n'existent qu'avec un profil local, le recap
// du dimanche qu'avec au moins un enfant suivi.

import type { ParentPage } from '../screens/ParentDashboard';
import { listProfiles } from '../lib/storage';
import { loadWatchCredentials, watchConfigured, type WatchedProfile } from '../lib/watchStore';
import { dailyReminderStrings, useParentDashboardStrings, weeklyRecapStrings } from '../i18n/parent';
import LanguageToggle from './LanguageToggle';
import PushPrefRow from './PushPrefRow';
import { SettingList, SettingRow } from './ParentSettingRow';
import { BellIcon, CalendarIcon, HelpIcon, ProfilesIcon, ShareIcon } from './ParentSettingIcons';

interface ParentSettingsListProps {
  hasLocalProfile: boolean;
  watched: WatchedProfile[];
  onOpenPage: (page: ParentPage) => void;
}

export default function ParentSettingsList({ hasLocalProfile, watched, onOpenPage }: ParentSettingsListProps) {
  const t = useParentDashboardStrings();
  const profiles = listProfiles();
  const sharedNames = profiles.filter((p) => loadWatchCredentials(p.id)).map((p) => p.name);

  return (
    <SettingList>
      {watchConfigured() && (
        <SettingRow
          icon={<ShareIcon />}
          title={t.watchTitle}
          sub={t.watchRowSummary(
            sharedNames,
            watched.map((w) => w.name),
          )}
          onClick={() => onOpenPage('watch')}
        />
      )}
      {hasLocalProfile && (
        <>
          <SettingRow
            icon={<ProfilesIcon />}
            title={t.profilesTitle}
            sub={t.profilesRowSubtitle(profiles.map((p) => p.name))}
            onClick={() => onOpenPage('profiles')}
          />
          <PushPrefRow pref="daily" icon={<BellIcon />} strings={dailyReminderStrings} />
        </>
      )}
      {watched.length > 0 && <PushPrefRow pref="weekly" icon={<CalendarIcon />} strings={weeklyRecapStrings} />}
      <LanguageToggle />
      <SettingRow icon={<HelpIcon />} title={t.helpTitle} sub={t.helpRowSubtitle} onClick={() => onOpenPage('help')} />
    </SettingList>
  );
}
