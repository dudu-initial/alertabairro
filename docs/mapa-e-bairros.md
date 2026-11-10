# Mapa e nomes de São Paulo

## O que está implementado

O cadastro consulta um catálogo local de **451 nomes únicos**: os **96 distritos administrativos** do IBGE e **355 nomes adicionais** de bairros do OpenStreetMap. Distritos e bairros são identificados separadamente nas sugestões. A base não pretende conter todos os nomes populares da cidade.

Exemplos: `vila mariana` → **Vila Mariana**, `jd. angela` → **Jardim Ângela**, `vl. sonia` → **Vila Sônia**. A busca ignora maiúsculas, acentos e espaços repetidos. Nomes incompletos recebem sugestões; nomes desconhecidos não são convertidos por aproximação. A API também valida e normaliza, independentemente da interface. Ao iniciar o servidor, registros antigos com nomes reconhecidos são padronizados sem apagar ocorrências ou histórico. Nomes antigos desconhecidos são preservados.

O mapa usa **Leaflet 1.9.4**, incluído em `frontend/vendor/leaflet`, e ruas do OpenStreetMap. A aba **Mapa** está na navegação principal. Permite arrastar, aproximar, buscar a posição atual e filtrar por bairro, risco ou alertas ativos. Cada marcador tem cor e letra de risco (B, M, A, C); `!` identifica um alerta ativo. O popup apresenta estado, fonte, confiança e acesso ao detalhe. A lista abaixo oferece os mesmos relatos e inclui aqueles sem coordenadas.

No cadastro, o usuário pode tocar no mapa, mover o mapa com as setas e marcar o centro, usar a localização do dispositivo ou informar coordenadas. O ponto é opcional; latitude e longitude são enviadas juntas e persistidas no SQLite. O centro de um bairro é apenas uma referência para abrir o mapa: **nunca é salvo automaticamente como localização de uma ocorrência**. Coordenadas fornecidas por usuários e dados demonstrativos não são posições verificadas pela equipe.

## Fontes e reprodução da consulta

Coleta em **10/11/2026**, sem chamadas externas durante a validação de um relato:

- [Distritos de São Paulo — IBGE](https://servicodados.ibge.gov.br/api/v1/localidades/municipios/3550308/distritos): snapshot em `backend/catalog/ibge-districts.json`.
- [Lei municipal 11.220/1992](https://legislacao.prefeitura.sp.gov.br/lei-11220-de-20-de-maio-de-1992): referência para as grafias acentuadas **Cangaíba** e **Cidade Líder**. Mantêm-se as grafias atuais **Artur Alvim** e **Mooca** do IBGE; Arthur Alvim é aceito como variante de entrada.
- [OpenStreetMap](https://www.openstreetmap.org/copyright), © OpenStreetMap contributors, **ODbL 1.0**: snapshot de 466 objetos em `backend/catalog/osm-neighborhoods.json`, agrupados por nome. A resposta preserva atribuição e timestamp. Centros de navegação também vêm desse snapshot. A API retorna o link de origem de cada bairro. Correção editorial: `jardim piratininga` → `Jardim Piratininga`.

Consulta executada via GET no [Overpass](https://overpass-api.de/api/interpreter), com parâmetro `data` codificado em URL e User-Agent `AlertaBairro/1.0 (https://github.com/dudu-initial/alertabairro; catalogue import)`:

```overpass
[out:json][timeout:30];
area["boundary"="administrative"]["name"="São Paulo"]["admin_level"="8"]->.city;
nwr["place"~"^(suburb|neighbourhood)$"]["name"](area.city);
out center tags;
```

Os snapshots ficam versionados. Atualizações devem ser revisadas antes de substituí-los. O catálogo derivado de dados OSM mantém a atribuição e licença ODbL; a licença do Leaflet acompanha a biblioteca. Não há dependência de CDN para carregar o código do mapa.

## Limites e privacidade

- As ruas exigem internet. Se os tiles falharem, a interface avisa e mantém a lista. Os tiles não são pré-carregados nem guardados pelo service worker; segue-se a [política de tiles do OpenStreetMap](https://operations.osmfoundation.org/policies/tiles/).
- O provedor de mapas recebe IP e requisições de tiles da região visualizada. Não recebe o token da aplicação ou o conteúdo dos relatos.
- Geolocalização só é solicitada quando o usuário toca no botão. Requer autorização do navegador e HTTPS ou localhost; HTTP pela rede local pode não permitir localização.
- O ponto enviado é visível aos usuários autenticados. Não há rastreamento contínuo. “Perto de mim” apenas centraliza o mapa, mantendo os filtros atuais.
- A validação de coordenadas usa uma caixa de limites da região de São Paulo, não um teste de pertencimento ao polígono municipal ou ao bairro. Cabe ao usuário conferir o ponto e ao agente validar o relato.
- Não há geocodificação de endereços, cálculo de rotas, trânsito ao vivo, áreas de risco medidas ou integração com Waze. A ausência de relatos não garante segurança.
- A base de bairros é uma seleção de dados colaborativos e pode conter lacunas, variantes e nomes repetidos em regiões diferentes. As sugestões distinguem bairro de distrito, mas não certificam limites oficiais de bairros.

## Verificações

Testes Python cobrem busca, padronização, bairros reais, nomes desconhecidos, coordenadas, migração idempotente e persistência via HTTP. Testes Node cobrem os filtros do mapa, coordenadas ausentes, normalização e escape de nomes. O carregamento de recursos estáticos é testado por HTTP.

A interação visual, os gestos de toque, o leitor de tela, a geolocalização real e o carregamento dos tiles no navegador ainda precisam de validação em aparelho. O acesso automatizado ao localhost foi negado anteriormente pelo ambiente; não foi contornado.
