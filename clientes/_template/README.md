# Como criar um novo cliente

Normalmente você não precisa fazer isso manualmente: rode `novo-cliente.ps1`
na raiz do repositório (ou dê duplo-clique em `novo-cliente.bat`), informe o
nome do cliente, e ele copia esta pasta `_template/` automaticamente.

Se preferir fazer manualmente:

1. Copie esta pasta `_template/` para `clientes/<id-do-cliente>/`.
2. Edite `config.js`: `clientId`, `clientName`, `mapCenter`, `mapZoom`,
   `zoomToLayerOnLoad`, `defaultActiveLayers` e a lista `layerGroups` (ajuste
   para as camadas que esse cliente realmente tem).
3. Coloque os arquivos de dados exportados do QGIS em `data/`, no formato
   `<id>.js` contendo `window.geojsonData_<id> = {...};` (gerados
   automaticamente por `node preprocess.js <id-do-cliente>` a partir dos
   GeoJSON exportados do QGIS — veja `atualizar.ps1` na raiz).
4. Acesse `clientes/<id-do-cliente>/index.html` para testar localmente, depois
   `git add`, `commit` e `push` (ou use `atualizar.ps1`) para publicar.

A URL pública do cliente fica:
`https://carlabcosta.github.io/WEBGIS/clientes/<id-do-cliente>/`
