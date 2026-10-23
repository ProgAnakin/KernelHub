# KernelHub · benchmark e critérios de evolução

Data: **23 de outubro de 2026**. Base examinada: KernelHub `0.3.1`, commit `3b5c473`. Este documento separa o diagnóstico verificado do aplicativo, a pesquisa externa que foi possível executar e as hipóteses de produto.

## Limite da pesquisa externa

Foram solicitados por HTTPS os sites oficiais de WHOOP, Bevel, Athlytic, Gentler Streak, Exist, Gyroscope, Oura, Apple Saúde e Hevy, além da documentação HealthKit. **O proxy do ambiente recusou todas essas conexões com `CONNECT 403 Forbidden`.** A execução com permissão ampliada recebeu a mesma resposta. App Store e lookup do iTunes também ficaram inacessíveis.

Nenhum certificado foi ignorado e nenhum bloqueio foi contornado. Não foi possível ler as páginas, verificar recursos atuais, preços, capturas, notas de usuários ou estudos de eficácia. Portanto, este documento **não apresenta uma comparação atual de funcionalidades como se tivesse sido verificada**, nem estimativas de mercado. Os links abaixo são alvos oficiais de consulta; não são evidência de conteúdo que tenha sido recuperado nesta sessão.

| Referência a validar | Pergunta de produto que orienta o benchmark                                                                                         | URL consultada                                                                 |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| WHOOP                | Como a experiência transforma dados fisiológicos em contexto diário? Como comunica origem, disponibilidade e incerteza?             | [WHOOP](https://www.whoop.com/us/en/thelocker/what-is-whoop/)                  |
| Bevel                | Como apresenta tendências e recuperação sem exigir vários formulários? O que pode ser entendido no primeiro olhar?                  | [Bevel](https://www.bevel.health/)                                             |
| Athlytic             | Como organiza métricas, referências pessoais e informações detalhadas dentro de uma experiência móvel?                              | [Athlytic](https://www.athlyticapp.com/)                                       |
| Gentler Streak       | Como contextualiza esforço, descanso e consistência sem transformar o uso em cobrança constante?                                    | [Gentler Streak](https://gentler.app/)                                         |
| Exist                | Como reúne fontes diferentes e apresenta relações entre rotina e resultados? Que controles existem para interpretar essas relações? | [Exist](https://exist.io/)                                                     |
| Gyroscope            | Como combina domínios da vida e mantém a leitura diária manejável?                                                                  | [Gyroscope](https://gyrosco.pe/)                                               |
| Oura                 | Como oferece uma síntese diária e permite investigar os dados que a sustentam?                                                      | [Oura](https://ouraring.com/)                                                  |
| Apple Saúde          | Como representa fontes, períodos, unidades, ausência de amostras e permissões?                                                      | [Apple Saúde](https://www.apple.com/ios/health/)                               |
| Hevy                 | Como reduz atrito na execução de séries e descanso? Há passagem de planos/importação suportada?                                     | [Hevy](https://www.hevyapp.com/)                                               |
| HealthKit            | Quais capacidades, permissões e consultas serão necessárias na camada nativa?                                                       | [Documentação HealthKit](https://developer.apple.com/documentation/healthkit/) |

As perguntas da tabela são uma agenda de comparação, não afirmações de que cada concorrente implementa determinada solução. Uma revisão externa conclusiva precisa retomar essas fontes em um ambiente com acesso e registrar capturas ou trechos verificáveis.

## Diagnóstico confirmado do KernelHub 0.3.1

A crítica do usuário — a experiência parecer uma planilha de registros — corresponde a limitações concretas do código anterior à nova evolução:

- [Dashboard](../components/dashboard.tsx): a telemetria usa `mockTelemetry`; as contribuições usam `mockContributions`. No modo pessoal, a principal alternativa ao Garmin sem conexão é preencher um check-in. Não existe acompanhamento fisiológico automático nessa base.
- [Fixtures](../lib/mock-engine.ts): `HABITS`, `EXERCISES` e `COURSES` são catálogos fixos. Isso facilita uma demonstração, mas limita a utilidade para uma rotina real.
- [Métricas](../lib/metrics.ts) e [panorama](../components/growth.tsx): existem somas, médias e resumos de sete dias. Ainda não existe uma camada consistente de disponibilidade de métricas por provedor, séries normalizadas, atualização e comparação com uma referência pessoal.
- [Persistência](../lib/storage.ts): protege os registros locais e resolve concorrência. Isso é infraestrutura necessária; não representa, sozinho, uma mudança perceptível no valor do produto.
- A navegação reúne muitos módulos, mas grande parte do ciclo diário continua sendo abrir um painel, digitar e salvar. O app devolve menos contexto do que exige de entrada.

Esses achados foram verificados no snapshot indicado. Os links apontam para arquivos que podem evoluir depois desta revisão; o commit identifica a base auditada.

## Decisão de produto proposta

O próximo ciclo deve implementar **receber → normalizar → contextualizar → permitir agir**. Registro manual continua disponível para o que só a pessoa sabe, mas a proposta de valor precisa começar a depender de dados recebidos e de acompanhamento real.

A diferenciação a validar é a conexão entre domínios: recuperação, movimento, rotina, aprendizado e trabalho técnico no mesmo dia. Não basta reunir indicadores já existentes em outros aplicativos. É preciso explicar o que mudou, de onde veio a observação e qual ação concreta o usuário pode considerar.

Exemplos de contexto útil, quando existirem dados suficientes:

- “Sono de 6 h 40, 35 min abaixo da sua média dos últimos sete registros.”
- “Três sessões de estudo nesta semana; a última aplicação registrada foi há quatro dias.”
- “Seu projeto recebeu duas alterações públicas desde a última atualização.”

São exemplos de redação e cálculo, não resultados do usuário, recomendações clínicas ou recursos já conectados na versão de referência. Uma comparação não deve ser exibida quando faltar uma base válida; associação temporal não deve ser apresentada como causa.

## Contrato mínimo das métricas

| Elemento    | Regra                                                                                                                               |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Valor       | Número e unidade coerentes; `null` quando a fonte não fornecer a medida. Ausência não é zero.                                       |
| Origem      | Identificar provedor, dispositivo ou registro manual. “Apple Saúde” pode agregar fontes; não deve ocultar a procedência disponível. |
| Tempo       | Instante observado, dia local, fuso e última sincronização são informações distintas.                                               |
| Atualização | Informar se os dados são recentes, antigos, indisponíveis ou demonstrativos.                                                        |
| Cobertura   | Permitir um conjunto parcial: sono disponível e HRV ausente ainda formam um estado útil.                                            |
| Comparação  | Informar janela, quantidade de observações e referência usada. Não preencher lacunas artificialmente.                               |
| Conflito    | Deduplicar por origem/identificador; definir precedência de registros antes de somar medidas de diferentes provedores.              |
| Insight     | Relacionar a frase aos dados que a sustentam e permitir abrir o detalhe. Sem “score de vida” inventado.                             |

O aplicativo não deve exigir que um provedor complete todos os campos para disponibilizar os que existem. Isso também evita substituir uma integração parcial por um formulário inteiro.

## Direção visual recomendada

Estas são decisões de design para testar no KernelHub, não características copiadas ou verificadas nos concorrentes:

1. Trocar a abertura de caráter promocional por uma central do dia: data, estado das fontes, principal mudança e uma visualização forte de contexto.
2. Usar contraste, tipografia e cor com função: sinais importantes podem ter presença e energia; metadados e ações secundárias continuam discretos.
3. Mostrar séries compactas e comparações reais junto aos números. Um anel decorativo com valor demonstrativo não substitui evidência de acompanhamento.
4. Organizar profundidade por camadas. O primeiro olhar responde o que merece atenção; tocar revela histórico, referência, procedência e controles.
5. Colocar tarefas frequentes na base, com alvos confortáveis. Campos e configurações não devem dominar a tela inicial.
6. Exibir estados vazios úteis e honestos: conectar, importar ou aguardar amostras, com métricas ausentes visivelmente vazias.

## Critérios de aceitação para a evolução

- Ao menos uma fonte real deve atualizar o contexto sem exigir a digitação dos próprios indicadores a cada acesso.
- A interface deve distinguir claramente conexão, importação pontual, demonstração e entrada manual. Importar um arquivo não deve ser chamado de sincronização contínua.
- Falhas de um provedor ou de uma métrica não podem apagar os demais dados nem fabricar substitutos.
- Uma recomendação contextual precisa mostrar observações suficientes para ser avaliada; cálculos e limites devem ser testáveis.
- O usuário deve conseguir perceber a nova hierarquia no primeiro acesso, além de encontrar melhorias técnicas no relatório.
- Medir número de campos obrigatórios, tempo até uma ação útil, correções, dados recebidos automaticamente e módulos realmente consultados. Instalações e tempo de tela, isolados, não demonstram utilidade.
- A validação em iPhone físico continua necessária para teclado, safe areas, gestos, VoiceOver e desempenho.

## O que continua pendente de pesquisa

Comparação visual direta, descrição atual de recursos por concorrente, disponibilidade comercial das APIs, formatos aceitos pela Hevy, custos, limites de acesso e evidências de eficácia não foram verificados pela rede disponível. Essas informações devem ser confirmadas antes de orientar integrações ou alegações de mercado.
