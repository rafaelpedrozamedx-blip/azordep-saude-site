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

O acesso administrativo /marketing esta implantado no projeto Vercel azordep-saude-oficial, deployment dpl_8ew3ctMnXExY427cNBZMxtva5xrP. Os segredos de autenticacao foram configurados no ambiente Production e verificados somente pelos nomes, sem expor seus valores. Testes de producao confirmaram login HTTP 200, protecao de status HTTP 401 e rejeicao de admin/admin.

Limitacoes: existem apenas os metadados editoriais dos 15 criativos. Nenhuma midia inedita ou video esta hospedado nesta rota, tampouco ha persistencia de aprovacoes ou upload. A inclusao de videos reais exige armazenamento privado, autenticacao e controle de acesso, com avaliacao e aprovacao de custos.

A branch main do GitHub deve preservar esta implementacao para evitar que um deploy futuro sobrescreva /marketing. A inclusao de qualquer novo criativo permanece sujeita aos gates acima.
