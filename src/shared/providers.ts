export type AgentProviderId = 'claude' | 'cursor'

export interface RendererModel {
  id: string
  label: string
  description: string
  contextWindow: number
}

export interface RendererProvider {
  id: AgentProviderId
  displayName: string
  color: { text: string; bg: string; border: string; accent: string }
  models: RendererModel[]
  defaultModel: string
  capabilities: {
    sessionResume: boolean
    modelSwitchInSession: boolean
    contextUsage: boolean
    plans: boolean
    sessionFork: boolean
  }
}

export const PROVIDERS: RendererProvider[] = [
  {
    id: 'claude',
    displayName: 'Claude',
    color: { text: 'text-orange-400', bg: 'bg-orange-400/10', border: 'border-orange-400/30', accent: 'orange' },
    models: [
      { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6', description: 'Fast & capable', contextWindow: 1_000_000 },
      { id: 'claude-opus-4-6', label: 'Opus 4.6', description: 'Most intelligent', contextWindow: 1_000_000 },
      { id: 'claude-haiku-4-5', label: 'Haiku 4.5', description: 'Fastest', contextWindow: 200_000 }
    ],
    defaultModel: 'claude-opus-4-6',
    capabilities: { sessionResume: true, modelSwitchInSession: true, contextUsage: true, plans: true, sessionFork: true }
  },
  {
    id: 'cursor',
    displayName: 'Cursor',
    color: { text: 'text-violet-400', bg: 'bg-violet-400/10', border: 'border-violet-400/30', accent: 'violet' },
    models: [
      { id: 'composer-2-fast', label: 'Composer 2 Fast', description: 'Fast default', contextWindow: 200_000 },
      { id: 'claude-4.6-opus-high-thinking', label: 'Opus 4.6 1M Thinking', description: 'Most intelligent + thinking', contextWindow: 1_000_000 },
      { id: 'claude-4.6-opus-max-thinking', label: 'Opus 4.6 Max Thinking', description: 'Max effort + thinking', contextWindow: 1_000_000 },
      { id: 'claude-4.6-opus-max', label: 'Opus 4.6 Max', description: 'Max effort', contextWindow: 1_000_000 },
      { id: 'claude-4.6-opus-high', label: 'Opus 4.6 High', description: 'Most intelligent', contextWindow: 1_000_000 },
      { id: 'claude-4.6-sonnet-medium', label: 'Sonnet 4.6 1M', description: 'Fast & capable', contextWindow: 1_000_000 },
      { id: 'gpt-5.3-codex', label: 'Codex 5.3', description: 'Strong coding', contextWindow: 200_000 },
      { id: 'gpt-5.4-medium', label: 'GPT-5.4 1M', description: 'Latest GPT', contextWindow: 1_000_000 },
      { id: 'gemini-3.1-pro', label: 'Gemini 3.1 Pro', description: 'Google latest', contextWindow: 1_000_000 }
    ],
    defaultModel: 'claude-4.6-opus-high-thinking',
    capabilities: { sessionResume: true, modelSwitchInSession: true, contextUsage: false, plans: true, sessionFork: false }
  }
]

// Lookup helpers
const modelToProvider = new Map<string, RendererProvider>()
for (const p of PROVIDERS) {
  for (const m of p.models) {
    modelToProvider.set(m.id, p)
  }
}

export function getProviderById(id: AgentProviderId): RendererProvider {
  return PROVIDERS.find((p) => p.id === id) || PROVIDERS[0]
}

export function getProviderForModel(modelId: string): RendererProvider | undefined {
  return modelToProvider.get(modelId)
}

export function inferProvider(modelId: string): RendererProvider {
  return modelToProvider.get(modelId) || PROVIDERS[0]
}

export function getAllModels(): RendererModel[] {
  return PROVIDERS.flatMap((p) => p.models)
}
