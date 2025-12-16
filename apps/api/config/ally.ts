import env from '#start/env'
import { defineConfig, services } from '@adonisjs/ally'

const allyConfig = defineConfig({
  google: services.google({
    clientId: env.get('GOOGLE_CLIENT_ID', ''),
    clientSecret: env.get('GOOGLE_CLIENT_SECRET', ''),
    callbackUrl: env.get(
      'GOOGLE_CALLBACK_URL',
      'http://localhost:3333/api/v1/auth/oauth/google/callback'
    ),
    scopes: ['email', 'profile'],
  }),
  github: services.github({
    clientId: env.get('GITHUB_CLIENT_ID', ''),
    clientSecret: env.get('GITHUB_CLIENT_SECRET', ''),
    callbackUrl: env.get(
      'GITHUB_CALLBACK_URL',
      'http://localhost:3333/api/v1/auth/oauth/github/callback'
    ),
    scopes: ['user:email'],
  }),
})

export default allyConfig

declare module '@adonisjs/ally/types' {
  interface SocialProviders extends InferSocialProviders<typeof allyConfig> {}
}
