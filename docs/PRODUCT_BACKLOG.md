# 30studio — plano de produto e backlog

Este plano transforma a visão de `PRODUCT_SPEC.md` em telas, atividades sequenciadas e critérios verificáveis. É um plano de implementação, não uma promessa de prazo. Cada entrega deve incluir persistência via Drizzle ORM, autorização do tenant, estados de interface, localização PT/EN e evidência de aceite compatível com o ambiente disponível.

## Regras de produto e desenvolvimento

- O tenant é a organização ativa validada no servidor. Toda leitura, gravação, busca e job usa o escopo da organização e, quando aplicável, da marca.
- Os textos da interface são sempre chaves de `messages/pt.json` e `messages/en.json`, consumidas por `next-intl`. Não escrever labels ou mensagens visíveis diretamente em componentes.
- Código e estrutura técnica — incluindo nomes de pastas e arquivos, variáveis, funções, tipos, comentários, testes e configurações — são escritos em inglês. Textos da interface vêm somente dos catálogos i18n.
- PostgreSQL é a fonte de verdade; operações de dados passam por Drizzle ORM e repositórios tipados.
- IA prepara sugestões e conteúdo. Somente pessoas autorizadas aprovam; publicação revalida no backend a aprovação da versão exata.
- 30studio contém o produto e seus fluxos. Não adicionar n8n ou Postiz como dependências operacionais.
- Cada tela deve ter estados de carregamento, vazio, erro, sucesso e dados parciais/stale quando isso se aplicar. Nunca preencher o produto com métricas fictícias.
- Toda tabela de dados deve oferecer filtro, cabeçalho clicável para ordenar cada coluna e seletor da quantidade de itens por página; estados e rótulos devem ser acessíveis e localizados.

## Estado atual

| Área | Estado | Limite conhecido |
|---|---|---|
| Next.js, TypeScript, Tailwind v4, tema e identidade 30studio | Implementado no scaffold | Revisão visual automatizada ainda não foi comprovada neste ambiente. |
| Better Auth, sessão, organizações e membros no schema Drizzle | Implementado | SMTP transacional integrado; o provedor e as credenciais ainda precisam ser configurados no ambiente de deploy. |
| Troca/criação de workspace e interface PT/EN | Implementado | Shell com Visão geral, Marcas e Equipe; as duas primeiras áreas são funcionais. |
| Criar/listar marcas com escopo de tenant | Implementado | Depende de PostgreSQL configurado para uso real. |
| Editar/arquivar marca | Integrado em `develop` | Lint, TypeScript, build, migração Drizzle, 5 testes unitários e 2 testes de integração passaram em PostgreSQL descartável. As rotas exercitam sessão Better Auth, tenant ativo, associação atual, papel e isolamento por organização. |
| Equipe: membros, papéis, convites e auditoria | Implementado nesta entrega | Convites exigem SMTP e e-mail verificado; teste de integração cobre criação, reenvio, cancelamento, aceite e trilha auditável. |
| Brand Kit | Versões e primeira implementação da biblioteca de imagens | Snapshots imutáveis, URLs de fonte, upload privado por adaptador S3, verificação de hash/dimensões, revisão humana, direitos de uso e links de leitura temporários. Chaves temporárias são isoladas dos objetos finais. LocalStack validou upload, replay e limpeza de objeto. O comando diário remove uploads abandonados após 24 horas em lotes de até 100; falta agendar/monitorar no deploy. Configuração de bucket/IAM/CORS/backup, importação de templates editáveis e checagem automática de fontes seguem pendentes. |
| Campanhas, agenda e editor editorial | Em implementação em `feature/editorial-calendar` | Campanha multimarca por tenant com briefing-base e uma publicação por rede selecionada; cada publicação possui dia/horário independentes. Grade/lista PT/EN, filtros, versões de copy e snapshot de Brand Kit aprovado. Migrations aditivas e testes PostgreSQL escritos; ainda aguardam aplicação/execução em banco local. |
| OAuth social, campanhas/editor, revisão, aprovação, publicação e analytics | Planejado | A agenda guarda ideias básicas por marca/canal. As versões editáveis, campanhas, aprovação e publicação ainda não têm fluxo funcional nesta branch. |

## Mapa de telas

| ID | Tela/área | Objetivo e ações principais | Dados centrais |
|---|---|---|---|
| S01 | Entrar e criar conta | Entrar, criar conta, verificar e-mail, recuperar acesso e trocar idioma. | User, Session, Verification |
| S02 | Criar e trocar workspace | Criar organização, escolher tenant ativo e entender seu papel no espaço. | Organization, Member, Invitation |
| S03 | Visão geral | Mostrar pendências, calendário da semana, falhas de conexão e resumo real de desempenho; atalhos contextuais. | Content, Approval, PublicationJob, MetricSnapshot |
| S04 | Portfólio de marcas | Buscar, filtrar, criar, editar, arquivar e abrir uma marca; mostrar canais e atividade disponíveis. | Brand, SocialProfile |
| S05 | Visão geral da marca | Exibir configuração, identidade, estado dos canais, itens recentes e atalhos dentro do escopo da marca. | Brand, BrandKitVersion, SocialProfile, ContentItem |
| S06 | Brand Kit | Importar arquivos, organizar logos, cores, tipografia, público, tom, fatos aprovados, claims, CTAs e templates; comparar e aprovar versões. | BrandKit, BrandKitVersion, MediaAsset, VerifiedClaim |
| S07 | Canais sociais | Conectar, reconectar e revogar perfis; mostrar conta, permissões, capacidades e saúde sem expor tokens. | SocialProfile, OAuthCredential, ConnectorCapability |
| S08 | Calendário editorial | Alternar calendário/lista, filtrar e abrir itens; alterar horário gera nova versão e invalida aprovação anterior. | Campaign, ContentItem, ContentVersion |
| S09 | Campanhas e ideias | Definir objetivo, público, mensagem, datas, marcas/canais e organizar ideias em trabalho. | Campaign, ContentItem |
| S10 | Editor de conteúdo | Escrever briefing e variantes por canal; ver preview, restrições, mídia, texto alternativo, idioma e horário. Acionar sugestões de IA sem publicar. | ContentItem, ContentVersion, BrandKitVersion |
| S11 | Caixa de aprovação | Revisar copy, mídia, fontes e histórico; aprovar, rejeitar ou pedir alterações segundo a política da marca/tenant. | ApprovalPolicy, ApprovalDecision, ReviewFinding |
| S12 | Biblioteca de mídia | Buscar assets por marca, tipo, uso e direitos; pré-visualizar e verificar origem, licença e expiração. | MediaAsset, ContentAsset |
| S13 | Inteligência competitiva | Gerir fontes autorizadas, consultar observações com proveniência e limitações, explorar oportunidades editoriais. | CompetitorSource, Observation |
| S14 | Analytics | Comparar resultados por marca, canal, campanha e formato; expor definição, origem, período e cobertura de cada métrica. | MetricSnapshot, PublicationJob, Campaign |
| S15 | Equipe e permissões | Convidar/remover membros, alterar papéis e consultar convites pendentes. | Member, Invitation, AuditEvent |
| S16 | Configurações do workspace | Gerir nome, idioma, fuso, política padrão de aprovação, retenção, plano e limites. | Organization, ApprovalPolicy, UsageLedger |
| S17 | Histórico operacional | Inspecionar execuções de IA, mídia e publicação; consultar erro sanitizado, tentativas e estado; repetir/cancelar ações seguras. | AIJob, WorkflowRun, PublicationAttempt |

## Atividades por fase

### F0 — Fechar a fundação multi-tenant

**Telas:** S01, S02, S04.

1. Configurar ambiente local PostgreSQL, migrar o schema e documentar setup seguro sem credenciais no Git.
2. Completar o fluxo de verificação e entrega de e-mail; convites só ficam ativos quando o provedor estiver configurado.
3. Definir e testar a matriz de papéis/permissões no servidor para organização e marcas.
4. Criar testes automatizados para sessão ausente, associação removida, papéis sem permissão e isolamento entre dois tenants.
5. Concluir a branch atual de edição/arquivamento após testar no banco: um ID de outra organização deve responder como não encontrado e não alterar dados.
6. Criar navegação-base responsiva com tenant ativo visível e sem links de tela ainda não implementada apresentados como ações funcionais.

**Aceite da fase:** usuário pode criar/trocar workspace e administrar marcas; tenant A não consegue ler ou alterar dados de tenant B; ações proibidas falham no backend; PT/EN e estados da tela estão cobertos.

### F1 — Equipe, acesso e auditoria

**Telas:** S02, S15, S16.

1. Implementar convites com expiração, aceite, cancelamento e reenvio pelo mesmo registro pendente.
2. Permitir alterar papéis e remover membro sem remover a identidade global do usuário.
3. Definir ações permitidas por papel e registrar mudanças de acesso em audit log append-only.
4. Adicionar testes de autorização para todas as operações administrativas e casos de convite expirado/revogado.

**Aceite da fase:** múltiplas pessoas podem colaborar em um tenant; uma pessoa pode pertencer a mais de um; mudanças de acesso deixam trilha e não expandem escopo.

### F2 — Perfil completo de marca e Brand Kit

**Telas:** S04, S05, S06.

1. Criar detalhes da marca com abas; manter arquivos e fatos separados por tenant/marca.
2. ~~Definir schema versionado do Brand Kit para identidade, tom, audiência, produtos, claims aprovados, restrições e CTAs.~~ Concluído: snapshots imutáveis são vinculados ao tenant e à marca.
3. Implementar armazenamento privado de logos e imagens de referência com checksum, origem, dimensões e revisão humana; não marcar arquivos enviados como aprovados automaticamente. Concluído para PNG/JPEG/WebP, com checksum e revisão. LocalStack validou upload, proteção contra replay e exclusão do staging. Templates editáveis, SVG, vídeo e arquivos compactados seguem fora do escopo.
4. ~~Permitir salvar rascunhos, aprovar uma versão e consultar versões anteriores.~~ Concluído. Nova edição cria nova versão; aprovação antiga não pode ser reaplicada.
5. ~~Adicionar autorização de leitura/edição e testes de tenant para versões.~~ Concluído. Ativos usam autorização por organização/marca; leitura comum mostra apenas itens aprovados e revisão fica restrita a owner/admin.

6. ~~Completar teste S3 via LocalStack e limpeza de upload pendente.~~ Concluído para S3 local e job bounded; teste das rotas cobre escopo de dois tenants e revisão por papel. Permanecem teste de CORS no navegador e homologação de bucket/role/política/backups quando a infraestrutura for autorizada.

**Aceite da fase:** a marca mostra sua versão aprovada de identidade e conhecimento, com fonte rastreável; conteúdo externo ou importado não vira fato aprovado sem ação humana.

### F3 — Conexões sociais

**Telas:** S07 e vistas de conexão em S04/S05.

1. Construir registro versionado de capacidades por plataforma e tipo de conta.
2. Validar app, permissões, formatos, limites, métricas, publicação e processo de revisão de cada API antes de prometer suporte.
3. Implementar OAuth com state/PKCE quando suportado, callback validado, armazenamento criptografado, rotação e revogação.
4. Começar pelos conectores aprovados para LinkedIn e Meta; YouTube entra após validar permissões e mídia. Avaliar Threads, X, Pinterest e TikTok individualmente.
5. Exibir permissões concedidas, proprietário da conexão, saúde e última checagem; nunca exibir segredo.

**Aceite da fase:** perfil conecta e desconecta em ambiente de teste, escopos ficam visíveis, callback CSRF é rejeitado e nenhuma credencial aparece em logs/respostas.

### F4 — Ideias, campanhas, editor e calendário

**Telas:** S03, S08, S09, S10.

1. ~~Definir os estados iniciais do conteúdo no schema.~~ Concluído para ideias; as transições de revisão, aprovação e publicação seguem pendentes.
2. ~~Implementar criação e listagem de ideias no escopo de tenant e marca.~~ Concluído no primeiro fluxo da agenda; campanhas e edição avançada seguem pendentes.
3. Criar conteúdo canônico e variantes imutáveis por canal com snapshot da versão do Brand Kit e capacidades usadas. Parcial: versão canônica, variante única selecionada e snapshot de Brand Kit aprovado já são persistidos; múltiplas variantes por versão e snapshot de capacidades ainda pendentes.
4. Validar copy e mídia contra o contrato do canal; preview deve refletir a variante que será submetida.
5. Implementar calendário mensal com filtros por marca/canal/status e fuso local. ~~Exibir itens planejados e criar ideia vinculada a uma marca/canal.~~ O editor cria nova versão ao salvar copy, e não altera versões existentes; transições de aprovação e publicação continuam pendentes.
6. Cobrir concorrência de edição, tenant boundaries e criação repetida com testes.

**Aceite da fase:** parcial. A agenda mensal, campanhas com agendas por rede e primeira fatia do editor/versionamento estão implementadas na feature branch. Geração de copy/imagem, múltiplas variantes por versão, preview de canal e invalidação de aprovação continuam pendentes. PostgreSQL local é necessário para aplicar as migrations e executar os testes de integração.

### Pendências fora do código — agenda mensal

1. Configurar `DATABASE_URL` de desenvolvimento e aplicar a migration para executar `calendar.test.ts` no PostgreSQL.
2. Resolver a sequência das migrations antes de integrar: `feature/linkedin-oauth` e `feature/editorial-calendar` partiram de `develop` e ambas geraram uma migration `0009`.
3. Depois da validação local e da reconciliação das migrations, integrar as branches pelo fluxo Git para disponibilizar as funcionalidades em `develop`.
4. Migrations `0010_adorable_magma.sql` e `0011_busy_silverclaw.sql` são aditivas. Rollback antes de usar o editor/campanhas: reverter o código e migrations; depois de existirem dados, exportar/reter campanhas, agendas e rascunhos antes de remover as tabelas relacionadas.

### F5 — Revisão, aprovação e mídia

**Telas:** S10, S11, S12.

1. Definir política de aprovação configurável por tenant e substituível por marca.
2. Persistir decisões append-only ligadas a usuário, data, versão e fingerprint de copy, arquivos, canal, formato, horário e Brand Kit.
3. Implementar solicitar alterações, rejeitar, aprovar individualmente ou exigir múltiplas pessoas; alterações invalidam decisões anteriores.
4. Criar biblioteca privada de mídia com checksum, direitos, consentimento, alt text, prefixo do tenant e URL temporária autorizada.
5. Integrar revisão automática como findings explicáveis; não deixar agente aprovar nem acionar publicação.
6. Homologar que item pendente/rejeitado/nova versão nunca passa pelo release gate.

**Aceite da fase:** aprovação antiga falha ao validar qualquer fingerprint alterado; usuário sem papel não aprova; arquivos de outro tenant não são acessíveis.

### F6 — IA, pesquisa e produção de mídia

**Telas:** S06, S09, S10, S13, S17.

1. Implementar tarefas de IA limitadas e explícitas: ideias, variantes de copy, roteiro e proposta de carrossel. Parcial: o editor solicita uma sugestão canônica e uma variante por canal usando somente briefing e Brand Kit aprovado; a saída não é persistida até a pessoa revisar e salvar. O primeiro adapter usa AI SDK com provider OpenAI configurado no servidor; `OPENAI_MODEL` é configurável.
2. Construir contexto apenas com organização autorizada, marca, Brand Kit aprovado e fontes permitidas; registrar modelo, fontes e uso.
3. Adicionar conectores de pesquisa autorizados com proveniência e limites de dados; conteúdo externo é entrada não confiável e nunca vira instrução do agente.
4. Implementar fila durável para trabalhos longos, limites de concorrência, retries finitos, dead-letter e retomada após reinício. Parcial: fila PostgreSQL para imagem tem idempotência por tenant, lease, `FOR UPDATE SKIP LOCKED`, quatro tentativas limitadas e falha terminal; falta homologar concorrência/reinício no banco e adicionar limites globais/custo por tenant.
5. Renderizar primeiro imagens/carrosséis; só adicionar vídeo quando limites de CPU/RAM e direitos de mídia tiverem sido validados. Parcial: fila PostgreSQL e worker geram uma imagem WebP associada a versão salva; revisão da imagem é separada da aprovação do post. Ainda falta comparar carrossel/templates, preparar termos/direitos e implantar/monitorar o worker.
6. Comparar bibliotecas, licença e custo antes de adotar geração de imagem/vídeo ou composição.

**Aceite da fase:** job recupera estado após reinício, falhas têm retry limitado e rastreável, custo/contexto permanecem no tenant e saída de IA nunca muda permissões.

### F7 — Agendamento, publicação e métricas

**Telas:** S03, S07, S08, S14, S17.

1. Criar outbox/scheduler persistido e uma interface comum com adapters nativos por canal.
2. Revalidar no backend membership, estado da conexão, política e fingerprint aprovado antes de inserir job na fila.
3. Garantir idempotência, retries com backoff, consulta de status após timeout ambíguo e caminho de intervenção manual.
4. Começar por ambiente de teste e contas autorizadas; nunca tornar conteúdo público durante homologação.
5. Coletar métricas oferecidas pela API com origem, unidade, definição, período e cobertura; preservar valores ausentes como ausentes.
6. Mostrar relatórios e tendências apenas com dados observados; registrar indisponibilidade e restrições do canal.

**Aceite da fase:** job sem aprovação não agenda; job aprovado é enviado uma vez; publicação/erro têm status consultável; métricas são rastreáveis e não inventadas.

### F8 — Preparação SaaS

**Telas:** S15, S16, S17 e produto todo.

1. Planos, quotas, ledger de uso e alertas de limite.
2. Cobrança, exportação e exclusão de dados do tenant, retenção e trilhas de auditoria.
3. Backups e recuperação testada, observabilidade, rate limiting, alertas e operação segura de migrações.
4. Revisão de segurança, privacidade, licenças e termos das redes; suporte e processo de incidente.
5. Teste de isolamento, carga e recuperação antes de abrir onboarding para clientes.

**Aceite da fase:** tenant consegue entrar, colaborar, conectar canais suportados, publicar somente após aprovação, medir resultados, exportar/excluir seus dados e recuperar operação conforme objetivos definidos.

## Jornadas de ponta a ponta a validar

1. **Primeiro uso:** cadastro -> verificação -> criar workspace -> criar marca -> preencher Brand Kit -> convidar colega.
2. **Conectar canal:** abrir marca -> selecionar plataforma -> OAuth -> revisar permissões/capacidades -> verificar conexão.
3. **Produzir:** abrir campanha/ideia -> gerar briefing -> criar variante por canal -> anexar arte -> revisão automática -> solicitar aprovação.
4. **Aprovar:** atribuir aprovadores -> revisar conteúdo/preview/fontes -> pedir ajuste ou aprovar a versão exata -> auditar decisão.
5. **Publicar:** revalidar aprovação -> agendar em ambiente de teste -> publicar pela API autorizada -> consultar status -> coletar métricas.
6. **Recuperar falha:** simular timeout/reinício -> consultar status remoto -> evitar duplicata -> permitir retry seguro e registrar tentativa.
7. **Provar isolamento:** repetir CRUD, convite, upload, aprovação, busca, job e métricas com dois tenants; nenhuma chave de recurso de outro tenant concede acesso.

## Ordem de trabalho imediata

1. Configurar SMTP no ambiente de desenvolvimento/homologação antes de habilitar cadastro e convites para pessoas reais.
2. Agendar e monitorar a limpeza de uploads no deploy; validar CORS no navegador e homologar armazenamento privado quando a infraestrutura for autorizada.
3. Importar materiais oficiais de marca e templates editáveis com parser e análise de segurança.
4. Só então avançar para OAuth, editor/conteúdo e aprovação; publicação permanece bloqueada até a política de aprovação e seus testes existirem.
