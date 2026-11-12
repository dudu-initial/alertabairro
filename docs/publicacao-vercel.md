# Publicação gratuita na Vercel

Estado: adaptação implementada e contrato HTTP verificado localmente. Deploy real
e integração PostgreSQL ainda dependem das contas e da configuração do banco.

## Arquitetura

- Vercel executa app.py (Flask/WSGI), reutilizando a API existente.
- O build copia frontend/ para public/, servido pela CDN, incluindo o WASM.
- DATABASE_URL aponta para PostgreSQL persistente (por exemplo, Supabase).
- Sem DATABASE_URL na Vercel, a API retorna 503. Não existe fallback para SQLite
  temporário. A execução local com python -m backend.server mantém SQLite.
- As tabelas Supabase têm RLS ativado sem políticas públicas. Somente a API,
  conectada como proprietária do banco, pode acessá-las.

## Configuração

1. Crie um projeto no plano gratuito do Supabase.
2. Copie a conexão PostgreSQL do Transaction Pooler (porta 6543), usando o
   usuário e host apresentados no painel. Inclua sslmode=require. A senha
   precisa estar codificada como componente de URL. Não a publique no GitHub.
3. Guarde essa conexão em DATABASE_URL, variável secreta no painel da Vercel,
   para Production. Não use prefixos públicos como VITE_ ou NEXT_PUBLIC_.
4. Para inicializar durante o build da Vercel, adicione também
   ALERTABAIRRO_INIT_DB=1 em Production. O build cria as tabelas e a carga
   demonstrativa no banco dedicado, sem apagar registros existentes.
   Após a primeira publicação validada, essa variável pode ser removida.
   Como alternativa, em um terminal com DATABASE_URL configurada, execute:

   ```powershell
   python -m pip install -r requirements.txt
   python -m scripts.init_cloud
   ```

   O comando cria o esquema e dados demonstrativos somente se não houver
   usuários. Ele não importa os registros do computador e não apaga dados.
   Não configure banco de produção nos testes: os testes locais usam SQLite
   temporário. A validação real com PostgreSQL deve preceder a entrega.
5. Na Vercel, importe dudu-initial/alertabairro. Root Directory: raiz do
   repositório. Framework: Flask. vercel.json fornece o comando de build.
6. Faça o deploy e verifique /api/health, cadastro, login, registro, validação,
   emissão de alerta, notificações e persistência depois de um novo deploy.
7. Teste o HTTPS no celular, permissões de câmera e primeiro download do modelo.

As contas Demo@2026 são destinadas à apresentação acadêmica: agente e gestor
podem alterar e excluir ocorrências. Use dados fictícios na demonstração pública.
O uso público real requer substituir as credenciais e remover os atalhos demo.

## Verificações já executadas

61 testes Python passaram localmente, incluindo 19 testes HTTP repetidos na
entrada WSGI e testes de configuração. Isso não comprova conexão com Supabase
nem execução na Vercel. O teste PostgreSQL real e o deploy permanecem pendentes.

## Referências

- https://vercel.com/docs/frameworks/backend/flask
- https://vercel.com/docs/functions/runtimes/python
- https://supabase.com/docs/guides/database/connecting-to-postgres
