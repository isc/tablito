import{useStrings as r}from"./lang.js";const s={confirmDeleteProfile:e=>`Supprimer le profil de ${e} ?

Le pr\xE9nom, les s\xE9ances, les badges et la s\xE9rie seront effac\xE9s de cet appareil. Cette action est irr\xE9versible.`,transferFailed:"Le transfert n'a pas abouti : le lien a peut-\xEAtre expir\xE9 ou d\xE9j\xE0 servi. Relancez-en un depuis l'ancien appareil (Espace parent \u2192 Transf\xE9rer).",transferImported:"La progression est bien arriv\xE9e sur cet appareil \u2713",dismiss:"Fermer"},n={confirmDeleteProfile:e=>`Delete ${e}'s profile?

The name, sessions, badges and streak will be erased from this device. This action cannot be undone.`,transferFailed:"The transfer didn't go through: the link may have expired or already been used. Start a new one from the old device (Parent area \u2192 Transfer).",transferImported:"The progress has arrived on this device \u2713",dismiss:"Close"},i={fr:s,en:n};function a(){return r(i)}export{i as appStrings,a as useAppStrings};

//# sourceMappingURL=app.js.map
