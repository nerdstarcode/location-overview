# Think: Busca e paginação nas tabelas — 2026-10-22

> Registro da sessão /think (decisões confirmadas em 2026-10-22).

## Resumo
Hoje o `DataTable` ([src/components/organisms/DataTable/DataTable.tsx](src/components/organisms/DataTable/DataTable.tsx)) só ordena; a paginação é feita
manualmente (estado `page`/`pageSize` + `slice` + reset por `resetKey` + `<Pagination>`) e duplicada em `WorkItemsTable` e `AllocationTable`.
As demais ~12 tabelas (Squads, People, Cargos, Sprints, Levels, TestReports, AllocationsOverview x2, IterationsList,
SprintAllocationView, SprintAllocationComparison, SprintPointsByTypeChart) não têm paginação nem busca. A única busca textual
existente é a de `AzureProjectsList` (não é tabela). O objetivo é refatorar (Clean Code, sem mudar comportamento além do pedido)
para que toda tabela tenha busca e paginação, eliminando a duplicação.

Fatos levantados:
- TanStack Table v8 já é dependência (`getPaginationRowModel`, `getFilteredRowModel`/`globalFilter` disponíveis).
- `Pagination` molecule já existe (`ROW_LIMIT_OPTIONS = [10,25,50,100]`; Work/Allocation usam `[25,50,100,200]`).
- `Input` atom já é usado como campo de busca em `AzureProjectsList`.
- Ordenação hoje é aplicada apenas à página recebida (bug latente em Work/Allocation: ordena só a página atual).
- `DataTable` tem seleção "por página" (`onTogglePage`), usada só no Storybook.
- A prop `footer` do DataTable não é usada por nenhuma tabela (os `footer=` encontrados são do `Modal`).

## Perguntas e respostas

### Q1. Escopo das tabelas
- **Type:** Business rule
- **Question:** Quais tabelas devem ganhar busca + paginação?
- **Recommended answer:** Todas as instâncias de DataTable, por padrão, com opt-out explícito.
- **Decision:** Todas.
- **Depends on:** —

### Q2. Semântica da busca
- **Type:** Business rule
- **Question:** O que o termo digitado deve casar em cada linha?
- **Recommended answer:** Campo único de busca global; linha aparece se qualquer coluna visível contiver o termo.
- **Decision:** Global, todas as colunas.
- **Depends on:** Q1

### Q3. Regras de correspondência
- **Type:** Business rule
- **Question:** Como comparar o termo com o conteúdo?
- **Recommended answer:** Ignorar maiúsculas e acentos, substring, termo dividido em palavras e todas devem aparecer na linha (AND, em qualquer coluna).
- **Decision:** Normalizada + palavras AND.
- **Depends on:** Q2

### Q4. Valor considerado na busca
- **Type:** Business rule
- **Question:** A busca casa com o valor exibido ou com o valor bruto?
- **Recommended answer:** Valor exibido; colunas declaram um texto de busca quando o exibido difere do bruto (datas, squad resolvida, colunas só-`cell`).
- **Decision:** Valor exibido.
- **Depends on:** Q2, Q3

### Q5. Convivência com filtros MultiSelect
- **Type:** Business rule
- **Question:** Como a busca textual convive com os filtros MultiSelect de Work Items e Alocação?
- **Recommended answer:** Mantêm-se os filtros; linha deve passar nos filtros E na busca; total reflete o combinado.
- **Decision:** Combinam em AND.
- **Depends on:** Q2

### Q6. Escopo da ordenação
- **Type:** Business rule
- **Question:** Ordenação deve valer só para a página atual ou para todo o resultado?
- **Recommended answer:** Filtros → busca → ordenação sobre todo o resultado → paginação (corrige o comportamento atual de Work Items/Alocação).
- **Decision:** Ordena tudo, depois pagina.
- **Depends on:** Q1, Q5

### Q7. Tamanho de página
- **Type:** Business rule
- **Question:** Quais opções e qual tamanho inicial de página?
- **Recommended answer:** Padrão [10, 25, 50, 100] iniciando em 10; Work Items e Alocação mantêm [25, 50, 100, 200] iniciando em 25 via override.
- **Decision:** Padrão 10 + override.
- **Depends on:** Q1

### Q8. Visibilidade dos controles
- **Type:** Business rule
- **Question:** Quando mostrar busca e barra de paginação?
- **Recommended answer:** Sempre que a tabela tiver ao menos 1 linha de dados de origem; sem dados, só a mensagem vazia.
- **Decision:** Sempre que houver dados.
- **Depends on:** Q1, Q7

### Q9. Quando a página volta para 1
- **Type:** Business rule
- **Question:** Em que eventos a página reseta para 1?
- **Recommended answer:** Reset ao mudar busca, filtros, ordenação ou tamanho de página; ao editar/adicionar/remover linhas mantém a página (recuando só se ela deixar de existir).
- **Decision:** Reset em busca/filtro/ordenação/size; mudanças de dados só ajustam.
- **Depends on:** Q5, Q6, Q7

### Q10. Busca sem resultados
- **Type:** Business rule
- **Question:** O que exibir quando há dados mas nada casa com busca/filtros?
- **Recommended answer:** Busca continua visível; mensagem própria "Nenhum resultado para “x”." no lugar da tabela; paginação mostra 0 no total.
- **Decision:** Mensagem própria + busca visível.
- **Depends on:** Q8

### Q11. Persistência do estado
- **Type:** Business rule
- **Question:** Busca, página e tamanho de página sobrevivem a navegação/reload?
- **Recommended answer:** Não persistir; estado local do componente, como hoje.
- **Decision:** Não persistir.
- **Depends on:** —

### Q12. Onde vive a lógica de busca/ordenação/paginação
- **Type:** Technical resource
- **Question:** A lógica fica dentro do DataTable ou num hook com DataTable puro?
- **Recommended answer:** Dentro do DataTable, via TanStack (`getFilteredRowModel` com `globalFilterFn` normalizado, `getSortedRowModel`, `getPaginationRowModel`, `autoResetPageIndex: false`), renderizando busca + `<Pagination>`; props `pageSizeOptions`, `searchPlaceholder` e opt-out.
- **Decision:** Dentro do DataTable.
- **Depends on:** Q1, Q6, Q7, Q9

### Q13. Filtros MultiSelect externos
- **Type:** Technical resource
- **Question:** Como o DataTable distingue mudança de filtro externo (reset) de edição de dados (mantém página)?
- **Recommended answer:** Pai continua filtrando e passa `data` filtrada + `pageResetKey` (ex.: `JSON.stringify(columnFilters)`) + MultiSelects via slot `toolbar`, na mesma barra da busca.
- **Decision:** Pai filtra + `pageResetKey` + slot `toolbar`.
- **Depends on:** Q5, Q9, Q12

### Q14. Texto de busca por coluna
- **Type:** Technical resource
- **Question:** Como cada coluna informa o texto exibido para a busca?
- **Recommended answer:** Campo opcional `meta.searchValue?: (row, tableMeta) => string` em `DataTableColumnMeta`; sem ele, valor do accessor em string. Colunas sem accessor e sem `searchValue` (ex.: ações) ficam fora da busca.
- **Decision:** `meta.searchValue` + fallback.
- **Depends on:** Q4, Q12

### Q15. Responsividade da busca
- **Type:** Technical resource
- **Question:** Filtrar a cada tecla imediatamente ou com atraso?
- **Recommended answer:** `useDeferredValue` do React 19.
- **Decision:** Debounce ~250ms (não há hook de debounce no projeto; criar `src/hooks/useDebouncedValue.ts`).
- **Depends on:** Q12

### Q16. Prop `footer` do DataTable
- **Type:** Technical resource
- **Question:** O que fazer com a prop `footer`, não usada por nenhuma tabela (confirmado: todos os `footer=` são do `Modal`; nenhuma story usa)?
- **Recommended answer:** Remover (código morto; total ficaria ambíguo com paginação).
- **Decision:** Remover.
- **Depends on:** Q12

### Q17. Estratégia de testes
- **Type:** Technical resource
- **Question:** Como cobrir a mudança com testes?
- **Recommended answer:** Função pura `src/lib/tableSearch.ts` + `tableSearch.test.ts`; DataTable.stories com dataset grande e play test (busca → reset página → ordenação global → "Nenhum resultado").
- **Decision:** Unit + story com play.
- **Depends on:** Q3, Q6, Q9, Q10, Q12

### Q18. Layout dos controles
- **Type:** Technical resource
- **Question:** Onde ficam busca, `toolbar` e paginação?
- **Recommended answer:** Linha acima da tabela com busca (max-w-sm, ícone lupa, placeholder "Buscar…" sobrescrevível) + `toolbar`; `<Pagination>` abaixo da tabela.
- **Decision:** Busca + toolbar em cima, paginação embaixo.
- **Depends on:** Q8, Q13

---

## Business rules
- Toda tabela (DataTable) tem busca e paginação — Q1
- Busca global: um campo; linha aparece se qualquer coluna visível casar — Q2
- Ignora caixa e acentos, substring, termo dividido em palavras com AND entre colunas — Q3
- Casa com o valor exibido na tela, não o bruto — Q4
- Busca combina em AND com os filtros MultiSelect existentes — Q5
- Ordenação vale sobre todo o resultado filtrado, depois pagina — Q6
- Page size padrão [10,25,50,100] iniciando em 10; Work Items/Alocação [25,50,100,200] iniciando em 25 — Q7
- Busca e paginação visíveis sempre que houver dados de origem — Q8
- Página volta a 1 ao mudar busca/filtro/ordenação/size; edições de dados mantêm a página (recuando se sumir) — Q9
- Sem resultados: busca visível + "Nenhum resultado para “x”." + 0 no total — Q10
- Estado de busca/página/size não é persistido — Q11

## Technical resources
- Lógica dentro do DataTable via TanStack (filtered + sorted + pagination row models, `autoResetPageIndex: false`) — Q12
- Filtros externos ficam no pai; DataTable recebe `pageResetKey` e slot `toolbar` — Q13
- `meta.searchValue?: (row, tableMeta) => string` com fallback para o accessor; colunas sem ambos ficam fora — Q14
- Debounce de ~250ms via novo `src/hooks/useDebouncedValue.ts` — Q15
- Remover prop `footer` (morta) do DataTable — Q16
- `src/lib/tableSearch.ts` + teste unitário; story com play test — Q17
- Busca + toolbar acima, Pagination abaixo — Q18

## Open questions
- Q1 previa opt-out explícito; como todas as tabelas usarão busca + paginação, o plano **não** cria props de opt-out até surgir um caso (YAGNI). Confirmar.
- A seleção por checkbox (`onTogglePage`, só usada no Storybook) continua significando "selecionar a página atual" — agora a página interna do DataTable.

---

## Plano de implementação (após confirmação)

**Contexto:** paginação duplicada em 2 telas, sem busca em nenhuma tabela, ordenação aplicada só à página atual. Objetivo: centralizar busca + ordenação + paginação no `DataTable`, aplicando as regras acima a todas as tabelas.

Passos (seguros e incrementais, conforme /refatoracao-clean-code; branch nova a partir de `master`):
1. `src/lib/tableSearch.ts`: `normalizeText` (NFD + remove diacríticos + lowercase) e `matchesSearch(haystacks: string[], term)` (palavras AND). Teste em `src/lib/tableSearch.test.ts`.
2. `src/hooks/useDebouncedValue.ts` (250ms).
3. `DataTable.tsx`:
   - `DataTableColumnMeta.searchValue`; remover `footer`.
   - Estado `globalFilter` (input imediato, filtro com valor debounced), `pagination` ({pageIndex, pageSize}).
   - `useReactTable` com `getFilteredRowModel`, `globalFilterFn` usando `searchValue`/accessor + `matchesSearch`, `getPaginationRowModel`, `autoResetPageIndex: false`, `getColumnCanGlobalFilter` incluindo colunas só com `searchValue`.
   - Reset de página em mudança de busca, ordenação, page size e `pageResetKey` (ajuste de estado durante render, padrão já usado em WorkItemsTable); clamp quando `pageIndex >= pageCount`.
   - Props novas: `pageSizeOptions` (default `ROW_LIMIT_OPTIONS`), `searchPlaceholder`, `pageResetKey`, `toolbar`.
   - Render: sem dados de origem → `emptyMessage`; senão barra (busca com `Input` + ícone `Search` do lucide + `toolbar`), tabela ou "Nenhum resultado para “x”.", e `<Pagination>` reutilizando [Pagination.tsx](src/components/molecules/Pagination/Pagination.tsx).
4. `WorkItemsTable` e `AllocationTable`: remover `page`/`pageSize`/`resetKey`/`pageRows`/`<Pagination>`; passar `filteredRows`, `pageResetKey={JSON.stringify(columnFilters)}`, MultiSelects via `toolbar`, `pageSizeOptions={[25,50,100,200]}`.
5. Colunas cujo exibido difere do bruto ganham `meta.searchValue`: datas (`IterationsList`, Sprints/TestReports se houver), squad resolvida (`lib/allocation.tsx` via `tableMeta.squadDisplayName`), colunas só-`cell` (`AllocationsOverview` capacity/max, `%` em `SprintAllocationView`, etc.). Revisar cada uma das ~14 telas.
6. Stories: atualizar [DataTable.stories.tsx](src/components/organisms/DataTable/DataTable.stories.tsx) com dataset grande + play test; ajustar stories de Work/Allocation se quebrarem.

**Verificação:** `npm run test:unit`, `npm run lint`, `npm run build`, testes de story (Storybook/vitest); `npm run dev` e conferir manualmente Work Items (busca + MultiSelect + ordenação global + edição mantendo página) e uma tabela pequena (Levels).

