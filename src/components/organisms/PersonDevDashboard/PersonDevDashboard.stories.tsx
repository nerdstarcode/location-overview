import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { PersonDevDashboard } from './PersonDevDashboard'
import { PERSON_FIXTURE_DEV_METRICS } from '../../../lib/personFixtures'

const meta: Meta<typeof PersonDevDashboard> = {
  title: 'Organisms/Dashboard/PersonDevDashboard',
  component: PersonDevDashboard,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { metrics: PERSON_FIXTURE_DEV_METRICS, peerAverage: 6, mode: 'assigned', onModeChange: fn(), onOpenItem: fn() },
}

export default meta
type Story = StoryObj<typeof PersonDevDashboard>

export const ComEntregas: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Média de SP atrasados')).toBeInTheDocument()
    await expect(canvas.getByText('Média do time: 6 SP/sprint')).toBeInTheDocument()
    await expect(canvas.getByText('Story Points entregues por sprint e squad')).toBeInTheDocument()
    await expect(canvas.getByRole('button', { name: 'Como funciona: Entrega × previsto' })).toHaveAccessibleDescription(
      /só nas sprints em que ela tem alocação/,
    )
    await expect(canvas.queryByText('Nenhuma entrega nas sprints selecionadas.')).not.toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Rateio por Tasks' }))
    await expect(args.onModeChange).toHaveBeenCalledWith('tasks')

    await userEvent.click(canvas.getByRole('checkbox'))
    await expect(canvas.getByText('Integração com o ERP')).toBeInTheDocument()
    await expect(canvas.queryByText('Erro ao salvar')).not.toBeInTheDocument()

    await userEvent.click(canvas.getByText('Integração com o ERP'))
    await expect(args.onOpenItem).toHaveBeenCalledWith(expect.objectContaining({ row: expect.objectContaining({ id: 109 }) }))
  },
}
