# Segurança do KernelHub

O aplicativo não possui servidor próprio de contas, login ou armazenamento remoto. A conexão opcional do GitHub consulta exclusivamente a API pública, sem senha ou token; a importação de saúde é processada localmente em um Web Worker. Os registros são locais, em IndexedDB; a migração da versão anterior preserva o JSON de localStorage até confirmar a gravação. O service worker armazena somente o shell e arquivos públicos.

## Proteções implementadas

- Validação estrutural e semântica de backups: espaço com limite de 2 MiB, arquivo completo com até 64 MB, IDs e dias únicos, assinatura e tamanho de cada foto, chaves desconhecidas recusadas e restauração atômica.
- Transações atômicas para ações em múltiplas abas; falhas de gravação preservam a sessão e exibem aviso.
- Renderização de texto pelo React, sem HTML fornecido pelo usuário.
- Cache limitado à origem/caminho do app e fora das APIs; variantes de consulta dos assets usam chave canônica.
- XML de saúde limitado a 12 MiB e 150 mil registros; entidades externas e estruturas incompatíveis são rejeitadas. O importador não executa XML nem busca recursos externos.
- Snapshots das fontes passam por validação; revisões transacionais impedem que respostas anteriores restaurem uma conexão ou dados removidos em outra aba.
- Conclusão do cronômetro grava o bloco e consome a sessão em uma única transação, sem duplicar minutos.
- GitHub: timeout, limite de resposta, URLs validadas, respeito à quota e preservação da última leitura quando a atualização falha.
- Dependências fixadas por lockfile, Actions fixadas por SHA e verificações automatizadas.
- Headers contra MIME sniffing e framing no modo com servidor, com CSP específica do service worker. O importador de saúde usa um worker de mesma origem, sem Blob ou código remoto.

## Limites importantes

Os dados e backups não são criptografados pelo app. Outras páginas da mesma origem compartilham o armazenamento; caminhos distintos de GitHub Pages não oferecem isolamento. Prefira uma origem dedicada para informações pessoais reais e mantenha backups fora do navegador.

Os headers de `next.config.ts` não são aplicados no export estático pelo GitHub Pages. Uma hospedagem/proxy deve configurá-los. CSP estrita da página, autenticação, rate limiting, OAuth e testes de brute force precisam ser tratados quando existir backend; atualmente não há endpoints desse tipo.

Após atualizar da versão 0.2, recarregue as abas antigas antes de continuar. Limpar os dados do navegador remove os bancos locais. O backup JSON inclui os registros do KernelHub, o armário de skincare (com fotos, se escolhido) e o usuário GitHub conectado; snapshots de Saúde e o cronômetro em andamento não entram nele. O arquivo não é criptografado: contém fotos e registros pessoais em texto legível. Durante uma falha de gravação, ações ainda não confirmadas podem se perder se o app for fechado; exporte a sessão antes de sair.

## Verificação

Veja [a revisão de qualidade](docs/QUALITY-REVIEW.md) para reproduções, remediações, testes e medições. A auditoria foi local, em Chromium, com dados demonstrativos; não é uma certificação ou um pentest de infraestrutura em produção. Safari físico permanece pendente.

Ao relatar um problema, inclua versão, navegador e passos de reprodução com dados fictícios. Não publique backups pessoais, tokens ou medidas reais em issues públicas. Quando disponível, use o canal privado de advisories de segurança do repositório.
