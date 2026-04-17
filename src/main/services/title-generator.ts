import { execSync } from 'child_process'
import type { AgentProviderConfig } from '../providers/types'

export async function generateTitle(userMessage: string, dirName: string, provider?: AgentProviderConfig): Promise<string> {
  const prompt = `Generate a short title (3-6 words, no quotes) summarizing this chat message. Just output the title, nothing else.\n\nMessage: ${userMessage}`

  // Only use Claude CLI for title generation (most reliable pipe-mode support)
  if (!provider || provider.id === 'claude') {
    try {
      const result = execSync(
        `echo ${JSON.stringify(prompt)} | claude --model claude-haiku-4-5-20251001 --output-format text -p`,
        { encoding: 'utf-8', timeout: 10000 }
      ).trim()

      if (result && result.length > 0 && result.length < 80) {
        return `${dirName} — ${result}`
      }
    } catch {
      // Fall back to raw message
    }
  }

  // Fallback: use first line of message (for non-Claude providers or on error)
  const firstLine = userMessage.split('\n')[0]
  const title = firstLine.length > 60 ? firstLine.slice(0, 57) + '...' : firstLine
  return `${dirName} — ${title}`
}
