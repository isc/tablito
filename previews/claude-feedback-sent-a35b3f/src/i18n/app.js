import{useStrings as r}from"./lang.js";const s={confirmDeleteProfile:e=>`Supprimer le profil de ${e} ?

Le pr\xE9nom, les s\xE9ances, les badges et la s\xE9rie seront effac\xE9s de cet appareil. Cette action est irr\xE9versible.`,confirmRemoveSyncedProfile:e=>`Retirer ${e} de cet appareil ?

${e} joue aussi sur un autre appareil : sa progression y reste, et continue de s'y synchroniser.`,syncStopped:e=>`La progression de ${e} n'est plus synchronis\xE9e : le partage a \xE9t\xE9 arr\xEAt\xE9 depuis un autre appareil. Elle reste sur celui-ci.`,transferFailed:"Le transfert n'a pas abouti : le lien a peut-\xEAtre expir\xE9 ou d\xE9j\xE0 servi. Relancez-en un depuis l'ancien appareil (Espace parent \u2192 Profils et sauvegarde \u2192 Changer d'appareil).",transferImported:"La progression est bien arriv\xE9e sur cet appareil \u2713",dismiss:"Fermer"},n={confirmDeleteProfile:e=>`Delete ${e}'s profile?

The name, sessions, badges and streak will be erased from this device. This action cannot be undone.`,confirmRemoveSyncedProfile:e=>`Remove ${e} from this device?

${e} also plays on another device: their progress stays there, and keeps syncing.`,syncStopped:e=>`${e}'s progress is no longer synced: sharing was stopped from another device. It stays on this one.`,transferFailed:"The transfer didn't go through: the link may have expired or already been used. Start a new one from the old device (Parent area \u2192 Profiles and backup \u2192 Move to another device).",transferImported:"The progress has arrived on this device \u2713",dismiss:"Close"},i={fr:s,en:n};function a(){return r(i)}export{i as appStrings,a as useAppStrings};

//# sourceMappingURL=app.js.map
