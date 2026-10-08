import type { Meta, StoryObj } from '@storybook/react-vite'
import { expect, fn, userEvent, within } from 'storybook/test'
import { AzureTokenForm } from './AzureTokenForm'
import { DEFAULT_AZURE_CONFIG } from '../../../lib/azure/azureConfigStorage'

const meta: Meta<typeof AzureTokenForm> = {
  title: 'Organisms/Azure/AzureTokenForm',
  component: AzureTokenForm,
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
  args: { initialConfig: DEFAULT_AZURE_CONFIG, onSave: fn(), onTest: fn(async () => 3) },
}

export default meta
type Story = StoryObj<typeof AzureTokenForm>

export const Preencher: Story = {
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement)
    const save = canvas.getByRole('button', { name: 'Salvar' })
    await expect(save).toBeDisabled()

    await userEvent.type(canvas.getByLabelText(/^Organização/), 'minha-org')
    await userEvent.type(canvas.getByLabelText(/^Personal Access Token/), 'abc123')
    await userEvent.click(canvas.getByRole('button', { name: 'Testar conexão' }))
    await expect(await canvas.findByText('Conexão ok — 3 projeto(s) visível(is) para este token.')).toBeInTheDocument()

    await userEvent.click(save)
    await expect(args.onSave).toHaveBeenCalledWith(
      expect.objectContaining({ organization: 'minha-org', pat: 'abc123', qaMinPercent: 20, qaMaxPercent: 30 }),
    )
  },
}

export const TokenInvalido: Story = {
  args: {
    initialConfig: { ...DEFAULT_AZURE_CONFIG, organization: 'minha-org', pat: 'expirado' },
    onTest: fn(async () => {
      throw new Error('Token inválido ou expirado. Atualize o PAT na configuração do Azure DevOps.')
    }),
  },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button', { name: 'Testar conexão' }))
    await expect(await canvas.findByText(/Token inválido ou expirado/)).toBeInTheDocument()
  },
}
