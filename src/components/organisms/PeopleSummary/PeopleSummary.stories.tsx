import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { PeopleSummary } from './PeopleSummary'
import { PERSON_FIXTURE_SUMMARY } from '../../../lib/personFixtures'

const meta: Meta<typeof PeopleSummary> = {
  title: 'Organisms/Dashboard/PeopleSummary',
  component: PeopleSummary,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { rows: PERSON_FIXTURE_SUMMARY, view: 'dev', mode: 'assigned', onModeChange: fn(), onOpenPerson: fn() },
}

export default meta
type Story = StoryObj<typeof PeopleSummary>

export const Dev: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Story Points entregues por pessoa')).toBeInTheDocument()
    // A QA fica fora da visão Dev.
    await expect(canvas.queryByRole('cell', { name: 'Grace Hopper' })).not.toBeInTheDocument()

    await userEvent.click(canvas.getByRole('cell', { name: 'Ada Lovelace' }))
    await expect(args.onOpenPerson).toHaveBeenCalledWith(expect.objectContaining({ nome: 'Ada Lovelace' }))
  },
}

export const QA: Story = {
  args: { view: 'qa' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Testes executados por pessoa')).toBeInTheDocument()
    await expect(canvas.getByRole('cell', { name: 'Grace Hopper' })).toBeInTheDocument()
    await expect(canvas.getByRole('cell', { name: '72' })).toBeInTheDocument()
  },
}
