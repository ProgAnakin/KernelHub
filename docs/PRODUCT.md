# KernelHub · hipótese de produto

**Um centro diário para transformar intenção em pequenos avanços observáveis.** A tela inicial deve responder “como estou, o que importa hoje e o que acabei de fazer” em poucos segundos.

O primeiro público assumido é uma pessoa que combina rotina física, trabalho técnico e aprendizado. A implementação não depende dessa hipótese: o protótipo permite experimentar os três e observar qual realmente merece destaque.

## Estado atual · revisão 0.2

O protótipo passou a incluir check-in de bem-estar, sono, peso e passos opcionais; blocos concluídos de projeto e estudo; metas pessoais; histórico diário e um panorama de sete dias. O modo pessoal começa sem dados fictícios e apresenta integrações indisponíveis de forma explícita. Exportação, restauração validada e recuperação de registros antigos completam o fluxo de backup local.

A ideia central e a linguagem visual foram mantidas. Consulte a [revisão de UX](UX-REVIEW.md) para o diagnóstico de cada módulo e as próximas inclusões priorizadas. As hipóteses e integrações abaixo continuam como direção de produto, não como funcionalidades já conectadas.

## Recorte inicial

O núcleo é **consultar → agir → registrar → continuar o dia**. Ações rotineiras precisam de poucos toques: água no próprio card, séries no painel de treino, cuidado por checkbox e aula por conclusão. Notas e refeições recebem formulário apenas quando os dados são necessários.

“Hoje” oferece contexto. “Corpo” concentra a rotina. “Evoluir” reúne construção e aprendizado no iPhone. “Coleção” mantém recursos e desejos fora do caminho dos cuidados cotidianos. O botão central abre registros rápidos de qualquer seção.

Aquisições precisam de um objetivo, além do preço. Cursos devem registrar compreensão, além de porcentagem. Métricas técnicas precisam descrever o trabalho feito, sem criar uma pontuação geral de valor pessoal.

## Decisões de experiência

1. **Dados acima, ação perto do polegar.** Navegação e painéis surgem na base. Uma regra absoluta de “100% dos controles nos 60% inferiores” não se mantém com rolagem, teclado, texto ampliado e tamanhos de iPhone distintos. O critério prático é concluir as ações frequentes sem alcançar o topo; preservar leitura, zoom e acessibilidade.
2. **Estado confiável antes de automação.** Dados de exemplo têm identificação visível. Relógio local não implica sincronização com um dispositivo. Uma futura integração precisa informar origem, instante da última sincronização e indisponibilidade.
3. **Sem haptics prometido no Safari.** Vibração só é chamada quando suportada. Mudança de estado, confirmação visual e leitores de tela continuam sendo o feedback principal. Nenhuma funcionalidade depende da vibração.
4. **Progressos são distintos.** Body Battery, hábitos, calorias, aulas e deploys não formam um “score de vida”. O indicador diário conta os cinco cuidados, água e treino; as demais métricas mantêm seu contexto.
5. **Sem esconder o dia anterior em uma corrida de streaks.** A rotina diária reinicia, mas o histórico permanece até seu limite de armazenamento. Gráficos de contribuições desta versão são exemplos, não análise do usuário.
6. **Local primeiro para testar a utilidade.** A demonstração não pede credenciais de saúde. Persistência local permite testar os fluxos, mas não oferece a recuperação e sincronização esperadas de um produto final.

## Modelo de domínio

| Domínio      | Unidade observável                              | Próxima integração                                                    |
| ------------ | ----------------------------------------------- | --------------------------------------------------------------------- |
| Recuperação  | Frequência, sono, Body Battery com fonte        | Avaliar acesso autorizado à Garmin Health API ou importação suportada |
| Movimento    | Série concluída e distância registrada          | Provedor de treino escolhido pelo usuário                             |
| Nutrição     | Macros e água registrados                       | Catálogo de alimentos ou importação, se poupar digitação              |
| Rotina       | Cuidado concluído por data                      | Regras editáveis pelo usuário                                         |
| Engenharia   | Commit, PR e implantação como eventos distintos | GitHub App/OAuth no servidor e fonte real dos deploys                 |
| Conhecimento | Aula concluída e insight escrito                | Links e importações úteis, antes de integrações por plataforma        |
| Aquisições   | Item com objetivo, prioridade e status          | Planejamento de orçamento; não checkout                               |

Para evoluir o backend, separar entidades de catálogo e eventos de execução. Cada evento deve ter `id`, usuário, instante, data local, fuso, origem e identificador externo para deduplicação. Agregações são derivadas, não contadores incrementados em paralelo. Uma implantação de provider não deve ser inferida pela quantidade de commits.

## Integrações e arquitetura futura

- **GitHub:** autorização de leitura com menor escopo possível no backend; webhooks assinados, deduplicação e reconciliação periódica. Repositórios privados precisam de autorização própria. Deploys vêm de GitHub Deployments/Actions ou do provedor realmente usado.
- **Garmin:** confirmar elegibilidade, contrato e métricas disponibilizadas pelo canal oficial antes de prometer sincronização. Não armazenar senha Garmin nem depender de scraping de login. HealthKit não está diretamente disponível para uma PWA; uma ponte nativa mudaria o escopo.
- **Dados pessoais:** conta, banco, política de retenção, exportação/importação, isolamento por usuário e armazenamento seguro de credenciais antes de sincronização real. Manter respostas autenticadas fora do cache público do service worker.
- **Offline:** o protótipo guarda o shell e registros pequenos. Para múltiplos dispositivos, usar fila de eventos idempotente em IndexedDB, sincronização com conflitos definidos e confirmação explícita de salvamento.

## O que validar antes de aumentar o escopo

Durante sete dias, observar: tempo até o primeiro registro, quantidade de aberturas úteis, campos abandonados e módulos ignorados. Uma sessão curta e bem concluída vale mais do que tempo de tela.

As duas decisões iniciais são o resultado prioritário (corpo, evolução técnica ou equilíbrio) e o público (uso pessoal ou produto para terceiros). Sem resposta, esta versão segue com equilíbrio e uso pessoal, mantendo as integrações reais fora do protótipo.

Depois, decidir: o registro manual já é útil? Qual fonte evita mais digitação? A pessoa consulta energia para adaptar o dia ou só olha o número? Ela revisita os insights? A wishlist ajuda a priorizar ou vira acúmulo? As respostas devem definir a próxima entrega.

## Nome e posicionamento

KernelHub funciona como nome de trabalho para alguém próximo da engenharia: um núcleo que reúne rotinas. Pode parecer técnico demais para um público amplo de bem-estar; esse tradeoff precisa de teste.

Não foi feita busca de domínio, lojas, nomes empresariais ou marcas. Uma validação de disponibilidade exige consultas datadas ao registrador do domínio, App Store, mecanismos de busca e registros de marca pertinentes (por exemplo, INPI, EUIPO e WIPO). Disponibilidade de domínio não garante direito de uso da marca.
