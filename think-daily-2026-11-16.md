# Think — Visão de Daily na Análise da Sprint — 2026-11-16

Nova visão "Daily" na página de Análise da Sprint (Azure): passagem pessoa por pessoa mostrando as tasks de cada um, como a pessoa está alocada entre as squads (base local de Alocação), quais tasks ela tem em cada squad, o andamento das tasks de cada User Story, e no final as tasks sem ninguém atribuído.

> Registro mantido aqui porque o modo de planejamento só permite editar este arquivo; ao sair do plano ele será copiado para `think-daily-2026-11-16.md` no projeto.

## Fatos levantados
- A página busca os work items de **um team/iteration** do Azure (`SprintAnalysisProvider`); Tasks já vêm com `parentId` e `state`.
- A alocação por pessoa/squad/sprint vive na base local (`sprintAllocation` em `src/lib/azure/sprintMetrics.ts`, só da squad local atual).
- Não há pasta `docs/` no projeto.

## Perguntas e decisões

### Q1. Origem das tasks das outras squads
- **Type:** Technical resource
- **Question:** De onde vêm as tasks das outras squads em que a pessoa está alocada?
- **Recommended answer:** Só o team atual ao vivo + % de alocação das demais squads pela base local.
- **Decision:** Base local sincronizada — as outras squads usam os work items já gravados na base (Salvar na base); o team atual usa os dados ao vivo do Azure.
- **Depends on:** —

### Q2. Quem entra na passagem
- **Type:** Business rule
- **Question:** Quem aparece na passagem pessoa a pessoa?
- **Recommended answer:** União: alocados na squad/sprint (base local) + quem tem task neste team.
- **Decision:** União (recomendado).
- **Depends on:** Q1

### Q3. Organização das tasks da pessoa
- **Type:** Business rule
- **Question:** Como organizar as tasks de cada pessoa dentro de cada squad?
- **Recommended answer:** Por US pai, com andamento da US.
- **Decision:** Por estado — mini-kanban por pessoa/squad (colunas por estado).
- **Depends on:** Q2
- **Revised:** Agrupar por US; o mini-kanban por estado fica dentro de cada US (ver Q4).

### Q4. Andamento das tasks das USs
- **Type:** Business rule
- **Question:** Como mostrar o andamento de cada task das USs?
- **Recommended answer:** Selo X/Y no card da task + seção de USs com barra.
- **Decision:** Agrupar por US; ao abrir (expandir) cada US, mostrar o mini-kanban das tasks por estado. Hierarquia: Pessoa → Squad → US (recolhível, com andamento) → kanban.
- **Depends on:** Q3

### Q5. Tasks exibidas no kanban da US
- **Type:** Business rule
- **Question:** Ao abrir uma US na passagem de uma pessoa, mostrar só as tasks dela ou todas?
- **Recommended answer:** Todas, destacando as da pessoa e mostrando o responsável nas demais.
- **Decision:** Todas, destacando (recomendado).
- **Depends on:** Q4

### Q6. Quais USs aparecem para a pessoa
- **Type:** Business rule
- **Question:** Quais USs aparecem na passagem de uma pessoa?
- **Recommended answer:** Atribuída a ela ou com ao menos uma task dela.
- **Decision:** Atribuída ou com task (recomendado). Tasks soltas (sem US pai) da pessoa vão num grupo "Sem US".
- **Depends on:** Q5

### Q7. Colunas do mini-kanban
- **Type:** Business rule
- **Question:** Quais colunas no mini-kanban das tasks?
- **Recommended answer:** 3 colunas (To Do · In Progress · Done), Removed oculto.
- **Decision:** Uma coluna por State real que aparecer nas tasks da US (ordenadas pela ordem de estados já usada no projeto, `STATE_ORDER`).
- **Depends on:** Q4

### Q8. Alocação entre squads no cabeçalho da pessoa
- **Type:** Business rule
- **Question:** O que mostrar da alocação da pessoa entre squads?
- **Recommended answer:** Chip por squad com "% alocado · X/Y tasks abertas"; aviso se a squad não tem dados sincronizados.
- **Decision:** % + tasks por squad (recomendado).
- **Depends on:** Q1, Q2

### Q9. Seção final "sem ninguém"
- **Type:** Business rule
- **Question:** O que entra na seção de itens sem responsável?
- **Recommended answer:** Tasks e USs sem Assigned To, não fechadas, do team atual, agrupadas pela US com o mesmo kanban.
- **Decision:** Tasks + USs abertas (recomendado).
- **Depends on:** Q4, Q7

### Q10. Onde e como a Daily aparece
- **Type:** Business rule
- **Question:** Onde/como a visão Daily aparece na página?
- **Recommended answer:** Seletor Análise/Daily; uma pessoa por vez com Anterior/Próxima.
- **Decision:** Seletor "Análise | Daily" no topo; na Daily, todas as pessoas empilhadas em cards recolhíveis, "Sem ninguém" no final.
- **Depends on:** —

### Q11. Ordem e estado inicial
- **Type:** Business rule
- **Question:** Ordem das pessoas e estado inicial dos cards/USs?
- **Recommended answer:** Alfabética; cards abertos; USs recolhidas com X/Y; USs fechadas por último.
- **Decision:** Alfabética, USs recolhidas (recomendado).
- **Depends on:** Q10

### Q12. Test Cases para QAs
- **Type:** Business rule
- **Question:** Na passagem de um QA, o que mostrar dos Test Cases ligados?
- **Recommended answer:** Dentro de cada US aberta, lista dos Test Cases ligados (Tested By) à US e às tasks dela, com estado e último resultado (base local); só para cargo QA.
- **Decision:** Lista na US + resultado (recomendado).
- **Depends on:** Q4, Q5

## Business rules
- Q12 — QA: ao abrir a US, lista de Test Cases (Tested By da US e das tasks) com estado e último resultado.
- Q2 — Pessoas = alocadas na squad/sprint (base local) ∪ quem tem item atribuído no team.
- Q4/Q3 — Hierarquia Pessoa → Squad → US (recolhível, andamento X/Y tasks fechadas) → mini-kanban.
- Q5 — Kanban da US mostra todas as tasks; as da pessoa destacadas, demais com responsável.
- Q6 — USs da pessoa: atribuídas a ela ou com task dela; tasks sem pai em "Sem US".
- Q7 — Uma coluna por State real, na ordem `STATE_ORDER`.
- Q8 — Cabeçalho da pessoa: chip por squad "% alocado · X/Y tasks abertas"; aviso sem dados sincronizados.
- Q9 — Final: tasks e USs abertas sem Assigned To do team atual, agrupadas por US.
- Q10 — Seletor "Análise | Daily"; pessoas empilhadas em cards recolhíveis.
- Q11 — Ordem alfabética; USs recolhidas; USs fechadas por último.

## Technical resources
- Q1 — Team atual: work items ao vivo do Azure; outras squads: work items da base local (`matchingWorkItems` em `src/lib/allocationWorkItems.ts`).

## Open questions
- Nenhuma bloqueante. Padrões assumidos: itens ocultos (`hiddenIds`) ficam fora; clicar numa task/US abre `WorkItemDetailsModal`.

---

# Plano de implementação

**Contexto:** a análise da sprint mostra métricas agregadas, mas não serve para conduzir a daily. A nova aba dá uma passagem pessoa a pessoa com tasks, alocação entre squads e andamento das USs.

1. **Lógica pura** — novo `src/lib/azure/dailyView.ts` (+ `dailyView.test.ts` com fixtures de `sprintFixtures.ts`):
   - `buildDaily({ liveItems, localSquad, localSprint, base: { workItems, squads, people, allocations }, hiddenIds, pointTypes })` →
     `{ people: DailyPerson[], unassigned: DailyUs[] }`.
   - `DailyPerson = { name, email, squads: DailySquad[] }`; `DailySquad = { squadId, name, percentage|null, openTasks, totalTasks, hasData, stories: DailyUs[] }`; `DailyUs = { row|null ('Sem US'), tasks: WorkItemRow[], done, total, columns: {state, tasks}[] }`.
   - Squad atual usa `liveItems`; demais squads da alocação usam `matchingWorkItems(base.workItems, squad, sprint)`.
   - `DailyUs.testCases: { id, title, state, lastOutcome? }[]` — ids de `row.testCaseIds` da US + tasks; título/estado dos Test Cases presentes em `liveItems`/base; resultado de `base.testCaseExecutions` (mesma fonte de `itemExecutions` em `src/lib/testExecutionsPerPoint.ts`). Preenchido só quando o cargo da pessoa é QA.
   - Reusar `isPointItem`, `isType`, `isClosed`, `STATE_ORDER` de `sprintMetrics.ts`/`workItems.tsx`, `normalizeKey` (`lib/text`), alocações de `personAllocationsStorage`.
2. **UI** — `src/components/organisms/SprintDailyView/SprintDailyView.tsx` (+ `.stories.tsx`):
   - Card por pessoa (recolhível) com chips de squad; por squad, lista de USs (`<details>`) com barra X/Y; ao abrir, kanban horizontal com uma coluna por estado; task da pessoa destacada (borda `--accent`), demais mostram responsável. Card final "Sem ninguém".
3. **Página** — `SprintAnalysisPage.tsx`: `SegmentedControl` "Análise | Daily" (`usePersistedState('sprint-analysis-view')`) abaixo do `SprintHeader`; Daily renderiza `SprintDailyView` com dados do `useSprintAnalysis()` e da base local; `WorkItemDetailsModal` ao clicar.

**Verificação:** `npx tsc -b --noEmit`, `npx vitest run src/lib/azure`, abrir a story no Storybook e conferir a página com uma sprint real (pessoa em 2 squads, task sem responsável).

### Q13. USs exibidas para QAs
- **Type:** Business rule
- **Question:** QAs não têm tasks/USs atribuídas no Azure (card vazio). Quais USs aparecem para eles?
- **Recommended answer:** Todas as USs da squad com Test Case ligado, além das que já são deles.
- **Decision:** Todas da squad com TC (recomendado).
- **Depends on:** Q6, Q12
