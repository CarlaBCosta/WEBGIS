# Timelapse anual de satélite por fazenda

Gera, para cada fazenda, um vídeo com um quadro por ano (2007 → ano mais recente) em
**GIF e MP4**, com o ano escrito em cada quadro e o contorno da fazenda em amarelo.
Usa o **Google Earth Engine** e a biblioteca **geemap**.

## 1. Instalação (uma vez)

1. Instale o Python 3.12: `winget install --exact --id Python.Python.3.12 --scope user`
2. Crie o ambiente **fora do OneDrive**, em `%USERPROFILE%\.venvs\timelapse`. O caminho
   desta pasta no OneDrive é longo demais para o Windows (limite de 260 caracteres) e
   a instalação do geemap falha dentro dele; fora do OneDrive, os milhares de arquivos
   das bibliotecas também não ficam sincronizando.

   ```powershell
   & "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe" -m venv "$env:USERPROFILE\.venvs\timelapse"
   & "$env:USERPROFILE\.venvs\timelapse\Scripts\python.exe" -m pip install -r requirements.txt
   ```

Nos exemplos abaixo, `python` significa o Python desse ambiente:
`& "$env:USERPROFILE\.venvs\timelapse\Scripts\python.exe"`.
O ffmpeg vem embutido no pacote `imageio-ffmpeg` — não precisa instalar à parte.

## 2. Autenticação do Earth Engine (uma vez)

1. Tenha um projeto no Google Cloud com a **Earth Engine API** habilitada e registrado
   em <https://code.earthengine.google.com/register>.
2. Autentique a máquina (abre o navegador):

   ```powershell
   & "$env:USERPROFILE\.venvs\timelapse\Scripts\earthengine.exe" authenticate
   ```

3. Anote o ID do projeto e passe em `--projeto`, ou defina de uma vez:

   ```powershell
   $env:EE_PROJECT = "seu-projeto"
   ```

> **Licença:** uso comercial do Earth Engine exige licença paga. Confirme o
> enquadramento da empresa antes de rodar em produção.

Sem autenticação, o script imprime as instruções e encerra com uma mensagem dizendo o
que falta (credencial, projeto, API habilitada ou permissão).

## 3. Uso

O arquivo de entrada deve estar em **EPSG:4326**. A camada ADA processada já está:
`webgis_portal/processed/cliente-demo/Area_Diretamente_Afetada_teste.geojson`
(os arquivos brutos da pasta `GEOJSON/` estão em UTM 22S e são recusados).

```powershell
# Uma fazenda, série longa Landsat
python timelapse_fazenda.py --geojson ..\..\processed\cliente-demo\Area_Diretamente_Afetada_teste.geojson --codigo 2502 --projeto seu-projeto

# Mais detalhe (Sentinel-2, 10 m) — período menor, a partir de 2017
python timelapse_fazenda.py --geojson ...ADA.geojson --codigo 2502 --detalhe

# Lote: teste com 3 fazendas, depois todas
python timelapse_fazenda.py --geojson ...ADA.geojson --todas --limite 3
python timelapse_fazenda.py --geojson ...ADA.geojson --todas
```

Saídas em `saida/<codigo>/timelapse_<codigo>_<sensor>_<inicio>-<fim>.gif|.mp4`.
No modo `--todas`, fazendas já prontas são puladas (use `--sobrescrever` para refazer)
e uma falha não interrompe o lote. Se o lote for interrompido, basta rodar o mesmo
comando de novo: ele continua de onde parou.

O `relatorio_lote.csv` recebe uma linha por fazenda **assim que ela termina**, com data
e hora; rodadas de retomada se acumulam no mesmo arquivo, sem apagar as anteriores.

**Lote completo recomendado** (fora do OneDrive, só MP4 — cerca de 2 a 4 MB por fazenda):

```powershell
python timelapse_fazenda.py --geojson ...ADA.geojson --todas --projeto gis-esg --saida C:\timelapse_saida --somente-mp4
```

Referência medida: 15 a 21 s por fazenda com Landsat 2007–2025 (613 fazendas ≈ 3 h).

| Parâmetro | Padrão | O que faz |
|---|---|---|
| `--campo` | `FAZENDA` | campo com o código da fazenda |
| `--sensor` / `--detalhe` | `landsat` | `sentinel2` para 10 m (desde 2017) |
| `--inicio` / `--fim` | 2007 / automático | intervalo de anos |
| `--meses` | `5-9` | janela da composição anual (estação seca) |
| `--margem-m` | 300 | entorno mostrado ao redor da fazenda |
| `--dimensao` | 768 | lado maior do vídeo, em pixels |
| `--fps` | 2 | anos por segundo |
| `--saida` | `saida` | pasta dos vídeos — use fora do OneDrive no lote |
| `--somente-mp4` | desligado | grava só o MP4, apagando o GIF intermediário |
| `--limite` | — | no lote, processa só as N primeiras (para testes) |

## Robô de timelapse (automático, pelo painel admin)

Em vez de rodar o script à mão, o painel pede os vídeos e um robô gera em segundo plano:

1. **Pedido**: no *Novo cliente*, a opção "Gerar timelapses das fazendas" (já marcada)
   cria o pedido logo após o envio das camadas. Na página do cliente, o card
   **Timelapses das fazendas** permite pedir de novo, acompanhar a barra de progresso,
   ver se o robô está online e cancelar.
2. **Fila**: o pedido fica na tabela `timelapse_jobs` do Supabase (migration 0005).
3. **Robô** (`robo_timelapse.py`): a cada 30 s pega o pedido mais antigo, baixa a camada
   de fazendas do Storage, gera um MP4 por fazenda em
   `C:\timelapse_saida\<cliente>\<codigo>\` e registra cada resultado em
   `timelapse_videos`. Fazendas com vídeo pronto são puladas.

**Robustez**: tenta de novo até 3 vezes quando o Google falha de forma passageira
(ex.: HTTP 503); se o computador desligar no meio, o pedido volta para a fila após
3 min sem sinal e continua de onde parou; só um robô roda por máquina.

**Liga sozinho**: a tarefa **"Robo Timelapse AMBIUM"** do Agendador de Tarefas do
Windows abre o `INICIAR-ROBO-TIMELAPSE.bat` (pasta `8_WEBPORTAL`) 1 minuto após o
logon, numa janela minimizada. Registro de atividade: `C:\timelapse_saida\robo.log`.

```powershell
Start-ScheduledTask -TaskName "Robo Timelapse AMBIUM"      # ligar agora
Disable-ScheduledTask -TaskName "Robo Timelapse AMBIUM"    # parar de ligar no logon
Unregister-ScheduledTask -TaskName "Robo Timelapse AMBIUM" # remover a tarefa
```

Para desligar o robô em execução, feche a janela "Robo Timelapse AMBIUM".

**Publicação no portal**: ainda não acontece — o armazenamento dos vídeos não foi
escolhido. Quando for, basta implementar a função `publicar()` do robô, que grava a
URL em `timelapse_videos.url`.

## Como cada quadro é montado

- **Landsat** (padrão): Landsat 5, 7, 8 e 9 — Collection 2, Level-2 (reflectância de
  superfície), com máscara de nuvem, sombra e neve pelo `QA_PIXEL`.
- **Sentinel-2** (`--detalhe`): `S2_SR_HARMONIZED` com máscara **Cloud Score+**.
- **Composição anual por mediana** dos pixels limpos da janela de meses: robusta a
  resíduos de nuvem e não "esconde" a colheita como o método de melhor pixel faria.
- **Ano final automático**: o último ano cuja janela de meses já terminou.

## Limitações conhecidas

- **2012 aparece com listras** (rótulo `2012*`): o Landsat 5 parou em nov/2011 e o
  Landsat 8 só começou em abr/2013; nesse ano só havia o Landsat 7, com a falha de
  SLC que deixa faixas sem dados.
- Pequena diferença de cor entre os sensores antigos (TM/ETM+) e os novos (OLI), sem
  harmonização — é um produto visual.
- **Sentinel-2 a partir de 2017**: o satélite opera desde 2015, mas a coleção de
  superfície no Earth Engine só tem cobertura consistente desde 2017.
- Anos com poucas cenas na janela geram aviso no console e no relatório.

## Conferir na documentação oficial

**Já conferido nas versões instaladas** (earthengine-api 1.7.43, geemap 0.38.5):
`geemap.add_text_to_gif` com os parâmetros usados (`xy`, `text_sequence`, `font_type`,
`font_size`, `font_color`, `add_progress_bar`, `progress_bar_color`,
`progress_bar_height`, `duration`, `loop`); `ee.ImageCollection.linkCollection`;
`ee.ImageCollection.getVideoThumbURL`; `ee.Initialize(project=...)`; ffmpeg embutido.

**Ainda a conferir** (valores de dados, não assinaturas — só confirmáveis com login):

1. Landsat Collection 2 Level-2 — bits do `QA_PIXEL` e fator de escala das bandas `SR_B*`.
2. `COPERNICUS/S2_SR_HARMONIZED` — data de início efetiva da cobertura na região.
3. `GOOGLE/CLOUD_SCORE_PLUS/V1/S2_HARMONIZED` — banda `cs_cdf` e limiar recomendado.
4. `getVideoThumbURL` — limite de tamanho da requisição para fazendas muito grandes.
