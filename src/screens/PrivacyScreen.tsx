import BackChevron from '../components/BackChevron';

interface PrivacyScreenProps {
  onBack: () => void;
}

export default function PrivacyScreen({ onBack }: PrivacyScreenProps) {
  return (
    <div className="privacy-screen">
      <button className="privacy-back-btn" onClick={onBack} aria-label="Retour">
        <BackChevron />
      </button>

      <div className="privacy-content">
        <h1 className="privacy-title">Confidentialité</h1>
        <p className="privacy-subtitle">
          Multiplix est conçu pour respecter la vie privée des enfants. Voici
          exactement ce qui se passe avec les données.
        </p>

        <section className="privacy-section">
          <h2>Ce qui reste sur cet appareil</h2>
          <p>
            Le prénom de l'enfant, sa progression (Leitner, badges, séances,
            streak) et ses préférences (son, mode vocal) sont stockés
            localement dans le navigateur (<code>localStorage</code>). Rien
            n'est envoyé sur un serveur — l'application fonctionne entièrement
            hors-ligne après le premier chargement.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Ce qui est envoyé en cas d'avis</h2>
          <p>
            Si vous utilisez le bouton <strong>«&nbsp;Envoyer un avis&nbsp;»</strong> du
            dashboard parent, les éléments suivants sortent de l'appareil :
          </p>
          <ul>
            <li>le message que vous écrivez,</li>
            <li>l'email si vous en fournissez un (optionnel, pour vous répondre),</li>
            <li>
              un contexte anonyme : navigateur, langue, taille d'écran, et
              quelques statistiques agrégées (nombre de séances, faits
              maîtrisés, streak, jours depuis le début).
            </li>
          </ul>
          <p>
            Le prénom de l'enfant n'est pas envoyé. Ces données atterrissent
            dans une base Supabase hébergée en Europe, lisible uniquement par
            le responsable du projet.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Ce qui n'est pas collecté</h2>
          <ul>
            <li>Aucun cookie de suivi, aucun analytics tiers.</li>
            <li>Aucune publicité, aucun lien externe côté enfant.</li>
            <li>Aucun nom de famille, école, adresse, ou donnée sensible.</li>
            <li>Aucune donnée vocale n'est enregistrée : le mode vocal utilise l'API du navigateur en local, rien ne sort.</li>
          </ul>
        </section>

        <section className="privacy-section">
          <h2>Vos droits</h2>
          <p>
            Depuis le dashboard parent vous pouvez à tout moment :
          </p>
          <ul>
            <li><strong>Exporter</strong> toute la progression au format JSON,</li>
            <li><strong>Importer</strong> une sauvegarde.</li>
          </ul>
          <p>
            Pour supprimer l'intégralité des données, videz les données du site
            dans les réglages de votre navigateur. Pour les avis déjà envoyés,
            demandez la suppression via un nouveau formulaire «&nbsp;Envoyer un avis&nbsp;».
          </p>
        </section>

        <section className="privacy-section">
          <h2>Contact</h2>
          <p>
            Pour toute question ou demande de suppression, utilisez le
            formulaire <strong>«&nbsp;Envoyer un avis&nbsp;»</strong> du dashboard parent.
          </p>
        </section>

        <p className="privacy-updated">Dernière mise à jour : avril 2026.</p>
      </div>
    </div>
  );
}
