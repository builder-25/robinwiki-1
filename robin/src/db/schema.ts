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
} from 'drizzle-orm/pg-core'
import { customAlphabet } from 'nanoid'

const nanoid = customAlphabet('0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 21)

// ─── Auth Tables (better-auth — preserved exactly) ───

export const users = pgTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('email_verified').notNull().default(false),
  name: text('name'),
  image: text('image'),
  publicKey: text('public_key').notNull().default(''),
  encryptedPrivateKey: text('encrypted_private_key').notNull().default(''),
  mcpTokenVersion: integer('mcp_token_version').notNull().default(1),
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

export const vaults = pgTable(
  'vaults',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    icon: text('icon').notNull().default(''),
    description: text('description').notNull().default(''),
    profile: text('profile').notNull().default(''),
    color: text('color').notNull().default(''),
    type: text('type').notNull().default('user'), // 'user' | 'system' | 'inbox' (no more 'uncategorized')
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [index('vaults_user_idx').on(t.userId)]
)

// ─── State Enum ───

export const objectStateEnum = pgEnum('object_state', ['PENDING', 'RESOLVED', 'LINKING', 'DIRTY'])

// ─── Shared Base Columns ───

function baseColumns() {
  return {
    lookupKey: text('lookup_key').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    slug: text('slug').notNull(),
    state: objectStateEnum('state').notNull().default('PENDING'),
    repoPath: text('repo_path').notNull().default(''),
    frontmatterHash: text('frontmatter_hash'),
    bodyHash: text('body_hash'),
    contentHash: text('content_hash'),
    dedupHash: text('dedup_hash'),
    lockedBy: text('locked_by'),
    lockedAt: timestamp('locked_at'),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  }
}

// ─── Domain Tables ───

export const entries = pgTable(
  'entries',
  {
    ...baseColumns(),
    title: text('title').notNull().default(''),
    content: text('content').notNull().default(''),
    type: text('type').notNull().default('thought'),
    source: text('source').notNull().default('api'),
    vaultId: text('vault_id').references(() => vaults.id, {
      onDelete: 'set null',
    }),
  },
  (t) => [
    index('entries_user_idx').on(t.userId),
    uniqueIndex('entries_user_slug_uidx').on(t.userId, t.slug),
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
  },
  (t) => [
    index('fragments_user_idx').on(t.userId),
    uniqueIndex('fragments_user_slug_uidx').on(t.userId, t.slug),
  ]
)

export const threads = pgTable(
  'threads',
  {
    ...baseColumns(),
    name: text('name').notNull(),
    type: text('type').notNull().default('log'),
    prompt: text('prompt').notNull().default(''),
    vaultId: text('vault_id').references(() => vaults.id, {
      onDelete: 'set null',
    }),
    lastRebuiltAt: timestamp('last_rebuilt_at'),
  },
  (t) => [
    index('threads_user_idx').on(t.userId),
    uniqueIndex('threads_user_slug_uidx').on(t.userId, t.slug),
  ]
)

export const people = pgTable(
  'people',
  {
    ...baseColumns(),
    name: text('name').notNull(),
    relationship: text('relationship').notNull().default(''),
    sections: jsonb('sections').notNull().default({}).$type<Record<string, unknown>>(),
    lastRebuiltAt: timestamp('last_rebuilt_at'),
  },
  (t) => [
    index('people_user_idx').on(t.userId),
    uniqueIndex('people_user_slug_uidx').on(t.userId, t.slug),
  ]
)

// ─── Thread Edits (user edit log for wiki regen) ───

export const threadEdits = pgTable(
  'thread_edits',
  {
    id: text('id')
      .primaryKey()
      .$defaultFn(() => nanoid()),
    threadId: text('thread_id')
      .notNull()
      .references(() => threads.lookupKey, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    timestamp: timestamp('timestamp').defaultNow().notNull(),
    type: text('type').notNull().default('addition'),
    content: text('content').notNull(),
  },
  (t) => [index('thread_edits_thread_idx').on(t.threadId)]
)

// ─── Edges ───

export const edges = pgTable(
  'edges',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
    index('edges_user_src_idx').on(t.userId, t.srcType, t.srcId, t.edgeType),
    index('edges_user_dst_idx').on(t.userId, t.dstType, t.dstId, t.edgeType),
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
    status: text('status').notNull(), // 'started' | 'completed' | 'failed'
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

// ─── Operational Tables (preserved) ───

export const configNotes = pgTable(
  'config_notes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    key: text('key').notNull(),
    title: text('title').notNull(),
    content: text('content').notNull().default(''),
    frontmatter: jsonb('frontmatter').notNull().default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (t) => [
    index('config_notes_user_idx').on(t.userId),
    uniqueIndex('config_notes_user_key_uidx').on(t.userId, t.key),
  ]
)

export const auditLog = pgTable('audit_log', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  operation: text('operation').notNull(),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const apiKeys = pgTable('api_keys', {
  id: text('id').primaryKey(),
  userId: text('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  keyHash: text('key_hash').notNull().unique(),
  hint: text('hint').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})
