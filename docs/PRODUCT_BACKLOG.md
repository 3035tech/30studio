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

Revisto em 2026-11-16 após conferência com rotas, workers, repositórios e migrations presentes no workspace. Esta tabela é a referência de status; notas históricas nas fases abaixo não devem contradizê-la.

| Área | Estado | Limite conhecido |
|---|---|---|
| Next.js, TypeScript, Tailwind v4, tema e identidade 30studio | Implementado no scaffold | Revisão visual automatizada ainda não foi comprovada neste ambiente. |
| Better Auth, sessão, organizações e membros no schema Drizzle | Implementado | SMTP transacional integrado; o provedor e as credenciais ainda precisam ser configurados no ambiente de deploy. Docker de desenvolvimento cria uma conta demo verificada e isolada para exploração local. |
| Troca/criação e configurações de workspace, interface PT/EN | Implementado | Visão geral prioriza ações de atenção; proprietários podem atualizar o nome exibido sem alterar o slug, com autorização no servidor. CTA de publicação depende da permissão efetiva e de marca ativa. |
| Criar/listar marcas com escopo de tenant | Implementado | A lista resume o status da versão mais recente do Brand Kit e a saúde das conexões sociais; após criar marca, oferece atalhos opcionais para configurar ambos. Depende de PostgreSQL configurado para uso real. |
| Editar/arquivar marca | Integrado em `develop` | Lint, TypeScript, build, migração Drizzle, 5 testes unitários e 2 testes de integração passaram em PostgreSQL descartável. As rotas exercitam sessão Better Auth, tenant ativo, associação atual, papel e isolamento por organização. |
| Equipe: membros, papéis, convites e auditoria | Implementado nesta entrega | Convites exigem SMTP e e-mail verificado; teste de integração cobre criação, reenvio, cancelamento, aceite e trilha auditável. |
| Brand Kit | Versões e primeira implementação da biblioteca de imagens | Snapshots imutáveis, URLs de fonte, upload privado por adaptador S3, verificação de hash/dimensões, revisão humana, direitos de uso e links de leitura temporários. Chaves temporárias são isoladas dos objetos finais. LocalStack validou upload, replay e limpeza de objeto. O comando diário remove uploads abandonados após 24 horas em lotes de até 100; falta agendar/monitorar no deploy. Configuração de bucket/IAM/CORS/backup, importação de templates editáveis e checagem automática de fontes seguem pendentes. |
| Campanhas, agenda e editor editorial | Fluxo principal validado em `feature/editorial-calendar` | Criação guiada em duas etapas, com datas e horários independentes por rede e resumo antes do envio; calendário em grade/lista PT/EN e filtros; geração opcional de copy; versões imutáveis com snapshot do Brand Kit e das capacidades do canal (catálogo v1); prévia textual por canal; aviso e confirmação para descartar alterações não salvas; criação idempotente e conflito explícito em edições concorrentes. Migrations até `0034` geradas; não aplicar em ambiente compartilhado antes de validação isolada e revisão da sequência. |
| OAuth social, aprovação configurável, publicação e analytics | Conexões, aprovação, publicação inicial e analytics operacionais de publicações implementados | OAuth com adaptadores desacoplados, credenciais criptografadas e gestão de perfis; políticas de aprovação e decisões vinculadas a fingerprint; worker PostgreSQL durável para LinkedIn/Threads/Facebook (texto) e Instagram (uma imagem com legenda), com destino por publicação exibido no calendário e histórico de aprovação. O worker informa heartbeat; o dashboard mostra saúde, volume de jobs vencidos por tenant, marca e rede e o horário do mais antigo, com atalho para a fila. O dashboard também compartilha filtros de marca/rede/período, mostra fila de atenção com atalhos para resolver falhas, conciliar resultados, revisar aprovações e reabrir conexões; alertas podem ser silenciados por usuário por 24 horas. Metas mensais por marca/rede e progresso comparado ao período também estão disponíveis. Coleta manual de curtidas/reactions e comentários de até 10 posts recentes do Facebook/Instagram registra snapshots com origem, versão da definição, data, cobertura, frescor e resultado de acesso. Métricas da API para Threads, LinkedIn, alcance, impressões, vídeo e periodicidade automática seguem pendentes. Migrações `0021`–`0022`, `0026` e `0031`–`0032` geradas, ainda não aplicadas. |

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
| S13 | Inteligência competitiva | Cadastrar feeds RSS/Atom HTTPS por marca; coletar observações com proveniência; classificar temas e sugerir pautas bilíngues com citações num worker PostgreSQL. Próximas etapas: métricas permitidas, descoberta de fontes e coletores de outras redes. | CompetitorSource, Observation |
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
4. A publicação inicial suporta texto no LinkedIn, Threads e Páginas do Facebook, além de uma imagem com legenda no Instagram. Cada adapter declara suas capacidades e o destino é escolhido por publicação na solicitação de aprovação; YouTube e variantes adicionais de mídia seguem como próximas entregas após validação das aplicações Meta.
5. Exibir permissões concedidas, proprietário da conexão, saúde e última checagem; nunca exibir segredo.

**Aceite da fase:** perfil conecta e desconecta em ambiente de teste, escopos ficam visíveis, callback CSRF é rejeitado e nenhuma credencial aparece em logs/respostas.

### F4 — Ideias, campanhas, editor e calendário

**Telas:** S03, S08, S09, S10.

1. ~~Definir os estados iniciais do conteúdo no schema.~~ Concluído; estados de rascunho, revisão, aprovação, agendamento, falha e publicação estão conectados aos fluxos existentes.
2. ~~Implementar criação e listagem de ideias no escopo de tenant e marca.~~ Concluído no fluxo de campanhas e agenda; criação, edição versionada e listagem estão implementadas.
3. Criar conteúdo canônico e variantes imutáveis por canal com snapshot da versão do Brand Kit e capacidades usadas. Versão canônica, variante selecionada, Brand Kit e snapshot versionado das capacidades do conector agora são persistidos. Versões antigas mantêm snapshot nulo para compatibilidade; o fingerprint de aprovação inclui snapshots novos. Múltiplas variantes de copy no mesmo canal seguem pendentes.
4. Validar copy e mídia contra o contrato do canal; preview deve refletir a variante que será submetida. A prévia textual reflete a copy e o canal selecionados; validação de limites/formato e prévia de mídia aguardam o contrato versionado de capacidades.
5. ~~Implementar calendário mensal com filtros por marca/canal/status e fuso local.~~ O editor cria versões imutáveis; aprovação e publicação já têm fluxos próprios. Permanecem as variantes adicionais por canal e snapshots versionados de capacidades do item 3.
6. Cobrir concorrência de edição, tenant boundaries e criação repetida com testes. Implementado e validado: edição usa número de versão esperado e conflito retorna HTTP 409; campanha usa chave de idempotência por tenant/autor com fingerprint normalizado. A suíte PostgreSQL em Docker validou criação/replay/conflito de campanha, concorrência de versões, agendas por canal e isolamento entre tenants.

**Aceite do fluxo principal (item 1 do roadmap):** concluído na feature branch e validado em PostgreSQL temporário Docker. F4 continua parcial: variantes adicionais por canal e snapshots versionados de capacidades ainda faltam. Revisão/aprovação é F5; publicação é F7.

### Pendências fora do código — agenda mensal

1. Aplicar migrations ao PostgreSQL do ambiente de desenvolvimento somente quando esse ambiente for preparado; o fluxo principal foi testado isoladamente em PostgreSQL 18 via Docker, sem tocar em banco de outro projeto.
2. Resolver a sequência das migrations antes de integrar: `feature/linkedin-oauth` e `feature/editorial-calendar` partiram de `develop` e ambas geraram uma migration `0009`.
3. Depois da validação local e da reconciliação das migrations, integrar as branches pelo fluxo Git para disponibilizar as funcionalidades em `develop`.
4. Migrations `0010_adorable_magma.sql` e `0011_busy_silverclaw.sql` são aditivas. Rollback antes de usar o editor/campanhas: reverter o código e migrations; depois de existirem dados, exportar/reter campanhas, agendas e rascunhos antes de remover as tabelas relacionadas.

### F5 — Revisão, aprovação e mídia

**Telas:** S10, S11, S12.

1. ~~Definir política de aprovação configurável por tenant e substituível por marca.~~ Concluído na feature branch: padrão e overrides por marca exigem 1–5 aprovações; cada solicitação mantém seu snapshot.
2. Persistir decisões append-only ligadas a usuário, data, versão e fingerprint de copy, arquivos, canal, horário e Brand Kit. Implementado na feature branch; as migrations `0015_amazing_ben_parker.sql` e `0016_thankful_wendell_rand.sql` criam pedidos versionados, decisões e políticas multiaprovador.
3. ~~Implementar solicitar alterações, rejeitar e aprovar; alterações invalidam decisões anteriores.~~ Concluído na feature branch: decisão distinta por revisor, aprovação parcial até atingir a regra, rejeição/alteração resolvem a solicitação, fingerprint é revalidado antes de decisão.
4. ~~Criar biblioteca privada de mídia com checksum, direitos, prefixo do tenant e URL temporária autorizada.~~ Implementada para PNG/JPEG/WebP em F2; permanecem templates editáveis, SVG/vídeo/compactados e homologação de produção descritos em F2/F6.
5. Integrar revisão automática como findings explicáveis; não deixar agente aprovar nem acionar publicação. Parcial implementado: revisão sob demanda da versão salva usa somente a copy e o snapshot exato do Brand Kit aprovado; findings classificados são consultivos, não persistidos, e exigem `OPENAI_API_KEY`/`OPENAI_MODEL`. A chamada real ao provedor ainda precisa de homologação com credenciais.
6. Validar o release gate ponta a ponta com contas autorizadas e ambiente de homologação. O worker já revalida aprovação, fingerprint, versão e mídia antes do envio; falta evidência de homologação externa dos conectores e do ciclo de ponta a ponta.

**Aceite da fase:** aprovação antiga falha ao validar qualquer fingerprint alterado; usuário sem papel não aprova; arquivos de outro tenant não são acessíveis.

### F6 — IA, pesquisa e produção de mídia

**Telas:** S06, S09, S10, S13, S17.

1. Implementar tarefas de IA limitadas e explícitas: ideias, variantes de copy, roteiro e proposta de carrossel. Parcial: o editor gera uma mensagem canônica e três opções distintas para o canal usando somente briefing e Brand Kit aprovado; a pessoa compara, escolhe e salva uma delas como nova versão imutável. As opções não são persistidas separadamente na mesma publicação. O adapter usa AI SDK com provider OpenAI configurado no servidor; `OPENAI_MODEL` é configurável.
2. Construir contexto apenas com organização autorizada, marca, Brand Kit aprovado e fontes permitidas; registrar modelo, fontes e uso.
3. Adicionar conectores de pesquisa autorizados com proveniência e limites de dados; conteúdo externo é entrada não confiável e nunca vira instrução do agente.
4. Implementar fila durável para trabalhos longos, limites de concorrência, retries finitos, dead-letter e retomada após reinício. Parcial: fila PostgreSQL para imagem tem idempotência por tenant, lease, `FOR UPDATE SKIP LOCKED`, quatro tentativas limitadas e falha terminal; falta homologar concorrência/reinício no banco e adicionar limites globais/custo por tenant.
5. Renderizar primeiro imagens/carrosséis; só adicionar vídeo quando limites de CPU/RAM e direitos de mídia tiverem sido validados. Parcial: fila PostgreSQL e worker geram imagem WebP de IA, cartão estático ou carrossel de três páginas ligado a uma versão salva; cartão e cada página do carrossel usam o preset do canal e a composição adapta-se à proporção. As páginas são revistas como unidade e a revisão da mídia é separada da aprovação do post. Instagram converte o ativo para JPEG e valida proporção, largura e tamanho antes de publicar; presets de Instagram/TikTok/LinkedIn foram confrontados com documentação oficial, mas somente Instagram tem publicação de imagem habilitada. Formatos de imagem de Facebook, X, YouTube, Threads e Pinterest seguem sem homologação para conectores. Compose de desenvolvimento provisiona app, PostgreSQL, LocalStack, migrações, usuário demo e worker opcional. Ainda faltam assets oficiais de marca/fontes e homologação/monitoramento do worker em produção.
6. Comparar bibliotecas, licença e custo antes de adotar geração de imagem/vídeo ou composição.

**Aceite da fase:** job recupera estado após reinício, falhas têm retry limitado e rastreável, custo/contexto permanecem no tenant e saída de IA nunca muda permissões.

### F7 — Agendamento, publicação e métricas

**Telas:** S03, S07, S08, S14, S17.

1. ~~Criar outbox/scheduler persistido e uma interface comum com adapters nativos por canal.~~ Implementados jobs PostgreSQL duráveis e adapters nativos para os canais habilitados. A publicação real permanece desligada por configuração até ambiente e contas serem homologados.
2. ~~Revalidar no backend membership, estado da conexão, política e fingerprint aprovado antes de inserir job na fila.~~ O agendamento e o worker verificam autorização, conexão e snapshot aprovado; manter essa regra nos testes de regressão.
3. ~~Garantir idempotência e retries limitados.~~ Implementados retries e reconciliação automática do status positivo do Instagram. Reconciliação manual auditada permite resolver resultado indeterminado para todos os canais e uma única tentativa após confirmação explícita de ausência. Consulta automática de Facebook, Threads e LinkedIn ainda depende de referência remota determinística e escopos aprovados.
4. Homologar em ambiente de teste com contas autorizadas, usando conteúdo não público/de teste; validar publicação real somente quando a autorização de rollout e as contas estiverem disponíveis.
5. Coleta manual de curtidas, comentários e compartilhamentos recentes de Facebook/Instagram está implementada. Automatizar a atualização e ampliar métricas somente conforme origem, unidade, definição, período e cobertura documentados; Threads, LinkedIn, alcance, impressões e vídeo seguem pendentes.
6. Analytics de publicações, saúde operacional, metas e snapshots Meta manuais já aparecem no dashboard. Ampliar tendências apenas com dados observados e exibir indisponibilidade/frescor por canal.

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
4. **Aprovar:** aplicar política padrão do tenant ou exceção por marca (1–5 revisores) -> revisar conteúdo/preview/fontes -> pedir ajuste ou contar aprovações distintas sobre a versão exata -> auditar decisão. Solicitações abertas preservam a política capturada no envio.
5. **Publicar:** revalidar aprovação -> agendar em ambiente de teste -> publicar pela API autorizada -> consultar status -> coletar métricas.
6. **Recuperar falha:** simular timeout/reinício -> consultar status remoto -> evitar duplicata -> permitir retry seguro e registrar tentativa.
7. **Provar isolamento:** repetir CRUD, convite, upload, aprovação, busca, job e métricas com dois tenants; nenhuma chave de recurso de outro tenant concede acesso.

## Ordem de trabalho imediata

1. Aplicar as migrations em uma base descartável dedicada ao 30studio e executar a suíte de regressão; não usar banco de outro projeto. Há duas migrations com prefixo `0017`, ambas no journal: preservar os IDs registrados e confirmar a ordenação pelo journal antes de qualquer migração de ambiente.
2. Homologar revisão de conteúdo com `OPENAI_API_KEY` e `OPENAI_MODEL`; sem credenciais, manter a funcionalidade explicitamente não homologada e sem chamadas pagas.
3. Executar e monitorar workers de publicação, mídia e concorrentes em Docker; testar concorrência, reinício, lease expirado e recuperação sem duplicar publicação.
4. Agendar e monitorar a limpeza de uploads no deploy; validar CORS em navegador e homologar bucket, role, política e backups S3 quando a infraestrutura for autorizada.
5. Fazer auditoria visual no navegador em desktop/mobile e PT/EN; o host de automação do Chrome/Firefox está indisponível no ambiente atual, então não marcar essa validação como concluída.
6. Depois da homologação, ampliar coleta de analytics e reconciliação remota somente para APIs com permissões e identificadores remotos determinísticos documentados.
7. Planejar F8: quotas/uso, cobrança, exportação/exclusão de dados, retenção, backups/recuperação, observabilidade, segurança e testes de carga/isolation. Definir política de retenção, metas de recuperação e requisitos comerciais antes de fechar critérios de aceite.
