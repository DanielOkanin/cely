import type { AgentProviderId, AgentProviderConfig } from './types'
import { claudeProvider } from './claude'
import { cursorProvider } from './cursor'
export type { AgentProviderId, AgentModel, AgentProviderConfig } from './types'

const providers: Record<AgentProviderId, AgentProviderConfig> = {
  claude: claudeProvider,
  cursor: cursorProvider
}

// Build model-to-provider lookup
const modelToProvider = new Map<string, AgentProviderConfig>()
for (const provider of Object.values(providers)) {
  for (const model of provider.models) {
    modelToProvider.set(model.id, provider)
  }
}

export function getProvider(id: AgentProviderId): AgentProviderConfig {
  return providers[id] || providers.claude
}

export function getAllProviders(): AgentProviderConfig[] {
  return Object.values(providers)
}

export function getProviderForModel(modelId: string): AgentProviderConfig | undefined {
  return modelToProvider.get(modelId)
}

export function inferProvider(modelId: string): AgentProviderConfig {
  return modelToProvider.get(modelId) || providers.claude
}
