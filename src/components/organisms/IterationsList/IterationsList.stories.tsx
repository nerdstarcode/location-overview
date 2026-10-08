import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { IterationsList } from './IterationsList'
import { FIXTURE_ITERATIONS } from '../../../lib/azure/sprintFixtures'

const meta: Meta<typeof IterationsList> = {
  title: 'Organisms/Azure/IterationsList',
  component: IterationsList,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { onOpen: fn() },
}

export default meta
type Story = StoryObj<typeof IterationsList>

export const ComSprints: Story = {
  args: { iterations: FIXTURE_ITERATIONS },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Atual')).toBeInTheDocument()
    await userEvent.click(canvas.getAllByRole('button', { name: 'Analisar' })[0])
    await expect(args.onOpen).toHaveBeenCalledWith(FIXTURE_ITERATIONS[0])
  },
}

export const Vazia: Story = {
  args: { iterations: [] },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Este team não tem sprints configuradas.')).toBeInTheDocument()
  },
}
