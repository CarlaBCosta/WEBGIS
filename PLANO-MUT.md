# Plano — Visão MUT (Mudança do Uso do Solo)

Documento de planejamento, escrito antes da execução. Objetivo: substituir a
prancha estática do QGIS (figura 3: duas imagens lado a lado + legenda de uso do
solo + gráfico temporal) por uma visão interativa dentro do Portal WebGIS, com
timelapse navegável no estilo Google Earth Timelapse (figura 2).

---

## 1. O que a visão MUT entrega

Quando o usuário liga a **Visão MUT** no portal:

| Elemento da prancha (figura 3) | Como fica no portal |
| --- | --- |
| Polígonos de uso do solo | Camada MUT no mapa, com dois modos de cor (botão para alternar): **Elegibilidade** (verde/vermelho) e **Uso do Solo** (cores das classes) |
| Passar o olho no talhão | **Tooltip no hover** com os mesmos dados do popup — sem precisar clicar |
| Quadro "MUT 2008 / Fazenda / Código / Área / Safra" | **Cabeçalho da fazenda** no painel lateral |
| Legenda "Uso do solo — 60,78 ha / 232,92 ha..." | **Legenda com área por classe** da fazenda selecionada, somando os talhões |
| Gráfico "Análise Temporal — Índice de Vegetação" | **Gráfico EVI** por classe de uso, calculado no Earth Engine |
| Duas imagens (2007 Landsat 5 × atual Sentinel-2) | **Comparador antes/depois** com cortina deslizante sobre o mapa |
| — (não existe na prancha) | **Barra de anos** sobre o mapa, com play, zoom e navegação (figura 2) |

A visão MUT **só aparece para clientes que têm uma camada MUT cadastrada**, e a
barra de anos **só roda dentro dessa visão** — nas outras camadas o mapa segue
com o satélite atual, como hoje.

---

## 2. Como os dados chegam

Segue o fluxo que já existe: você exporta do QGIS em GeoJSON e sobe pelo painel
administrativo (ZIP ou arquivo solto). Nada muda no seu trabalho no QGIS, exceto
a padronização dos campos.

Campos encontrados no arquivo de teste (`teste-mut/FAZENDA_410123.geojson`):

```
CHAVE_AMB  410123_2        chave fazenda_talhão
FAZENDA    410123          código da fazenda
TALHAO     2               número do talhão
AREA       4.72            hectares
ELEG       ELEGÍVEL        elegibilidade (também aparece INELEGÍVEL)
```

Falta o campo da **classe de uso do solo**. O portal vai detectar o campo
automaticamente (procurando `USO`, `CLASSE`, `USO_SOLO`, `COBERTURA`) e mostrar
no admin qual encontrou, para você confirmar ou trocar — mesma mecânica que já
uso hoje para achar o campo de código das fazendas no timelapse.

Elegibilidade por talhão, resumida na fazenda: a fazenda recebe um selo
**Elegível** (todos os talhões), **Parcialmente elegível** ou **Inelegível**, com
o total em hectares e o percentual.

---

## 3. Banco de dados (migration `0009_mut.sql`)

Tudo configurável por cliente, sem mexer em código — igual ao resto do portal.

| Tabela | Para quê |
| --- | --- |
| `mut_config` | Um registro por cliente: camada MUT, campos (código, talhão, área, elegibilidade, uso), quais valores contam como elegível, safra, ano inicial do timelapse, ligada/desligada |
| `mut_classes` | Catálogo das classes de uso com nome e cor. Vem semeado com as 9 classes da prancha e é editável numa tela do admin, como o modelo de divisões |
| `mut_tiles` | Endereço das imagens anuais do Earth Engine: cliente, ano, sensor, URL, validade. Preenchida pelo robô |
| `mut_ndvi` | Série do índice de vegetação por fazenda e classe, em JSON. Preenchida pelo robô |

Leitura pública (chave publicável) só do que o portal precisa; escrita apenas
com a chave secreta, como nas outras tabelas.

---

## 4. Painel administrativo

1. **Card "Visão MUT"** na página do cliente: escolher a camada MUT, conferir os
   campos detectados, informar safra e ano inicial, ligar/desligar a visão.
2. **Botões de processamento**: "Gerar imagens anuais" e "Calcular índice de
   vegetação" — enfileiram trabalho para o robô, com a mesma barra de progresso,
   cancelamento e reenvio que o timelapse já tem hoje.
3. **Tela "Classes de uso do solo"**: editar nome e cor de cada classe
   (padrão = cores da prancha), válida para todos os clientes, com exceções por
   cliente quando precisar.

---

## 5. Portal — a visão MUT

- **Botão "Visão MUT"** no painel de camadas (só aparece se o cliente tiver).
- **Modo de cor** com dois botões: *Elegibilidade* e *Uso do Solo*.
  - Elegibilidade: verde para elegível, vermelho para inelegível.
  - Uso do Solo: preenchimento pela cor da classe e contorno verde/vermelho pela
    elegibilidade — as duas leituras ao mesmo tempo, como na prancha.
- **Hover**: tooltip que acompanha o mouse com fazenda, talhão, área, uso e
  elegibilidade; o talhão realça enquanto o mouse está em cima. O clique continua
  abrindo o painel completo.
- **Painel da fazenda** (a prancha digital): cabeçalho (fazenda, código, área
  total, safra, coordenadas), legenda com hectares por classe, gráfico do índice
  de vegetação e os botões de vídeo em alta resolução que o robô já gera.
- **Barra de anos** no rodapé do mapa: lista de anos, play/pause, avançar e
  voltar, controle de velocidade. Troca o fundo do mapa pela imagem daquele ano,
  com zoom e navegação livres — é a figura 2 aplicada à área do cliente.
- **Comparador antes/depois**: cortina deslizante comparando o ano inicial
  (2007, por padrão) com o ano atual.

---

## 6. Robô (Python, Earth Engine)

O robô já roda autenticado no Earth Engine e já conversa com o Supabase. Ganha
dois trabalhos novos, reaproveitando a fila, o heartbeat e a recuperação de
órfãos que já existem:

1. **Imagens anuais** — para cada ano, monta a composição mediana da estação
   seca (mesma receita dos vídeos), recorta na área do cliente, pede o endereço
   de exibição ao Earth Engine e grava em `mut_tiles`. Landsat até 2016,
   Sentinel-2 de 2017 em diante (10 m). Esses endereços expiram, então o robô os
   renova sozinho todo dia; se um ano ficar indisponível, o portal avisa no lugar
   de quebrar.
2. **Índice de vegetação** — para cada fazenda, calcula a série mensal de EVI
   separada por classe de uso e grava em `mut_ndvi`. É o gráfico do rodapé da
   prancha.

As imagens ficam hospedadas no Google, não no Supabase: **não consomem o
armazenamento do plano** e não perdem resolução.

---

## 7. Entrega em três fases

| Fase | O que entra | O que você consegue testar |
| --- | --- | --- |
| **1. Mapa MUT** | Migration, card do admin, tela de classes, visão MUT no portal com os dois modos de cor, hover, painel da fazenda com cabeçalho e legenda por classe | Abrir o TESTE MUT e navegar pelos 238 talhões com verde/vermelho e dados no hover |
| **2. Timelapse** | Robô gerando as imagens anuais, barra de anos no mapa, comparador antes/depois | Rodar a linha do tempo igual à figura 2 e comparar 2007 com hoje |
| **3. Gráfico** | Robô calculando o EVI por classe, gráfico no painel da fazenda | A prancha inteira substituída na tela |

Cada fase é testada no navegador antes de eu te chamar, como combinado.

---

## 8. Riscos e limites

- **Validade dos endereços do Earth Engine**: expiram em poucos dias. Mitigado
  pela renovação diária do robô; se o robô ficar desligado muito tempo, a barra
  de anos avisa que precisa atualizar.
- **Primeiro carregamento de cada ano** é mais lento (o Google calcula a imagem
  na hora); depois fica em cache e responde rápido.
- **Plano B**, se o Earth Engine não liberar as imagens para o portal: a barra de
  anos passa a usar os vídeos por fazenda que o robô já gera, perdendo o zoom
  livre mas mantendo a leitura ano a ano.
- **Nuvem**: anos com muita nuvem na estação seca podem sair manchados; é o mesmo
  comportamento dos vídeos atuais.

---

## 9. Decisões tomadas (16/10/2026)

1. **Elegibilidade** já vem pronta no GeoJSON (campo `ELEG`, valores
   `ELEGÍVEL` / `INELEGÍVEL`).
2. **Cor**: botão para alternar entre *Elegibilidade* e *Uso do Solo*.
3. **Safra e nome da fazenda**: ficam no cadastro do cliente, não no GeoJSON.
4. **Timelapse**: 2007 até hoje, barra de anos no mapa + vídeo por fazenda.
5. **Gráfico**: os dados virão de um Excel que a Carla vai enviar — o gráfico
   sai do escopo até o arquivo chegar.
6. **Campo de uso do solo**: a Carla vai enviar um GeoJSON MUT com o uso
   classificado; até lá o campo fica em branco e a visão mostra só a
   elegibilidade.

## 10. Onde parou (19/10/2026)

**Fase 1 completa, com os três arquivos reais do ATVOS UMV ISCC 2026.**

O projeto sai do QGIS em duas camadas que se completam, e o portal usa as duas:

| Arquivo | O que é | Para que serve na tela |
| --- | --- | --- |
| `MUT_2008_UMV_ISCC_2026` | 3.201 talhões, com a classe de uso de 2008 | cor por uso do solo, hover e contagem de talhões |
| `ATLAS_UMV_ISCC_2026` | 116 fazendas (uma feição cada) | elegibilidade, nome, período, coordenadas, área e áreas por classe |
| `10imag_Indices_Vegetacao...csv` | 24.628 medições de NDVI e EVI | o gráfico do rodapé da prancha |

As duas camadas se ligam pelo código da fazenda (`CODIGO` ↔ `CHAVE_AMB`): os 116
códigos batem um a um.

**Como ficou no portal** (`/cliente/atvos-umv-iscc-2026`):

- A visão abre em **Elegibilidade**: 28 fazendas verdes e 88 vermelhas, com o
  contorno de cada fazenda do Atlas desenhado por cima do satélite.
- O botão **Uso do Solo** troca o preenchimento para a classe de 2008 e mantém o
  contorno da elegibilidade — as duas leituras ao mesmo tempo.
- **Hover**: nome da fazenda, código, talhão, área, classe e o selo
  elegível/inelegível.
- **Painel da fazenda**: nome, código, município/estado, área total, talhões,
  período (01/09/2025 a 31/08/2026), coordenadas de consulta, selo, hectares
  elegíveis e inelegíveis, áreas por classe e o gráfico EVI/NDVI de 2007 a 2026.
- **Busca por código** acha os talhões da visão MUT e o realce sobrevive à troca
  de modo de cor.

**Conferências feitas contra o arquivo** (tudo no navegador):

- 410082 — FAZENDA BABILONIA, LD: RIO GRANDE: elegível, 513,99 ha, Lavoura de
  Grãos 513,99 ha.
- 410816 — FAZENDA BABILÔNIA II: inelegível, 297,55 ha em 17 talhões, Pastagem
  Plantada 276,76 ha + Vegetação Nativa 20,79 ha (fecha com o `AREA` do Atlas).

As áreas por classe saem das colunas do Atlas (`PLANT08`, `LAV08`, `VEG08`...),
que somam exatamente a área da fazenda. Qual coluna é de qual classe fica na
tela "Classes de uso do solo" — nada disso está escrito no código.

## 11. Próximos passos

1. **Fase 2 — timelapse**: imagens anuais 2007→hoje no robô, barra de anos no
   mapa e comparador antes/depois.
2. Conferir na tela "Classes de uso do solo" as cores e as colunas do Atlas das
   classes usadas nos projetos.
3. Repetir o cadastro para os próximos projetos: enviar as duas camadas e o CSV,
   apontar os campos no card e pronto — sem código novo.
