# KernelHub · direção de produto

Atualizado em **23 de outubro de 2026**, a partir das decisões do usuário.

**Um sistema pessoal para acompanhar a vida com precisão e transformar intenção em avanços observáveis.** Corpo, recuperação, rotina, aparência, estudo, carreira e aquisições permanecem no mesmo conceito. A tela inicial deve responder “como estou, o que merece atenção e o que avancei hoje” em poucos segundos.

A profundidade fica disponível nos detalhes. A experiência diária precisa ser simples de consultar e operar, sem exigir que a pessoa preencha todos os módulos ou configure tudo antes de começar.

## Base implementada · ciclo 0.3.1

O protótipo oferece check-in manual de energia, humor, estresse, sono, peso e passos opcionais; água e refeições corrigíveis; séries e distância de corrida; cinco cuidados diários; foco em projeto/estudo; progresso e insights de cursos; wishlist; metas; panorama de sete dias e backups locais validados. IndexedDB mantém os registros no navegador e coordena gravações entre abas.

**Treinos, cursos e cuidados ainda usam modelos predefinidos.** Telemetria Garmin e eventos GitHub são demonstrações identificadas. O espaço pessoal começa sem registros fictícios e mostra integrações indisponíveis. Ainda não existem agentes, conexão com Apple Saúde, exportação de treino para outras apps ou sincronização entre dispositivos.

A [revisão de qualidade](QUALITY-REVIEW.md) documenta verificações e limites da base. As propostas abaixo são direção de produto; não são funcionalidades já conectadas.

## Experiência diária

O núcleo permanece **consultar → agir → registrar → continuar o dia**. “Hoje” oferece contexto; “Corpo” reúne rotina e recuperação; “Evoluir” aproxima construção e aprendizado; “Coleção” mantém planos de aquisição fora do caminho das ações frequentes. O botão central abre registros rápidos.

- Priorizar poucos sinais e próximos passos relevantes em “Hoje”. Detalhes, histórico e ajustes abrem sob demanda; módulos podem ser ativados conforme a rotina da pessoa.
- Preservar ações diretas, correção e desfazer. Um hábito não pode exigir o mesmo formulário de uma refeição ou de um protocolo de treino.
- Manter navegação e painéis próximos ao polegar, controles de toque confortáveis, zoom e acessibilidade. A posição absoluta de todos os controles não é garantida com rolagem, teclado e texto ampliado.
- Informar origem, data, última sincronização e ausência de dados. Dados manuais, importados e demonstrativos precisam continuar distinguíveis.
- Mostrar métricas em seu contexto. Sono, estudos, hábitos e deploys não formam uma nota geral de valor pessoal; tempo de tela e streak não são objetivos do produto.

## Cursos e aprendizagem · próxima evolução

O acompanhamento deve funcionar entre plataformas, sem depender de integrações específicas para começar. O cadastro livre inclui nome, plataforma, URL, objetivo e estado: planejado, em andamento, pausado ou concluído. A pessoa informa módulos/aulas quando conhece essa estrutura; sem denominador confiável, o app não inventa uma porcentagem.

Cada sessão de estudo pode ser vinculada a um curso ou tema, com tempo efetivamente registrado, conteúdo estudado e um próximo passo opcional. O foco já existente é uma base para essa ligação; o vínculo ainda precisa ser implementado. Duração prevista do curso e tempo dedicado são informações distintas.

A compreensão deve aparecer por evidências simples: um insight, exercício concluído, explicação com palavras próprias, código/projeto produzido ou aplicação prática. Revisões curtas podem recuperar essas ideias depois. Uma percepção de compreensão deve ser identificada como subjetiva; minutos assistidos e aulas marcadas não comprovam qualidade da aprendizagem.

O registro mínimo precisa continuar curto: escolher o curso, registrar avanço e seguir. Evidências e revisões acrescentam profundidade quando forem úteis, sem questionário obrigatório a cada sessão.

## Hábitos e cuidados · próxima evolução

Permitir criar hábitos e escolher o tipo adequado: conclusão, quantidade com unidade ou duração. Frequência, dias previstos, período do dia e meta são configuráveis; uma atividade não diária não deve parecer atrasada nos demais dias.

Registrar por data, permitir corrigir/desfazer e distinguir “não previsto”, “sem registro” e “concluído”. Evitar duplicar água e suplementação como checkboxes independentes quando seus registros estruturados já puderem indicar o cumprimento da rotina. O usuário escolhe o que acompanhar; amplitude de módulos não deve virar obrigação de preenchimento.

## Saúde · Apple Saúde como fonte principal

A direção escolhida é reunir no Apple Saúde os dados que os dispositivos e suas apps autorizarem compartilhar. Garmin, Whoop, Fitbit e outros podem ter coberturas e políticas diferentes; não se presume que toda métrica do dispositivo chegará ao Apple Saúde.

**Uma PWA no Safari não acessa HealthKit diretamente.** Essa integração exige uma camada nativa iOS com as permissões e capacidades necessárias. Uma opção a avaliar é preservar a interface web em um contêiner como Capacitor e implementar uma ponte HealthKit. Essa viabilidade precisa ser validada antes de prometer sincronização; não está implementada.

- Solicitar acesso por tipo de dado, conforme a função usada. A pessoa mantém controle das permissões e pode continuar com registros manuais quando possível.
- Normalizar unidade, origem, instante, data local e fuso; definir precedência e deduplicação para medidas recebidas de fontes distintas.
- Água continuará sendo registrada pelo app. Eventual escrita no Apple Saúde exige autorização própria e identificação dos eventos para não contar novamente o que o KernelHub escreveu.
- Body Battery da Garmin e Recovery/Strain da Whoop não são métricas universais do HealthKit. Só devem aparecer como dados reais se houver uma fonte autorizada que os disponibilize; integrações diretas adicionais dependem da viabilidade de cada fornecedor.

## Suplementação · registro preciso antes da avaliação assistida

A evolução deve separar **o que foi tomado** da **avaliação desse uso**. O registro estruturado precisa comportar produto, composto/ingrediente ativo, quantidade por dose, unidade, número de doses, horário e frequência. O total diário deve considerar ingredientes repetidos em produtos diferentes, com conversões explícitas entre unidades como mg e µg.

A primeira utilidade é organizar o protocolo escolhido, registrar consumo e mostrar duplicidades ou totais que merecem revisão. Referências de limites devem incluir fonte, população a que se aplicam e data de revisão; não são automaticamente uma dose recomendada para a pessoa.

Um agente de apoio é futuro e opcional. Ele precisará consultar fontes confiáveis, distinguir evidência de incerteza e considerar contexto relevante, como medicamentos, condições de saúde, idade e horário. **Peso sozinho não define dose segura**, e o app não deve prometer avaliar todas as interações ou substituir avaliação clínica. Informações sensíveis adicionais só devem ser solicitadas quando necessárias e com finalidade clara.

## Treino com agente · etapa futura e opcional

O usuário poderá fornecer contexto e objetivos para um agente com uma estrutura mais profunda: exercícios, séries, repetições, carga, repetições em reserva (RIR), intervalos, progressão e técnicas como rest-pause quando pertinentes. A proposta precisa ser revisável e explicar suas escolhas; não deve reduzir o treino a uma ficha genérica ou impor apoio por IA a quem não o deseja.

O KernelHub poderá preparar uma estrutura de passagem para uma app especializada de execução, como a Hevy: PDF legível e, se houver suporte verificado, formato de importação. **Não foi confirmada uma API, importação automática ou formato aceito pela Hevy.** O fluxo de transferência será decidido após validar essas possibilidades, sem prometer sincronização inexistente.

## Engenharia, aquisições e dados

GitHub permanece como integração futura de leitura, com o menor escopo possível no backend. Commits, PRs e deploys são eventos distintos; deploy não deve ser inferido de commits. Autorização, credenciais, webhooks assinados, deduplicação e reconciliação precisam existir antes da conexão real. Contagem de atividade não equivale a qualidade ou valor do trabalho.

A wishlist mantém objetivo, prioridade, custo e estado, ajudando a escolher recursos para a rotina. Não precisa virar checkout ou inventário complexo para ser útil.

Na evolução do domínio, separar catálogos, protocolos e eventos de execução. Cada evento deve ter ID, instante, data local, fuso, origem, unidade e identificador externo quando existir. Definir retenção, conflitos e exportação antes de sincronizar dispositivos. Respostas autenticadas e dados pessoais não pertencem ao cache público do service worker; credenciais ficam fora do frontend.

## Ordem de evolução

1. Resolver bugs de integridade e validar “Hoje” no iPhone real: instalação, teclado, safe areas, VoiceOver e conclusão das ações frequentes.
2. Implementar cursos livres e hábitos configuráveis, com registros corrigíveis e detalhes progressivos. Observar quais campos são usados antes de ampliar formulários.
3. Decidir a camada nativa para HealthKit e validar um conjunto pequeno de medidas úteis, com permissões e origem claras.
4. Conectar fontes reais que reduzam digitação, incluindo GitHub; estruturar suplementação com unidades e referências verificáveis.
5. Adicionar agentes opcionais de treino e suplementação após consolidar dados, limites, revisão e transferência para outras apps.

Durante o uso, avaliar tempo até o primeiro registro, campos abandonados, correções necessárias, módulos ignorados e retorno às anotações. A próxima mudança deve reduzir esforço ou melhorar uma decisão concreta; aumentar o número de métricas não basta.

## Nome e posicionamento

KernelHub continua como nome de trabalho: um núcleo para reunir a rotina pessoal. Disponibilidade de domínio e marca não foi validada. Essa avaliação exige consultas datadas a registradores, lojas e registros de marca pertinentes; domínio disponível não garante direito de uso da marca.
