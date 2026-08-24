<p align="center">
  <img src="src-tauri/icons/icon.png" width="120" alt="STEMMA logo">
</p>

<h1 align="center">STEMMA</h1>

<p align="center">
  <strong>Application de généalogie 100% locale, open-source et cross-platform</strong>
</p>

<p align="center">
  Aucune connexion réseau • Aucune télémétrie • Aucune donnée envoyée<br>
  Vos données vous appartiennent.
</p>

<p align="center">
  <a href="#installation">Installation</a> •
  <a href="#fonctionnalites">Fonctionnalités</a> •
  <a href="#requirements">Requirements</a> •
  <a href="# developpement">Développement</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#licence">Licence</a>
</p>

---

## Pourquoi STEMMA ?

La plupart des logiciels de généalogie requièrent un compte en ligne, stockent vos données sur leurs serveurs ou envolent des informations à des tiers. **STEMMA** a été conçu pour les personnes qui souhaitent **garder le contrôle total** de leur arbre généalogique.

| | Logiciels en ligne | STEMMA |
|---|---|---|
| **Données stockées** | Serveurs distants | Votre ordinateur uniquement |
| **Connexion internet** | Requise | Jamais nécessaire |
| **Compte obligatoire** | Oui | Non |
| **Vie privée** | Dépend de la politique du service | 100% garantie |
| **Portabilité** | Non | Clé USB possible |
| **Coût** | Souvent payant | Gratuit et open-source |

---

## Fonctionnalites

### Arbre generique
- Vue **descendante** (ancetres → descendants) et **ascendante** (enfants → ascendants)
- Mise en page automatique via React Flow
- Nœuds interactifs avec photo de profil et informations rapides

### Gestion des personnes
- Fiches complètes : prénom, nom, nom de naissance, sexe, profession, notes
- Dates flexibles : exacte, « vers », « avant », « après », « entre », inconnue
- Photos de profil avec fallback par initiales
- Suppression logique (soft delete) — réversible

### Familles et unions
- Mariages, civils, PACS, unions libres, concubinage
- Partenaires multiples par union
- Relations parent → enfant : biologique, adoptive, beau-parent
- Support des familles recomposées

### Evenements
- Naissances, décès, mariages, baptêmes, déménagements, etc.
- Types personnalisables
- Dates flexibles et lieux
- Filtrage par type

### Sources et citations
- Références documentaires (actes, archives, ouvrages)
- Citations liées à n'importe quelle entité (personne, union, événement)
- Champs : auteur, date, archive, référence, URL, commentaire

### Medias
- Import local de photos et documents (JPG, PNG, WebP, PDF, etc.)
- Liaison de n'importe quel média à une personne, union ou événement
- Galerie avec aperçu et suppression protégée

### Recherche
- Recherche multi-catégories : personnes, familles, sources, événements
- Filtres et onglets par catégorie avec compteurs
- Texte normalisé (sans accents, insensible à la casse)

### Import / Export
- **GEDCOM 5.5.1** : import et export complet
- Import via sélection de fichier local
- Export avec dialogue de sauvegarde

### Sauvegarde et restauration
- Sauvegarde complète : base de données + médias dans un ZIP
- **Chiffrement optionnel** : AES-128-CBC + HMAC-SHA256
- Mot de passe dérivé via PBKDF2 (100 000 itérations)
- Copie de sécurité automatique avant restauration

### Mode portable
- Fichier `portable` à côté de l'exécutable → données stockées localement
- Idéal pour une **clé USB** : emportez votre arbre partout
- Script de déploiement USB inclus

### Interface
- Thème **clair** et **sombre**
- Sidebar rétractable
- 12+ pages avec navigation latérale
- Composants UI modernes (shadcn/ui)
- Responsive (960px minimum)

---

## Requirements

### Taille de l'application

| Composant | Taille |
|---|---|
| Exécutable Windows (stemma.exe) | ~5 Mo |
| DLLs WebView2 (embarquées) | ~10 Mo |
| **Total installé** | **~15 Mo** |
| Données par projet (SQLite + médias) | Variable (1 Ko → Go selon les photos) |

### Puissance requise

STEMMA est **extrêmement léger**. Pas besoin de machine performante :

| Ressource | Minimum | Recommandé |
|---|---|---|
| **RAM** | 256 Mo | 512 Mo |
| **CPU** | Tout processeur x64 moderne | — |
| **Disque** | 50 Mo pour l'application + espace pour les données | 500 Mo+ avec photos |
| **Ecran** | 960 × 600 | 1280 × 820 ou plus |

> STEMMA utilise SQLite (une seule fichier `.db`) qui est stocké entièrement en RAM pour les opérations fréquentes. Même avec des milliers de personnes, l'application reste réactive.

### Systemes supportes

| OS | Version minimum | Format |
|---|---|---|
| **Windows** | 10 (build 1903) | `.exe` (NSIS) / `.msi` |
| **macOS** | 10.15 (Catalina) | `.dmg` (Intel + Apple Silicon) |
| **Linux** | Ubuntu 22.04 / Debian 12 | `.deb` / `.AppImage` |

> **Windows 7/8** : non supporté (Tauri 2 requiert Windows 10+). Le mode portable peut fonctionner sur USB avec WebView2 pré-installé.

### Dependances systeme (pour le build depuis les sources)

**Windows :**
- [Rust](https://rustup.rs/) (toolchain GNU, pas MSVC)
- Node.js 22+
- WebView2 (installé automatiquement sur Windows 10+)

**macOS :**
- Xcode Command Line Tools (`xcode-select --install`)
- Rust + Node.js 22+
- WebView2 inclus dans macOS

**Linux :**
```bash
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf
```
- Rust + Node.js 22+

---

## Installation

### Telecharger les releases

Rendez-vous sur la page [Releases](../../releases) du dépôt GitHub pour telecharger la version stable pour votre systeme.

### Mode portable (toutes plateformes)

1. Copiez l'exécutable (et les DLLs sur Windows) dans un dossier
2. Créez un fichier vide nommé `portable` (sans extension) dans le même dossier
3. Lancez l'application — les données seront stockées dans `./data/` à côté de l'exécutable

```
MonDossier/
├── stemma.exe          (ou stemma sur macOS/Linux)
├── portable            (fichier vide)
├── data/
│   ├── projects/
│   │   └── mon-projet/
│   │       ├── familytree.db
│   │       └── media/
│   └── backups/
```

### Deploiement USB (Windows)

```powershell
.\deploy-stemma.ps1 -Destination "E:\STEMMA"
```

Ce script copie l'exe, les DLLs, crée le fichier `portable` et un lanceur `.bat`.

---

## Developpement

### Pre-requis

- [Node.js](https://nodejs.org/) v22+
- [Rust](https://rustup.rs/) (toolchain stable)
- Git

### Installation

```bash
# Cloner le depot
git clone https://github.com/ADZirid/stemma.git
cd stemma

# Installer les dependances JS
npm install

# Lancer en mode dev (frontend + backend)
npm run tauri:dev
```

### Commandes disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Frontend Vite seul (hot reload) |
| `npm run tauri:dev` | App complète en mode dev |
| `npm run build` | Build frontend de production |
| `npm run tauri:build` | Build complet (frontend + Rust release) |
| `npm test` | Lancer les tests (29 tests) |
| `npm run lint` | Linter (oxlint) |
| `npm run validate` | Lint + test + build complet |

### CI/CD

Le projet utilise **GitHub Actions** pour les builds automatisés :

- **CI** (`ci.yml`) : lint + tests + build multi-OS à chaque push/PR
- **Release** (`release.yml`) : build + upload des installers sur tag `v*`

Pour créer une release :
```bash
git tag v0.1.0
git push origin v0.1.0
```

---

## Architecture

```
stemma/
├── src/                          # Frontend React/TypeScript
│   ├── components/               # Composants UI
│   │   ├── layout/               # AppShell, sidebar, headers
│   │   ├── media/                # Liaison médias, photo de profil
│   │   ├── person/               # Formulaires personnes, dates
│   │   ├── tree/                 # Nœuds arbre (React Flow)
│   │   └── ui/                   # Composants shadcn (20+)
│   ├── database/                 # Couche d'accès SQLite (via Tauri invoke)
│   │   └── repositories/         # person, union, source, event, media
│   ├── features/                 # Modules métier
│   │   ├── tree/                 # Moteur de relations + layout
│   │   ├── import/               # Parser GEDCOM 5.5.1
│   │   ├── export/               # Export GEDCOM + PDF/PNG
│   │   └── search/               # Recherche multi-catégories
│   ├── lib/                      # Utilitaires (dates, normalisation)
│   ├── pages/                    # 12+ pages
│   ├── stores/                   # État global (Zustand)
│   └── types/                    # Types TypeScript
├── src-tauri/                    # Backend Rust (Tauri 2)
│   ├── src/
│   │   ├── commands.rs           # 25+ commandes Tauri (IPC)
│   │   ├── db.rs                 # Connexions SQLite + migrations
│   │   ├── backup.rs             # Chiffrement AES-128-CBC + ZIP
│   │   ├── lib.rs                # Builder Tauri + plugins
│   │   └── main.rs               # Point d'entrée
│   ├── migrations/
│   │   └── 0001_schema.sql       # Schéma complet (10 tables)
│   └── icons/                    # Icônes multi-plateformes
├── .github/workflows/            # CI/CD GitHub Actions
└── deploy-stemma.ps1             # Script déploiement USB
```

### Base de données (SQLite)

10 tables couvrant l'ensemble du domaine généalogique :

| Table | Description |
|---|---|
| `person` | Individus (prénom, nom, sexe, profession) |
| `date_value` | Dates flexibles (exacte, vers, avant, après, entre) |
| `person_date` | Dates liées aux personnes (naissance, décès) |
| `union_family` | Familles / unions |
| `union_partner` | Participants à une union |
| `union_child` | Enfants rattachés à une union |
| `parent_child` | Liens directs parent → enfant |
| `event` | Événements (naissances, mariages, etc.) |
| `source` | Sources documentaires |
| `citation` | Citations liant sources à entités |
| `media` / `media_link` | Médias et liaisons |
| `person_search` | Index de recherche textuelle |

### Securite

- **Chiffrement des backups** : AES-128-CBC + HMAC-SHA256 (PBKDF2 100k itérations)
- **CSP restrictive** : aucune connexion réseau (`connect-src 'none'`)
- **OS CSPRNG** : `getrandom` (arc4random /dev/urandom / BCryptGenRandom)
- **Paramétrage SQL** : aucune concaténation, protection injection SQL
- **Soft delete** : suppression logique, restauration possible

---

## Stack technique

| Couche | Technologie |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS v4 |
| UI | shadcn/ui, Radix UI, Lucide Icons |
| Arbre | React Flow (@xyflow/react) |
| État | Zustand |
| Backend | Tauri 2, Rust |
| Base de données | SQLite (rusqlite, bundled) |
| Chiffrement | AES-128-CBC, HMAC-SHA256, PBKDF2 |
| Build | Vite 8, Cargo, oxlint |
| Tests | Vitest (frontend), cargo test (Rust) |

---

## Contribution

STEMMA est open-source et accueille les contributions !

1. Fork le dépôt
2. Crée une branche (`git checkout -b feature/ma-feature`)
3. Commit tes changements (`git commit -m 'feat: ajout de...'`)
4. Push (`git push origin feature/ma-feature`)
5. Ouvre une Pull Request

---

## Licence

MIT License — voir [LICENSE](LICENSE) pour les détails.

---

<p align="center">
  Fait avec ❤️ pour la communauté généalogique.
</p>
