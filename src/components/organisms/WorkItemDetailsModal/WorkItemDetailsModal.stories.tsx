import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, within } from 'storybook/test'
import { WorkItemDetailsModal } from './WorkItemDetailsModal'
import { AzureConfigProvider } from '../../../contexts/azure/AzureConfigProvider'
import { PERSON_FIXTURE_DELAY, PERSON_FIXTURE_DELAYED_ITEM, PERSON_FIXTURE_ROWS } from '../../../lib/personFixtures'

const meta: Meta<typeof WorkItemDetailsModal> = {
  title: 'Organisms/Dashboard/WorkItemDetailsModal',
  component: WorkItemDetailsModal,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <AzureConfigProvider>
        <Story />
      </AzureConfigProvider>
    ),
  ],
  args: { row: PERSON_FIXTURE_DELAYED_ITEM, delay: PERSON_FIXTURE_DELAY, allRows: PERSON_FIXTURE_ROWS, onClose: fn() },
}

export default meta
type Story = StoryObj<typeof WorkItemDetailsModal>

export const ItemAtrasado: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement.ownerDocument.body)
    await expect(canvas.getByRole('status')).toHaveTextContent('Tag Delayed')
    await expect(canvas.getByText('Sprint de entrega').nextElementSibling).toHaveTextContent('Sprint 09 - FY25-26')
    await expect(canvas.getByText('Sprint planejada').nextElementSibling).toHaveTextContent('Sprint 08 - FY25-26')
    await expect(canvas.getByText('Configure o Azure DevOps para buscar o histórico do item.')).toBeInTheDocument()
  },
}
