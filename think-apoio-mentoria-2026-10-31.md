# Think: Apoio/mentoria entre pessoas — 2026-10-31

> Registro da sessão /think (decisões confirmadas em 2026-10-31).

## Resumo
Algumas pessoas ficam sob a responsabilidade de outra (mentoria/apoio). A ajuda necessária varia por pessoa, por sprint e até por task. Hoje, quem dá apoio aparece "Abaixo do previsto" (`loadStatusOf` em [personMetrics.ts](src/lib/personMetrics.ts)), e o app não tem como mostrar que isso acontece porque essa pessoa está cuidando de outras.

Fatos levantados no código:
- O `Person` ([peopleStorage.ts](src/lib/peopleStorage.ts)) tem só nome, email, cargo, nível e squadIds. Não existe relação entre pessoas.
- O `PersonAllocation` ([personAllocationsStorage.ts](src/lib/personAllocationsStorage.ts)) guarda pessoa, squad, sprint e %.
- Previsto e máximo vêm de `pointsForEntry`: dias × pontos por dia do nível.
- O status usa `loadStatusOf(entregue, previsto, máximo, máximoComExtensão)`, com ±10% de tolerância.
- O `WorkItemRow` ([workItems.tsx](src/lib/workItems.tsx)) tem `assignedTo`, `email` e `tags`. As tags já são usadas para detectar "Delayed".
- O backup ([backupStorage.ts](src/lib/backupStorage.ts)) usa o registro `DATA_SECTIONS`. Um storage novo entra lá.

## Perguntas e respostas

### Q1. Como representar a relação de apoio
- **Type:** Business rule
- **Question:** Como representar que alguém cuida de outra pessoa?
- **Recommended answer:** Um registro de apoio por sprint: quem apoia, quem é apoiado e N% do tempo de quem apoia. O detalhe por task fica para depois.
- **Decision:** Apoio por sprint.
- **Depends on:** —

### Q2. Efeito do apoio nos números de quem apoia
- **Type:** Business rule
- **Question:** O apoio deve mudar os números (previsto/máximo/status) de quem apoia?
- **Recommended answer:** Descontar do previsto e do máximo, mostrando o desconto de forma explícita.
- **Decision:** Mostrar os dois status: o bruto (como hoje) e o "considerando o apoio", lado a lado.
- **Depends on:** Q1

### Q3. Unidade do apoio
- **Type:** Business rule
- **Question:** Em que unidade informar quanto apoio X dá a Y numa sprint?
- **Recommended answer:** % do tempo de X na sprint, com atalhos Leve 10% / Médio 25% / Intenso 50%.
- **Decision:** Em %, mas convertida em pontos a partir dos pontos de cada apoiado, e não só do previsto/máximo de quem apoia.
- **Depends on:** Q1, Q2

### Q4. Base de pontos do apoiado
- **Type:** Business rule
- **Question:** Sobre quais pontos do apoiado a % é aplicada?
- **Recommended answer:** A mesma base de cada tela: SP entregues de Y na visão da pessoa e SP planejados de Y no plano da sprint.
- **Decision:** Mesma base da tela.
- **Depends on:** Q3

### Q5. Como o apoio entra no status de quem apoia
- **Type:** Business rule
- **Question:** Como os pontos de apoio entram no "status considerando o apoio"?
- **Recommended answer:** Somam como crédito: (pontos de X + apoio) contra o previsto/máximo de X, que não mudam.
- **Decision:** Somam como crédito.
- **Depends on:** Q2, Q4

### Q6. Lado de quem recebe o apoio
- **Type:** Business rule
- **Question:** O que muda para quem recebe o apoio (Y)?
- **Recommended answer:** Os números ficam intactos, só com um selo "Apoiado por X (25%)".
- **Decision:** Só o selo, números intactos.
- **Depends on:** Q5

### Q7. Limites do apoio
- **Type:** Business rule
- **Question:** Que limites valem para o apoio numa sprint?
- **Recommended answer:** N:N. Um registro por par (X→Y) por sprint, com 1–100%. Ninguém apoia a si mesmo. Os dois precisam estar alocados na sprint, em qualquer squad.
- **Decision:** N:N, ambos alocados.
- **Depends on:** Q1

### Q8. Onde cadastrar o apoio
- **Type:** Business rule
- **Question:** Onde cadastrar os apoios de uma sprint?
- **Recommended answer:** Uma seção "Apoios da sprint" em Sprints → sprint, com adicionar rápido (10/25/50), remover com Desfazer e copiar da sprint anterior.
- **Decision:** Nos dois lugares: a seção na sprint e atalhos no detalhe da squad (AllocationGroupDetail).
- **Depends on:** Q1, Q7

### Q9. Onde o apoio aparece
- **Type:** Business rule
- **Question:** Onde o apoio deve aparecer para justificar os pontos?
- **Recommended answer:** No card "Entrega × previsto", no gráfico/tooltip por sprint, no detalhe da squad e nos cards das squads do plano da sprint.
- **Decision:** No card "Entrega × previsto", no gráfico/tooltip por sprint e no detalhe da squad. Os cards das squads no plano da sprint ficam como estão.
- **Depends on:** Q2, Q6, Q8

### Q10. Apoio entre Dev e QA
- **Type:** Business rule
- **Question:** Como converter o apoio quando quem apoia e quem é apoiado são de tipos diferentes (SP × Test Points)?
- **Recommended answer:** Usar a métrica de quem apoia; se Y não tiver pontos nessa métrica, o apoio vale 0 e aparece só como selo.
- **Decision:** Bloquear o cadastro de apoio entre tipos diferentes. O tipo é QA ou não-QA, pelo mesmo `isQaPerson` ([sprintMetrics.ts](src/lib/azure/sprintMetrics.ts)) que escolhe a visão Dev/QA da pessoa.
- **Depends on:** Q4, Q7

### Q11. Contexto por task / observação
- **Type:** Business rule
- **Question:** Registrar uma observação opcional por par (ex.: "onboarding", "pair na #1234")?
- **Recommended answer:** Uma observação livre opcional, exibida no selo/tooltip e fora do cálculo.
- **Decision:** Nada por enquanto: só X, Y e a %.
- **Depends on:** Q1

### Q12. Apoio quando alguém deixa de estar alocado
- **Type:** Business rule
- **Question:** O que acontece com o apoio quando X ou Y deixa de estar alocado na sprint?
- **Recommended answer:** Mantém o registro, ignora no cálculo e avisa na seção. Volta a valer se a pessoa for realocada.
- **Decision:** Mantém, ignora e avisa.
- **Depends on:** Q7

### Q13. Onde guardar os apoios
- **Type:** Technical resource
- **Question:** Onde guardar os apoios?
- **Recommended answer:** Um storage novo `src/lib/personSupportsStorage.ts` (`location-overview:person-supports`) com registros `{ id, supporterId, supportedId, sprintId, percentage }` e as funções add/remove/restore/setPercentage/copyFromSprint, entrando como seção "Apoios" no `DATA_SECTIONS` do backup.
- **Decision:** Storage próprio + backup.
- **Depends on:** Q1, Q7

### Q14. O que ganha versão "com apoio" no card
- **Type:** Business rule
- **Question:** Além do status, o que mais do card "Entrega × previsto" ganha versão com apoio?
- **Recommended answer:** O status e a contagem de sprints por situação. Aderência, extensão e sobrecarga ficam só com a entrega real.
- **Decision:** Tudo: status, aderência, contagem por situação, extensão usada e sobrecarga ganham a versão com apoio.
- **Depends on:** Q2, Q5, Q9

### Q15. Filtro de squad e pontos do apoiado
- **Type:** Business rule
- **Question:** Os pontos de Y que geram o apoio respeitam o filtro de squad da visão da pessoa?
- **Recommended answer:** Não. Conta toda a entrega de Y na sprint; o filtro afeta só X.
- **Decision:** Ignora o filtro de squad.
- **Depends on:** Q4

### Q16. Onde fica o cálculo
- **Type:** Technical resource
- **Question:** O cálculo fica dentro de `computePersonDevMetrics`/`computePersonQaMetrics` ou num módulo separado?
- **Recommended answer:** Dentro das métricas, com um input opcional `supports`, recalculando Y como faz o `peerAveragePerSprint`.
- **Decision:** Módulo separado (`supportMetrics.ts`). Ele recebe as métricas já calculadas de X e dos apoiados e devolve o "com apoio". O `allocationAdherence` passa a ser exportado.
- **Depends on:** Q5, Q14, Q15

---

## Business rules
- O apoio é cadastrado por sprint: X apoia Y com N% — Q1
- O status de quem apoia aparece duas vezes: o bruto e o "com apoio", lado a lado — Q2
- A % é convertida em pontos sobre os pontos de cada apoiado — Q3
- A base é a mesma de cada tela: carga entregue + em andamento na visão da pessoa e SP planejados no detalhe da squad — Q4
- Os pontos de apoio somam como crédito à carga de X. O previsto e o máximo de X não mudam — Q5
- O apoiado só ganha o selo "Apoiado por X (N%)". Os números dele não mudam — Q6
- N:N, um registro por par por sprint, 1–100%, sem autoapoio, os dois alocados na sprint (em qualquer squad) — Q7
- O cadastro fica na seção "Apoios da sprint" (Sprints → sprint), com atalhos no detalhe da squad — Q8
- O apoio aparece no card "Entrega × previsto", no gráfico/tooltip por sprint e no detalhe da squad. Os cards do plano da sprint não mudam — Q9
- É proibido apoio entre QA e não-QA — Q10
- Sem observação nem vínculo com task por enquanto — Q11
- Um apoio com pessoa desalocada fica guardado, sai do cálculo e mostra um aviso — Q12
- No card, tudo ganha a versão com apoio: status, aderência, contagem, extensão e sobrecarga — Q14
- Os pontos do apoiado ignoram o filtro de squad da visão da pessoa — Q15

## Technical resources
- `src/lib/personSupportsStorage.ts` (`location-overview:person-supports`) + a seção "Apoios" no backup — Q13
- `src/lib/supportMetrics.ts` separado, com `allocationAdherence` exportado de `personMetrics.ts` — Q16

## Open questions
- "Copiar apoios da sprint anterior": copia todos os pares que ainda não existem na sprint. Os que ficarem inválidos (pessoa não alocada) mostram o aviso da Q12. Assumido; confirmar.
- Se o cargo de alguém mudar e um par existente passar a misturar QA e não-QA, o par sai do cálculo e mostra um aviso, como na Q12. Assumido.
- O atalho no detalhe da squad é uma ação por linha, "Apoio…", que abre um formulário pequeno (pessoa + % com 10/25/50). A pessoa da linha pode ser quem apoia ou quem é apoiado. Assumido.

