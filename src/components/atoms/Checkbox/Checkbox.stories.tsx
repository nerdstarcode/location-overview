import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { Checkbox } from './Checkbox'

const meta: Meta<typeof Checkbox> = {
  title: 'Atoms/Checkbox',
  component: Checkbox,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
  args: { onChange: fn(), 'aria-label': 'Selecionar' },
}

export default meta
type Story = StoryObj<typeof Checkbox>

export const Default: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('checkbox'))
    await expect(args.onChange).toHaveBeenCalledTimes(1)
  },
}

export const Marcado: Story = {
  args: { checked: true },
}

export const Indeterminado: Story = {
  args: { indeterminate: true },
}
