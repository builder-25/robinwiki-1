import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  index,
  uniqueIndex,
  vector,
  customType,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'
import { nanoid } from '../lib/id.js'

// tsvector custom column — managed by raw SQL triggers in the migration.
// Drizzle treats it as opaque; no reads or writes from the ORM layer.
const tsvector = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'tsvector'
  },
})

// ─── Auth Tables (better-auth — single-user, user_id retained) ───
// NOTE: These four tables keep user_id and FKs because better-auth requires them.
// All other domain tables dropped user_id in M2 (single-user collapse). Do not
// re-add user_id to domain tables — single user means unscoped queries.

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  name: text('name'),
  image: text('image'),
  // MCP JWT signing + token revocation (preserved from prior schema):
  publicKey: text('public_key').notNull().default(''),
  encryptedPrivateKey: text('encrypted_private_key').notNull().default(''),
  mcpTokenVersion: integer('mcp_token_version').notNull().default(1),
  // Single-user additions (M1):
  encryptedDek: text('encrypted_dek').notNull().default(''),
  passwordResetRequired: boolean('password_reset_required').notNull().default(false),
  onboardingComplete: boolean('onboarding_complete').notNull().default(false),
  onboardedAt: timestamp('onboarded_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const accounts = pgTable('accounts', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  accountId: text('account_id').notNull(),
  providerId: text('provider_id').notNull(),
  accessToken: text('access_token'),
  refreshToken: text('refresh_token'),
  accessTokenExpiresAt: timestamp('access_token_expires_at'),
  refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
  scope: text('scope'),
  idToken: text('id_token'),
  password: text('password'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

export const verifications = pgTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ─── Vaults (config table — no shared base columns, preserved as-is) ───

export const vaults = pgTable('vaults', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull(),
  icon: text('icon').notNull().default(''),
  description: text('description').notNull().default(''),
  profile: text('profile').notNull().default(''),
  color: text('color').notNull().default(''),
  type: text('type').notNull().default('user'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
})

// ─── Configs (normalized config store — single-user) ───

export const configs = pgTable(
  'configs',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    scope: text('scope').notNull(), // 'system' | 'user'
    kind: text('kind').notNull(), // 'llm_key' | 'model_preference' | 'wiki_type_prompt' | ...
    key: text('key').notNull(),
    value: jsonb('value').notNull().$type<unknown>(),
    encrypted: boolean('encrypted').notNull().default(false),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('configs_scope_kind_key_uidx').on(t.scope, t.kind, t.key),
    index('configs_kind_idx').on(t.kind),
  ]
)

// ─── State Enum ───

export const objectStateEnum = pgEnum('object_state', ['PENDING', 'LINKING', 'RESOLVED'])

// ─── Shared Base Columns ───

function baseColumns() {
  return {
    lookupKey: text('lookup_key').primaryKey(),
    slug: text('slug').notNull(),
    state: objectStateEnum('state').notNull().default('PENDING'),
    dedupHash: text('dedup_hash'),
    lockedBy: text('locked_by'),
    lockedAt: timestamp('locked_at'),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
}

// ─── Domain Tables ───

// `entries` TS export intentionally preserved; SQL table name is `raw_sources`.
// The API and all internal code continue to use "entry" terminology.
export const entries = pgTable(
  'raw_sources',
  {
    ...baseColumns(),
    title: text('title').notNull().default(''),
    content: text('content').notNull().default(''),
    type: text('type').notNull().default('thought'),
    source: text('source').notNull().default('api'),
    vaultId: text('vault_id').references(() => vaults.id, {
      onDelete: 'set null',
    }),
    ingestStatus: text('ingest_status').notNull().default('pending'),
    lastError: text('last_error'),
    lastAttemptAt: timestamp('last_attempt_at'),
    attemptCount: integer('attempt_count').notNull().default(0),
  },
  (t) => [
    uniqueIndex('raw_sources_slug_uidx').on(t.slug),
    index('raw_sources_ingest_status_idx').on(t.ingestStatus),
  ]
)

export const fragments = pgTable(
  'fragments',
  {
    ...baseColumns(),
    title: text('title').notNull(),
    type: text('type'),
    tags: jsonb('tags').notNull().default([]).$type<string[]>(),
    entryId: text('entry_id').references(() => entries.lookupKey, {
      onDelete: 'cascade',
    }),
    vaultId: text('vault_id').references(() => vaults.id, {
      onDelete: 'set null',
    }),
    embedding: vector('embedding', { dimensions: 1536 }),
    searchVector: tsvector('search_vector'),
  },
  (t) => [uniqueIndex('fragments_slug_uidx').on(t.slug)]
)

export const wikis = pgTable(
  'wikis',
  {
    ...baseColumns(),
    name: text('name').notNull(),
    type: text('type').notNull().default('log'),
    prompt: text('prompt').notNull().default(''),
    vaultId: text('vault_id').references(() => vaults.id, {
      onDelete: 'set null',
    }),
    lastRebuiltAt: timestamp('last_rebuilt_at'),
    embedding: vector('embedding', { dimensions: 1536 }),
    searchVector: tsvector('search_vector'),
  },
  (t) => [uniqueIndex('wikis_slug_uidx').on(t.slug)]
)

export const people = pgTable(
  'people',
  {
    ...baseColumns(),
    name: text('name').notNull(),
    relationship: text('relationship').notNull().default(''),
    canonicalName: text('canonical_name').notNull().default(''),
    aliases: text('aliases').array().notNull().default(sql`'{}'::text[]`),
    verified: boolean('verified').notNull().default(false),
    lastRebuiltAt: timestamp('last_rebuilt_at'),
    embedding: vector('embedding', { dimensions: 1536 }),
    searchVector: tsvector('search_vector'),
  },
  (t) => [
    uniqueIndex('people_slug_uidx').on(t.slug),
    index('people_aliases_gin_idx').using('gin', t.aliases),
  ]
)

// ─── Edits (generalized edit log across any object type) ───

export const edits = pgTable(
  'edits',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    objectType: text('object_type').notNull(), // 'wiki' | 'raw_source' | 'fragment' | 'person'
    objectId: text('object_id').notNull(), // lookup_key of target
    timestamp: timestamp('timestamp').defaultNow().notNull(),
    type: text('type').notNull().default('addition'),
    content: text('content').notNull(),
  },
  (t) => [index('edits_object_idx').on(t.objectType, t.objectId)]
)

// ─── Edges ───

export const edges = pgTable(
  'edges',
  {
    id: text('id').primaryKey(),
    srcType: text('src_type').notNull(),
    srcId: text('src_id').notNull(),
    dstType: text('dst_type').notNull(),
    dstId: text('dst_id').notNull(),
    edgeType: text('edge_type').notNull(),
    attrs: jsonb('attrs').$type<Record<string, unknown>>(),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex('edges_src_dst_type_uidx').on(t.srcType, t.srcId, t.dstType, t.dstId, t.edgeType),
    index('edges_src_idx').on(t.srcType, t.srcId, t.edgeType),
    index('edges_dst_idx').on(t.dstType, t.dstId, t.edgeType),
  ]
)

// ─── Processed Jobs (dedup) ───

export const processedJobs = pgTable(
  'processed_jobs',
  {
    jobId: text('job_id').primaryKey(),
    contentHash: text('content_hash'),
    processedAt: timestamp('processed_at').defaultNow().notNull(),
  },
  (t) => [
    index('processed_jobs_content_hash_idx').on(t.contentHash),
    index('processed_jobs_processed_at_idx').on(t.processedAt),
  ]
)

// ─── Pipeline Events (observability) ───

export const pipelineEvents = pgTable(
  'pipeline_events',
  {
    id: text('id').primaryKey(),
    entryKey: text('entry_key').notNull(),
    jobId: text('job_id').notNull(),
    stage: text('stage').notNull(),
    status: text('status').notNull(),
    fragmentKey: text('fragment_key'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (t) => [
    index('pipeline_events_entry_key_idx').on(t.entryKey),
    index('pipeline_events_status_stage_idx').on(t.status, t.stage),
    index('pipeline_events_created_at_idx').on(t.createdAt),
  ]
)

// ─── Operational Tables ───

export const auditLog = pgTable('audit_log', {
  id: text('id').primaryKey(),
  operation: text('operation').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  keyHash: text('key_hash').notNull().unique(),
  hint: text('hint').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
