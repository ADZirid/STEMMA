<# 
  STEMMA — Déploiement portable sur clé USB
  Usage : .\deploy-stemma.ps1 -Destination "E:\STEMMA"
  
  Ce script :
  1. Copie l'exe + DLLs vers la clé USB
  2. Crée le fichier "portable" (active le mode portable)
  3. Crée un lanceur .bat pour le PC cible
  4. Optionnel : copie les données existantes depuis le PC local
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Destination,
    
    [switch]$IncludeData
)

$ErrorActionPreference = "Stop"
$ExeDir = "C:\Users\adamm\STEMMA"
$SrcExe = "C:\familytree-local\src-tauri\target\release\stemma.exe"
$DllDir = "C:\familytree-local\src-tauri\target\release"

Write-Host "=== STEMMA — Déploiement portable ===" -ForegroundColor Cyan

# 1. Vérifier que l'exe existe
if (!(Test-Path $SrcExe)) {
    Write-Host "ERREUR : stemma.exe introuvable dans $DllDir" -ForegroundColor Red
    exit 1
}

# 2. Créer la structure sur la clé USB
Write-Host "`n[1/4] Création de la structure..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path $Destination -Force | Out-Null
New-Item -ItemType Directory -Path "$Destination\data" -Force | Out-Null

# 3. Copier l'exe et les DLLs
Write-Host "[2/4] Copie des fichiers..." -ForegroundColor Yellow
Copy-Item $SrcExe "$Destination\stemma.exe" -Force
Copy-Item "$DllDir\WebView2Loader.dll" "$Destination\" -Force -ErrorAction SilentlyContinue
Copy-Item "$DllDir\libgcc_s_seh-1.dll" "$Destination\" -Force -ErrorAction SilentlyContinue
Copy-Item "$DllDir\libwinpthread-1.dll" "$Destination\" -Force -ErrorAction SilentlyContinue
Write-Host "  -> stemma.exe + DLLs copiés" -ForegroundColor Green

# 4. Créer le fichier "portable" (active le mode portable)
Write-Host "[3/4] Activation du mode portable..." -ForegroundColor Yellow
"" | Out-File -FilePath "$Destination\portable" -Encoding utf8
Write-Host "  -> Fichier 'portable' créé" -ForegroundColor Green

# 5. Créer le lanceur .bat
Write-Host "[4/4] Création du lanceur..." -ForegroundColor Yellow
$batContent = @"
@echo off
title STEMMA
echo Demarrage de STEMMA...
start "" "%~dp0stemma.exe"
"@
$batContent | Out-File -FilePath "$Destination\STEMMA.bat" -Encoding ascii
Write-Host "  -> STEMMA.bat créé" -ForegroundColor Green

# 6. Optionnel : copier les données existantes
if ($IncludeData) {
    $AppDataDir = "$env:APPDATA\com.stemma.app"
    if (Test-Path $AppDataDir) {
        Write-Host "`n[ Bonus ] Copie des données existantes..." -ForegroundColor Yellow
        Copy-Item "$AppDataDir\*" "$Destination\data\" -Recurse -Force
        Write-Host "  -> Données copiées depuis $AppDataDir" -ForegroundColor Green
    } else {
        Write-Host "`n  Aucune donnée existante trouvée." -ForegroundColor DarkGray
    }
}

# 7. Résumé
Write-Host "`n=== Déploiement terminé ===" -ForegroundColor Cyan
Write-Host "Contenu de $Destination :" -ForegroundColor White
Get-ChildItem $Destination | Format-Table Name, Length, LastWriteTime -AutoSize

Write-Host "`nPour utiliser STEMMA sur un autre PC :" -ForegroundColor Yellow
Write-Host "  1. Brancher la clé USB" -ForegroundColor White
Write-Host "  2. Ouvrir le dossier STEMMA" -ForegroundColor White
Write-Host "  3. Double-cliquer sur STEMMA.bat" -ForegroundColor White
Write-Host "  (ou directement stemma.exe)" -ForegroundColor DarkGray
Write-Host "`nNote : le PC cible doit avoir WebView2 installé." -ForegroundColor DarkGray
Write-Host "  (déjà présent sur Windows 10/11)" -ForegroundColor DarkGray
