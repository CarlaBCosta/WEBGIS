# Cria a estrutura de um novo cliente a partir de clientes/_template,
# preenche o config.js e publica no GitHub Pages.
# Uso: clique duas vezes em novo-cliente.bat, ou rode:
#   powershell -ExecutionPolicy Bypass -File novo-cliente.ps1

$ErrorActionPreference = 'Stop'
Set-Location -Path $PSScriptRoot

function Remove-Acentos($texto) {
    $normalized = $texto.Normalize([System.Text.NormalizationForm]::FormD)
    $sb = New-Object System.Text.StringBuilder
    foreach ($c in $normalized.ToCharArray()) {
        $cat = [System.Globalization.CharUnicodeInfo]::GetUnicodeCategory($c)
        if ($cat -ne [System.Globalization.UnicodeCategory]::NonSpacingMark) {
            [void]$sb.Append($c)
        }
    }
    return $sb.ToString().Normalize([System.Text.NormalizationForm]::FormC)
}

Write-Host "=== Novo cliente - Portal WebGIS ===" -ForegroundColor Cyan
$nomeCliente = Read-Host "Nome do cliente (ex: Usina Sao Jose)"
if ([string]::IsNullOrWhiteSpace($nomeCliente)) {
    Write-Host "Nome nao pode ser vazio." -ForegroundColor Red
    exit 1
}

$clienteId = (Remove-Acentos $nomeCliente).ToLower() -replace '[^a-z0-9]+', '-'
$clienteId = $clienteId.Trim('-')

$destino = "clientes\$clienteId"
if (Test-Path $destino) {
    Write-Host "Ja existe um cliente em '$destino'. Escolha outro nome ou edite-o diretamente." -ForegroundColor Red
    exit 1
}

Write-Host "Criando pasta: $destino"
Copy-Item -Path "clientes\_template" -Destination $destino -Recurse
Remove-Item "$destino\README.md" -ErrorAction SilentlyContinue
New-Item -ItemType File -Path "$destino\data\.gitkeep" -Force | Out-Null

$configPath = "$destino\config.js"
(Get-Content $configPath -Raw) `
    -replace "clientId: 'NOME_DO_CLIENTE_AQUI'", "clientId: '$clienteId'" `
    -replace "clientName: 'Nome do Cliente Aqui'", "clientName: '$nomeCliente'" `
    | Set-Content $configPath -Encoding UTF8

Write-Host ""
Write-Host "Cliente '$clienteId' criado em $destino" -ForegroundColor Green
Write-Host "Edite '$destino\config.js' (centro do mapa, camadas) antes de publicar." -ForegroundColor Yellow
Write-Host ""
Write-Host "Pasta para exportar os .geojson do QGIS deste cliente:" -ForegroundColor Yellow
Write-Host "  C:\Users\carla.dalpian\OneDrive - sigmagis.com.br\Documentos\Claude\Projects\8_WEBPORTAL\GEOJSON\$clienteId\"
Write-Host ""

$publicar = Read-Host "Publicar agora no GitHub Pages? (S/n)"
if ($publicar -eq '' -or $publicar -match '^[sS]') {
    git add $destino
    git commit -m "Adiciona novo cliente: $nomeCliente"
    git push
    Write-Host ""
    Write-Host "Publicado! Link do cliente (disponivel em ~1 min):" -ForegroundColor Green
    Write-Host "  https://carlabcosta.github.io/WEBGIS/clientes/$clienteId/" -ForegroundColor Cyan
} else {
    Write-Host "OK, nao publicado. Rode 'git add $destino; git commit; git push' quando estiver pronta." -ForegroundColor Yellow
}
