# 30studio — plano de produto e backlog

Este plano transforma a visão de `PRODUCT_SPEC.md` em telas, atividades sequenciadas e critérios verificáveis. É um plano de implementação, não uma promessa de prazo. Cada entrega deve incluir persistência via Drizzle ORM, autorização do tenant, estados de interface, localização PT/EN e evidência de aceite compatível com o ambiente disponível.

## Regras de produto e desenvolvimento

- O tenant é a organização ativa validada no servidor. Toda leitura, gravação, busca e job usa o escopo da organização e, quando aplicável, da marca.
- Os textos da interface são sempre chaves de `messages/pt.json` e `messages/en.json`, consumidas por `next-intl`. Não escrever labels ou mensagens visíveis diretamente em componentes.
- Código, nomes de variáveis/funções/tipos, comentários, testes e configurações técnicas são escritos em inglês.
- PostgreSQL é a fonte de verdade; operações de dados passam por Drizzle ORM e repositórios tipados.
- IA prepara sugestões e conteúdo. Somente pessoas autorizadas aprovam; publicação revalida no backend a aprovação da versão exata.
- 30studio contém o produto e seus fluxos. Não adicionar n8n ou Postiz como dependências operacionais.
- Cada tela deve ter estados de carregamento, vazio, erro, sucesso e dados parciais/stale quando isso se aplicar. Nunca preencher o produto com métricas fictícias.

## Estado atual

| Área | Estado | Limite conhecido |
|---|---|---|
| Next.js, TypeScript, Tailwind v4, tema e identidade 30studio | Implementado no scaffold | Revisão visual automatizada ainda não foi comprovada neste ambiente. |
| Better Auth, sessão, organizações e membros no schema Drizzle | Base implementada | Entrega de e-mail não configurada; cadastro/verificação não está pronto para clientes. |
| Troca/criação de workspace e interface PT/EN | Implementado | Shell com Visão geral, Marcas e Equipe; as duas primeiras áreas são funcionais. |
| Criar/listar marcas com escopo de tenant | Implementado | Depende de PostgreSQL configurado para uso real. |
| Editar/arquivar marca | Integrado em `develop` | Lint, TypeScript, build, migração Drizzle, 5 testes unitários e 2 testes de integração passaram em PostgreSQL descartável. As rotas exercitam sessão Better Auth, tenant ativo, associação atual, papel e isolamento por organização. |
| Equipe: listar, alterar papel e remover associação | Em implementação | Auditoria é gravada na mesma transação; convites aguardam configuração de entrega de e-mail. |
| Brand Kit, OAuth, conteúdo, revisão, aprovação, publicação e analytics | Planejado | Sem tabelas/fluxos funcionais ainda. |

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

1. Implementar convites com expiração, aceite, cancelamento e reenvio idempotente.
2. Permitir alterar papéis e remover membro sem remover a identidade global do usuário.
3. Definir ações permitidas por papel e registrar mudanças de acesso em audit log append-only.
4. Adicionar testes de autorização para todas as operações administrativas e casos de convite expirado/revogado.

**Aceite da fase:** múltiplas pessoas podem colaborar em um tenant; uma pessoa pode pertencer a mais de um; mudanças de acesso deixam trilha e não expandem escopo.

### F2 — Perfil completo de marca e Brand Kit

**Telas:** S04, S05, S06.

1. Criar detalhes da marca com abas; manter arquivos e fatos separados por tenant/marca.
2. Definir schema versionado do Brand Kit para identidade, tom, audiência, produtos, claims aprovados, restrições, CTAs e templates.
3. Importar materiais com checksum, origem, tipo e estado de revisão; não marcar conteúdo importado como aprovado automaticamente.
4. Permitir editar e publicar uma nova versão do Brand Kit; versões antigas continuam consultáveis.
5. Adicionar autorização de leitura/edição e testes de tenant para importação, versão e download.

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

1. Definir estados de conteúdo e comandos de transição server-side.
2. Implementar campanhas e ideias no escopo de tenant e marca.
3. Criar conteúdo canônico e variantes imutáveis por canal com snapshot da versão do Brand Kit e capacidades usadas.
4. Validar copy e mídia contra o contrato do canal; preview deve refletir a variante que será submetida.
5. Implementar calendário/lista, filtros, time zone e alteração de horário que sempre cria nova versão pendente de aprovação.
6. Cobrir concorrência de edição, tenant boundaries e criação repetida com testes.

**Aceite da fase:** editor guarda rascunho recuperável após reinício; cada canal tem variante identificável; nenhuma alteração silenciosa altera uma versão já aprovada.

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

1. Implementar tarefas de IA limitadas e explícitas: ideias, variantes de copy, roteiro e proposta de carrossel.
2. Construir contexto apenas com organização autorizada, marca, Brand Kit aprovado e fontes permitidas; registrar modelo, fontes e uso.
3. Adicionar conectores de pesquisa autorizados com proveniência e limites de dados; conteúdo externo é entrada não confiável e nunca vira instrução do agente.
4. Implementar fila durável para trabalhos longos, limites de concorrência, retries finitos, dead-letter e retomada após reinício.
5. Renderizar primeiro imagens/carrosséis; só adicionar vídeo quando limites de CPU/RAM e direitos de mídia tiverem sido validados.
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

1. Validar a migração da auditoria e executar os testes de integração das rotas de equipe em PostgreSQL descartável.
2. Configurar entrega de e-mail transacional antes de ativar convites, reenvio, cancelamento e aceite por link.
3. Completar a trilha de auditoria consultável e testar a matriz de papéis com sessão Better Auth e isolamento tenant.
4. Implementar Brand Kit versionado com importação rastreável de ativos e fatos aprovados.
5. Só então avançar para OAuth, editor/conteúdo e aprovação; publicação permanece bloqueada até a política de aprovação e seus testes existirem.
