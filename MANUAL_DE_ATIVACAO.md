# AZORDEP Marketing - operacao e recuperacao

## Estado verificado em 23/11/2026

- Rota administrativa: https://www.azordepsaude.com.br/marketing
- Producao do dominio: Vercel azordep-saude-oficial, projeto prj_3AfEaRMLJkBH16A3RChzoc1Aned3.
- Publicacao validada: dpl_8ew3ctMnXExY427cNBZMxtva5xrP.
- A pagina de login abre com HTTP 200. Visitantes nao autenticados recebem HTTP 401 em /marketing/status.json e redirecionamento para /marketing nas paginas de revisao.
- Os arquivos institucionais originais foram verificados sem alteracao: HTML, CSS e logo.
- MARKETING_ADMIN_SCRYPT e MARKETING_SESSION_SECRET ja estao configuradas como segredos ocultos de Production. Nao os copie para este repositorio, chats ou Bridges.
- Login de producao com a senha real: validar pelo proprio titular. A senha fraca admin/admin foi rejeitada em producao.
- A interface tem 15 registros editoriais e os 15 videos correspondentes no Blob privado, com suas legendas. A reproducao e protegida pelo login.
- Aprovacoes, reprovacoes e bloqueios de QA geram registros JSON privados append-only, sem publicar posts.

## Preservacao no GitHub

Codigo fonte: rafaelpedrozamedx-blip/azordep-saude-site, branch main. O projeto Vercel do dominio usa esse repositorio como origem para atualizacoes via Git. Esta implementacao deve permanecer no GitHub para preservar /marketing em futuros deploys.

Nao modificar index.html, styles.css, DNS ou outras rotas sem autorizacao especifica.

## Recuperacao e troca futura de senha

Usuario administrativo: admin. A senha literal admin e proibida.
Somente se houver aprovacao para rotacao de credenciais:

1. Execute node scripts/marketing-credential-setup.mjs em um Terminal privado.
2. Guarde a nova senha no gerenciador de senhas.
3. Atualize MARKETING_ADMIN_SCRYPT e MARKETING_SESSION_SECRET no ambiente Production da Vercel, projeto azordep-saude-oficial.
4. Faca uma implantacao autorizada e valide login, logout e acesso aos dados.

Nao execute rotacao por rotina: as variaveis ja estao configuradas.

## Pendencias funcionais

- Midia atual armazenada no Blob privado azordep-marketing-private (store_dYkMMEPNX9mXbtc3), com OIDC e quota Hobby. Nunca usar URL do Blob privada diretamente no HTML; servir pela Function autenticada.
- O painel nao persiste aprovacoes em banco e nao altera Metricool.
- Aprovacao criativa da Pet & Place nao comprova checkout pago ou fulfillment CJ.
- Os doze Reels antigos Copiloto, O Iniciado e RMF ainda estao marcados para reformulacao.
