import { pgTable, text, varchar, timestamp, boolean, integer, real, jsonb, uuid, uniqueIndex, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ---- PROMPTWALL CORE TABLES ----

export const policies = pgTable('policies', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  description: text('description').default(''),
  content: text('content'), // Added content to store raw YAML
  action: varchar('action', { length: 32 }).default('block'), // Default action
  enabled: boolean('enabled').default(true),
  priority: integer('priority').default(0),
  match: text('match'),
  plane: varchar('plane', { length: 16 }).default('input'),
  severity: varchar('severity', { length: 16 }).default('medium'),
  agent: varchar('agent', { length: 255 }),
  environment: varchar('environment', { length: 32 }).default('production').notNull(),
  organizationId: text('organization_id'), // Optional for now, should link to organization.id
  userId: text('user_id'), // User ID for personal workspace policies
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const policyVersions = pgTable('policy_versions', {
  id: uuid('id').defaultRandom().primaryKey(),
  policyId: uuid('policy_id').references(() => policies.id).notNull(),
  content: text('content').notNull(),
  versionMessage: text('version_message'),
  createdAt: timestamp('created_at').defaultNow(),
  createdBy: text('created_by') // References user.id but loosely bound to avoid circular initially
});
export const policyDeletionRequests = pgTable('policy_deletion_requests', {
  id: uuid('id').defaultRandom().primaryKey(),
  policyId: uuid('policy_id').references(() => policies.id, { onDelete: 'cascade' }).notNull(),
  requestedBy: text('requested_by').references(() => user.id, { onDelete: 'cascade' }).notNull(),
  status: varchar('status', { length: 32 }).default('pending').notNull(), // pending, approved, denied
  createdAt: timestamp('created_at').defaultNow()
});
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  timestamp: timestamp('timestamp').defaultNow(),
  prompt: text('prompt').notNull(),
  sanitized: text('sanitized').notNull(),
  score: real('score').notNull(),
  threats: jsonb('threats').default('[]'),
  decision: varchar('decision', { length: 32 }).notNull(),
  matchedRule: varchar('matched_rule', { length: 255 }).notNull(),
  latency: integer('latency').notNull(),
  plane: varchar('plane', { length: 16 }).default('input'),
  severity: varchar('severity', { length: 16 }).default('low'),
  hash: varchar('hash', { length: 64 }).notNull(),
  parentHash: varchar('parent_hash', { length: 64 }),
  status: varchar('status', { length: 16 }).default('final'),
  environment: varchar('environment', { length: 32 }).default('production').notNull(),
  organizationId: text('organization_id'),
  userId: text('user_id'),
  cached: boolean('cached').default(false),
  tokensSaved: integer('tokens_saved').default(0)
});

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
  key: varchar('key', { length: 255 }).notNull().unique(),
  environment: varchar('environment', { length: 32 }).default('production').notNull(),
  budget: integer('budget'), // Monthly token budget limit
  spend: integer('spend').default(0), // Tokens used this month
  rateLimit: integer('rate_limit').default(60), // Requests per minute
  organizationId: text('organization_id'), // Will link to organization.id
  createdAt: timestamp('created_at').defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
  userId: text('user_id')
});

export const settings = pgTable('settings', {
  id: text('id').primaryKey(),
  webhookUrl: text('webhook_url'),
  retentionDays: integer('retention_days').default(30),
});

export const siemIntegrations = pgTable('siem_integrations', {
  id: text('id').primaryKey(),
  provider: varchar('provider', { length: 64 }).notNull(), // 'datadog' | 'splunk'
  endpoint: text('endpoint').notNull(),
  apiKey: text('api_key').notNull(),
  enabled: boolean('enabled').default(true),
  createdAt: timestamp('created_at').defaultNow(),
});

// ---- BETTER AUTH TABLES ----

export const user = pgTable("user", {
	id: text("id").primaryKey(),
	name: text("name").notNull(),
	email: text("email").notNull().unique(),
	emailVerified: boolean("emailVerified").notNull(),
	image: text("image"),
	twoFactorEnabled: boolean("twoFactorEnabled"),
	twoFactorSecret: text("twoFactorSecret"),
	twoFactorBackupCodes: text("twoFactorBackupCodes"),
	createdAt: timestamp("createdAt").notNull(),
	updatedAt: timestamp("updatedAt").notNull(),
    routingRules: jsonb("routing_rules")
});

export const session = pgTable("session", {
	id: text("id").primaryKey(),
	expiresAt: timestamp("expiresAt").notNull(),
	token: text("token").notNull().unique(),
	createdAt: timestamp("createdAt").notNull(),
	updatedAt: timestamp("updatedAt").notNull(),
	ipAddress: text("ipAddress"),
	userAgent: text("userAgent"),
	userId: text("userId").notNull().references(() => user.id),
    activeOrganizationId: text("activeOrganizationId") // Required by organization plugin
});

export const account = pgTable("account", {
	id: text("id").primaryKey(),
	accountId: text("accountId").notNull(),
	providerId: text("providerId").notNull(),
	userId: text("userId").notNull().references(() => user.id),
	accessToken: text("accessToken"),
	refreshToken: text("refreshToken"),
	idToken: text("idToken"),
	accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
	refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
	scope: text("scope"),
	password: text("password"),
	createdAt: timestamp("createdAt").notNull(),
	updatedAt: timestamp("updatedAt").notNull()
});

export const verification = pgTable("verification", {
	id: text("id").primaryKey(),
	identifier: text("identifier").notNull(),
	value: text("value").notNull(),
	expiresAt: timestamp("expiresAt").notNull(),
	createdAt: timestamp("createdAt"),
	updatedAt: timestamp("updatedAt")
});

export const organization = pgTable("organization", {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull().unique(),
    logo: text("logo"),
    createdAt: timestamp("createdAt").notNull(),
    metadata: text("metadata"),
    routingRules: jsonb("routing_rules"),
});

export const member = pgTable("member", {
    id: text("id").primaryKey(),
    organizationId: text("organizationId").notNull().references(() => organization.id, { onDelete: "cascade" }),
    userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
    role: text("role").default("member").notNull(),
    createdAt: timestamp("createdAt").notNull(),
});

export const invitation = pgTable("invitation", {
    id: text("id").primaryKey(),
    organizationId: text("organizationId").notNull().references(() => organization.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: text("role"),
    status: text("status").default("pending").notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
    createdAt: timestamp("createdAt").notNull(),
    inviterId: text("inviterId").notNull().references(() => user.id, { onDelete: "cascade" }),
});
