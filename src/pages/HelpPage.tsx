// ---------------------------------------------------------------------------
// Page Aide & Tutoriel : guide complet des fonctionnalités STEMMA.
// ---------------------------------------------------------------------------
import {
  BookOpen, TreePine, Users, HeartHandshake, Search,
  Image, CalendarDays, DatabaseBackup, FileJson,
  UserPlus, Link2, Trash2, Shield,
  Lightbulb,
} from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'

interface Section {
  icon: React.ReactNode
  title: string
  content: React.ReactNode
}

const sections: Section[] = [
  {
    icon: <TreePine className="size-5 text-primary" />,
    title: 'Arbre généalogique',
    content: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>L'arbre est visualisé avec <strong className="text-foreground">React Flow</strong> — un canvas interactif que vous pouvez zoomer, déplacer et naviguer.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Sélectionnez une personne racine</strong> dans le menu déroulant du haut pour centrer l'arbre sur elle.</li>
          <li><strong>Vue Descendants / Ascendants</strong> : basculez entre l'arbre descendant (enfants en bas) et ascendant (ancêtres en haut).</li>
          <li><strong>Développer / Réduire</strong> : les boutons ± déplient ou replient toutes les branches.</li>
          <li><strong>Cliquer sur une personne</strong> ouvre sa fiche détaillée.</li>
          <li><strong>Flèches sur les nœuds</strong> : développer les enfants ou afficher les parents d'une personne.</li>
          <li><strong>Mini-carte</strong> en bas à droite pour naviguer rapidement dans l'arbre.</li>
          <li><strong>Export</strong> : boutons PDF, PNG ou Imprimer dans le haut de la page.</li>
        </ul>
        <p className="flex items-center gap-1"><Lightbulb className="size-3.5" /> <em>Astuce : l'arbre mémorise la dernière personne racine choisie par projet.</em></p>
      </div>
    ),
  },
  {
    icon: <Users className="size-5 text-primary" />,
    title: 'Personnes',
    content: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Chaque personne a une fiche avec : identité, dates, lieu, profession, notes, photo de profil et relations familiales.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Créer</strong> : bouton "Nouvelle personne" depuis la liste ou depuis l'arbre.</li>
          <li><strong>Modifier</strong> : bouton "Modifier" en haut de la fiche.</li>
          <li><strong>Photo de profil</strong> : bouton "Lier un média" puis "Définir comme photo de profil". L'apparaît dans l'arbre et les cartes.</li>
          <li><strong>Événements</strong> : la fiche affiche tous les événements liés (baptême, mariage, etc.).</li>
          <li><strong>Médias</strong> : la fiche affiche les documents et photos liés.</li>
          <li><strong>Supprimer</strong> : bouton corbeille — la personne passe dans la corbeille du projet (récupérable).</li>
        </ul>
      </div>
    ),
  },
  {
    icon: <HeartHandshake className="size-5 text-primary" />,
    title: 'Unions & relations familiales',
    content: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>STEMMA gère toutes les structures familiales :</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Unions multiples</strong> : une personne peut avoir plusieurs époux/épouses (simultanément ou successivement). Chaque union est une carte séparée.</li>
          <li><strong>Statuts d'union</strong> : actuel, passé, divorcé, séparé.</li>
          <li><strong>Enfants</strong> : ajoutez des enfants à n'importe quelle union. Les deux partenaires sont automatiquement parents.</li>
          <li><strong>Partenaires dynamiques</strong> : ajoutez ou retirez des partenaires d'une union à tout moment.</li>
        </ul>
        <p><strong>Types de relations reconnus :</strong></p>
        <ul className="list-disc pl-5 space-y-1">
          <li>Parents / Enfants (biologiques ou adoptifs)</li>
          <li>Frères &amp; sœurs (pleins et demi-frères/demi-sœurs)</li>
          <li>Grands-parents / Petits-enfants</li>
          <li>Oncles &amp; Tantes / Neveux &amp; Nièces</li>
          <li>Cousins (germains et au N-e degré)</li>
          <li>Beau-parent / Beau-enfant (familles recomposées)</li>
          <li>Conjoint / Ex-conjoint</li>
        </ul>
        <p className="flex items-center gap-1"><Lightbulb className="size-3.5" /> <em>Les relations sont calculées dynamiquement — jamais stockées. Elles se mettent à jour automatiquement.</em></p>
      </div>
    ),
  },
  {
    icon: <UserPlus className="size-5 text-primary" />,
    title: 'Parents adoptifs & belles-familles',
    content: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p><strong>Adoption</strong> : créez un lien parent-enfant direct avec le type "Adopté" (table <code>parent_child</code>). Le moteur de relations affichera "père adoptif" / "mère adoptive".</p>
        <p><strong>Familles recomposées</strong> : quand un parent se remarie avec le parent d'un autre enfant, les relations beau-parent / beau-enfant sont détectées automatiquement.</p>
        <p><strong>Orphelins</strong> : si les deux parents sont supprimés, l'enfant reste visible dans l'arbre tant qu'il a des enfants ou des unions. Les parents supprimés sont affichés en pointillés sur la fiche.</p>
      </div>
    ),
  },
  {
    icon: <CalendarDays className="size-5 text-primary" />,
    title: 'Événements',
    content: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Enregistrez des événements liés à des personnes ou des unions : baptême, confirmation, mariage, divorce, séparation, décès, inhumation, ou événement personnalisé.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Créer</strong> : depuis la page Événements, bouton "Nouvel événement". Choisissez le type, la personne associée, la date et le lieu.</li>
          <li><strong>Modifier / Supprimer</strong> :survoler un événement pour afficher les boutons d'action.</li>
          <li><strong>Filtrer</strong> : les boutons en haut de la page filtrent par type (baptême, mariage, décès, etc.).</li>
          <li><strong>Sur la fiche personne</strong> : tous les événements de la personne sont affichés dans la section "Événements".</li>
          <li><strong>Date flexible</strong> : date exacte, "vers", "avant", "après", "entre" ou inconnue.</li>
        </ul>
      </div>
    ),
  },
  {
    icon: <Link2 className="size-5 text-primary" />,
    title: 'Sources & citations',
    content: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Enregistrez vos sources (archives, livres, sites) et liez-les aux personnes via des citations.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Créer une source</strong> : titre, auteur, date, type (archive, livre, site web, etc.).</li>
          <li><strong>Ajouter une citation</strong> : associez une source à une personne avec une note contextuelle.</li>
          <li><strong>Voir les sources d'une personne</strong> : onglet Sources de la fiche.</li>
        </ul>
      </div>
    ),
  },
  {
    icon: <Image className="size-5 text-primary" />,
    title: 'Médias',
    content: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Importez des photos, documents ou images depuis votre ordinateur — rien ne part en ligne.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Importer</strong> : depuis la page Médias, bouton "Importer". Sélectionnez un fichier sur votre ordinateur.</li>
          <li><strong>Lier à une personne</strong> : depuis la fiche personne, bouton "Lier un média". Sélectionnez un média existant dans la galerie.</li>
          <li><strong>Photo de profil</strong> : dans le dialogue "Lier un média", cliquez "Définir comme photo de profil". Elle apparaît sur la fiche et dans l'arbre.</li>
          <li><strong>Galerie</strong> : les images s'affichent en grille, les documents en liste.</li>
          <li><strong>Stockage</strong> : les fichiers sont copiés dans le dossier du projet (<code>media/</code>).</li>
        </ul>
      </div>
    ),
  },
  {
    icon: <Search className="size-5 text-primary" />,
    title: 'Recherche',
    content: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>La recherche couvre toutes les entités du projet : personnes, familles, sources et événements.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Onglets</strong> : filtrez par catégorie (Tout, Personnes, Familles, Sources, Événements).</li>
          <li><strong>Compteurs</strong> : le nombre de résultats par catégorie s'affiche sur chaque onglet.</li>
          <li><strong>Recherche personnes</strong> : nom, prénom, nom de naissance, profession, notes.</li>
          <li><strong>Recherche familles</strong> : nom des partenaires, lieu, notes.</li>
          <li><strong>Recherche sources</strong> : titre, auteur, archive, référence.</li>
          <li><strong>Recherche événements</strong> : description, lieu, type, nom de la personne associée.</li>
          <li><strong>Débouchage</strong> : la recherche se lance automatiquement après 250ms d'inactivité.</li>
        </ul>
      </div>
    ),
  },
  {
    icon: <FileJson className="size-5 text-primary" />,
    title: 'Import & Export GEDCOM',
    content: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>GEDCOM 5.5.1 est le format standard d'échange entre logiciels de généalogie.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Exporter</strong> : depuis la page Import/Export, bouton "Exporter". Enregistrez le fichier <code>.ged</code> sur votre ordinateur.</li>
          <li><strong>Importer</strong> : depuis la page Import/Export, bouton "Importer". Sélectionnez un fichier <code>.ged</code> depuis Gramps, RootsMagic, Ancestry, FamilySearch ou tout autre logiciel compatible.</li>
          <li><strong>Données importées</strong> : personnes (noms, dates, lieux), familles (unions, partenaires, enfants), relations parent-enfant.</li>
          <li><strong>Export PDF / PNG</strong> : depuis l'arbre ou une fiche personne, exportez en image haute résolution ou en PDF.</li>
        </ul>
        <p className="flex items-center gap-1"><Lightbulb className="size-3.5" /> <em>Pour chaque export, le dialogue "Enregistrer sous" s'ouvre pour choisir le dossier.</em></p>
      </div>
    ),
  },
  {
    icon: <DatabaseBackup className="size-5 text-primary" />,
    title: 'Sauvegarde & restauration',
    content: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Les sauvegardes contiennent la base complète + les médias + un manifest vérifié par SHA-256.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Créer</strong> : depuis l'onglet Sauvegarde, bouton "Sauvegarder".</li>
          <li><strong>Chiffrement</strong> : optionnel — cochez "Chiffrer" et entrez un mot de passe (AES-128-CBC + HMAC-SHA256, PBKDF2 100 000 itérations).</li>
          <li><strong>Restaurer</strong> : sélectionnez un fichier <code>.ftbackup</code>. L'ancienne base est automatiquement copiée dans la corbeille avant restauration.</li>
        </ul>
      </div>
    ),
  },
  {
    icon: <Trash2 className="size-5 text-primary" />,
    title: 'Corbeille',
    content: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Les personnes et projets supprimés vont dans la corbeille. Vous pouvez les restaurer ou les purger définitivement.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Restaurer</strong> : la personne ou le projet réapparaît dans l'application.</li>
          <li><strong>Purger</strong> : suppression définitive (irréversible).</li>
        </ul>
      </div>
    ),
  },
  {
    icon: <Shield className="size-5 text-primary" />,
    title: 'Sécurité & confidentialité',
    content: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p><strong>100% local</strong> : aucune donnée ne quitte votre ordinateur. Zéro connexion réseau, zéro telemetry.</p>
        <ul className="list-disc pl-5 space-y-1">
          <li><strong>Base SQLite</strong> : chaque projet a sa propre base dans le dossier de l'application.</li>
          <li><strong>Sauvegardes chiffrées</strong> : AES-128-CBC avec HMAC-SHA256 et dérivation de clé PBKDF2 (100 000 itérations).</li>
          <li><strong>CSP restrictif</strong> : protection contre les attaques XSS.</li>
          <li><strong>Mode portable</strong> : copiez le dossier STEMMA sur une clé USB, créez un fichier <code>portable</code> à côté de l'exécutable.</li>
        </ul>
      </div>
    ),
  },
  {
    icon: <FileJson className="size-5 text-primary" />,
    title: 'Projet démo',
    content: (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>Pour découvrir l'application, créez un <strong>projet démo</strong> depuis l'accueil. Il pré-remplit une famille fictive avec des unions, des enfants, des sources et des médias d'exemple.</p>
      </div>
    ),
  },
]

export function HelpPage() {
  return (
    <div className="flex h-full flex-col">
      <PageHeader
        title="Aide & Tutoriel"
        subtitle="Guide complet des fonctionnalités STEMMA"
      />
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <BookOpen className="size-5 text-primary" />
              <div>
                <h2 className="text-sm font-semibold">Bienvenue dans STEMMA</h2>
                <p className="text-xs text-muted-foreground">
                  STEMMA est un logiciel de généalogie 100% local. Toutes vos données restent
                  sur votre ordinateur. Ce guide vous aide à prendre en main chaque fonctionnalité.
                </p>
              </div>
            </div>
          </div>

          {sections.map((s, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                {s.icon}
                <h3 className="text-sm font-semibold">{s.title}</h3>
              </div>
              {s.content}
            </div>
          ))}

          <div className="rounded-xl border border-dashed bg-card/50 p-4 text-center text-xs text-muted-foreground">
            <p>
              Une question ou une suggestion ? STEMMA est 100% local — votre retour compte pour améliorer l'application.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
