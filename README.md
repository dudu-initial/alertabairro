# AlertaBairro

Protótipo web de apoio à comunicação comunitária de ocorrências locais, desenvolvido para o briefing de Engenharia de Software da Global Solution FIAP 2026.2. Moradores registram relatos; agentes verificam evidências, controlam o ciclo de vida da ocorrência e emitem alertas com notificações internas. O painel mostra dados persistidos, risco, origem e confiança de cada registro.

> **Demonstração acadêmica:** ocorrências, usuários e fontes carregados pelo seed são fictícios. O AlertaBairro não é um canal oficial de emergência.

## Tecnologias

- **Interface:** HTML5, CSS3 e JavaScript, com layout mobile-first, navegação por hash e chamadas `fetch` à API.
- **Servidor e API:** Python 3.11 ou superior, biblioteca padrão (`http.server`, `sqlite3` e módulos de segurança).
- **Dados:** SQLite local.
- **Testes:** `unittest`, sem serviço externo obrigatório.
- **Diagramas:** Mermaid e PlantUML editáveis, acompanhados por SVG para leitura na documentação.

## Estrutura

```text
AlertaBairro/
├── backend/             # API HTTP, autenticação, regras, banco e seed
├── frontend/            # SPA, estilos e recursos visuais
├── tests/               # testes das regras e endpoints
├── docs/
│   ├── arquitetura.md   # camadas, fluxos, estados e evolução futura
│   ├── requisitos.md    # requisitos, critérios e rastreabilidade
│   ├── roteiro-video.md # roteiro de até 3 minutos
│   └── diagramas/       # Mermaid, PlantUML e imagens SVG
├── .env.example
└── README.md
```

O arquivo SQLite é criado em `data/` na primeira inicialização e fica fora do controle de versão.

## Pré-requisitos

- Python 3.11 ou superior disponível no terminal (`python --version`).
- Navegador moderno com JavaScript habilitado.
- Nenhum `npm install` ou serviço de banco separado é necessário.

## Instalação e configuração

Abra um terminal **na pasta `AlertaBairro`**. Uma instalação virtual é opcional, pois o projeto usa a biblioteca padrão do Python.

```powershell
Copy-Item .env.example .env
```

Em macOS/Linux, use `cp .env.example .env`. Ajuste o arquivo `.env` conforme necessário:

| Variável | Padrão | Uso |
| --- | --- | --- |
| `ALERTABAIRRO_HOST` | `127.0.0.1` | Endereço de escuta do servidor |
| `ALERTABAIRRO_PORT` | `8000` | Porta HTTP local |
| `ALERTABAIRRO_DB` | `data/alertabairro.sqlite3` | Caminho do banco SQLite, relativo à raiz do projeto ou absoluto |

O `.env` contém somente opções locais. Não publique credenciais próprias ou dados pessoais nesse arquivo.

## Inicialização do banco e dados demonstrativos

```powershell
python -m backend.seed
```

O comando prepara o esquema SQLite e, quando o banco está vazio, insere 3 usuários, 3 fontes identificadas como demonstrativas, 12 ocorrências com histórico de estados, 4 alertas e 12 notificações. Executá-lo de novo preserva os registros existentes. Para voltar ao estado inicial da apresentação, use:

```powershell
python -m backend.seed --reset
```

**Atenção:** `--reset` apaga os registros existentes no banco configurado. A inicialização normal do servidor preserva ocorrências já registradas.

Se o servidor for iniciado antes do comando de seed, ele prepara automaticamente um banco vazio com esses mesmos dados demonstrativos.

## Executar back-end e front-end

```powershell
python -m backend.server
```

Abra [http://127.0.0.1:8000](http://127.0.0.1:8000). O servidor entrega o front-end em `/` e a API em `/api`; não é necessário iniciar dois processos. A verificação de saúde fica em [http://127.0.0.1:8000/api/health](http://127.0.0.1:8000/api/health).

Para interromper, use `Ctrl+C`. Se a porta 8000 já estiver ocupada, altere `ALERTABAIRRO_PORT` no `.env` e abra o endereço correspondente.

## Credenciais locais de demonstração

| Perfil | E-mail | Senha |
| --- | --- | --- |
| Morador | `morador@alertabairro.local` | `Demo@2026` |
| Agente | `agente@alertabairro.local` | `Demo@2026` |
| Gestor | `gestor@alertabairro.local` | `Demo@2026` |

Estas contas servem apenas para execução local. O agente e o gestor podem mudar estados e emitir alertas; o morador registra e acompanha ocorrências. O servidor verifica as permissões mesmo quando um cliente chama a API diretamente.

## Telas e fluxo de demonstração

A interface prioriza o morador no celular. A navegação inferior reúne **Início** (`#inicio`), **Alertas** (`#alertas`), **Registrar** (`#registrar`, formulário em três etapas curtas), **Mapa** (`#mapa`) e **Relatos / Acompanhar** (`#acompanhar`). O menu **Mais** abre **Ocorrências** (`#ocorrencias`), **Mapa** (`#mapa`) e **Origem e confiança** (`#fontes`). Cartões e listas abrem o **Detalhe da ocorrência** (`#detalhe/:id`). Agente e gestor acessam ainda a **Fila de validação** (`#fila`) e **Monitoramento** (`#monitoramento`); **Administração** (`#administracao`) é exclusiva do gestor. São **onze telas navegáveis**, além do login.

O Início apresenta “O que acontece no meu bairro?”, filtro por bairro e alertas ativos. O mapa tem ruas reais do OpenStreetMap, marcadores de risco, filtros e detalhes. O cadastro sugere 451 nomes de bairros/distritos de São Paulo e permite marcar o local da ocorrência. Veja [mapa e bairros](docs/mapa-e-bairros.md). Os estados aparecem para o morador em linguagem simples: `Registrado` como **Recebido**, `Em validação` como **Em análise**, `Alerta emitido` como **Alerta enviado**, `Em monitoramento` como **Em acompanhamento**, `Encerrado` como **Resolvido** e `Descartado` como **Não confirmado**. A API e o banco mantêm os nomes canônicos documentados no diagrama de estados.

1. Entre como **morador**, consulte os alertas do bairro em **Início** e registre um relato nas três etapas de **Registrar**. Abra **Acompanhar** para ver o novo registro como **Recebido**.
2. Entre como **agente**, abra **Fila de validação** e altere o relato para `Em validação` e `Confirmado`. O caminho alternativo permite `Descartado` com justificativa.
3. Emita o alerta de uma ocorrência confirmada. A aplicação cria o alerta e notificações internas.
4. Volte como **morador**, consulte **Alertas** e abra o detalhe para ver origem, risco, confiança e histórico.
5. Como agente ou gestor, avance para `Em monitoramento` e `Encerrado`. Confira o resultado em **Início** e **Acompanhar**.

O ciclo completo e as condições de cada transição estão em [Arquitetura](docs/arquitetura.md). Os requisitos e critérios de aceite estão em [Requisitos](docs/requisitos.md).

## API principal

| Método | Rota | Finalidade |
| --- | --- | --- |
| `POST` | `/api/auth/login` | Autenticação local |
| `GET` | `/api/auth/me` | Dados do usuário autenticado |
| `POST` | `/api/auth/logout` | Encerrar a sessão atual |
| `GET` | `/api/dashboard` | Indicadores e resumo |
| `GET`, `POST` | `/api/occurrences` | Listar e criar ocorrências |
| `GET` | `/api/occurrences/:id` | Detalhe e histórico |
| `POST` | `/api/occurrences/:id/transition` | Validar, descartar, alertar, monitorar ou encerrar |
| `GET` | `/api/alerts` | Alertas emitidos |
| `GET` | `/api/notifications` | Notificações internas do usuário |
| `POST` | `/api/notifications/:id/read` | Marcar aviso como lido |
| `GET` | `/api/sources` | Origens demonstrativas |
| `GET` | `/api/users` | Usuários da demonstração, conforme permissão |
| `GET` | `/api/neighborhoods?q=vila` | Busca pública de nomes reais de São Paulo |
| `GET` | `/api/meta`, `/api/health` | Metadados e saúde da aplicação |

As rotas protegidas usam `Authorization: Bearer <token>`. O corpo de criação e transição é JSON; a transição recebe `to`, `notes` e, para alerta, `message`.

O mapa usa Leaflet 1.9.4 incluído no repositório e tiles do OpenStreetMap. A busca de bairros usa snapshots IBGE/OSM, sem chave de API. Node.js 18+ é necessário apenas para os testes JavaScript. [Fontes, licenças e comportamento do mapa](docs/mapa-e-bairros.md).

## Executar testes

```powershell
python -m unittest discover -s tests -v
node --test tests/*.test.cjs
```

Os testes cobrem validação do registro, pontuações, máquina de estados, permissões, notificações e rotas principais. A integração HTTP usa banco temporário e não altera o arquivo demonstrativo em `data/`.

**Verificação do back-end:** o comando acima foi executado no Windows e os **30 testes Python e 15 testes Node passaram**, incluindo requisições HTTP locais à API e revogação da sessão após logout. Também foram verificadas a inicialização do banco e a carga demonstrativa. A interface reformulada requer revisão visual separada.

## Diagramas e vídeo

- [Diagrama de sequência em Mermaid](docs/diagramas/sequencia.mmd) · [PlantUML](docs/diagramas/sequencia.puml) · [imagem SVG](docs/diagramas/sequencia.svg)
- [Diagrama de estados em Mermaid](docs/diagramas/estados.mmd) · [PlantUML](docs/diagramas/estados.puml) · [imagem SVG](docs/diagramas/estados.svg)
- [Arquitetura em Mermaid](docs/diagramas/arquitetura.mmd) · [imagem SVG](docs/diagramas/arquitetura.svg)
- [Roteiro do vídeo, até 3 minutos](docs/roteiro-video.md)

## Limitações conhecidas

- As fontes institucional e climática são **demonstrativas**; não há ingestão automática de dados externos.
- As notificações são internas à aplicação. Não existe envio por SMS, e-mail ou push.
- A confiança é uma heurística explicável, não uma probabilidade estatística ou certificação oficial.
- O mapa depende de internet para as ruas; posições são informadas pelo usuário ou demonstrativas. Não há geocodificação automática, trânsito ao vivo ou rotas. O catálogo de 451 nomes não inclui todos os nomes populares de bairros. [Fontes e limites](docs/mapa-e-bairros.md).
- A classificação de risco ajuda a priorizar relatos, mas requer análise humana e não substitui avaliação técnica.
- A autenticação e o SQLite atendem ao protótipo local; uma publicação em produção exigiria HTTPS, revisão de sessão, controle de abuso, política de dados e infraestrutura apropriada.

## Capturas de tela

Nenhuma captura da aplicação foi obtida nesta execução. A aprovação de acesso do navegador de pré-visualização ao servidor `localhost` foi rejeitada no ambiente de trabalho; por isso, não foi possível realizar a revisão visual da interface nem registrar imagens do Início e dos fluxos. Os diagramas SVG acima estão disponíveis como imagens da documentação. Para completar essa verificação, execute o servidor localmente, abra a aplicação no navegador e confira desktop, celular e os fluxos de morador, agente e gestor.

## Preparação para GitHub

O repositório inclui `.gitignore` para banco local, ambiente e arquivos temporários. A pasta `.github/workflows/` contém a rotina de testes automatizados. Antes de publicar, confira se `.env` e o arquivo SQLite não foram adicionados ao commit.

## Aplicativo no celular (PWA)

A interface tem cinco atalhos principais: Início, Alertas, Mapa, Registrar e Relatos (Acompanhar). O registro ocorre em três etapas. O manifesto, os ícones e o service worker permitem instalação em navegadores compatíveis quando servido por HTTPS (ou localhost no desenvolvimento). O botão de instalação aparece quando o navegador oferece essa opção. No iPhone, use Compartilhar → Adicionar à Tela de Início.

Para testar a interface em outro aparelho na mesma rede, configure `ALERTABAIRRO_HOST=0.0.0.0` e abra `http://IP-DO-COMPUTADOR:8000` no celular. O computador precisa continuar ligado e a rede/firewall deve permitir a conexão. HTTP pela rede local serve para testar a interface; a instalação PWA requer hospedagem HTTPS. O repositório GitHub contém o código, não hospeda a API Python.

Somente os arquivos públicos da interface são armazenados no cache. Login, registros e alertas dependem de conexão com a API; não há envio offline. A instalação em Android/iOS ainda precisa ser validada em um aparelho real. Não foi gerado APK nem pacote da App Store. Referência: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable

## Cadastro de moradores

Na tela de login, escolha **Criar minha conta**. Informe nome, e-mail e uma senha de 8 a 128 caracteres e confirme a senha. Após o cadastro, entre com suas credenciais. `POST /api/auth/register` persiste o usuário com senha PBKDF2; e-mails duplicados são rejeitados. O cadastro público cria somente moradores. Não há confirmação de e-mail nem recuperação de senha nesta versão.

## Identidade visual e acessibilidade

A revisão visual usa sinalização azul/amarela, texto maior, títulos de ocorrências sem corte e navegação inferior em celulares e tablets. Confira as decisões e os limites de verificação em [Design para celular](docs/design-mobile.md).

## Câmera com inteligência artificial

Na primeira etapa de **Registrar**, use **Abrir câmera com IA** ou **Tirar ou escolher foto**. A câmera analisa a cena e preenche automaticamente o tipo e uma descrição inicial ao identificar uma categoria. Exemplo: uma casa em chamas é classificada como **Incêndio**. Confira o texto e toque em **Continuar**; a detecção não exige escolher a categoria. Escolhas e descrições manuais já preenchidas são preservadas. A foto é analisada no aparelho. Apenas metadados da sugestão confirmada são salvos com o relato, sem imagem.

A implementação usa **CLIP q8 + Transformers.js em um Web Worker**, com sugestões experimentais de alagamento, incêndio, deslizamento e árvore caída. Não usa YOLO nesta versão. Não publica alertas automaticamente e pode responder que não conseguiu identificar. São necessários cerca de **180 MB no primeiro uso**; prefira Wi-Fi. Câmera ao vivo requer **HTTPS ou localhost**; em HTTP pelo IP do computador, use foto ou formulário manual.

O modelo real foi executado em Node/CPU com quatro fotos: identificou incêndio em uma casa e alagamento em uma rua; não classificou uma chama de fogão nem um animal como ocorrência. A comparação com fogo controlado foi acrescentada após detectar um falso positivo no teste de fogão. Isso não mede precisão e não valida câmera/WASM no celular. Para reproduzir a inferência (Node 20+):

```powershell
npm ci
npm run test:vision
```

Os arquivos grandes baixados pelo teste ficam em `.cache/`, ignorada pelo Git. `npm ci` não é necessário para rodar a API Python ou abrir a aplicação. [Funcionamento, arquitetura, fontes, testes e limites da IA](docs/ia-camera.md).
