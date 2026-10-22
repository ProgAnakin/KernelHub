# Revisão de produto e UX · 22 de outubro de 2026

## Princípio constante

KernelHub continua sendo um sistema diário para corpo, mente, construção e estilo de vida. A revisão busca tornar os registros úteis e confiáveis, mantendo a linguagem OLED, o ritmo visual e o uso com uma mão.

Uma medição precisa responder a uma decisão: perceber cansaço, ajustar uma rotina, reconhecer tempo dedicado, rever um aprendizado ou priorizar uma aquisição. Métricas de áreas diferentes não são somadas em uma nota de valor pessoal.

## Diagnóstico e correções

| Achado                                                                | Consequência                                               | Tratamento                                                                                                  |
| --------------------------------------------------------------------- | ---------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Abertura com muito espaço dedicado à frase institucional              | Menos contexto útil no primeiro olhar do iPhone            | Cabeçalho compacto, preservando identidade; próximo passo contextual e biometria com leitura mais imediata. |
| Corpo, mente e carreira tinham coberturas diferentes                  | O conceito amplo dependia demais de relógio e GitHub       | Check-in manual e blocos de foco que funcionam sem integrações.                                             |
| Exemplos e registros locais compartilhavam a mesma apresentação       | Exemplos podiam parecer dados pessoais                     | Saída explícita da demonstração, com confirmação e indicação de fontes indisponíveis no espaço pessoal.     |
| Metas estavam fixas no código                                         | O painel organizava uma rotina genérica                    | Metas editáveis de água, sono, corrida, foco e macros, refletidas nos módulos.                              |
| Registros diários eram reiniciados sem um resumo próprio              | Evolução quantitativa dependia de texto no histórico       | Arquivamento diário e panorama móvel de sete dias; sem preencher dias ausentes.                             |
| Exportação não permitia restauração                                   | Um backup não completava a recuperação                     | Importação com validação, limite de arquivo e confirmação antes de substituir registros.                    |
| Dados incompatíveis podiam ser descartados na inicialização           | Risco de perder um registro antigo                         | Migração dos campos antigos e preservação do conteúdo incompatível em uma chave de recuperação exportável.  |
| Checklist resumido escondia um dos cinco cuidados                     | Contagem e itens visíveis não correspondiam                | Todos os cinco cuidados ficam acessíveis no módulo.                                                         |
| Status inicial de treino e curso sugeria atividade ainda não iniciada | Estado visual impreciso                                    | Estados de planejado, em andamento e concluído derivados do progresso.                                      |
| Histórico mostrava hora sem data                                      | Eventos de dias diferentes pareciam pertencer ao mesmo dia | Data e hora aparecem juntas.                                                                                |
| Botão flutuante de desktop interceptava o acesso do rodapé            | “Meu espaço” podia ficar impossível de clicar              | Espaço inferior reservado, verificado por interação real.                                                   |
| Caminho de hospedagem podia quebrar ícones, assets e offline          | Pages abre o app sob um subdiretório                       | Caminho compartilhado no shell, manifesto e service worker; teste estático próprio.                         |

## Inventário de interação

| Elemento           | Comportamento e estado revisado                                                                                                       |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Navegação inferior | Destino ativo identificado por texto e ícone; muda de seção sem apagar registros e volta ao topo.                                     |
| Botão central      | Abre registros rápidos com sugestão contextual; não simula um registro sem ação do usuário.                                           |
| Top bar            | Relógio local, Body Battery e deploys distinguem demonstração e indisponibilidade. Body Battery tem identificação acessível própria.  |
| Próximo passo      | Contexto de check-in, hidratação, foco ou cuidados; sem prescrição automática a partir de dados fictícios.                            |
| Anel biométrico    | Resumo demonstrativo e painel explicativo; no modo pessoal, ausência de conexão é declarada.                                          |
| Séries             | Marcação direta, desfazer e limite no total da ficha; alvos de toque de pelo menos 44 px.                                             |
| Corrida e água     | Adição e remoção, limites de valores e atualização das metas configuradas.                                                            |
| Refeição           | Nome e macros validados; calorias calculadas por 4/4/9; confirmação após salvar.                                                      |
| Cuidados           | Checkbox circular acessível; estado visual e contagem acompanham a mesma fonte de dados.                                              |
| Check-in           | Escalas com rótulos, não apenas cores; sono validado; peso e passos opcionais; salvar novamente atualiza o dia.                       |
| Foco               | Minutos de blocos já concluídos, categoria e resultado opcional; correção de sessão; limite coerente com 24 horas.                    |
| Cursos e insights  | Progresso limitado ao total de aulas, conclusão reversível, texto preservado e sem HTML executável.                                   |
| Atividade técnica  | Filtros distintos para commit, PR e deploy; fixtures não são apresentadas como integração real.                                       |
| Wishlist           | Objetivo obrigatório na criação, prioridade, status reversível e confirmação de remoção. Nenhum fluxo realiza compras.                |
| Metas              | Validação de intervalos e consistência dos macros; confirmação atualiza o estado compartilhado.                                       |
| Backups            | Exportação explícita; importação verifica estrutura e referências antes de pedir confirmação. Arquivo inválido mantém o estado atual. |
| Painéis            | Fechamento por botão, Escape, gesto na alça e toque no fundo; foco contido e devolvido ao controle de origem; área rolável acessível. |
| Feedback           | Confirmações visuais independentes de vibração; mensagens de offline e falha de armazenamento são explícitas.                         |

## Leitura visual

O fundo é preto real; superfícies têm baixa opacidade, borda discreta e blur. Verde comunica conclusão, azul organiza percepção e foco, e âmbar marca atenção. Peso e estresse não recebem uma classificação automática de “melhor” ou “pior”.

Campos usam 16 px para evitar zoom de foco indesejado no iPhone. Há zoom por pinça e as transições respeitam redução de movimento. Contraste e relações ARIA foram conferidos automaticamente nos módulos principais e nos novos painéis. Esses checks complementam a inspeção visual; não substituem VoiceOver e Safari físico.

A região inferior concentra navegação e painéis. Rolagem, teclado, conteúdo longo e diferentes tamanhos de tela tornam inadequada uma garantia literal de que todo controle estará sempre nos 60% inferiores. O critério é concluir as ações frequentes sem alcançar o topo e sem sacrificar acessibilidade.

## Métricas incluídas e interpretação

- **Sono informado:** horas da noite anterior; médias usam apenas noites com registro.
- **Energia, humor e estresse:** escalas subjetivas de 1 a 5; descrevem a percepção do momento, sem diagnóstico.
- **Peso e passos:** opcionais e manuais; variação de peso exige ao menos duas medidas e não recebe uma cor de mérito.
- **Foco:** minutos de projeto e de estudo; um bloco descreve trabalho concluído, não um cronômetro fictício.
- **Cuidados, água, treino e macros:** registros com unidade explícita; metas pertencem ao usuário.
- **Resultados técnicos:** commits, PRs e deploys são eventos diferentes. Tempo de foco não substitui qualidade de entrega.

## Próximas inclusões pertinentes

| Prioridade | Inclusão                                             | Condição de utilidade                                                              |
| ---------- | ---------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Próxima    | Rotina e ficha de treino editáveis, trilhas próprias | Adaptar o app à rotina real antes de ampliar a automação.                          |
| Próxima    | Integração GitHub com escopo mínimo                  | Mostrar o que foi entregue com fonte e atualização verificáveis.                   |
| Próxima    | Caminho autorizado para Garmin/importação            | Confirmar acesso oficial e quais métricas podem ser lidas.                         |
| Posterior  | Ritmo, duração e percepção de esforço na corrida     | Interpretar carga de movimento com contexto.                                       |
| Posterior  | Medidas corporais por objetivo e notas de cuidado    | Acompanhar mudanças sem pontuação de aparência.                                    |
| Posterior  | Projetos, objetivos de habilidade e revisão semanal  | Relacionar estudo e tempo dedicado a entregas concretas.                           |
| Posterior  | Orçamento de aquisições e reposições                 | Decidir prioridade e momento sem incentivar consumo por pontuação.                 |
| Posterior  | Sincronização entre dispositivos e backup seguro     | Definir autenticação, retenção, criptografia e conflitos antes da coleta em nuvem. |

Não foram acrescentados score de beleza, diagnóstico, sugestão de dose, perda de peso automática, leitura fictícia de HealthKit nem conexão simulada de conta. Cada integração futura precisa informar fonte, última sincronização e falhas.

## Publicação e validação pendente

O build tradicional e a exportação para Pages são caminhos separados. A verificação estática abre `/KernelHub/`, confere manifesto e ícones e registra água após recarga offline. Publicação remota só pode ser afirmada depois do push e da evidência de implantação; arquivos de workflow, isoladamente, não comprovam um site online.

Antes de um lançamento público: testar Safari em iPhone físico, VoiceOver, teclado, instalação, atualização do service worker e restauração real entre dois dispositivos. O armazenamento desta versão é local e não é criptografado pelo app.
