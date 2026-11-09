# Requisitos do AlertaBairro

## Contexto e objetivo

O AlertaBairro é um protótipo de apoio à resposta comunitária a ocorrências locais. Moradores registram fatos observados; agentes analisam a informação, atribuem um estado verificável e emitem alertas internos quando há evidência suficiente. A interface expõe origem, pontuação de confiança e classificação de risco para que a informação circule com contexto.

O sistema **não substitui** serviços de emergência, órgãos de defesa civil ou canais oficiais. Os dados demonstrativos foram criados para avaliação acadêmica.

## Perfis

| Perfil | Necessidade principal | Permissões previstas |
| --- | --- | --- |
| Morador | Entender o que ocorre no bairro, informar um fato e acompanhar a resposta | Consultar Início, Alertas, Acompanhar e páginas secundárias; registrar; ler notificações próprias |
| Agente | Avaliar relatos e orientar a resposta | Consultar Fila de validação; validar ou descartar; emitir alerta e acompanhar estados |
| Gestor | Supervisionar os indicadores e a operação | Acesso à Administração e às transições de agente |

## Requisitos funcionais

| ID | Requisito | Critério de aceite |
| --- | --- | --- |
| RF01 | Autenticar usuários locais de demonstração | Credenciais válidas retornam sessão; credenciais inválidas são rejeitadas |
| RF02 | Exibir Início com dados da aplicação | Alertas ativos, indicadores e ocorrências usam a API e refletem uma ocorrência recém-criada; o morador pode filtrar por bairro |
| RF03 | Permitir navegação por todas as telas | Navegação inferior acessa quatro destinos principais do morador; Mais abre páginas secundárias; cartões levam ao detalhe; área da equipe é acessível ao perfil correspondente |
| RF04 | Registrar ocorrência comunitária | Formulário móvel em três etapas curtas valida dados obrigatórios e persiste um registro no banco |
| RF05 | Listar, acompanhar e detalhar ocorrências | Estado, tipo, bairro, risco, origem, confiança e histórico ficam visíveis; Acompanhar dá acesso aos relatos do morador |
| RF06 | Classificar risco | Uma regra reproduzível produz pontuação e nível de risco para cada ocorrência |
| RF07 | Calcular confiança | Uma regra reproduzível produz pontuação de confiança e indica a fonte |
| RF08 | Controlar o ciclo de estados | Somente transições permitidas são aceitas; o histórico registra cada mudança |
| RF09 | Restringir validação e alerta por perfil | Morador não consegue validar, descartar nem emitir alerta pela API |
| RF10 | Emitir alerta interno | A transição para `Alerta emitido` cria um alerta e notificações persistidas |
| RF11 | Consultar notificações internas | O usuário vê suas notificações e pode marcá-las como lidas |
| RF12 | Exibir fontes e confiança | A interface explica as origens e mostra pontuações junto às ocorrências |
| RF13 | Disponibilizar dados demonstrativos | Um comando prepara usuários e ocorrências locais para a apresentação |
| RF14 | Exibir o andamento em linguagem simples | A interface do morador traduz os estados técnicos sem mudar os valores persistidos pela API |

## Requisitos não funcionais

| ID | Requisito | Verificação proposta |
| --- | --- | --- |
| RNF01 | Interface mobile-first, responsiva e consistente | Inspecionar barra inferior, formulário em três etapas, cartões, menu Mais e área da equipe em celular e desktop |
| RNF02 | Persistência local | Reiniciar o processo e confirmar que registros permanecem no SQLite |
| RNF03 | Controle de acesso no servidor | Repetir ações protegidas com perfis diferentes e sem token |
| RNF04 | Proteção básica de dados | Não expor senha em texto claro; não incluir segredos no repositório |
| RNF05 | Rastreabilidade | Registrar autor, data, estado anterior, novo estado e observação de transição |
| RNF06 | Testabilidade | Executar testes automáticos das regras, permissões e rotas principais |
| RNF07 | Execução simples | Iniciar a aplicação com Python 3, sem serviços externos obrigatórios |

## Regras de negócio

1. Uma ocorrência é criada em `Registrado`; a análise começa em `Em validação`.
2. A confirmação exige uma decisão feita por agente ou gestor. O protótipo não verifica automaticamente a suficiência das evidências. O descarte exige justificativa de pelo menos 8 caracteres.
3. A emissão de alerta parte de `Confirmado`, exige mensagem de 20 a 500 caracteres e cria notificações internas; um alerta não nasce de um relato ainda não confirmado.
4. O monitoramento parte de `Alerta emitido`; o encerramento parte de `Em monitoramento`.
5. `Descartado` e `Encerrado` são estados terminais no protótipo. Uma correção posterior exigiria uma nova regra de reabertura e auditoria.
6. A pontuação de risco representa prioridade operacional do protótipo, não um parecer técnico oficial.
7. A pontuação de confiança representa força das evidências disponíveis, não certeza absoluta.

## Histórias de usuário e cenários

### HU01 — Registro comunitário

Como morador, quero informar tipo, localização, gravidade e descrição de um evento em poucas etapas para que o agente tenha dados suficientes para triagem.

**Dado** um usuário autenticado, **quando** completar as três etapas curtas de Registrar com campos válidos, **então** o sistema salva a ocorrência em `Registrado` e permite acompanhá-la como **Recebido**. Campos inválidos recebem erro sem criar registro.

### HU02 — Validação

Como agente, quero iniciar a validação, confirmar ou descartar um relato com observação para que o público entenda o resultado da análise.

**Dado** um relato `Registrado`, **quando** iniciar análise, **então** ele passa para `Em validação`. **Dado** um relato em validação, **quando** confirmar, **então** ele passa para `Confirmado`; quando descartar com justificativa, passa para `Descartado`.

### HU03 — Alerta e monitoramento

Como agente, quero emitir um alerta de ocorrência confirmada para avisar moradores e acompanhar a evolução.

**Dado** um relato `Confirmado`, **quando** emitir alerta, **então** o estado vira `Alerta emitido`, há registro de alerta e notificações internas. O agente pode passar a `Em monitoramento` e, ao fim, `Encerrado`.

### HU04 — Transparência

Como morador, quero abrir um alerta ou uma ocorrência e ver a origem, o nível de risco, a confiança e o histórico para entender por que um relato merece atenção.

**Dado** uma ocorrência listada, **quando** abrir o detalhe, **então** a interface apresenta esses atributos e as mudanças de estado disponíveis na API.

### HU05 — Visão do bairro

Como morador, quero filtrar o Início por bairro e acessar rapidamente Alertas e Acompanhar para localizar informações relevantes na tela do celular.

**Dado** um usuário autenticado, **quando** escolher um bairro, **então** a visão inicial usa os dados da aplicação para apresentar os registros correspondentes. A barra inferior mantém Início, Alertas, Registrar e Acompanhar acessíveis.

## Matriz de rastreabilidade

| Área navegável | Requisitos principais |
| --- | --- |
| Início (`#inicio`) | RF02, RF05, RF06, RF07 |
| Alertas (`#alertas`) | RF10, RF11 |
| Registrar (`#registrar`) | RF04 |
| Acompanhar (`#acompanhar`) | RF05, RF14 |
| Ocorrências (`#ocorrencias`) | RF05, RF06, RF07 |
| Mapa (`#mapa`) | RF03, RF05 |
| Origem e confiança (`#fontes`) | RF07, RF12 |
| Detalhe (`#detalhe/:id`) | RF05, RF08, RF12, RF14 |
| Fila de validação (`#fila`) | RF08, RF09 |
| Monitoramento (`#monitoramento`) | RF08, RF10 |
| Administração (`#administracao`) | RF01, RF09, RF13 |

## Escopo de demonstração

O fluxo de avaliação recomendado começa em **Início** no celular: filtrar o bairro, abrir um alerta, registrar ocorrência em três etapas e vê-la em **Acompanhar** como **Recebido**. Depois, entrar como agente, iniciar validação na **Fila**, confirmar, emitir alerta e consultar a notificação no perfil do morador. Por fim, iniciar monitoramento e encerrar. O caminho alternativo mostra um segundo relato descartado com justificativa, exibido ao morador como **Não confirmado**.
