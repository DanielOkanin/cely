export type AgentProviderId = 'claude' | 'cursor'

export interface AgentModel {
  id: string
  label: string
  description: string
  contextWindow: number
}

export interface AgentProviderConfig {
  id: AgentProviderId
  displayName: string
  binary: string
  models: AgentModel[]
  defaultModel: string
  capabilities: {
    sessionResume: boolean
    modelSwitchInSession: boolean
    contextUsage: boolean
    plans: boolean
    sessionFork: boolean
  }
  buildCommand(sessionId: string, model: string, resume: boolean): string
  getModelSwitchCommand?(modelId: string): string | null
}
