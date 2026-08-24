<p align="center">
  <img src="src-tauri/icons/icon.png" width="120" alt="STEMMA logo">
</p>

<h1 align="center">STEMMA</h1>

<p align="center">
  <em>A 100% local, open-source genealogy application</em>
</p>

<p align="center">
  <a href="#features">Features</a> &bull;
  <a href="#why-stemma">Why STEMMA</a> &bull;
  <a href="#installation">Installation</a> &bull;
  <a href="#requirements">Requirements</a> &bull;
  <a href="#development">Development</a> &bull;
  <a href="#contributing">Contributing</a> &bull;
  <a href="#license">License</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue" alt="Platforms">
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License">
  <img src="https://img.shields.io/badge/version-0.1.0-orange" alt="Version">
</p>

---

## About

STEMMA is a desktop genealogy application built with [Tauri](https://tauri.app). Your data never leaves your machine — no cloud sync, no accounts, no telemetry.

## Why STEMMA

Most genealogy tools require online accounts, store your data on remote servers, or share information with third parties. STEMMA was built for users who want **full ownership** of their family tree.

| | Online tools | STEMMA |
|---|---|---|
| **Data storage** | Remote servers | Your computer only |
| **Internet required** | Yes | Never |
| **Account required** | Yes | No |
| **Privacy** | Depends on provider | 100% guaranteed |
| **Portability** | No | USB drive supported |
| **Cost** | Often paid | Free & open-source |

## Features

### Family Tree
- **Descendant** (ancestors &rarr; descendants) and **ascendant** (children &rarr; ancestors) views
- Automatic layout with React Flow
- Interactive nodes with profile photos and quick info

### People
- Full profiles: first name, last name, birth name, sex, profession, notes
- Flexible dates: exact, circa, before, after, between, unknown
- Profile photos with initials fallback
- Soft delete &mdash; reversible

### Families & Unions
- Marriages, civil unions, PACS, common-law partnerships
- Multiple partners per union
- Parent &rarr; child relationships: biological, adoptive, stepparent
- Blended family support

### Events
- Births, deaths, marriages, baptisms, moves, and more
- Custom event types
- Flexible dates and places
- Filter by type

### Sources & Citations
- Document references (records, archives, books)
- Citations linked to any entity (person, union, event)
- Fields: author, date, archive, reference, URL, comments

### Media
- Local import of photos and documents (JPG, PNG, WebP, PDF, etc.)
- Link any media to a person, union, or event
- Gallery with preview and protected deletion

### Search
- Multi-category search: people, families, sources, events
- Tabbed filters with counters
- Normalized text (accent-insensitive, case-insensitive)

### Import / Export
- **GEDCOM 5.5.1**: full import and export
- Local file selection
- Save dialog for exports

### Backup & Restore
- Full backup: database + media in a ZIP
- **Optional encryption**: AES-128-CBC + HMAC-SHA256
- Password derived via PBKDF2 (100,000 iterations)
- Automatic safety backup before restore

### Portable Mode
- Place a `portable` file next to the executable &rarr; data stored locally
- Ideal for **USB drives**: carry your tree everywhere
- USB deployment script included

### Interface
- **Light** and **dark** themes
- Collapsible sidebar
- 12+ pages with side navigation
- Modern UI components (shadcn/ui)
- Responsive (960px minimum)

## Installation

### Download Releases

Go to the [Releases](../../releases) page to download the latest stable build for your platform.

| Platform | Format |
|---|---|
| Windows 10+ | `.exe` (NSIS) / `.msi` |
| macOS 10.15+ | `.dmg` (Intel & Apple Silicon) |
| Linux (Ubuntu 22.04 / Debian 12) | `.deb` / `.AppImage` |

### Portable Mode (All Platforms)

1. Copy the executable (and DLLs on Windows) to a folder
2. Create an empty file named `portable` (no extension) in the same folder
3. Launch the app &mdash; data is stored in `./data/` next to the executable

```
STEMMA/
├── stemma.exe          (or stemma on macOS/Linux)
├── portable            (empty file)
├── data/
│   ├── projects/
│   │   └── my-project/
│   │       ├── familytree.db
│   │       └── media/
│   └── backups/
```

### USB Deployment (Windows)

```powershell
.\deploy-stemma.ps1 -Destination "E:\STEMMA"
```

Copies the executable, DLLs, creates the `portable` file and a `.bat` launcher.

## Requirements

### Disk Space

| Component | Size |
|---|---|
| Windows executable | ~5 MB |
| Bundled WebView2 DLLs | ~10 MB |
| **Total installed** | **~15 MB** |
| Data per project (SQLite + media) | Variable (KB to GB depending on photos) |

### Hardware

STEMMA is extremely lightweight:

| Resource | Minimum | Recommended |
|---|---|---|
| **RAM** | 256 MB | 512 MB |
| **CPU** | Any modern x64 processor | &mdash; |
| **Disk** | 50 MB for app + space for data | 500 MB+ with photos |
| **Display** | 960 &times; 600 | 1280 &times; 820 or higher |

> STEMMA uses SQLite (a single `.db` file) cached in memory for frequent operations. The app stays responsive even with thousands of records.

### Supported Systems

| OS | Minimum Version | Package Format |
|---|---|---|
| **Windows** | 10 (build 1903) | `.exe` / `.msi` |
| **macOS** | 10.15 (Catalina) | `.dmg` |
| **Linux** | Ubuntu 22.04 / Debian 12 | `.deb` / `.AppImage` |

> **Windows 7/8** is not supported (Tauri 2 requires Windows 10+). Portable mode may work on USB with WebView2 pre-installed.

## Development

### Prerequisites

- [Node.js](https://nodejs.org/) v22+
- [Rust](https://rustup.rs/) (stable toolchain)
- Git

### Platform-Specific Dependencies

<details>
<summary><strong>Windows</strong></summary>

- [Rust](https://rustup.rs/) (GNU toolchain, not MSVC)
- Node.js 22+
- WebView2 (auto-installed on Windows 10+)
</details>

<details>
<summary><strong>macOS</strong></summary>

- Xcode Command Line Tools: `xcode-select --install`
- Rust + Node.js 22+
</details>

<details>
<summary><strong>Linux</strong></summary>

```bash
sudo apt-get install -y \
  libwebkit2gtk-4.1-dev \
  libgtk-3-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf
```
- Rust + Node.js 22+
</details>

### Getting Started

```bash
git clone https://github.com/ADZirid/STEMMA.git
cd STEMMA
npm install
npm run tauri:dev
```

### Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Frontend only (Vite hot reload) |
| `npm run tauri:dev` | Full app in dev mode |
| `npm run build` | Production frontend build |
| `npm run tauri:build` | Full release build (frontend + Rust) |
| `npm test` | Run tests (29 tests) |
| `npm run lint` | Lint with oxlint |
| `npm run validate` | Lint + test + build |

### CI/CD

GitHub Actions automates builds across platforms:

- **CI** (`ci.yml`): lint, tests, and build on every push/PR
- **Release** (`release.yml`): build and upload installers on `v*` tags

To create a release:
```bash
git tag v0.1.0
git push origin v0.1.0
```

## Architecture

```
STEMMA/
├── src/                          # Frontend (React / TypeScript)
│   ├── components/               # UI components
│   │   ├── layout/               # AppShell, sidebar, page headers
│   │   ├── media/                # Media linking, profile photos
│   │   ├── person/               # Person forms, date fields
│   │   ├── tree/                 # Tree nodes (React Flow)
│   │   └── ui/                   # shadcn components (20+)
│   ├── database/                 # Data access layer (Tauri IPC)
│   │   └── repositories/         # person, union, source, event, media
│   ├── features/                 # Business logic
│   │   ├── tree/                 # Relation engine + layout
│   │   ├── import/               # GEDCOM 5.5.1 parser
│   │   ├── export/               # GEDCOM + PDF/PNG export
│   │   └── search/               # Multi-category search
│   ├── lib/                      # Utilities (dates, normalization)
│   ├── pages/                    # 12+ application pages
│   ├── stores/                   # Global state (Zustand)
│   └── types/                    # TypeScript types
├── src-tauri/                    # Backend (Rust / Tauri 2)
│   ├── src/
│   │   ├── commands.rs           # 25+ Tauri IPC commands
│   │   ├── db.rs                 # SQLite connections + migrations
│   │   ├── backup.rs             # AES-128-CBC encryption + ZIP
│   │   ├── lib.rs                # Tauri builder + plugins
│   │   └── main.rs               # Entry point
│   ├── migrations/
│   │   └── 0001_schema.sql       # Full schema (10 tables)
│   └── icons/                    # Cross-platform icons
├── .github/workflows/            # CI/CD (GitHub Actions)
└── deploy-stemma.ps1             # USB deployment script
```

### Database Schema (SQLite)

| Table | Description |
|---|---|
| `person` | Individuals (name, sex, profession) |
| `date_value` | Flexible dates (exact, circa, before, after, between) |
| `person_date` | Dates linked to persons (birth, death) |
| `union_family` | Families / unions |
| `union_partner` | Participants in a union |
| `union_child` | Children linked to a union |
| `parent_child` | Direct parent &rarr; child links |
| `event` | Events (births, marriages, etc.) |
| `source` | Document sources |
| `citation` | Citations linking sources to entities |
| `media` / `media_link` | Media files and associations |
| `person_search` | Full-text search index |

### Security

- **Backup encryption**: AES-128-CBC + HMAC-SHA256 (PBKDF2, 100k iterations)
- **Restrictive CSP**: no network connections (`connect-src 'none'`)
- **OS CSPRNG**: `getrandom` (arc4random /dev/urandom / BCryptGenRandom)
- **Parameterized SQL**: no string concatenation, SQL injection protection
- **Soft delete**: logical deletion, reversible

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript, Tailwind CSS v4 |
| UI | shadcn/ui, Radix UI, Lucide Icons |
| Tree visualization | React Flow (@xyflow/react) |
| State management | Zustand |
| Backend | Tauri 2, Rust |
| Database | SQLite (rusqlite, bundled) |
| Encryption | AES-128-CBC, HMAC-SHA256, PBKDF2 |
| Build | Vite 8, Cargo, oxlint |
| Testing | Vitest (frontend), cargo test (Rust) |

## Contributing

Contributions are welcome!

1. Fork the repository
2. Create a branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m 'feat: add feature'`)
4. Push (`git push origin feature/my-feature`)
5. Open a Pull Request

## License

[MIT License](LICENSE)

---

<p align="center">
  Built with care for the genealogy community.
</p>
