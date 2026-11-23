# AZORDEP Marketing - Central canonica de previas

Destino unico das novas previas: https://www.azordepsaude.com.br/marketing

## Regras operacionais

1. Cada criativo deve ter ID estavel, marca, versao, formato, arte/narracao, CTA, data, responsavel, QA e estado. Referencia canonica: /marketing/preview/<id>.
2. Previa entregue no chat, Bridge, Metricool ou Mac nao equivale a insercao na central. Registrar somente depois de verificar midia real, identidade oficial e links.
3. Acesso aos videos apenas apos autenticacao. O repositorio GitHub azordep-saude-site e publico e NAO pode conter videos ou arquivos ineditos nem links diretos publicos.
4. Armazenamento privado duravel, com acesso validado no backend, e prerequisito para anexar midia. Nao usar localhost, file:// ou sandbox como falsa midia hospedada.
5. Estados distintos: DRAFT, EXPORTED, QA_BLOCKED, READY_FOR_REVIEW, CREATIVE_APPROVED, SCHEDULED, PUBLISHED. Cada transicao exige evidencia e permissao; aprovacao estetica nao equivale a publicacao.
6. QA obrigatorio: progressao visual >=8/10, clareza >=8/10, global >8/10, zero vetos, identidade oficial, frames autorizados, audio revisado, legenda legivel/sincronizada, CTA e destino verificados. Proibidos slides estaticos disfarçados de Reels e demonstracoes sinteticas apresentadas como reais.
7. Reprovacoes de Rafael devem aparecer como REWORK_REQUIRED ate que as correcoes tenham sido revisadas.
8. Noctua pode coordenar alertas, mas notificacao nao substitui aprovacao Rafael. Evitar cobrancas duplicadas.
9. Acesso administrativo: usuario admin, senha forte configurada como segredo no ambiente Vercel, nunca admin/admin. Nao guardar credenciais em codigo, Git ou Bridge.
10. Nenhum post e agendado ou publicado automaticamente pela central. Auditoria Metricool e autorizacao especifica seguem separadas.

## Estado em producao (23/11/2026)

Rota: https://www.azordepsaude.com.br/marketing.
Vercel: azordep-saude-oficial (prj_3AfEaRMLJkBH16A3RChzoc1Aned3).
Admin: usuario admin, senha forte nao armazenada no Git; login protegido.

Armazenamento de video e legendas: Vercel Blob privado, nome azordep-marketing-private,
store_dYkMMEPNX9mXbtc3, regiao gru1, vinculado ao projeto por OIDC sem chave estatica.
15 MP4s e 15 arquivos de legenda privados foram enviados. O acesso ao arquivo e feito
SOMENTE pelo gateway autenticado em /marketing/media/<id> e /marketing/captions/<id>.
Para seek, a Function preserva o cabecalho Content-Range e responde 206.

Decisoes: os botoes de aprovar, solicitar correcoes e bloquear no QA registram eventos
append-only como JSON privado em reviews/<id>/, consultados pela pagina.
Nenhuma decisao e autorizacao para publicar ou agendar.

Limites: storage na conta Hobby (sem faturamento de excedente), mas sujeito
aos limites da plataforma. Lote inicial ~91 MiB (<230 MiB guard).
Nao colocar videos no repositorio publico ou links do Blob no HTML.

## Novos lotes de previas

A primeira versao tem IDs editoriais definidos no codigo. Para inserir novas pecas:
1. Preparar e revisar o novo registro (ID, marca, data, tipo, status, CTA).
2. Registrar o novo ID na lista do gateway; nao marcar aprovado sem Rafael.
3. Fazer upload do MP4 e legenda ao Blob privado em media/<id>/master.mp4
   e media/<id>/captions.vtt por CLI autenticada, verificando tamanho e formato.
4. Revalidar que um visitante nao autenticado recebe 303 e que o administrador
   pode ver e registrar aprovacao. Atualizar o projeto na Vercel apenas com autorizacao.
5. Nao fazer upload se a cota Hobby estiver proxima do limite nem comprar planos automaticamente.

O cadastro self-service de um ID inteiramente novo, sem novo deploy de codigo,
ainda nao foi implementado. Nao alegar atualizacao automatica da galeria.
