import OpenAI from 'openai'

export function createOpenAIClient(apiKey?: string) {
  return new OpenAI({
    apiKey: apiKey || process.env.OPENAI_API_KEY,
  })
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface ChatResponse {
  content: string
  tokensUsed: number
}

export async function chat(
  messages: ChatMessage[],
  apiKey?: string,
  model = 'gpt-4o-mini'
): Promise<ChatResponse> {
  const client = createOpenAIClient(apiKey)
  
  const response = await client.chat.completions.create({
    model,
    messages,
    max_tokens: 1000,
    temperature: 0.3,
  })
  
  return {
    content: response.choices[0]?.message?.content || '',
    tokensUsed: response.usage?.total_tokens || 0,
  }
}

export async function embedText(text: string, apiKey?: string): Promise<number[]> {
  const client = createOpenAIClient(apiKey)
  
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  })
  
  return response.data[0]?.embedding || []
}

export async function embedBatch(texts: string[], apiKey?: string): Promise<number[][]> {
  const client = createOpenAIClient(apiKey)
  
  const response = await client.embeddings.create({
    model: 'text-embedding-3-small',
    input: texts,
  })
  
  return response.data.map(item => item.embedding)
}