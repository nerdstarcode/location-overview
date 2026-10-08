import { Link } from 'react-router-dom'
import { AzureTokenForm } from '../../components/organisms/AzureTokenForm/AzureTokenForm'
import { useAzureConfig } from '../../contexts/azure/AzureConfigContext'

export function AzureSettingsPage() {
  const { config, isConfigured, saveConfig, clearConfig, testConnection } = useAzureConfig()

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-semibold text-[var(--text-h)]">Configuração do Azure DevOps</h2>
        {isConfigured && (
          <Link to="/azure" className="text-sm font-medium text-[var(--accent)] hover:underline">
            Ver projetos →
          </Link>
        )}
      </div>
      <AzureTokenForm
        // Remonta o formulário quando a configuração é removida/salva por outro caminho.
        key={`${config.organization}|${config.pat ? 'pat' : ''}`}
        initialConfig={config}
        onSave={saveConfig}
        onTest={testConnection}
        onClear={isConfigured ? clearConfig : undefined}
      />
    </div>
  )
}
