import { defineConfig } from '@hey-api/openapi-ts'

const serverUrl = process.env.ROBIN_SERVER ?? 'http://localhost:3000'

export default defineConfig({
  input: `${serverUrl}/openapi.json`,
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
