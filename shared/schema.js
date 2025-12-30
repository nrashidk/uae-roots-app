// Database schema for UAE Family Tree application
// Referenced from blueprint:javascript_database

import { pgTable, text, integer, serial, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Users table - stores authenticated users (canonical user record)
export const users = pgTable('users', {
  id: text('id').primaryKey(), // Firebase UID or phone number (primary identity)
  email: text('email'),
  displayName: text('display_name'),
  phoneNumber: text('phone_number'),
  provider: text('provider'), // 'google' | 'microsoft' | 'email' | 'phone'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at').defaultNow().notNull(),
});

// Auth identities table - stores linked login methods for account linking
export const authIdentities = pgTable('auth_identities', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  identityType: text('identity_type').notNull(), // 'phone' | 'email' | 'google' | 'microsoft'
  identityValue: text('identity_value').notNull(), // normalized phone or email
  providerUserId: text('provider_user_id'), // Firebase UID for Google/Microsoft, null for phone
  isVerified: boolean('is_verified').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Audit logs table - tracks sensitive operations
export const auditLogs = pgTable('audit_logs', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  action: text('action').notNull(), // 'login' | 'logout' | 'create' | 'update' | 'delete'
  resourceType: text('resource_type').notNull(), // 'user' | 'tree' | 'person' | 'relationship'
  resourceId: text('resource_id'),
  details: jsonb('details'), // Additional context
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Edit history for undo/redo functionality
export const editHistory = pgTable('edit_history', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  treeId: integer('tree_id').notNull().references(() => trees.id, { onDelete: 'cascade' }),
  action: text('action').notNull(), // 'create' | 'update' | 'delete'
  resourceType: text('resource_type').notNull(), // 'person' | 'relationship'
  resourceId: integer('resource_id').notNull(),
  previousData: jsonb('previous_data'), // State before change
  newData: jsonb('new_data'), // State after change
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Trees table - represents individual family trees
export const trees = pgTable('trees', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// People table - represents family members
export const people = pgTable('people', {
  id: serial('id').primaryKey(),
  treeId: integer('tree_id').notNull().references(() => trees.id, { onDelete: 'cascade' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name'),
  gender: text('gender').notNull(), // 'male' | 'female'
  birthDate: text('birth_date'),
  birthPlace: text('birth_place'),
  deathDate: text('death_date'),
  isLiving: boolean('is_living').default(true),
  isBreastfed: boolean('is_breastfed').default(false),
  phone: text('phone'),
  email: text('email'),
  identificationNumber: text('identification_number'),
  profession: text('profession'),
  birthOrder: integer('birth_order'),
  photoUrl: text('photo_url'), // URL to uploaded photo
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relationships table - represents connections between people
export const relationships = pgTable('relationships', {
  id: serial('id').primaryKey(),
  treeId: integer('tree_id').notNull().references(() => trees.id, { onDelete: 'cascade' }),
  type: text('type').notNull(), // 'partner' | 'parent-child' | 'sibling'
  person1Id: integer('person1_id').references(() => people.id, { onDelete: 'cascade' }),
  person2Id: integer('person2_id').references(() => people.id, { onDelete: 'cascade' }),
  childId: integer('child_id').references(() => people.id, { onDelete: 'cascade' }),
  parentId: integer('parent_id').references(() => people.id, { onDelete: 'cascade' }),
  isBreastfeeding: boolean('is_breastfeeding').default(false),
  isDotted: boolean('is_dotted').default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const treesRelations = relations(trees, ({ many }) => ({
  people: many(people),
  relationships: many(relationships),
}));

export const peopleRelations = relations(people, ({ one, many }) => ({
  tree: one(trees, {
    fields: [people.treeId],
    references: [trees.id],
  }),
  // Relationships where this person is person1
  relationshipsAsPerson1: many(relationships, {
    relationName: 'person1Relationships',
  }),
  // Relationships where this person is person2
  relationshipsAsPerson2: many(relationships, {
    relationName: 'person2Relationships',
  }),
  // Relationships where this person is a child
  relationshipsAsChild: many(relationships, {
    relationName: 'childRelationships',
  }),
  // Relationships where this person is a parent
  relationshipsAsParent: many(relationships, {
    relationName: 'parentRelationships',
  }),
}));

export const relationshipsRelations = relations(relationships, ({ one }) => ({
  tree: one(trees, {
    fields: [relationships.treeId],
    references: [trees.id],
  }),
  person1: one(people, {
    fields: [relationships.person1Id],
    references: [people.id],
    relationName: 'person1Relationships',
  }),
  person2: one(people, {
    fields: [relationships.person2Id],
    references: [people.id],
    relationName: 'person2Relationships',
  }),
  child: one(people, {
    fields: [relationships.childId],
    references: [people.id],
    relationName: 'childRelationships',
  }),
  parent: one(people, {
    fields: [relationships.parentId],
    references: [people.id],
    relationName: 'parentRelationships',
  }),
}));

// TypeScript types removed for JavaScript compatibility