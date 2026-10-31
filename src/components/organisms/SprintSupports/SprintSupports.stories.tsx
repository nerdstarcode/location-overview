import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { SprintSupports } from './SprintSupports'
import type { PersonSupport } from '../../../lib/personSupportsStorage'
import { FIXTURE_ALLOCATIONS, FIXTURE_PEOPLE, FIXTURE_SPRINT } from '../../../lib/azure/sprintFixtures'

// Ada e Alan são devs; Grace é QA (pelo nome do cargo): não pode apoiar nem ser apoiada por eles.
const ADA_TO_ALAN: PersonSupport = { id: 'x1', supporterId: 'p1', supportedId: 'p2', sprintId: 's8', percentage: 25 }
const PREVIOUS = { ...FIXTURE_SPRINT, id: 's7', number: 7, startDate: '2025-08-18', endDate: '2025-08-29' }

const meta: Meta<typeof SprintSupports> = {
  title: 'Organisms/SprintSupports',
  component: SprintSupports,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: {
    sprint: FIXTURE_SPRINT,
    previousSprint: PREVIOUS,
    supports: [ADA_TO_ALAN],
    context: { allocations: FIXTURE_ALLOCATIONS, people: FIXTURE_PEOPLE, cargos: [] },
    onAdd: fn(() => null),
    onRemove: fn((ids: string[]) => [ADA_TO_ALAN].filter((s) => ids.includes(s.id))),
    onRestore: fn(),
    onSetPercentage: fn(() => null),
    onCopyPrevious: fn(() => 2),
  },
}

export default meta
type Story = StoryObj<typeof SprintSupports>

export const CadastroRapido: Story = {
  args: { supports: [] },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const body = within(canvasElement.ownerDocument.body)
    await userEvent.click(canvas.getByRole('combobox', { name: 'Quem apoia' }))
    await userEvent.click(body.getByRole('option', { name: 'Ada Lovelace' }))
    await userEvent.click(canvas.getByRole('combobox', { name: 'Quem é apoiado' }))
    // Só pessoas do mesmo tipo: a QA (Grace) não aparece para a Ada.
    await expect(body.queryByRole('option', { name: 'Grace Hopper' })).not.toBeInTheDocument()
    await userEvent.click(body.getByRole('option', { name: 'Alan Turing' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Leve 10%' }))
    await userEvent.click(canvas.getByRole('button', { name: 'Adicionar apoio' }))
    await expect(args.onAdd).toHaveBeenCalledWith({ supporterId: 'p1', supportedId: 'p2', percentage: 10, sprintId: 's8' })
  },
}

export const RemoverDesfazerECopiar: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Valendo')).toBeInTheDocument()
    await userEvent.click(canvas.getByRole('button', { name: 'Remover apoio de Ada Lovelace a Alan Turing' }))
    await expect(args.onRemove).toHaveBeenCalledWith(['x1'])
    await expect(canvas.getByRole('status')).toHaveTextContent('Apoio de Ada Lovelace a Alan Turing removido')
    await userEvent.click(canvas.getByRole('button', { name: 'Desfazer' }))
    await expect(args.onRestore).toHaveBeenCalledWith([ADA_TO_ALAN])

    await userEvent.click(canvas.getByRole('button', { name: 'Copiar de Sprint 07 - FY25-26' }))
    await expect(args.onCopyPrevious).toHaveBeenCalled()
    await expect(canvas.getByText('2 apoios copiados de Sprint 07 - FY25-26.')).toBeInTheDocument()
  },
}

// Alan saiu da sprint: o apoio continua guardado, mas fica fora do cálculo com o aviso.
export const ComPessoaDesalocada: Story = {
  args: {
    previousSprint: undefined,
    context: { allocations: FIXTURE_ALLOCATIONS.filter((a) => a.personId !== 'p2'), people: FIXTURE_PEOPLE, cargos: [] },
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText(/Alan Turing não está alocado nesta sprint/)).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Sem sprint anterior' })).toBeDisabled()
  },
}
