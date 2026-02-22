import type { PluginInput } from '@opencode-ai/plugin'

type SendResultOptions = {
  client: PluginInput['client']
  sessionID: string
  text: string
}

export const sendResult = async (options: SendResultOptions) => {
  await options.client.session.prompt({
    path: { id: options.sessionID },
    body: {
      noReply: true,
      parts: [{
        type: 'text',
        text: options.text,
        ignored: true,
      }],
    },
  })
}
