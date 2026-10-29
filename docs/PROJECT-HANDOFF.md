# KernelHub · estado do produto e passagem de contexto para outra IA

Revisão de **28 de outubro de 2026**. Base do aplicativo: commit **`0f054d75a2142a68fd0e3f18877adc53d3634d95`**, versão declarada no `package.json`: **0.4.0**. Este documento descreve o código observado, os pedidos do proprietário e as limitações verificadas; propostas futuras são identificadas como propostas.

- Repositório: [ProgAnakin/KernelHub](https://github.com/ProgAnakin/KernelHub).
- Aplicativo publicado: [proganakin.github.io/KernelHub](https://proganakin.github.io/KernelHub/).
- [Quality da base examinada](https://github.com/ProgAnakin/KernelHub/actions/runs/40125704664): concluído com sucesso.
- [Publicação da base examinada](https://github.com/ProgAnakin/KernelHub/actions/runs/40125704646): concluída com sucesso.
- A consulta ao GitHub confirmou esse commit em `main`; o site respondeu HTTP 200 nesta revisão. A publicação do aplicativo e a publicação das configurações do ambiente cloud são operações independentes.

> **Atualização de 29 de outubro de 2026 (0.5.0).** Uma revisão técnica posterior leu o código inteiro e corrigiu parte dos achados abaixo. Resolvidos: backup incompleto (§6), textos de integração contraditórios (§6), perda de rascunho ao fechar (§6) e distância entre abertura e ação (§6/§9). O que mudou, o que a revisão encontrou além deste relatório e o que continua em aberto está na [seção 12](#12-revisão-técnica-de-29-de-outubro-de-2026-050). As demais seções descrevem o estado de 28/10 e foram mantidas para referência.

## 1. O que é o produto e por que ele existe

KernelHub é um sistema pessoal diário para reunir corpo, recuperação, treino, alimentação, aparência, hábitos, aprendizado, engenharia de software e recursos futuros. A intenção é acompanhar a evolução da pessoa e devolver contexto útil para agir com menos esforço.

O usuário rejeitou uma experiência que funciona como uma planilha: abrir vários formulários, alimentar cada número manualmente e receber apenas totais. A diretriz central é **receber → normalizar → contextualizar → agir**. Cadastro e registro manual continuam necessários para escolhas, percepções e informações que não vêm de fontes externas; não devem constituir toda a proposta de valor.

O aplicativo deve responder rapidamente:

1. Como estou e quão recentes/confiáveis são os dados disponíveis?
2. O que mudou em relação ao meu próprio histórico?
3. O que merece atenção e qual ação prática posso realizar agora?
4. Em que avancei no corpo, na rotina, nos estudos e nos projetos?

A diferenciação pretendida está no contexto entre áreas da vida. Reproduzir os mesmos números já disponíveis no relógio não basta. Entretanto, associação entre duas séries não comprova causa; quantidade de commits ou minutos não comprova qualidade de trabalho ou aprendizado.

**Estado de maturidade:** há uma PWA funcional, publicada e com proteção relevante da integridade local. Ainda não existe um sistema completo de acompanhamento automático, sincronização entre dispositivos ou agentes especializados. A base é adequada para uso piloto e evolução; a visão completa permanece parcialmente implementada.

## 2. Decisões do proprietário que a próxima IA deve preservar

- O conceito abrange crescimento físico, mental, profissional, estilo de vida e aparência. Não reduzir o produto a treino, skincare ou um único dashboard de saúde.
- Priorizar iPhone e sensação de aplicativo iOS, com identidade OLED e interação cuidadosa. Desktop e notebook também precisam de interfaces próprias para tarefas extensas.
- Simplicidade significa reduzir esforço e organizar profundidade; não significa remover dados úteis nem exigir formulários longos para toda ação.
- Cada provedor fornece apenas o que realmente disponibilizar. Uma integração parcial continua útil; campos ausentes ficam vazios e não bloqueiam os demais.
- O Apple Saúde é a direção preferida para agregar dados dos dispositivos. A cobertura depende do que cada app efetivamente escreve nele e das permissões da pessoa.
- Água será registrada no KernelHub. Uma futura escrita no Apple Saúde deve ter permissão e deduplicação próprias.
- Cursos precisam funcionar entre plataformas diferentes. O usuário ainda não definiu um método completo de avaliação da aprendizagem; não assumir que tempo assistido mede compreensão.
- A personalização profunda do treino com agente é futura e opcional. Deve considerar estrutura de treino, anatomia, RIR, descanso, progressão e técnicas pertinentes, com possibilidade de passagem para Hevy/PDF.
- Suplementação precisa evoluir para registros precisos e eventual apoio com evidências. Peso corporal sozinho não define dose segura.
- O proprietário espera implementação e mudanças perceptíveis, correções, testes e acesso à versão publicada. Evitar reescritas amplas sem necessidade e pedidos repetidos de autorização já concedida.
- KernelHub e KernelHub.dev são identidade de trabalho. Disponibilidade de marca e domínio não foi comprovada.

## 3. Como o projeto chegou ao estado atual

| Etapa / referência         | Resultado relevante                                                                                                                 |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| 0.1–0.2, 22/10/2026        | Shell OLED/PWA, módulos demonstrativos, registros locais, check-in, foco manual, metas, backup e exportação estática.               |
| 0.3, 22/10/2026, `cc91abf` | Transações IndexedDB entre abas, recuperação, correções de registros, validação de backups, robustez offline e testes adversariais. |
| `3b5c473`                  | Correção de ações pendentes na virada do dia, preservando a data original e explicitando conflitos.                                 |
| 0.4, 23/10/2026, `7a2aaee` | Panorama novo, GitHub público real, importação XML de saúde e cronômetro persistente.                                               |
| `3d484e5`                  | Correção do ciclo exportação Pages → build normal: `out/` excluído da verificação TypeScript.                                       |
| `d276155`, 23/10/2026      | Armário de skincare AM/PM, cadastro compartilhado, checks independentes, histórico e fotos locais.                                  |
| `0f054d7`, 24/10/2026      | Editores em tela inteira no computador, diferenças por largura/altura e painéis móveis expansíveis com adaptação ao teclado.        |

O número 0.4.0 não foi incrementado nas duas últimas funcionalidades. README, changelog e revisões antigas não descrevem integralmente essas entregas; a referência de commit é mais precisa para este relatório.

## 4. Inventário funcional: o que existe e o que falta

| Área               | Implementado no código                                                                                                           | Limite e evolução necessária                                                                                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Hoje               | Panorama de saúde, fontes, contexto, atividade técnica, foco, nutrição e cuidados; gráficos com lacunas e prévias identificadas. | A abertura continua extensa. Falta priorização pessoal de módulos e próximos passos com maior valor entre domínios.                                       |
| Saúde              | Importação local do XML compatível do Apple Saúde, normalização de oito métricas, procedência, datas e séries.                   | Importação pontual, não sincronização contínua. Sem HealthKit direto, Garmin, Fitbit ou WHOOP conectados.                                                 |
| Contexto corporal  | Sono comparado à meta; FC em repouso comparada a registros anteriores quando há base suficiente.                                 | Não é avaliação clínica; falta evolução contextual mais ampla, validada e baseada em cobertura adequada.                                                  |
| Check-in           | Energia, humor e estresse em escalas subjetivas; sono, peso e passos manuais conforme os campos.                                 | O sono manual e o sono importado alimentam visões diferentes; falta uma política unificada de precedência e apresentação.                                 |
| Musculação         | Marcação/correção de séries de uma ficha predefinida.                                                                            | Exercícios, cargas e repetições ainda vêm de catálogo fixo. Sem rotina livre, progressão, descanso medido ou integração de execução.                      |
| Corrida            | Distância decimal, correção de total e meta pessoal.                                                                             | Sem GPS, duração/ritmo de uma atividade, zonas, esforço ou histórico detalhado de sessões importadas.                                                     |
| Água e alimentação | Água reversível; refeições com macros; remoção; correção confirmada de totais; calorias por 4/4/9; metas configuráveis.          | Predominantemente manual. Sem catálogo alimentar, código de barras, importação ou planejamento alimentar.                                                 |
| Skincare           | Armário de três prateleiras, portas, AM/PM, produtos próprios, sequência independente, checks, métricas, histórico e fotos.      | ~~Sem backup/restauração do módulo~~ (resolvido na 0.5). HEIC não suportado. Constância usa dias planejados armazenados, não todos os dias do calendário. |
| Outros cuidados    | Suplementação e grooming como checks diários.                                                                                    | Sem criação de hábitos, frequência configurável ou protocolo estruturado de suplementos.                                                                  |
| GitHub             | Perfil e até 100 eventos públicos, atualização limitada enquanto visível, snapshot local, filtros e totais derivados.            | Sem repositórios privados, OAuth, histórico completo ou garantia de atualização em segundo plano.                                                         |
| Foco               | Início, pausa, retomada, recarga e conclusão com minutos medidos; também há registro manual corrigível.                          | Sem vínculo estruturado com projeto/curso e sem comprovação de resultado do trabalho apenas pelo tempo.                                                   |
| Aprendizado        | Dois cursos de exemplo, avanço/correção de aulas, insights paginados e exclusão.                                                 | Sem cadastro livre, módulos próprios, vínculo com foco, revisão espaçada ou evidências estruturadas de aplicação.                                         |
| Carreira           | Eventos GitHub, blocos de projeto e anotações.                                                                                   | Sem entidades próprias de projeto, objetivos de habilidade ou revisão de resultados de carreira.                                                          |
| Aquisições         | Inclusão de item, categoria, objetivo, preço, prioridade, aquisição reversível e exclusão confirmada.                            | Sem orçamento, reposição, estoque ou ciclo de consumo. Essas extensões só se justificam com uso real.                                                     |
| Dados              | IndexedDB, concorrência, recuperação e backup JSON do estado principal.                                                          | Sem conta, nuvem, sincronização, criptografia do app ou backup completo de todos os módulos.                                                              |
| PWA                | Manifesto, metadados iOS, safe areas, instalação e shell offline após visita online.                                             | Safari/iPhone físico ainda não validado. Não existe acesso web direto ao HealthKit nem execução contínua garantida com a PWA fechada.                     |

### Saúde: contrato real e limites do importador

As oito métricas atuais são sono, FC em repouso, frequência cardíaca, VFC por **SDNN**, passos, energia ativa, peso e distância de caminhada/corrida. VFC SDNN não deve ser tratada como equivalente a RMSSD.

O usuário seleciona `export.xml` já descompactado. O limite é **12 MiB e 150 mil registros**; a janela normalizada retém até **14 dias contados da medida mais recente do arquivo**, não necessariamente de hoje. Exportações completas de longa duração podem exceder esse limite, o que torna o fluxo atual pouco prático para uso frequente.

O parser trabalha em Web Worker. Ausências permanecem `null`. Totais usam uma fonte por métrica/dia para reduzir duplicações; sono une intervalos de sono sobrepostos e atribui o episódio pela data de término. Essa estratégia não reproduz toda a arbitragem do Apple Saúde.

O snapshot importado é substituível por outra importação; não há um repositório longitudinal ilimitado de amostras brutas. Body Battery e índices proprietários de recuperação não aparecem como medidas reais sem uma fonte autorizada que os forneça.

### GitHub: o que os números significam

A conexão atual usa nome de usuário público, sem senha/token. Atualiza em cadência mínima de **dez minutos**, enquanto visível e conforme quota, indicação de polling e falhas. Há proteção contra respostas atrasadas após desconexão.

**Push, commit, PR mesclado, release e deploy são eventos diferentes.** Payload público incompleto não autoriza inferir commits; deploy só deve ser contado quando houver evidência correspondente. Um feed de até 100 eventos não prova streak completo ou total de contribuições. O app não oferece monitoramento garantido quando está fechado.

### Skincare: regras completas já implementadas

1. **Visualização:** três prateleiras, portas de correr, iluminação diferente por período e rotação animada na alternância. Movimento reduzido é respeitado.
2. **Horário:** AM antes das 16h e PM a partir das 16h por padrão; meia-noite retorna a AM. A transição pode ser configurada entre 00:01 e 23:59; 00:00 é excluído para preservar a regra de retorno a AM na virada do dia.
3. **Controle manual:** permite escolher AM/PM independentemente do relógio. A escolha dura até a próxima fronteira automática, mudança de configuração/fuso relevante ou meia-noite. A preferência usa a sessão da aba; não é uma preferência permanente sincronizada entre abas.
4. **Atualização:** considera data local, timers de fronteira e retomada por visibilidade/foco/`pageshow`. Há testes de fusos e horário de verão.
5. **Catálogo:** um mesmo ID de produto serve para AM, PM ou ambos. Há nome, marca, tipo, prateleira e arquivamento. A sequência de aplicação é própria de cada período.
6. **Execução:** chave lógica produto + data local + período. Estados `pending`, `used`, `skipped`; não uso admite motivo. Correção substitui o registro lógico, sem criar outro consumo. Pendência nunca vira não uso automaticamente.
7. **História:** cada dia conserva snapshots do planejamento e dos produtos. Alterações posteriores não reescrevem nomes e evidências já registradas. Há filtros por datas, produto, período e status, com correção de registros antigos válidos.
8. **Métricas:** `used / planned`, com pendentes e não usados separados. Uma rotina sem produtos não é 100% concluída. Há contagem AM, PM e de dias planejados completos.
9. **Constância:** considera os dias que realmente têm planejamento armazenado. Dias em que o aplicativo não foi usado não são reconstruídos automaticamente. Esse percentual não deve ser anunciado como aderência a todos os dias do calendário.
10. **Fotos:** JPEG/PNG/WebP até 5 MiB, data e nota, normalização para até 1600 px e JPEG, retirada de metadados pela regravação, exclusão confirmada e consulta dos registros entre duas fotos. HEIC e SVG são rejeitados. Não há análise clínica ou pontuação de aparência.
11. **Persistência:** produtos, histórico e fotos ficam localmente e **não entram no backup geral**. Há aviso no módulo; limpar dados do navegador perde esse conteúdo.
12. **Legado:** os antigos checks agregados de skincare foram retirados dos controles ativos; os campos antigos e registros existentes permanecem para compatibilidade. Não foi inventada uma migração que atribua a um produto um uso que nunca foi registrado.

## 5. Arquitetura atual e onde modificar cada parte

### Stack e organização

- Next.js **16.4.2**, App Router; React/React DOM **19.3.1**; TypeScript **5.9.3**.
- Tailwind **4.3.3**, CSS específico, Framer Motion **14.6.0**, Lucide **1.61.0**, Zod **4.6.7**.
- Node 24 no CI. O README estabelece Node 22.18+ como requisito mínimo.
- Uma rota principal em `app/page.tsx`; navegação e editores controlados por estado React. Não há backend de contas, API própria ou banco remoto.
- HTML inicial determinístico; data local e armazenamento entram após hidratação. Não trocar isso por `new Date()` divergente no primeiro render.
- A arquitetura usa funções de domínio + hooks + componentes. Não há necessidade atual de adicionar uma biblioteca global de estado para pequenas evoluções.

| Responsabilidade                      | Arquivos principais                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Rota, metadados, viewport e manifesto | `app/page.tsx`, `app/layout.tsx`, `app/manifest.ts`                                                                                         |
| Composição e navegação                | `components/dashboard.tsx`                                                                                                                  |
| Panorama e leituras do dia            | `components/pulse-overview.tsx`, `components/growth.tsx`, `lib/metrics.ts`                                                                  |
| Formulários gerais                    | `components/sheets.tsx`, `components/growth-sheets.tsx`                                                                                     |
| Primitivas, foco do diálogo e gestos  | `components/ui.tsx`                                                                                                                         |
| Fontes e atividade pública            | `components/source-center.tsx`, `lib/github.ts`, `lib/use-github.ts`                                                                        |
| Saúde e importação                    | `lib/health.ts`, `lib/health.worker.ts`, `lib/use-health.ts`                                                                                |
| Cronômetro                            | `components/focus-tracker.tsx`, `lib/focus-timer.ts`, `lib/use-focus-timer.ts`                                                              |
| Contrato e estado principal           | `types/kernel.ts`, `lib/state.ts`, `lib/storage.ts`, `lib/use-kernel.ts`                                                                    |
| Exemplos e catálogos fixos            | `lib/mock-engine.ts`                                                                                                                        |
| Domínio e persistência skincare       | `lib/skincare.ts`, `lib/skincare-storage.ts`, `lib/use-skincare.ts`                                                                         |
| Interface skincare                    | `components/skincare-cabinet.tsx`, `components/skincare-history.tsx`, `components/skincare-summary.tsx`                                     |
| Estilos                               | `app/globals.css`, `app/shell.css`, `app/pulse.css`, `app/skincare.css`, `app/skincare-history.css`, `app/panels.css`, `tailwind.config.ts` |
| Offline e caminhos                    | `public/sw.js`, `lib/paths.ts`, `scripts/precache.mjs`                                                                                      |
| Build e publicação                    | `next.config.ts`, `scripts/build-pages.mjs`, `.github/workflows/`                                                                           |

### Persistência e ciclo de gravação

| Escopo                   | Banco / store / chaves                                                                                          | Backup geral                                                |
| ------------------------ | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| Estado pessoal           | IndexedDB `kernelhub`, versão 1, store `records`, chave `kernelhub:state:v1`; recuperação em `:recovery`        | Sim                                                         |
| Cronômetro em andamento  | Mesmo banco/store, chave `kernelhub:focus-timer:v1`                                                             | Não; blocos concluídos passam a integrar o estado principal |
| Skincare                 | Mesmo banco/store; prefixos `kernelhub:skincare:settings:v1`, `:day:`, `:photo-meta:`, `:photo-blob:` e revisão | Não                                                         |
| GitHub                   | `kernelhub-integrations`, store `github`, conexão e revisão                                                     | Não                                                         |
| Saúde                    | `kernelhub-health`, store `snapshots`, snapshot e revisão                                                       | Não                                                         |
| Preferência AM/PM manual | `sessionStorage`, `kernelhub:skincare:view:v1`                                                                  | Não                                                         |
| Assets públicos          | CacheStorage do service worker, namespace por caminho/build                                                     | Não contém a base dos registros pessoais                    |

O estado principal é modificado por comandos tipados. Leitura, aplicação e gravação ocorrem na mesma transação IndexedDB, serializando escritores de abas distintas. BroadcastChannel comunica invalidação; o banco é a fonte de verdade. A fila preserva IDs e datas de ações pendentes para retentativas.

Na virada do dia, o núcleo arquiva um resumo e renova os dados diários. Metas, cursos, aquisições e insights continuam. O estado principal limita **90 resumos, 200 eventos recentes e 500 insights**; não é um histórico bruto integral de todos os domínios. O backup JSON validado tem limite de **2 MiB**. Skincare possui armazenamento por dia separado e não sofre o corte de 90 resumos.

Falhas de gravação são exibidas. No núcleo, alterações da sessão podem ser mantidas como pendentes; fechar sem persistência ainda pode perdê-las. Conflitos em que outra aba já arquivou o dia exigem resolução explícita, sem misturar as datas silenciosamente. Saúde/GitHub usam revisões para impedir que uma resposta atrasada restaure dados removidos.

O cronômetro reconstrói tempo por timestamps. Conclusão grava minutos completos a partir de 60 segundos e consome a sessão na mesma transação, no dia da conclusão; pausas não contam. Acima de oito horas há revisão explícita. Não depende de um intervalo JavaScript rodando continuamente em segundo plano.

### Modelo de dados: cuidado com a evolução

`KernelState` ainda é versão 1 e contém catálogos/referências fixos, inclusive os dois IDs de curso e campos legados de skincare. Alterar esses contratos exige migração explícita, backup compatível e testes de referências; remover um campo antigo pode inviabilizar restauração.

Saúde, GitHub, foco e skincare têm contratos próprios. O tipo unificado `Observation` em `docs/INTEGRATIONS.md` é **proposta**, não uma camada já implementada em todos os módulos. A próxima evolução deve separar catálogo, plano/protocolo e evento executado, com IDs estáveis, unidade, origem, instante e regra de dia local.

## 6. UI e UX: o que melhorou e o que ainda precisa de atenção

### Identidade e comportamento responsivo atuais

OLED `#000000`, superfícies translúcidas e bordas discretas permanecem. A versão 0.4 acrescentou verde-lima `#C8F06A` e azul `#55AAFF` aos acentos originais verde `#30D158`, azul `#0A84FF` e âmbar `#FF9F0A`. Fontes de sistema priorizam a família Apple quando disponível; SF Pro não é distribuída no repositório.

A barra inferior oferece Hoje, Corpo, registro rápido, Foco e Evolução; Coleção, Fontes e Meu espaço têm acessos no rodapé e nos cabeçalhos. Cada seção tem URL (`#corpo`, `#foco`, `#evolucao`, `#colecao`). O layout amplo usa navegação lateral. A interface tem estados demonstrativo e pessoal; prévias devem continuar identificadas.

Todos os editores compartilham `BottomSheet`:

- Abaixo de 900 px: painel inicia com cerca de 84% da altura visível e pode expandir por botão ou arraste; tocar um campo também expande. `visualViewport` ajusta altura/posição com teclado. O arraste na alça expande, reduz e fecha.
- Entre 600 e 899 px: limite de largura de 720 px.
- A partir de 900 px: editor ocupa a tela inteira, com cabeçalho/retorno e conteúdo rolável, sem o pequeno cartão central.
- A partir de 1600 px: área de conteúdo mais ampla e tipografia/espaçamento maiores. Alturas de até 800 px usam cabeçalho compacto.
- Skincare possui armário e rotina em colunas no computador; o cadastro também pode dividir espaço com a biblioteca.

“Notebook” e “desktop” são tratados por viewport, não por identificação de hardware. Um notebook ligado a um monitor amplo recebe o layout amplo; uma janela estreita no desktop recebe o layout estreito. Não existem dois apps nem rotas diferentes por dispositivo.

Há foco contido no diálogo, Escape, restauração de foco, botões alternativos aos gestos e movimento reduzido. Haptics via `navigator.vibrate` são opcionais; Safari no iPhone não oferece essa API. Zoom por pinça é preservado; `touch-action: manipulation` reduz interações acidentais sem bloquear acessibilidade.

### Problemas confirmados nesta análise

| Achado                                                 | Evidência / impacto                                                                                                                                                                              | Próxima correção recomendada                                                                                                           |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Backup incompleto para a percepção de “meu espaço”     | `WorkspaceSheet` exporta apenas `JSON.stringify(state)`; skincare/fotos, fontes e timer ativo ficam fora. O módulo de skincare avisa, mas a exportação geral não resolve portabilidade integral. | Definir backup versionado por escopo, incluindo imagens de forma adequada, restauração validada e indicação clara do que foi incluído. |
| Textos de integração contraditórios                    | `components/growth-sheets.tsx` diz que integrações ficam sem conexão até versão futura e que Garmin e GitHub não estão conectados. GitHub público já funciona; a frase é incondicional.          | Usar capacidades e estado reais das fontes; distinguir GitHub existente de Garmin futuro.                                              |
| Fechar perde rascunho sem aviso                        | Em browser, preencher produto, fechar o painel e reabrir elimina o editor/rascunho. `BottomSheet` chama fechamento por botão, Escape ou gesto sem proteção de alterações.                        | Adotar rascunho local ou confirmação de descarte para formulários com dados alterados, sem atrasar ações simples.                      |
| Tela inteira ainda é um diálogo na arquitetura         | Mantém `aria-modal`, foco contido e navegação em estado; não há rotas/URLs por editor.                                                                                                           | Avaliar histórico do navegador, links diretos e semântica por tarefa. Fullscreen resolveu espaço, não navegação completa.              |
| Documentação defasada                                  | README/PRODUCT/CHANGELOG e revisões mais antigas não incorporam integralmente skincare e novos painéis; algumas falas ainda descrevem cuidados fixos ou GitHub só demonstrativo.                 | Atualizar resumos/versionamento a partir do código, preservando revisões históricas com sua base explícita.                            |
| Persistência separada versus ideia de reiniciar espaço | `start-personal` substitui apenas `KernelState`; fontes, skincare e timer têm outros registros.                                                                                                  | Especificar e comunicar o alcance de “começar”, “restaurar” e “apagar tudo”; não apagar outros módulos implicitamente.                 |

Não foi demonstrado um novo defeito bloqueante nos fluxos cobertos pelos testes. Os achados acima continuam relevantes: testes verdes não verificam toda a coerência de conteúdo, portabilidade ou utilidade diária.

### Avaliação de design e produto a validar com o usuário

A inspeção atual em Chromium mostra que o armário ganhou espaço útil no notebook e que a separação por períodos está clara. O estado vazio explica como começar. Entretanto, a tela Hoje agrega muitos cards e ações, metadados pequenos e bastante conteúdo abaixo da primeira tela; ainda precisa de teste de tarefa e compreensão, não apenas contraste automatizado.

Como referência de extensão, uma abertura demonstrativa a 390 × 844 px produziu aproximadamente 4.167 px de documento, sem overflow horizontal. Isso descreve esse cenário, não todos os usuários; sugere testar a prioridade dos cards e a necessidade de rolar antes das ações mais úteis.

O armário deve permanecer uma forma rápida de encontrar o próximo produto. Animação e portas não devem adicionar passos obrigatórios ou consumir espaço excessivo com catálogos grandes. Testar sequência de uso, leitura de nomes longos e retorno ao próximo passo é mais útil que adicionar efeitos visuais.

Fotos em HEIC são um atrito provável para iPhone; o código atualmente exige conversão. No notebook, deve-se validar zoom de 125–150%, teclado e alturas menores, além dos viewports automatizados. Não prometer que todo controle estará sempre nos 60% inferiores: rolagem, texto ampliado e teclado tornam isso inadequado como regra literal.

## 7. Segurança, privacidade e qualidade dos dados

### Proteções existentes

- Validação Zod e regras semânticas, limites de tamanho/quantidade e IDs/referências válidos.
- Texto renderizado pelo React; sem interpretação de HTML fornecido pelo usuário.
- XML com limites de registros, tags, profundidade e fontes; rejeição de estruturas/entidades incompatíveis, sem buscar recursos externos.
- GitHub com timeout, limite de resposta, URLs validadas, quota e preservação da última leitura em falhas.
- Transações atômicas, revisões entre abas, migração de localStorage somente após commit e recuperação de conteúdo incompatível.
- Fotos com tipos/assinaturas verificados; metadados e Blob gravados atomicamente; normalização na UI e revogação de Object URLs.
- Service worker limitado aos assets públicos do app, manifesto de build validado e cache canônico; APIs externas não são armazenadas nele.
- Lockfile e Actions fixadas por SHA; CI executa testes e auditoria de dependências.

### Limitações materiais

- IndexedDB e backups não são criptografados pelo aplicativo. Ausência de upload não significa isolamento de outras páginas da mesma origem.
- `proganakin.github.io/KernelHub` compartilha origem com outros projetos sob `proganakin.github.io`. Para dados sensíveis reais, uma origem dedicada é uma melhoria prioritária.
- Não há proteção por conta, sincronização, backup remoto nem política de recuperação entre dispositivos.
- Headers de `next.config.ts` existem no modo servidor, mas não são aplicados pelo export estático do GitHub Pages. CSP/headers do site exigem hospedagem ou proxy adequado; a CSP específica do service worker não é uma CSP estrita de toda a página.
- Não existe backend de autenticação a submeter a brute force. A revisão executada não é pentest externo ou certificação de segurança; quando surgirem contas/OAuth/APIs privadas, o modelo de ameaças muda.
- O limite de 50 megapixels de fotos é verificado depois da decodificação no browser; não elimina todo pico de memória de imagem hostil. Arquivos grandes de saúde também exigem atenção ao consumo real de memória em iPhone.
- Métricas antigas não se tornam recentes porque houve sincronização de rede. Medida ausente não é zero; demo não pode completar uma importação parcial.
- Não gerar diagnósticos, doses personalizadas ou causalidade a partir dos registros/fotos. A exigência é confiabilidade do acompanhamento, não alegação clínica.

### Pesquisa externa e viabilidade das integrações

`docs/MARKET-RESEARCH.md` registra uma pesquisa anterior limitada pelo proxy: páginas oficiais de concorrentes e portais de fornecedores retornaram CONNECT 403. Não há comparação atual conclusiva de recursos, preços, avaliações ou eficácia. Esta revisão do repositório não realizou uma nova pesquisa de mercado nem validou disponibilidade de marca/domínio.

`docs/INTEGRATIONS.md` documenta evidências então acessíveis em repositórios oficiais: GitHub público, cliente Garmin Personal API e especificação de integração do HevyGPT. Essas referências não comprovam acesso comercial, termos vigentes ou elegibilidade do KernelHub. Antes de implementar conectores, confirmar autorização, escopos, custos e formato efetivamente suportado. Importar FIT não equivale a sincronizar toda a conta Garmin; encontrar uma API Hevy não equivale a já poder transferir rotinas em produção.

## 8. Testes e evidências desta revisão

Executados novamente sobre a base examinada:

| Verificação                    | Resultado                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| `npm run test:unit`            | **71 passaram**, zero falhas.                                                                                         |
| `npm test`                     | **94 passaram**, zero falhas, em cerca de 1,5 minuto.                                                                 |
| `npm run typecheck`            | Passou.                                                                                                               |
| `npm audit --json`             | Zero vulnerabilidades reportadas nas dependências nesta consulta; isso não comprova ausência de falhas no aplicativo. |
| Site e GitHub Actions          | HTTP 200; Quality e Pages concluídos com sucesso para `0f054d7`.                                                      |
| Inspeção adicional em Chromium | Armário em notebook e panorama móvel; reprodução do descarte de rascunho ao fechar produto.                           |

Os 94 E2E correspondem a 47 cenários executados nos projetos iPhone e desktop; ambos usam **Chromium**, inclusive o projeto chamado iPhone. Há testes de acessibilidade automatizada, persistência, múltiplas abas, falha de gravação, migração, virada de dia/fusos, fontes, parser adversarial, timer, offline, skincare e novos painéis. Alguns cenários usam relógios/dados/respostas controlados.

Não foram repetidos nesta análise todos os builds/exports: o CI da base foi consultado e já confirma o pipeline. `npm run build:pages` e `npm run test:pages` possuem verificações próprias do caminho `/KernelHub/`, assets, manifesto, navegação offline e primeira importação XML offline.

**Ainda sem validação física:** Safari/iPhone, instalação e atualização real da PWA, teclado, safe areas, VoiceOver, fotos de câmera/HEIC, exportação real de longa duração do Apple Saúde e comportamento sob pouca memória/armazenamento.

As métricas de performance de `docs/RELEASE-0.4.md` são observações de laboratório de uma entrega anterior: FCP/LCP de 1.144 ms e CLS 0 no cenário descrito. Não foram medidas novamente aqui e não representam desempenho de campo da versão atual. Ainda faltam orçamento atual de JS, INP em tarefas reais e coleta consentida ou medições reproduzíveis em iPhone.

## 9. O que melhorar, em qual ordem e por quê

Estimativas abaixo são **ordens de grandeza de engenharia**, não prazos acordados. Consideram uma pessoa com o repositório funcionando, sem redesenho amplo; validação física, decisão de produto, credenciais e aprovação de fornecedores podem ampliar o calendário.

| Prioridade | Entrega proposta                                             | Por que agora / aceite mínimo                                                                                                                                                    | Esforço indicativo                                                                 |
| ---------- | ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| P0         | Corrigir textos e alcance de ações de dados                  | Informações do app devem refletir conexão, backup, restauração e reinício reais. Aceite: nenhum estado conectado contradito por texto fixo.                                      | Pequeno: 0,5–2 dias.                                                               |
| P0         | Backup/restauração completos, especialmente skincare e fotos | Histórico pessoal sem saída confiável não é uma base segura para adoção. Aceite: transferir catálogo, AM/PM, motivos e fotos entre dois perfis limpos, com validação e rollback. | Médio: 3–7 dias, dependendo do formato e compatibilidade.                          |
| P0         | Validação em iPhone físico e proteção de rascunhos           | Resolver teclado, fechamento acidental, PWA e memória antes de aumentar complexidade. Aceite: tarefas reais completadas sem perda de entrada ou controles inacessíveis.          | Pequeno/médio: 2–5 dias mais acesso a dispositivo/usuário.                         |
| P0         | Preparar origem dedicada e política de dados                 | Reduzir compartilhamento de origem e definir exportação/exclusão/headers. Aceite: origem controlada e comportamento de segurança confirmado na hospedagem escolhida.             | Depende de domínio/hospedagem; não estimar só pelo frontend.                       |
| P1         | Prova de viabilidade HealthKit / sincronização autorizada    | Ataca a crítica principal: excesso de entrada manual. Aceite: ler uma métrica real com permissão, origem, data, revogação e ausência, sem credencial no bundle.                  | Spike de 3–5 dias; integração completa é projeto de semanas, sujeito à plataforma. |
| P1         | Cursos livres vinculados ao foco                             | Permitir uso real em plataformas diferentes. Aceite: criar/editar/pausar curso, medir sessão e registrar aplicação sem porcentagem fictícia.                                     | Médio: 4–8 dias com migração e testes.                                             |
| P1         | Hábitos próprios e suplementação estruturada                 | Trocar checks genéricos por planejamento adequado; separar protocolo de consumo e unidades. Aceite: frequência, data, correção e soma de ingredientes coerentes.                 | Dividir em entregas; aproximadamente 1–2 semanas por escopo delimitado.            |
| P1         | Refinar Hoje por relevância e contexto                       | Devolver uma decisão útil antes de pedir mais campos. Aceite: testar leitura inicial e tarefas, reduzir passos e permitir módulos relevantes à pessoa.                           | Experimento de 3–5 dias mais observação do uso.                                    |
| P2         | Treino avançado, exportação e agente opcional                | Depende de modelo de treino e passagem revisável; não deve anteceder integridade e utilidade básica.                                                                             | Estimar após definir contrato e acesso Hevy; não há prazo confiável agora.         |
| P2         | GitHub privado, projetos e sincronização remota              | Necessitam backend, autorização, conflitos e exclusão; ampliam significativamente a superfície de segurança.                                                                     | Projeto separado, com especificação prévia.                                        |

Não há razão para implementar todos os conectores ao mesmo tempo. A primeira entrega de automação deve provar um fluxo real ponta a ponta. Uma ponte nativa, possivelmente preservando a UI web, é uma hipótese a validar; nenhuma dependência como Capacitor foi adicionada.

Métricas de produto recomendadas: tempo até uma ação útil, quantidade de campos necessários, abandono de formulário, correções, dados recebidos sem digitação e uso do histórico para decidir. Não há instrumentação de produto consolidada hoje. Qualquer coleta deve respeitar a natureza sensível dos dados e não enviar conteúdo corporal/fotos por padrão.

## 10. Instruções operacionais para a próxima IA

1. Ler `AGENTS.md` e as instruções aplicáveis. Para código Next.js, consultar o guia relevante em `node_modules/next/dist/docs/` antes de editar; a versão instalada tem diferenças de API.
2. Conferir `git status`, branch, commit e código atual. Este relatório é uma fotografia, não substitui a inspeção após novos commits.
3. Ler este documento, `docs/PRODUCT.md` e o módulo que será alterado. Revisões históricas mantêm valor, mas seus números/afirmações são datados.
4. Trabalhar no checkout existente `/workspace/KernelHub`; não criar worktree sem necessidade. Não modificar módulos externos ao escopo nem adicionar dependências se a base atual resolve o problema.
5. Separar pedido do usuário, funcionalidade existente, bug reproduzido e proposta. Não anunciar uma conexão só porque existe um card ou um contrato de interface.
6. Preservar transações, IDs estáveis, datas locais, lacunas, dados legados e movimento reduzido. Migração e compatibilidade devem preceder mudanças de schema.
7. Definir critérios de aceitação observáveis; implementar em etapas verificáveis. Confirmar correção funcional e efeitos em UI, teclado, offline e armazenamento conforme o escopo.
8. Não colocar credenciais privadas no frontend. Não solicitar tokens em texto em um card da PWA para simular uma integração segura.
9. Depois de alterações, executar checks proporcionais. O projeto não possui script `lint`; usa Prettier, TypeScript, testes, build e auditoria conforme o pipeline.
10. Para publicar, confirmar commit/push e execução do Pages, além do endereço e artefato. Não confundir workflow existente, preview local e publicação concluída.
11. Relatar arquivos alterados, comportamento, testes e limites reais. Não afirmar validação em Safari físico, pentest ou pesquisa externa que não tenha sido executada.

### Comandos úteis

```bash
cd /workspace/KernelHub
npm --cache /workspace/.npm-cache ci
npm run dev
```

```bash
npm run format:check
npm run typecheck
npm run test:unit
npm run build
npm test
npm run build:pages
npm run test:pages
```

O export estático gera `out/` e substitui o artefato em `.next`. Executar `npm run build` novamente antes de voltar a `npm run start`. O Pages usa `/KernelHub`; URLs de assets devem passar pelo mecanismo de base path existente. Playwright usa porta 3100 e Chromium do sistema quando disponível. Nenhuma credencial é necessária para iniciar o frontend; GitHub público exige rede.

O service worker usa manifesto de precache com revisão por build e inclui chunks exclusivos do worker de saúde. Há uma correção intencional de resposta sintética para requisições cujo destino é `worker`, necessária ao bootstrap produzido pelo Turbopack. Não remover essa correção ou reduzir o precache aos scripts visíveis no HTML sem testar a primeira importação offline.

### Contexto pronto para fornecer a outra IA

> Você vai continuar o KernelHub, repositório ProgAnakin/KernelHub, uma PWA local-first em Next.js 16/React 19 para evolução pessoal integrada: corpo, rotina, aparência, estudos e carreira. Leia docs/PROJECT-HANDOFF.md e confira o commit atual antes de agir. O proprietário quer acompanhamento com menos digitação, dados verdadeiros e uma interface iOS cuidada, com formulários adequados ao computador. Já existem GitHub público real, XML local de saúde, foco persistente e armário skincare AM/PM com histórico/fotos; HealthKit contínuo, agentes, cursos livres e sincronização remota ainda não existem. Preserve IndexedDB transacional, IDs, datas locais, compatibilidade e campos ausentes como null. Não reescreva a base sem necessidade nem invente dados ou integrações. Priorize portabilidade completa dos dados, correções de conteúdo/rascunhos e teste físico no iPhone, enquanto valida uma via real de automação. Depois evolua cursos/hábitos e protocolos estruturados. Explique decisões por problema, comportamento esperado e evidência; valide a entrega e diferencie teste emulado de uso físico e deploy confirmado de intenção de publicar.

## 11. Questões ainda abertas, sem bloquear correções já claras

- Qual via de automação de saúde será adotada primeiro: ponte nativa HealthKit ou um conector autorizado específico? Quais dispositivos e dados reais serão usados no piloto?
- Quais duas ou três decisões diárias o panorama deve ajudar este usuário a tomar? O que ele consulta e ignora após uma semana de uso?
- O backup deve permitir pacote completo com imagens, exportações por módulo ou ambos? Qual política de retenção/exclusão e restauração entre dispositivos?
- Constância de skincare deve medir dias observados ou dias de uma agenda? É preciso definir vigência do protocolo e dias previstos antes de calcular aderência de calendário.
- Para cursos, qual evidência mínima é útil: aula, exercício, insight, projeto aplicado ou revisão? Quantidade de aulas pode ser desconhecida.
- O produto continuará pessoal/local ou terá contas e múltiplos usuários? Essa decisão altera backend, privacidade, suporte e custo.

Essas decisões pedem observação e escolha de produto; não justificam adiar textos corretos, proteção contra perda de dados ou os testes físicos necessários.

## 12. Revisão técnica de 29 de outubro de 2026 (0.5.0)

Base: este documento + leitura integral do código (≈10 mil linhas de TypeScript, 9 mil de CSS), execução dos testes e inspeção das telas em Chromium a 320, 390 e 1440 px. Não houve teste em Safari/iPhone físico.

### O que foi entregue

| Tema             | Mudança                                                                                                                                                     | Onde                                                                                                 |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Portabilidade    | Backup versionado (`kernelhub-backup` v2) com espaço, skincare, fotos opcionais e usuário GitHub; restauração atômica, aceita backups antigos               | `lib/backup.ts`, `lib/backup-storage.ts`, `components/backup-panel.tsx`, `lib/use-kernel.ts`         |
| Perda de dados   | Confirmação ao descartar entrada não salva; rascunho de produto elevado acima das abas; metas com rascunho em texto                                         | `useDraftGuard` e `BottomSheet` em `components/ui.tsx`, `components/skincare-cabinet.tsx`            |
| Utilidade diária | Cartão "Próximo passo" + atalhos em Hoje; sugestões de check-in a partir do Saúde importado; "marcar pendentes como usados" e destaque do próximo produto   | `components/pulse-overview.tsx`, `lib/metrics.ts`, `components/growth-sheets.tsx`, `lib/skincare.ts` |
| Dados            | Macros decimais (décimos de grama, totais exatos)                                                                                                           | `lib/state.ts`                                                                                       |
| Legibilidade     | Piso de 11 px; rótulos de frasco e títulos de evento em duas linhas                                                                                         | `app/*.css`                                                                                          |
| Higiene          | Telas inalcançáveis removidas (`TelemetrySheet`, `EngineeringSheet`, fixtures Garmin/Git), `noUnusedLocals`, deploy do Pages roda tipos e testes de domínio | `types/kernel.ts`, `tsconfig.json`, `.github/workflows/pages.yml`                                    |

### Achados desta revisão que o relatório de 28/10 não trazia

1. **O importador de saúde não funciona com um export real.** O limite de 12 MiB/150 mil registros é uma exceção, não o caso típico: um `export.xml` do Apple Saúde costuma ter centenas de MB (e o ZIP, dezenas). O parser percorre uma string inteira (`file.text()`), então a única saída é um parser em streaming que retém só a janela de 14 dias. Foi a maior lacuna de utilidade encontrada e **não foi implementada** (ver abaixo).
2. **Tipografia ilegível.** Medido em 390 px: 51% dos caracteres de Hoje renderizavam abaixo de 11 px (mínimo 6 px), inclusive a procedência "prévia ilustrativa", que é justamente o que o produto promete tornar visível. A verificação de acessibilidade automatizada (axe) não detecta isso.
3. **Código morto com texto falso.** `TelemetrySheet`, `EngineeringSheet`, `TodayBrief`, `Brand` e as fixtures não eram alcançados por nenhum caminho, mas continham frases como "Garmin simulada" e "conectar o GitHub requer um servidor".
4. **Defeito de toque.** Focar uma caixa de seleção expandia o painel móvel e deslocava o controle debaixo do dedo; só aparecia ao testar o fluxo no projeto iPhone.
5. **Entrada de macros.** Teclado decimal com `step="1"`: gramas fracionadas eram rejeitadas pelo navegador.
6. **Confirmação de remoção de foto** aparecia no fim da lista, fora da tela quando havia várias fotos.
7. **Ambiente de testes.** Com `@playwright/test` 1.64.1 o Chromium baixado pode não existir; use `PLAYWRIGHT_CHROMIUM_PATH=<caminho do chromium>`.
8. **O iPhone converte HEIC para JPEG** ao escolher da Fototeca quando `accept` não lista HEIC (comportamento esperado do Safari, a confirmar em aparelho); HEIC só chega via app Arquivos.

### Continua em aberto, em ordem sugerida

1. **Importador de saúde em streaming** (`File.stream()` + decodificação incremental no worker, janela de 14 dias, progresso, tempo limite por inatividade) e, opcionalmente, leitura direta do `export.zip` (`DecompressionStream`). Mantém o parser atual como API de strings para os testes adversariais.
2. **CSP por `<meta>`** no export estático, com hashes dos scripts em linha gerados no build, para limitar `connect-src`, `img-src` e origens de script; a afirmação de que o Pages "não permite CSP" vale só para cabeçalhos HTTP.
3. **Validação em iPhone físico:** exportação do backup em PWA instalada (`<a download>` com Blob é frágil no Safari standalone; considerar `navigator.share` com arquivo), teclado e `visualViewport`, memória com fotos grandes e com o XML real.
4. Origem dedicada (domínio próprio) antes de dados reais; criptografia opcional do backup.
5. Cursos livres e hábitos configuráveis (§9, P1), após a validação física.
6. Pesquisa do tamanho de fonte pelo usuário: o piso de 11 px resolveu o pior caso, mas os tamanhos continuam em `px` fixo (sem Dynamic Type).
