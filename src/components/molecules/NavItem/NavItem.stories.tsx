import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'
import { expect, within } from 'storybook/test'
import { LayoutDashboard } from 'lucide-react'
import { NavItem } from './NavItem'

const meta: Meta<typeof NavItem> = {
  title: 'Molecules/NavItem',
  component: NavItem,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/']}>
        <Story />
      </MemoryRouter>
    ),
  ],
  args: {
    to: '/',
    label: 'Alocação',
    icon: LayoutDashboard,
    exact: true,
  },
}

export default meta
type Story = StoryObj<typeof NavItem>

export const Ativo: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const link = canvas.getByRole('link', { name: 'Alocação' })
    await expect(link).toBeInTheDocument()
    await expect(link).toHaveAttribute('aria-current', 'page')
  },
}
