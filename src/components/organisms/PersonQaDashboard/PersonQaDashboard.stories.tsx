import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { PersonQaDashboard } from './PersonQaDashboard'
import { PERSON_FIXTURE_QA_METRICS } from '../../../lib/personFixtures'

const meta: Meta<typeof PersonQaDashboard> = {
  title: 'Organisms/Dashboard/PersonQaDashboard',
  component: PersonQaDashboard,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { metrics: PERSON_FIXTURE_QA_METRICS, onOpenItem: fn() },
}

export default meta
type Story = StoryObj<typeof PersonQaDashboard>

export const ComExecucoes: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('72')).toBeInTheDocument()
    await expect(canvas.getByText('36 testes/sprint')).toBeInTheDocument()
    await userEvent.click(canvas.getByText('Login com SSO - caminho feliz'))
    await expect(args.onOpenItem).toHaveBeenCalled()
  },
}
