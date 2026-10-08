import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'
import { expect, userEvent, within } from 'storybook/test'
import { AzureProjectsList } from './AzureProjectsList'

const meta: Meta<typeof AzureProjectsList> = {
  title: 'Organisms/Azure/AzureProjectsList',
  component: AzureProjectsList,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof AzureProjectsList>

export const ComBusca: Story = {
  args: {
    projects: [
      { id: '1', name: 'Portal', description: 'Portal do cliente', state: 'wellFormed' },
      { id: '2', name: 'Backoffice', state: 'wellFormed' },
    ],
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByRole('link', { name: /Portal/ })).toHaveAttribute('href', '/azure/Portal')
    await userEvent.type(canvas.getByLabelText('Buscar projeto'), 'back')
    await expect(canvas.queryByText('Portal')).not.toBeInTheDocument()
    await expect(canvas.getByText('Backoffice')).toBeInTheDocument()
  },
}
