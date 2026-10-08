import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, within } from 'storybook/test'
import { AppShell } from './AppShell'

const meta: Meta<typeof AppShell> = {
  title: 'Templates/AppShell',
  component: AppShell,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component:
          'Layout raiz da aplicação: menu lateral (`Sidebar` + `NavItem`) sem autenticação/permissões, ' +
          'com um único item ("Alocação" → "/"), barra superior com `ThemeToggle` e o conteúdo da rota via `Outlet`.',
      },
    },
  },
  decorators: [
    (Story) => (
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route path="/" element={<Story />}>
            <Route index element={<p>Conteúdo da rota</p>} />
          </Route>
        </Routes>
      </MemoryRouter>
    ),
  ],
}

export default meta
type Story = StoryObj<typeof AppShell>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Alocação Sprint')).toBeInTheDocument()
    await expect(canvas.getByRole('link', { name: 'Alocação' })).toBeInTheDocument()
    await expect(canvas.getByText('Conteúdo da rota')).toBeInTheDocument()
  },
}
