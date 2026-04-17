import type { AgentProviderConfig } from './types'

export const cursorProvider: AgentProviderConfig = {
  id: 'cursor',
  displayName: 'Cursor',
  binary: 'agent',
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
  capabilities: {
    sessionResume: true,
    modelSwitchInSession: true,
    contextUsage: false,
    plans: true,
    sessionFork: false
  },
  buildCommand(_sessionId: string, model: string, resume: boolean): string {
    if (resume) {
      return `agent --resume${model ? ` --model ${model}` : ''}`
    }
    return `agent${model ? ` --model ${model}` : ''}`
  },
  getModelSwitchCommand(modelId: string): string {
    return `/model ${modelId}`
  }
}
