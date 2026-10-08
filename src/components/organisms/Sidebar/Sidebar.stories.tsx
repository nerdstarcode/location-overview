import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'
import { expect, userEvent, within } from 'storybook/test'
import { LayoutDashboard } from 'lucide-react'
import { Sidebar } from './Sidebar'
import { NavItem } from '../../molecules/NavItem/NavItem'

function SidebarDemo() {
  const [open, setOpen] = useState(true)
  return (
    <div className="flex h-80">
      <Sidebar open={open} onClose={() => setOpen(false)}>
        <NavItem to="/" label="Alocação" icon={LayoutDashboard} exact />
      </Sidebar>
      {!open && (
        <button type="button" onClick={() => setOpen(true)}>
          Abrir menu
        </button>
      )}
    </div>
  )
}

const meta: Meta<typeof SidebarDemo> = {
  title: 'Organisms/Sidebar',
  component: SidebarDemo,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/']}>
        <Story />
      </MemoryRouter>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof SidebarDemo>

export const AbreEFecha: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Alocação')).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Fechar menu' }))
    await expect(canvas.getByRole('button', { name: 'Abrir menu' })).toBeInTheDocument()
  },
}
