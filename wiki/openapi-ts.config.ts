import { defineConfig } from '@hey-api/openapi-ts'

export default defineConfig({
  input: '../core/openapi.yaml',
  output: {
    path: 'src/lib/generated',
  },
  plugins: [
    '@hey-api/typescript',
    '@hey-api/sdk',
    '@hey-api/client-fetch',
    {
      name: '@tanstack/react-query',
      queryOptions: true,
      mutationOptions: true,
    },
  ],
})
