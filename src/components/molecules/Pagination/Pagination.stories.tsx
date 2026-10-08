import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, userEvent, within } from 'storybook/test'
import { Pagination } from './Pagination'

function PaginationDemo() {
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const total = 137
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <Pagination
      page={page}
      pageSize={pageSize}
      totalPages={totalPages}
      total={total}
      onPageChange={setPage}
      onPageSizeChange={(size) => {
        setPageSize(size)
        setPage(1)
      }}
    />
  )
}

const meta: Meta<typeof PaginationDemo> = {
  title: 'Molecules/Pagination',
  component: PaginationDemo,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof PaginationDemo>

export const Default: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await expect(canvas.getByText('Página 1 de 6')).toBeInTheDocument()

    await userEvent.click(canvas.getByRole('button', { name: 'Próxima página' }))
    await expect(canvas.getByText('Página 2 de 6')).toBeInTheDocument()
  },
}
