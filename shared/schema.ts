// Database schema for UAE Family Tree application
// Referenced from blueprint:javascript_database

import { pgTable, text, integer, serial, timestamp, boolean } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

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
  deathDate: text('death_date'),
  isLiving: boolean('is_living').default(true),
  phone: text('phone'),
  email: text('email'),
  identificationNumber: text('identification_number'),
  birthOrder: integer('birth_order'),
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

// TypeScript types
export type Tree = typeof trees.$inferSelect;
export type InsertTree = typeof trees.$inferInsert;

export type Person = typeof people.$inferSelect;
export type InsertPerson = typeof people.$inferInsert;

export type Relationship = typeof relationships.$inferSelect;
export type InsertRelationship = typeof relationships.$inferInsert;
