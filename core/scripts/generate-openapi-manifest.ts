/**
 * @module scripts/generate-openapi-manifest
 *
 * @summary Extracts all Zod schemas into JSON Schema and maps them to
 * HTTP routes. Outputs a single manifest JSON consumed by /apidoc.
 *
 * @remarks
 * Run: `pnpm --filter @robin/core openapi:manifest`
 * Output: `core/openapi-manifest.json`
 */

import { zodToJsonSchema } from 'zod-to-json-schema'
import type { ZodType } from 'zod'
import { writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  errorResponseSchema,
  okResponseSchema,
  queuedResponseSchema,
  createEntryBodySchema,
  entryListQuerySchema,
  entryResponseSchema,
  entryCreatedResponseSchema,
  entryListResponseSchema,
  createFragmentBodySchema,
  updateFragmentBodySchema,
  fragmentListQuerySchema,
  fragmentResponseSchema,
  fragmentWithContentResponseSchema,
  fragmentListResponseSchema,
  createThreadBodySchema,
  updateThreadBodySchema,
  threadResponseSchema,
  threadWithWikiResponseSchema,
  threadListResponseSchema,
  personResponseSchema,
  personWithBacklinksResponseSchema,
  personListResponseSchema,
  createVaultBodySchema,
  updateVaultBodySchema,
  vaultResponseSchema,
  vaultListResponseSchema,
  searchQuerySchema,
  searchResponseSchema,
  userProfileResponseSchema,
  userStatsResponseSchema,
  userActivityResponseSchema,
  keypairResponseSchema,
  mcpEndpointResponseSchema,
  exportDataResponseSchema,
  graphResponseSchema,
  relationshipsResponseSchema,
  configNoteResponseSchema,
  configNoteListResponseSchema,
  updateConfigNoteBodySchema,
  retryStuckDryRunResponseSchema,
  retryStuckResponseSchema,
  syncNotifyPayloadSchema,
  syncAcceptedResponseSchema,
  contentRawResponseSchema,
  contentStructuredResponseSchema,
  fragmentWriteSchema,
  entryWriteSchema,
  threadWriteSchema,
  personWriteSchema,
} from '../src/schemas/index.js'

// ── Schema registry ─────────────────────────────────────────────────────────

const schemaRegistry: Record<string, ZodType> = {
  errorResponseSchema,
  okResponseSchema,
  queuedResponseSchema,
  createEntryBodySchema,
  entryListQuerySchema,
  entryResponseSchema,
  entryCreatedResponseSchema,
  entryListResponseSchema,
  createFragmentBodySchema,
  updateFragmentBodySchema,
  fragmentListQuerySchema,
  fragmentResponseSchema,
  fragmentWithContentResponseSchema,
  fragmentListResponseSchema,
  createThreadBodySchema,
  updateThreadBodySchema,
  threadResponseSchema,
  threadWithWikiResponseSchema,
  threadListResponseSchema,
  personResponseSchema,
  personWithBacklinksResponseSchema,
  personListResponseSchema,
  createVaultBodySchema,
  updateVaultBodySchema,
  vaultResponseSchema,
  vaultListResponseSchema,
  searchQuerySchema,
  searchResponseSchema,
  userProfileResponseSchema,
  userStatsResponseSchema,
  userActivityResponseSchema,
  keypairResponseSchema,
  mcpEndpointResponseSchema,
  exportDataResponseSchema,
  graphResponseSchema,
  relationshipsResponseSchema,
  configNoteResponseSchema,
  configNoteListResponseSchema,
  updateConfigNoteBodySchema,
  retryStuckDryRunResponseSchema,
  retryStuckResponseSchema,
  syncNotifyPayloadSchema,
  syncAcceptedResponseSchema,
  contentRawResponseSchema,
  contentStructuredResponseSchema,
  fragmentWriteSchema,
  entryWriteSchema,
  threadWriteSchema,
  personWriteSchema,
}

// ── Route definitions ───────────────────────────────────────────────────────

interface RouteSpec {
  method: string
  path: string
  operationId: string
  summary: string
  tags: string[]
  auth: 'session' | 'hmac' | 'jwt' | 'none'
  request?: {
    body?: { schemaName: string }
    query?: { schemaName: string }
    params?: Record<string, string>
  }
  responses: Record<string, { description: string; schemaName?: string }>
}

const routes: RouteSpec[] = [
  // System
  { method: 'GET', path: '/health', operationId: 'getHealth', summary: 'Health check', tags: ['System'], auth: 'none', responses: { '200': { description: 'Server is running' } } },
  { method: 'GET', path: '/openapi.json', operationId: 'getOpenApiSpec', summary: 'OpenAPI specification', tags: ['System'], auth: 'none', responses: { '200': { description: 'The OpenAPI spec' } } },

  // Entries
  { method: 'POST', path: '/entries', operationId: 'createEntry', summary: 'Create a new entry (queues async processing)', tags: ['Entries'], auth: 'session', request: { body: { schemaName: 'createEntryBodySchema' } }, responses: { '202': { description: 'Entry created and queued', schemaName: 'entryCreatedResponseSchema' }, '400': { description: 'Invalid input', schemaName: 'errorResponseSchema' } } },
  { method: 'GET', path: '/entries', operationId: 'listEntries', summary: 'List recent entries', tags: ['Entries'], auth: 'session', request: { query: { schemaName: 'entryListQuerySchema' } }, responses: { '200': { description: 'List of entries', schemaName: 'entryListResponseSchema' } } },
  { method: 'GET', path: '/entries/{id}', operationId: 'getEntry', summary: 'Get an entry by ID', tags: ['Entries'], auth: 'session', request: { params: { id: 'lookupKey' } }, responses: { '200': { description: 'The entry', schemaName: 'entryResponseSchema' }, '404': { description: 'Not found', schemaName: 'errorResponseSchema' } } },
  { method: 'GET', path: '/entries/{id}/fragments', operationId: 'listEntryFragments', summary: 'Get all fragments derived from an entry', tags: ['Entries'], auth: 'session', request: { params: { id: 'lookupKey' } }, responses: { '200': { description: 'Fragments for this entry', schemaName: 'fragmentListResponseSchema' }, '404': { description: 'Not found', schemaName: 'errorResponseSchema' } } },

  // Fragments
  { method: 'GET', path: '/fragments', operationId: 'listFragments', summary: 'List fragments', tags: ['Fragments'], auth: 'session', request: { query: { schemaName: 'fragmentListQuerySchema' } }, responses: { '200': { description: 'List of fragments', schemaName: 'fragmentListResponseSchema' } } },
  { method: 'GET', path: '/fragments/{id}', operationId: 'getFragment', summary: 'Get a fragment by ID (includes content)', tags: ['Fragments'], auth: 'session', request: { params: { id: 'lookupKey' } }, responses: { '200': { description: 'Fragment with content', schemaName: 'fragmentWithContentResponseSchema' }, '404': { description: 'Not found', schemaName: 'errorResponseSchema' } } },
  { method: 'POST', path: '/fragments', operationId: 'createFragment', summary: 'Create a new fragment', tags: ['Fragments'], auth: 'session', request: { body: { schemaName: 'createFragmentBodySchema' } }, responses: { '201': { description: 'Created fragment', schemaName: 'fragmentWithContentResponseSchema' }, '400': { description: 'Invalid input', schemaName: 'errorResponseSchema' } } },
  { method: 'PUT', path: '/fragments/{id}', operationId: 'updateFragment', summary: 'Update a fragment', tags: ['Fragments'], auth: 'session', request: { params: { id: 'lookupKey' }, body: { schemaName: 'updateFragmentBodySchema' } }, responses: { '200': { description: 'Updated fragment', schemaName: 'fragmentResponseSchema' }, '404': { description: 'Not found', schemaName: 'errorResponseSchema' } } },
  { method: 'PUT', path: '/fragments/{id}/thread', operationId: 'setFragmentThread', summary: 'Move fragment to thread (not implemented)', tags: ['Fragments'], auth: 'session', responses: { '501': { description: 'Not implemented', schemaName: 'errorResponseSchema' } } },
  { method: 'GET', path: '/fragments/{id}/links', operationId: 'getFragmentLinks', summary: 'Get outgoing connections (stub)', tags: ['Fragments'], auth: 'session', responses: { '200': { description: 'Outgoing links (empty)' } } },
  { method: 'GET', path: '/fragments/{id}/backlinks', operationId: 'getFragmentBacklinks', summary: 'Get incoming connections (stub)', tags: ['Fragments'], auth: 'session', responses: { '200': { description: 'Incoming backlinks (empty)' } } },

  // Threads
  { method: 'GET', path: '/threads/{id}', operationId: 'getThread', summary: 'Get a thread by ID (includes wiki content)', tags: ['Threads'], auth: 'session', request: { params: { id: 'lookupKey' } }, responses: { '200': { description: 'Thread with wiki content', schemaName: 'threadWithWikiResponseSchema' }, '404': { description: 'Not found', schemaName: 'errorResponseSchema' } } },
  { method: 'PUT', path: '/threads/{id}', operationId: 'updateThread', summary: 'Update a thread', tags: ['Threads'], auth: 'session', request: { params: { id: 'lookupKey' }, body: { schemaName: 'updateThreadBodySchema' } }, responses: { '200': { description: 'Updated thread', schemaName: 'threadResponseSchema' }, '404': { description: 'Not found', schemaName: 'errorResponseSchema' } } },
  { method: 'POST', path: '/threads/{id}/regenerate', operationId: 'regenerateThread', summary: 'Trigger thread wiki regeneration', tags: ['Threads'], auth: 'session', request: { params: { id: 'lookupKey' } }, responses: { '202': { description: 'Job queued', schemaName: 'queuedResponseSchema' }, '404': { description: 'Not found', schemaName: 'errorResponseSchema' } } },
  { method: 'POST', path: '/threads/{targetId}/merge', operationId: 'mergeThreads', summary: 'Merge threads (not implemented)', tags: ['Threads'], auth: 'session', responses: { '501': { description: 'Not implemented', schemaName: 'errorResponseSchema' } } },

  // Vaults
  { method: 'GET', path: '/vaults', operationId: 'listVaults', summary: 'List all vaults', tags: ['Vaults'], auth: 'session', responses: { '200': { description: 'List of vaults', schemaName: 'vaultListResponseSchema' } } },
  { method: 'GET', path: '/vaults/{id}', operationId: 'getVault', summary: 'Get a vault by ID', tags: ['Vaults'], auth: 'session', request: { params: { id: 'string' } }, responses: { '200': { description: 'The vault', schemaName: 'vaultResponseSchema' }, '404': { description: 'Not found', schemaName: 'errorResponseSchema' } } },
  { method: 'POST', path: '/vaults', operationId: 'createVault', summary: 'Create a new vault', tags: ['Vaults'], auth: 'session', request: { body: { schemaName: 'createVaultBodySchema' } }, responses: { '201': { description: 'Created vault', schemaName: 'vaultResponseSchema' }, '400': { description: 'Invalid input', schemaName: 'errorResponseSchema' } } },
  { method: 'PUT', path: '/vaults/{id}', operationId: 'updateVault', summary: 'Update a vault', tags: ['Vaults'], auth: 'session', request: { params: { id: 'string' }, body: { schemaName: 'updateVaultBodySchema' } }, responses: { '200': { description: 'Updated vault', schemaName: 'vaultResponseSchema' }, '404': { description: 'Not found', schemaName: 'errorResponseSchema' } } },
  { method: 'PUT', path: '/vaults/{id}/profile', operationId: 'updateVaultProfile', summary: "Update vault profile text", tags: ['Vaults'], auth: 'session', request: { params: { id: 'string' } }, responses: { '200': { description: 'Updated vault', schemaName: 'vaultResponseSchema' }, '404': { description: 'Not found', schemaName: 'errorResponseSchema' } } },
  { method: 'GET', path: '/vaults/{vaultId}/threads', operationId: 'listVaultThreads', summary: 'List threads in a vault', tags: ['Vaults'], auth: 'session', request: { params: { vaultId: 'string' } }, responses: { '200': { description: 'List of threads', schemaName: 'threadListResponseSchema' } } },
  { method: 'POST', path: '/vaults/{vaultId}/threads', operationId: 'createVaultThread', summary: 'Create a thread in a vault', tags: ['Vaults'], auth: 'session', request: { params: { vaultId: 'string' }, body: { schemaName: 'createThreadBodySchema' } }, responses: { '201': { description: 'Created thread', schemaName: 'threadResponseSchema' }, '400': { description: 'Invalid input', schemaName: 'errorResponseSchema' }, '404': { description: 'Vault not found', schemaName: 'errorResponseSchema' } } },

  // People
  { method: 'GET', path: '/people', operationId: 'listPeople', summary: 'List all people', tags: ['People'], auth: 'session', responses: { '200': { description: 'List of people', schemaName: 'personListResponseSchema' } } },
  { method: 'GET', path: '/people/{id}', operationId: 'getPerson', summary: 'Get a person by ID (includes backlinks)', tags: ['People'], auth: 'session', request: { params: { id: 'lookupKey' } }, responses: { '200': { description: 'Person with backlinks', schemaName: 'personWithBacklinksResponseSchema' }, '404': { description: 'Not found', schemaName: 'errorResponseSchema' } } },
  { method: 'POST', path: '/people/{id}/regenerate', operationId: 'regeneratePerson', summary: 'Trigger person body regeneration', tags: ['People'], auth: 'session', request: { params: { id: 'lookupKey' } }, responses: { '202': { description: 'Job queued', schemaName: 'queuedResponseSchema' }, '404': { description: 'Not found', schemaName: 'errorResponseSchema' } } },

  // Search
  { method: 'GET', path: '/search', operationId: 'search', summary: 'Hybrid search across fragments, wikis, and people', tags: ['Search'], auth: 'session', request: { query: { schemaName: 'searchQuerySchema' } }, responses: { '200': { description: 'Search results', schemaName: 'searchResponseSchema' }, '400': { description: 'Missing query', schemaName: 'errorResponseSchema' } } },

  // Graph
  { method: 'GET', path: '/graph', operationId: 'getGraph', summary: 'Get the knowledge graph', tags: ['Graph'], auth: 'session', responses: { '200': { description: 'Graph nodes and edges', schemaName: 'graphResponseSchema' } } },

  // Relationships
  { method: 'GET', path: '/relationships/{type}/{id}', operationId: 'getRelationships', summary: 'Get all relationships for an object', tags: ['Relationships'], auth: 'session', request: { params: { type: 'enum: entry, fragment, thread, vault, person', id: 'lookupKey' } }, responses: { '200': { description: 'Relationships grouped by edge type', schemaName: 'relationshipsResponseSchema' }, '400': { description: 'Invalid type', schemaName: 'errorResponseSchema' } } },

  // Content
  { method: 'GET', path: '/api/content/{type}/{key}', operationId: 'getContent', summary: 'Read raw or structured content', tags: ['Content'], auth: 'session', request: { params: { type: 'enum: fragment, entry, thread, person', key: 'lookupKey' } }, responses: { '200': { description: 'Content (raw or structured)', schemaName: 'contentRawResponseSchema' }, '400': { description: 'Invalid type', schemaName: 'errorResponseSchema' }, '404': { description: 'Not found', schemaName: 'errorResponseSchema' } } },
  { method: 'PUT', path: '/api/content/{type}/{key}', operationId: 'updateContent', summary: 'Write structured content', tags: ['Content'], auth: 'session', request: { params: { type: 'enum: fragment, entry, thread, person', key: 'lookupKey' } }, responses: { '200': { description: 'Content updated', schemaName: 'okResponseSchema' }, '400': { description: 'Validation failed', schemaName: 'errorResponseSchema' }, '404': { description: 'Not found', schemaName: 'errorResponseSchema' } } },

  // Robin Config
  { method: 'GET', path: '/robin/config', operationId: 'listConfigNotes', summary: 'List all config notes', tags: ['Robin'], auth: 'session', responses: { '200': { description: 'List of config notes', schemaName: 'configNoteListResponseSchema' } } },
  { method: 'GET', path: '/robin/config/{key}', operationId: 'getConfigNote', summary: 'Get config note by key', tags: ['Robin'], auth: 'session', request: { params: { key: 'string' } }, responses: { '200': { description: 'The config note', schemaName: 'configNoteResponseSchema' }, '404': { description: 'Not found', schemaName: 'errorResponseSchema' } } },
  { method: 'PUT', path: '/robin/config/{key}', operationId: 'updateConfigNote', summary: 'Update config note', tags: ['Robin'], auth: 'session', request: { params: { key: 'string' }, body: { schemaName: 'updateConfigNoteBodySchema' } }, responses: { '200': { description: 'Updated config note', schemaName: 'configNoteResponseSchema' }, '404': { description: 'Not found', schemaName: 'errorResponseSchema' } } },

  // Users
  { method: 'GET', path: '/users/profile', operationId: 'getUserProfile', summary: "Get current user's profile", tags: ['Users'], auth: 'session', responses: { '200': { description: 'User profile', schemaName: 'userProfileResponseSchema' }, '404': { description: 'Not found', schemaName: 'errorResponseSchema' } } },
  { method: 'PATCH', path: '/users/onboard', operationId: 'markOnboarded', summary: 'Mark onboarding complete', tags: ['Users'], auth: 'session', responses: { '200': { description: 'Onboarding marked', schemaName: 'okResponseSchema' } } },
  { method: 'GET', path: '/users/keypair', operationId: 'getUserKeypair', summary: "Get user's Ed25519 keypair", tags: ['Users'], auth: 'session', responses: { '200': { description: 'Keypair details', schemaName: 'keypairResponseSchema' }, '404': { description: 'No keypair', schemaName: 'errorResponseSchema' } } },
  { method: 'GET', path: '/users/stats', operationId: 'getUserStats', summary: "Get user's stats", tags: ['Users'], auth: 'session', responses: { '200': { description: 'User stats', schemaName: 'userStatsResponseSchema' } } },
  { method: 'GET', path: '/users/activity', operationId: 'getUserActivity', summary: "Get user's recent activity", tags: ['Users'], auth: 'session', responses: { '200': { description: 'Recent activity', schemaName: 'userActivityResponseSchema' } } },
  { method: 'POST', path: '/users/export', operationId: 'exportUserData', summary: 'Export all user data', tags: ['Users'], auth: 'session', responses: { '200': { description: 'Full data export', schemaName: 'exportDataResponseSchema' } } },
  { method: 'POST', path: '/users/regenerate-mcp', operationId: 'regenerateMcpEndpoint', summary: 'Regenerate MCP endpoint URL', tags: ['Users'], auth: 'session', responses: { '200': { description: 'New MCP endpoint', schemaName: 'mcpEndpointResponseSchema' }, '400': { description: 'No keypair', schemaName: 'errorResponseSchema' } } },
  { method: 'DELETE', path: '/users/data', operationId: 'deleteUserData', summary: 'Delete all user data (keeps account)', tags: ['Users'], auth: 'session', responses: { '200': { description: 'Data deleted', schemaName: 'okResponseSchema' } } },
  { method: 'DELETE', path: '/users/account', operationId: 'deleteUserAccount', summary: 'Delete user account entirely', tags: ['Users'], auth: 'session', responses: { '200': { description: 'Account deleted', schemaName: 'okResponseSchema' } } },

  // Admin
  { method: 'POST', path: '/admin/retry-stuck', operationId: 'retryStuckFragments', summary: 'Re-enqueue stuck PENDING fragments', tags: ['Admin'], auth: 'none', responses: { '200': { description: 'Re-enqueue results', schemaName: 'retryStuckResponseSchema' } } },

  // Internal
  { method: 'POST', path: '/internal/sync-notify', operationId: 'syncNotify', summary: 'Gateway sync notification (HMAC)', tags: ['Internal'], auth: 'hmac', request: { body: { schemaName: 'syncNotifyPayloadSchema' } }, responses: { '202': { description: 'Sync job accepted', schemaName: 'syncAcceptedResponseSchema' }, '400': { description: 'Invalid payload', schemaName: 'errorResponseSchema' }, '401': { description: 'Invalid HMAC', schemaName: 'errorResponseSchema' } } },

  // MCP
  { method: 'POST', path: '/mcp', operationId: 'mcpTransport', summary: 'MCP Streamable HTTP transport (JWT)', tags: ['MCP'], auth: 'jwt', responses: { '200': { description: 'MCP protocol response' }, '401': { description: 'Invalid token', schemaName: 'errorResponseSchema' } } },
]

// ── Generate ────────────────────────────────────────────────────────────────

const schemas: Record<string, unknown> = {}
for (const [name, schema] of Object.entries(schemaRegistry)) {
  schemas[name] = zodToJsonSchema(schema, { name, target: 'openApi3' })
}

const manifest = {
  _meta: {
    generatedAt: new Date().toISOString(),
    description: 'Route + JSON Schema manifest for OpenAPI generation. Feed to /apidoc.',
    schemaCount: Object.keys(schemas).length,
    routeCount: routes.length,
  },
  info: {
    title: 'Robin API',
    version: '0.3.0',
    description: 'REST API for Robin.OS — a personal knowledge management system.',
  },
  servers: [{ url: 'http://localhost:3000', description: 'Local development' }],
  securitySchemes: {
    cookieAuth: { type: 'apiKey', in: 'cookie', name: 'better-auth.session_token', description: 'Session cookie set by better-auth after sign-in' },
    hmacAuth: { type: 'apiKey', in: 'header', name: 'X-Signature', description: 'HMAC-SHA256 signature of request body' },
    mcpToken: { type: 'apiKey', in: 'query', name: 'token', description: 'JWT token for MCP access' },
  },
  routes,
  schemas,
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const outPath = resolve(__dirname, '..', 'openapi-manifest.json')
writeFileSync(outPath, JSON.stringify(manifest, null, 2))
console.log(`Wrote ${outPath} (${routes.length} routes, ${Object.keys(schemas).length} schemas)`)
