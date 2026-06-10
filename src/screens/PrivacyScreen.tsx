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
          Tablito est conçu pour respecter la vie privée des enfants. Voici
          exactement ce qui se passe avec les données.
        </p>

        <section className="privacy-section">
          <h2>Ce qui reste sur cet appareil</h2>
          <p>
            Le prénom de l'enfant, sa progression (Leitner, badges, séances,
            streak) et ses préférences (son, mode vocal) sont stockés
            localement dans le navigateur (<code>localStorage</code>).
            L'application fonctionne entièrement hors-ligne après le premier
            chargement. Par défaut, rien n'est envoyé sur un serveur : les deux
            seules exceptions sont opt-in et décrites ci-dessous (l'envoi d'un
            avis et l'activation du rappel quotidien).
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
          <h2>Ce qui est envoyé si vous activez le rappel quotidien</h2>
          <p>
            Le <strong>rappel quotidien</strong> (espace parent) est facultatif.
            Si vous l'activez, l'appareil enregistre un <em>abonnement push</em>{' '}
            dans la même base Supabase :
          </p>
          <ul>
            <li>
              un identifiant technique fourni par le navigateur (l'<em>endpoint</em>{' '}
              de notification) et ses clés de chiffrement,
            </li>
            <li>le fuseau horaire de l'appareil (pour envoyer à 18&nbsp;h heure locale),</li>
            <li>
              la date de la dernière séance, uniquement pour ne pas notifier les
              jours où l'enfant a déjà pratiqué (anti-nag).
            </li>
          </ul>
          <p>
            <strong>Le prénom n'est pas envoyé</strong> et le message de rappel
            est générique. Ces informations sont rattachées à l'abonnement (son
            endpoint), pas à une identité. L'envoi des notifications passe par le
            service de notification de votre navigateur (Google, Mozilla ou Apple
            selon le navigateur), comme pour toute notification web. Vous pouvez
            désactiver le rappel à tout moment depuis le même bouton, ce qui
            supprime l'abonnement de la base.
          </p>
        </section>

        <section className="privacy-section">
          <h2>Ce qui n'est pas collecté</h2>
          <ul>
            <li>Aucun cookie de suivi, aucun analytics tiers.</li>
            <li>Aucune publicité, aucun lien externe côté enfant.</li>
            <li>Aucun nom de famille, école, adresse, ou donnée sensible.</li>
            <li>Aucune donnée vocale n'est enregistrée : le mode vocal utilise l'API du navigateur en local, rien ne sort.</li>
            <li>Aucun prénom n'est envoyé, même avec le rappel quotidien activé.</li>
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

        <p className="privacy-updated">Dernière mise à jour : mai 2026.</p>
      </div>
    </div>
  );
}
