# PRD — Portal WebGIS (funcionalidades do mapa)

Escopo: só o comportamento do WebGIS em si (mapa, camadas, ferramentas).
Não inclui multi-tenant, banco de dados, deploy ou autenticação — isso é
infraestrutura de acesso, tratada separadamente.

## 1. Visão geral

Mapa interativo (Leaflet) com:
- Painel de camadas agrupadas por tema, com carregamento sob demanda.
- Imagens de satélite históricas selecionáveis por período (timeline).
- Busca/filtro por código de fazenda, destacando feições correspondentes.
- Ferramentas de medição (distância e área).
- Painel de detalhes ao clicar em uma feição.

## 2. Painel de camadas

**Estrutura**: camadas organizadas em grupos temáticos, cada grupo com
título e lista de camadas. Grupos usados no projeto original:
1. **Empreendimento** — Usina Principal, ADA (Área Direta Afetada), AID
   (Área de Influência), Usinas Vizinhas.
2. **Ambiental & Conservação** — APP, Reserva Legal, Vegetação Nativa,
   Turfeiras, Unidades de Conservação (UC), Sítios RAMSAR, Áreas
   Importantes de Aves (Birdlife).
3. **Recursos Hídricos** — Corpos d'água, Canais/Hidrografia, Sub-bacias,
   Outorgas Superficiais, Outorgas Subterrâneas.
4. **Socioambiental & Cultural** — Assentamentos Rurais, Áreas
   Quilombolas, Terras Indígenas, Patrimônio Cultural, Sítios
   Arqueológicos.
5. **Solo & Outros** — Erodibilidade do Solo, Limite de Bacia (BAZE).

**Cada camada tem**:
- Nome de exibição (label).
- Ícone de legenda (cor/padrão que reflete o estilo da camada no mapa —
  preenchido, contorno tracejado, círculo para pontos, linha para
  hidrografia, etc.).
- Toggle (switch) de ativar/desativar.
- Flag "ativa por padrão": só as camadas necessárias para o enquadramento
  inicial (Usina Principal, ADA, AID, Usinas Vizinhas) vêm ligadas; o
  restante começa desligado.

**Comportamento ao clicar no toggle**:
- 1ª ativação de uma camada → mostra um spinner de carregamento no item
  enquanto busca os dados; depois desenha no mapa.
- Ativações seguintes → mostrar/esconder é instantâneo (sem rede), porque
  os dados já foram buscados e ficam em cache em memória.
- Se a camada não tiver dados (vazia ou arquivo ausente), o toggle fica
  desabilitado visualmente (opacidade reduzida, sem clique).
- Se der erro ao carregar, mostra um alerta explicando qual camada falhou
  e reabilita o toggle para nova tentativa.

**Por que carregamento sob demanda**: evita baixar/processar todas as
camadas (que somadas chegam a dezenas de MB) no carregamento inicial da
página — só busca o que o usuário realmente for olhar.

## 3. Estilização das camadas

Cada camada tem uma definição de estilo própria, usada tanto no mapa
quanto no ícone de legenda do painel:
- **Polígonos**: cor de contorno, cor de preenchimento, opacidade de
  preenchimento, espessura de linha, e opcionalmente `dashArray` (para
  contornos tracejados, como ADA e UC).
- **Pontos**: renderizados como círculos (`circleMarker`), com raio,
  cor de preenchimento e cor/espessura de contorno (ex: Usinas Vizinhas,
  Outorgas, Patrimônio Cultural, Sítios Arqueológicos).
- **Linhas**: cor e espessura (ex: Hidrografia, BAZE).

Paleta usada no projeto original (referência de cores por camada):
| Camada | Cor |
|---|---|
| Usina Principal / ADA / UC / Quilombolas | `#E31A1C` (vermelho) |
| AID / Corpos d'água / Hidrografia | `#1F78B4` (azul) |
| Usinas Vizinhas / Terras Indígenas | `#FF7F00` (laranja) |
| APP | `#33A02C` (verde) |
| Reserva Legal | `#B2DF8A` (verde claro) |
| Vegetação Nativa | `#1E5618` / preenchimento `#2E8B57` |
| Turfeiras | `#A6611A` (marrom) |
| RAMSAR | `#01665E` (verde-petróleo) |
| Birdlife | `#FDBF6F` (laranja claro) |
| Sub-bacias | `#CAB2D6` (lilás) |
| Outorgas Superficiais | `#00BFFF` (azul claro) |
| Outorgas Subterrâneas | `#8A2BE2` (violeta) |
| Assentamentos Rurais | `#FB9A99` (rosa) |
| Patrimônio Cultural | `#FFD700` (dourado) |
| Sítios Arqueológicos | `#FF4500` (vermelho-alaranjado) |
| Erodibilidade | `#B15928` (marrom escuro) |
| BAZE | `#969696` (cinza) |

## 4. Imagens de satélite (timeline)

Barra inferior com botões de período, um ativo por vez:
- **2026 (Atual)** — Google Satellite (tiles atuais).
- **2021** e **2014** — Esri Wayback (imagens históricas por data
  específica).
- **2008** — composto de duas fontes NASA GIBS (MODIS para zoom baixo,
  Landsat WELD para zoom mais próximo), já que não há uma fonte única de
  alta resolução para esse período.

Comportamento: clicar num botão troca a camada de satélite ativa (remove
a anterior do mapa, adiciona a nova) e marca visualmente o botão
selecionado. Apenas uma camada de satélite fica visível por vez.

**Próximo passo planejado (não implementado)**: série histórica
contínua de 2007 até hoje, com imagens tileadas e cache, carregando
somente a data selecionada — avaliado como melhoria futura, priorizada
depois da estabilização do restante da plataforma.

## 5. Busca por código de fazenda (funcionalidade-chave)

**Campo de busca** no topo do painel de camadas, com botão de buscar e
botão de limpar.

**Lógica de correspondência**: ao buscar um código, o sistema verifica,
em cada feição de cada camada **atualmente ativa no mapa**, se algum dos
campos abaixo contém o código digitado (comparação case-insensitive,
substring — não precisa ser exata):
- `FAZENDA`
- `CHAVE_USIN`
- `CHAVE_AMB`
- `PROPRIEDAD`
- `cod_imovel`

(lista configurável — cada cliente pode ter nomes de campo diferentes
no shapefile/GeoJSON de origem).

**Efeito visual**: feições que combinam com o filtro mantêm a opacidade
normal; as que não combinam ficam quase invisíveis (opacidade bem baixa,
tanto da borda quanto do preenchimento) — destacando visualmente só o
que interessa, sem esconder completamente o contexto ao redor.

**Resultado da busca**:
- Mostra uma mensagem de status: quantas feições foram encontradas.
- Se nada for encontrado, avisa e sugere ativar outras camadas (já que a
  busca só olha camadas que estão ligadas no momento).
- Se encontrar, a câmera do mapa ajusta automaticamente o zoom/posição
  para enquadrar todas as feições encontradas (com uma margem/padding).

**Limpar filtro**: restaura a opacidade original de todas as feições e
limpa o campo e a mensagem de status.

**Importante**: ativar uma nova camada enquanto um filtro já está
aplicado deve aplicar o mesmo filtro automaticamente a essa camada
(não fica "esquecida" fora do filtro).

## 6. Ferramentas de medição

Botões flutuantes sobre o mapa:
- **Medir distância**: clique a clique no mapa vai desenhando uma linha;
  mostra a distância acumulada em tempo real (em metros, ou km se passar
  de 1000m) num tooltip que segue o cursor.
- **Medir área**: clique a clique desenha um polígono; a partir do 3º
  ponto, mostra a área em tempo real (em m², ou hectares + km² se passar
  de 10.000 m²).
- **Limpar medições**: remove todas as linhas/polígonos/pontos de
  medição do mapa.
- Só uma ferramenta de medição fica ativa por vez; ativar uma desativa a
  outra automaticamente.
- O cursor do mapa muda para "crosshair" enquanto uma medição está em
  andamento.

## 7. Detalhes da feição (clique no mapa)

Ao clicar em qualquer feição de qualquer camada ativa:
- Um painel lateral (direita) desliza para dentro mostrando uma tabela
  com todos os atributos da feição (nome do campo → valor), pulando
  campos vazios/nulos ou que comecem com `_`.
- Nomes de campo "crus" do GeoJSON são traduzidos para um rótulo legível
  quando existe um mapeamento conhecido (ex: `area_ha` → "Área (ha)",
  `municipio` → "Município", `tipo_app` → "Tipo de APP" etc.) — campos
  sem mapeamento aparecem com o nome original.
- A feição clicada é destacada no mapa com um contorno/preenchimento
  diferenciado (verde-limão), removendo o destaque anterior se houver.
- Clicar em área vazia do mapa (fora de qualquer feição) fecha o painel
  e remove o destaque.
- Botão de fechar (×) no próprio painel.

## 8. Comportamento geral do mapa

- Zoom inicial automático enquadrando a área de influência do
  empreendimento (AID), assim que as camadas padrão terminam de carregar.
- Botão "centralizar na área de estudo" para voltar a esse enquadramento
  manualmente a qualquer momento.
- Barra de escala no canto inferior esquerdo.
- Renderização das camadas em **Canvas** (não SVG) — decisão de
  performance: evitar a lentidão ao ativar/desativar camadas com muitas
  feições, já que Canvas não precisa criar/destruir um elemento de DOM
  por feição.

## 9. Casos de borda já tratados

- Camada sem arquivo de dados ou com `features: []` → toggle desabilitado
  com aviso visual, sem travar o carregamento das outras camadas.
- Falha de rede ao buscar uma camada → alerta ao usuário, toggle volta a
  desmarcado, outras camadas não são afetadas.
- Múltiplas camadas carregando ao mesmo tempo (ex: no carregamento
  inicial) → todas em paralelo, cada uma com seu próprio spinner.
