import type { Meta, StoryObj } from '@storybook/react-vite'
import { MemoryRouter } from 'react-router-dom'
import { expect, userEvent, within } from 'storybook/test'
import { ChartColumn, LayoutGrid, UserRound, UsersRound } from 'lucide-react'
import { NavGroup } from './NavGroup'
import { NavItem } from '../NavItem/NavItem'

function DashboardsGroup() {
  return (
    <div className="w-64">
      <NavGroup label="Dashboards" icon={LayoutGrid} basePath="/dashboard">
        <NavItem to="/dashboard/pessoas" label="Pessoas" icon={UsersRound} />
        <NavItem to="/dashboard/squad" label="Squad" icon={ChartColumn} />
        <NavItem to="/dashboard/pessoa" label="Pessoa" icon={UserRound} />
      </NavGroup>
    </div>
  )
}

const meta: Meta<typeof NavGroup> = {
  title: 'Molecules/NavGroup',
  component: NavGroup,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof NavGroup>

export const DentroDoGrupo: Story = {
  render: () => (
    <MemoryRouter initialEntries={['/dashboard/pessoa/p1']}>
      <DashboardsGroup />
    </MemoryRouter>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const header = canvas.getByRole('button', { name: 'Dashboards' })
    await expect(header).toHaveAttribute('aria-expanded', 'true')
    // /dashboard/pessoa/:id ativa "Pessoa", não "Pessoas".
    await expect(canvas.getByRole('link', { name: 'Pessoa' })).toHaveAttribute('aria-current', 'page')
    await expect(canvas.getByRole('link', { name: 'Pessoas' })).not.toHaveAttribute('aria-current')

    await userEvent.click(header)
    await expect(header).toHaveAttribute('aria-expanded', 'false')
    await expect(canvas.queryByRole('link', { name: 'Pessoa' })).not.toBeInTheDocument()
  },
}

export const ForaDoGrupo: Story = {
  render: () => (
    <MemoryRouter initialEntries={['/work-items']}>
      <DashboardsGroup />
    </MemoryRouter>
  ),
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    const header = canvas.getByRole('button', { name: 'Dashboards' })
    await expect(header).toHaveAttribute('aria-expanded', 'false')
    await userEvent.click(header)
    await expect(canvas.getByRole('link', { name: 'Squad' })).toBeVisible()
  },
}
