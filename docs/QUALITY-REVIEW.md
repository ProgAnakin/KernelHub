# Revisão de qualidade · KernelHub 0.3

Revisão de 22 de outubro de 2026. O conceito permanece um sistema pessoal para corpo, bem-estar, carreira, aprendizado e rotina. A prioridade desta entrega é tornar os registros confiáveis, corrigíveis e rápidos de usar.

## Problemas encontrados e correções

| Problema reproduzido                                                              | Impacto                                                     | Correção                                                                                                                                                      |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Duas abas sobrescreviam registros e retransmitiam snapshots antigos.              | Alto para integridade: água e hábitos podiam desaparecer.   | Leitura, aplicação das ações e gravação em uma transação IndexedDB. BroadcastChannel apenas avisa sobre mudanças; não transporta os dados pessoais.           |
| Falha de armazenamento podia fazer ações posteriores partirem de dados antigos.   | Alto para integridade.                                      | A sessão conserva as ações pendentes, com IDs e horários estáveis, e tenta gravá-las novamente. O aviso continua enquanto não existe confirmação de gravação. |
| Backups aceitavam IDs duplicados, 24.000 minutos de foco/dia e campos excessivos. | Médio para integridade; baixo para abuso local de recursos. | Limite central de 2 MiB, campos limitados, exercícios conhecidos, IDs únicos, referências e somas coerentes.                                                  |
| Refeições só acumulavam nutrientes, sem correção.                                 | Alto para a utilidade diária.                               | Refeições individuais removíveis com confirmação; correção explícita do total para registros antigos.                                                         |
| Insights além dos oito primeiros ficavam inacessíveis.                            | Médio para acesso ao próprio conteúdo.                      | Carregar mais anotações e remover com confirmação.                                                                                                            |
| Corrida só permitia incrementos inteiros.                                         | Médio para precisão.                                        | Distância total com precisão de 0,1 km, incluindo correção para zero.                                                                                         |
| Progresso acima da meta expunha ARIA maior que 100.                               | Médio para acessibilidade.                                  | Valor acessível e largura visual limitados a 0–100; os totais reais continuam visíveis.                                                                       |
| O aviso de recuperação desaparecia após recarregar.                               | Baixo para recuperação.                                     | O estado do aviso é lido do arquivo preservado, inclusive após novos acessos.                                                                                 |
| Cinquenta parâmetros diferentes no mesmo ícone criavam cinquenta cópias em cache. | Baixo para robustez local.                                  | Chave e requisição canônicas dos assets; isolamento do cache por caminho sem colisões de pontuação.                                                           |
| Uma navegação com rede travada aguardava indefinidamente, apesar do shell salvo.  | Médio para disponibilidade.                                 | Retorno ao shell salvo após três segundos; atualização tardia continua em segundo plano.                                                                      |
| Relógio despertava a cada segundo e telemetria renderizava todo o dashboard.      | Custo desnecessário em repouso.                             | Relógio alinhado ao minuto, telemetria isolada e timers pausados com a página oculta.                                                                         |
| Árvore de desenvolvimento do Tailwind tinha advisories de negação de serviço.     | Risco de build com CSS/globs hostis.                        | Migração para Tailwind 4.3.3 com tokens preservados; remoção da árvore vulnerável.                                                                            |

A migração do armazenamento lê o JSON anterior apenas quando a base ainda não contém registros. Estado e arquivo de recuperação são copiados na mesma transação; a cópia antiga só é removida após commit confirmado. Se a migração falhar, o original permanece. Abas da versão 0.2 devem ser recarregadas antes de continuar usando a versão nova.

Também foi corrigida uma divergência de hidratação: abrir o HTML estático em outro dia/fuso gerava React #418 e recriava a árvore. O primeiro render agora é determinístico; a data e os registros reais entram após a hidratação. Alvos de séries são explícitos, evitando que dois toques rápidos no mesmo número contem uma série extra.

## Revisão por fluxo

| Área             | O que foi examinado                                                                                   | Resultado e limite atual                                                                                                       |
| ---------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Hoje e navegação | Estado demonstrativo/pessoal, atalhos, troca de seções, telas de 320–430 px, rodapé e barra inferior. | Layout sem overflow nos tamanhos testados. Controles frequentes permanecem na navegação inferior e nos painéis.                |
| Check-in         | Energia, humor, estresse, sono obrigatório e peso/passos opcionais.                                   | Valores validados, atualização do registro do dia e persistência após recarga. Sem pontuação de aparência ou diagnóstico.      |
| Movimento        | Séries, correção, corrida, distância decimal e metas excedidas.                                       | Registros locais funcionais. A ficha, cargas e exercícios continuam predefinidos e identificados como exemplo.                 |
| Alimentação      | Macronutrientes, calorias 4/4/9, água, remoção e correção.                                            | Registro reversível; água aparece antes do formulário para acesso rápido. Totais anteriores não são inventados como refeições. |
| Cuidado          | Todos os cinco hábitos, marcação, desmarcação e novo dia.                                             | Estados persistidos, controles circulares e feedback visual. Não há prescrição de suplementação.                               |
| Engenharia       | Filtros de commits/PRs/deploys e blocos de foco.                                                      | Dados externos demonstrativos identificados; espaço pessoal sem métricas GitHub inventadas. Foco separa projeto de estudo.     |
| Conhecimento     | Aulas, desfazer, insights longos, acesso a antigos e exclusão.                                        | Conteúdo acessível por paginação. Os cursos ainda são modelos predefinidos.                                                    |
| Wishlist         | Inclusão, prioridade, aquisição reversível, filtros e remoção.                                        | Estado vazio distingue ausência de planos de itens já adquiridos. Remoção confirmada.                                          |
| Evolução         | Resumos de sete dias, lacunas, sono e peso.                                                           | Apenas registros existentes entram nos cálculos. Histórico limitado a 90 resumos diários.                                      |
| Meu espaço       | Metas, importação, confirmação, exportação e recuperação.                                             | Arquivos inválidos preservam os registros atuais. Trocar o arquivo cancela a confirmação anterior.                             |
| Painéis          | Foco de teclado, Escape, retorno de foco, arrastar para fechar e conteúdo rolável.                    | Verificações Chromium e axe; teclado, VoiceOver e safe areas físicos ainda pendentes.                                          |
| PWA              | Manifesto, basePath, ícones, primeira visita offline, falhas de rede e cache.                         | Exportação estática testada com o caminho de Pages; offline depende de uma primeira visita online concluída.                   |

## Segurança: superfície realmente testada

O produto atual é um frontend local, sem login, API, banco remoto ou OAuth. Foram testadas entradas e arquivos hostis, repetição de ações, integridade entre abas, limites de armazenamento, XSS por conteúdo importado, chaves de protótipo, escopo de cache e dependências. Não existe endpoint de autenticação para um teste real de brute force de senhas. Nenhum serviço externo foi atacado.

Os testes adversariais incluem JSON truncado/profundo, conteúdo multibyte acima do limite, IDs duplicados, relações inválidas, totais inconsistentes, 256 mutações determinísticas e milhares de ações repetidas. Strings como `<img src=x onerror=...>` permaneceram texto; não houve criação do elemento nem execução do evento. Chaves `__proto__`, `constructor` e `prototype` não alteraram protótipos nos caminhos examinados.

O audit inicial completo tinha sete entradas, propagadas por dois advisories: GHSA-vfj7-8cjw-p6xm e GHSA-rj75-hqrm-r3gf. A árvore de produção já estava limpa. Após a migração do Tailwind, o audit completo ficou sem vulnerabilidades conhecidas na data da revisão. Isso não é garantia de ausência de vulnerabilidades.

No modo Next com servidor há `nosniff`, proteção de iframe, política de referência e bloqueio de câmera/microfone/geolocalização. O service worker recebe CSP restrita à própria origem. **Esses headers não acompanham o export estático no GitHub Pages**: dependem de hospedagem/proxy que permita configurá-los. CSP completa da página continua pendente de uma estratégia compatível com os scripts inline do Next e os estilos animados.

IndexedDB e backups não são criptografados pelo aplicativo. Código de outra página na mesma origem pode ler o armazenamento, mesmo em outro caminho. Para medidas pessoais reais, usar uma origem dedicada; o scope do service worker não é uma barreira de privacidade. Nenhuma credencial deve ser colocada no frontend ou no repositório.

## Performance medida

Medições de laboratório local em Chromium headless, viewport 390×844, CPU 4× mais lenta e rede configurada em 150 ms/1,6 Mbps via CDP; três execuções por versão. Não representam um iPhone físico ou dados de usuários em produção.

| Cenário                                              | Antes        | Depois      | Interpretação                                                                                                |
| ---------------------------------------------------- | ------------ | ----------- | ------------------------------------------------------------------------------------------------------------ |
| HTML atrasado artificialmente em 8 s, shell já salvo | 8.059 ms     | 3.045 ms    | O cache permite abrir a aplicação durante uma conexão travada.                                               |
| 50 consultas distintas ao mesmo ícone                | +50 entradas | +0 entradas | O cache não cresce com essas variantes.                                                                      |
| Execução JS em janela ociosa de 13 s, mediana        | 63,2 ms      | 4,4 ms      | Menos custo de timers/renderizações nessa janela sintética. Não é ganho geral de 93% nem medição de bateria. |
| LCP, mediana                                         | 868 ms       | 876 ms      | Nenhuma melhoria de carregamento inicial demonstrada.                                                        |
| CLS                                                  | 0            | 0           | Sem deslocamento de layout observado nessas execuções.                                                       |

As medições dos timers foram feitas antes da última migração transacional, com o mesmo isolamento de relógios. O build integrado acrescenta funcionalidades e validação; não foi apresentada uma redução de bundle. Os painéis continuam disponíveis no primeiro uso offline, evitando adiar código indispensável para uma rede indisponível.

## Validação reproduzível

```bash
npm ci
npm run format:check
npm audit
npm run test:unit
npm run build
npm test
npm run build:pages
npm run test:pages
```

As suítes cobrem iPhone emulado e desktop. Os testes de concorrência executam rajadas simultâneas em duas abas; os de falha abortam gravações e verificam preservação e retomada. A verificação de Pages exercita assets prefixados, manifesto, navegação lenta e interações offline.

Resultado local: **20 testes de domínio/adversariais e 58 testes de interface passaram**, além de dez execuções consecutivas do cenário de concorrência entre abas. As varreduras axe dos estados cobertos não encontraram violações; isso não substitui avaliação com VoiceOver.

## Próximas prioridades de produto

1. Validar Safari físico: instalação, teclado, VoiceOver, zoom, safe areas e gesto de fechar.
2. Permitir personalizar ficha de treino e cursos, preservando histórico e sem transformar o app em uma tela de configuração extensa.
3. Escolher uma origem dedicada e uma hospedagem com headers antes de usar dados pessoais reais em um lançamento público.
4. Implementar integrações reais somente com autorização e backend: OAuth, sessões, limites de requisição, proteção contra brute force e revisão específica de privacidade/cache.
5. Medir hidratação e latência de registro no iPhone real antes de dividir bundles ou adicionar novas métricas.

A publicação do código e a disponibilidade do site são verificações separadas. O workflow de Pages depende da habilitação do serviço nas configurações do repositório.

## Revisão de publicação · 23 de outubro de 2026 · 0.3.1

O site foi publicado em [GitHub Pages](https://proganakin.github.io/KernelHub/). A verificação HTTPS confirmou HTML, manifesto, três ícones, oito assets JS/CSS e service worker. O Chromium remoto deste ambiente recusou a CA; a inspeção HTTP usou validação TLS normal, sem ignorar certificados. Interações e offline continuam validados no build de produção local/export estático, sem alegar teste de Safari físico.

Uma regressão adicional foi reproduzida: +250 ml pendentes às 23:59, seguidos de +250 ml às 00:01, viravam 500 ml no dia novo. Agora as ações guardam data local e horário; o replay ocorre antes do rollover. O resultado é 250 ml hoje e os 250 ml anteriores no resumo de ontem.

Quando outra aba já arquivou o dia, o resumo existente não contém detalhe suficiente para mesclar uma ação antiga com segurança. Nesse caso, a gravação é abortada, o banco permanece intacto e a sessão pode ser exportada. Uma restauração confirmada resolve o conflito com o snapshot escolhido; não há mesclagem silenciosa.

Foram acrescentados cinco testes de domínio e quatro cenários de browser (iPhone/desktop), incluindo exportação da sessão e resolução explícita do conflito. A suíte passa a conter 25 testes de domínio/adversariais e 62 testes de interface.
