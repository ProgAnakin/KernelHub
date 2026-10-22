# Segurança do KernelHub

O protótipo atual não possui servidor de contas, login, API de integração ou armazenamento remoto. Os registros são locais, em IndexedDB; a migração da versão anterior preserva o JSON de localStorage até confirmar a gravação. O service worker armazena somente o shell e arquivos públicos.

## Proteções implementadas

- Validação estrutural e semântica de backups com limite de 2 MiB, IDs únicos, referências e limites de registros.
- Transações atômicas para ações em múltiplas abas; falhas de gravação preservam a sessão e exibem aviso.
- Renderização de texto pelo React, sem HTML fornecido pelo usuário.
- Cache limitado à origem/caminho do app e fora das APIs; variantes de consulta dos assets usam chave canônica.
- Dependências fixadas por lockfile, Actions fixadas por SHA e verificações automatizadas.
- Headers contra MIME sniffing e framing no modo com servidor, com CSP específica do worker.

## Limites importantes

Os dados e backups não são criptografados pelo app. Outras páginas da mesma origem compartilham o armazenamento; caminhos distintos de GitHub Pages não oferecem isolamento. Prefira uma origem dedicada para informações pessoais reais e mantenha backups fora do navegador.

Os headers de `next.config.ts` não são aplicados no export estático pelo GitHub Pages. Uma hospedagem/proxy deve configurá-los. CSP estrita da página, autenticação, rate limiting, OAuth e testes de brute force precisam ser tratados quando existir backend; atualmente não há endpoints desse tipo.

Após atualizar da versão 0.2, recarregue as abas antigas antes de continuar. Limpar os dados do navegador remove o banco local. Durante uma falha de gravação, ações ainda não confirmadas podem se perder se o app for fechado; exporte a sessão antes de sair.

## Verificação

Veja [a revisão de qualidade](docs/QUALITY-REVIEW.md) para reproduções, remediações, testes e medições. A auditoria foi local, em Chromium, com dados demonstrativos; não é uma certificação ou um pentest de infraestrutura em produção. Safari físico permanece pendente.

Ao relatar um problema, inclua versão, navegador e passos de reprodução com dados fictícios. Não publique backups pessoais, tokens ou medidas reais em issues públicas. Quando disponível, use o canal privado de advisories de segurança do repositório.
