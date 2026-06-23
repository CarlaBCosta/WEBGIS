# Reprocessa os .geojson exportados do QGIS para um cliente e publica a
# atualizacao no link do GitHub Pages.
# Uso: clique duas vezes em atualizar.bat, ou rode:
#   powershell -ExecutionPolicy Bypass -File atualizar.ps1 [id-do-cliente]

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

Write-Host "=== Atualizar camadas - Portal WebGIS ===" -ForegroundColor Cyan

$clienteId = $args[0]
if ([string]::IsNullOrWhiteSpace($clienteId)) {
    Write-Host ""
    Write-Host "Clientes existentes:"
    Get-ChildItem "clientes" -Directory | Where-Object { $_.Name -ne '_template' } | ForEach-Object { Write-Host "  - $($_.Name)" }
    Write-Host ""
    $clienteId = Read-Host "Para qual cliente voce exportou novos dados do QGIS?"
}

if (-not (Test-Path "clientes\$clienteId")) {
    Write-Host "Cliente 'clientes\$clienteId' nao encontrado. Rode novo-cliente.ps1 primeiro se for um cliente novo." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Reprocessando dados de '$clienteId'..." -ForegroundColor Yellow
node preprocess.js $clienteId
if ($LASTEXITCODE -ne 0) {
    Write-Host "Preprocessamento falhou - nada foi publicado. Corrija o erro acima e rode novamente." -ForegroundColor Red
    exit 1
}

git add "clientes\$clienteId\data"
$temMudanca = git status --porcelain "clientes\$clienteId\data"
if ([string]::IsNullOrWhiteSpace($temMudanca)) {
    Write-Host "Nenhuma mudanca nos dados desse cliente - nada para publicar." -ForegroundColor Yellow
    exit 0
}

$dataHora = Get-Date -Format "yyyy-MM-dd HH:mm"
git commit -m "Atualiza camadas: $clienteId ($dataHora)"
git push

Write-Host ""
Write-Host "Publicado! O link atualiza em ~1 minuto:" -ForegroundColor Green
Write-Host "  https://carlabcosta.github.io/WEBGIS/clientes/$clienteId/" -ForegroundColor Cyan
