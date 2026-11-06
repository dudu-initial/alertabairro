# AlertaBairro

Protótipo web de apoio à comunicação comunitária de ocorrências locais, desenvolvido para o briefing de Engenharia de Software da Global Solution FIAP 2026.2. Moradores registram relatos; agentes verificam evidências, controlam o ciclo de vida da ocorrência e emitem alertas com notificações internas. O painel mostra dados persistidos, risco, origem e confiança de cada registro.

> **Demonstração acadêmica:** ocorrências, usuários e fontes carregados pelo seed são fictícios. O AlertaBairro não é um canal oficial de emergência.

## Tecnologias

- **Interface:** HTML5, CSS3 e JavaScript, com navegação por hash e chamadas `fetch` à API.
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

A navegação dá acesso a **dez telas**: Dashboard, Mapa, Ocorrências, Registrar ocorrência, Detalhe da ocorrência (a partir das listas), Fila de validação, Alertas, Monitoramento, Fontes e confiança e Administração. O login é exibido no início da sessão.

1. Entre como **morador**, abra **Registrar ocorrência** e salve um relato. O detalhe mostra o estado `Registrado`, risco, origem e confiança.
2. Entre como **agente**, abra **Fila de validação** e altere o relato para `Em validação` e `Confirmado`. O caminho alternativo permite `Descartado` com justificativa.
3. Emita o alerta de uma ocorrência confirmada. A aplicação cria o alerta e notificações internas.
4. Consulte **Alertas** e o detalhe; depois avance para `Em monitoramento` e `Encerrado`.
5. Volte ao **Dashboard** para ver os indicadores atualizados a partir da API.

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
| `GET` | `/api/meta`, `/api/health` | Metadados e saúde da aplicação |

As rotas protegidas usam `Authorization: Bearer <token>`. O corpo de criação e transição é JSON; a transição recebe `to`, `notes` e, para alerta, `message`.

## Executar testes

```powershell
python -m unittest discover -s tests -v
```

Os testes cobrem validação do registro, pontuações, máquina de estados, permissões, notificações e rotas principais. A integração HTTP usa banco temporário e não altera o arquivo demonstrativo em `data/`.

**Verificação desta entrega:** o comando acima foi executado no Windows e os **16 testes passaram**, incluindo requisições HTTP locais à API e revogação da sessão após logout. Também foram verificadas a inicialização do banco e a carga demonstrativa. A execução automatizada não substitui a revisão visual das telas.

## Diagramas e vídeo

- [Diagrama de sequência em Mermaid](docs/diagramas/sequencia.mmd) · [PlantUML](docs/diagramas/sequencia.puml) · [imagem SVG](docs/diagramas/sequencia.svg)
- [Diagrama de estados em Mermaid](docs/diagramas/estados.mmd) · [PlantUML](docs/diagramas/estados.puml) · [imagem SVG](docs/diagramas/estados.svg)
- [Arquitetura em Mermaid](docs/diagramas/arquitetura.mmd) · [imagem SVG](docs/diagramas/arquitetura.svg)
- [Roteiro do vídeo, até 3 minutos](docs/roteiro-video.md)

## Limitações conhecidas

- As fontes institucional e climática são **demonstrativas**; não há ingestão automática de dados externos.
- As notificações são internas à aplicação. Não existe envio por SMS, e-mail ou push.
- A confiança é uma heurística explicável, não uma probabilidade estatística ou certificação oficial.
- O mapa é esquemático; os pontos não constituem cartografia nem geocodificação precisa.
- A classificação de risco ajuda a priorizar relatos, mas requer análise humana e não substitui avaliação técnica.
- A autenticação e o SQLite atendem ao protótipo local; uma publicação em produção exigiria HTTPS, revisão de sessão, controle de abuso, política de dados e infraestrutura apropriada.

## Capturas de tela

Nenhuma captura da aplicação foi obtida nesta execução. A aprovação de acesso do navegador de pré-visualização ao servidor `localhost` foi rejeitada no ambiente de trabalho; por isso, não foi possível realizar a revisão visual da interface nem registrar imagens do dashboard e dos fluxos. Os diagramas SVG acima estão disponíveis como imagens da documentação. Para completar essa verificação, execute o servidor localmente, abra a aplicação no navegador e confira desktop, celular e os fluxos de morador, agente e gestor.

## Preparação para GitHub

O repositório inclui `.gitignore` para banco local, ambiente e arquivos temporários. A pasta `.github/workflows/` contém a rotina de testes automatizados. Antes de publicar, confira se `.env` e o arquivo SQLite não foram adicionados ao commit.
