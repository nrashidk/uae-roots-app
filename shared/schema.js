// Database schema for UAE Family Tree application
// Referenced from blueprint:javascript_database

import {
  pgTable,
  text,
  integer,
  serial,
  timestamp,
  boolean,
  jsonb,
  index,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Users table - stores authenticated users (canonical user record)
export const users = pgTable("users", {
  id: text("id").primaryKey(), // Firebase UID or phone number (primary identity)
  email: text("email"),
  displayName: text("display_name"),
  phoneNumber: text("phone_number"),
  provider: text("provider"), // 'google' | 'microsoft' | 'email' | 'phone'
  // When this person accepted the terms and privacy policy. NULL for accounts
  // created before the sign-up gate existed — they were never asked. Recorded
  // because a screen saying someone agreed is not evidence that they did.
  termsAcceptedAt: timestamp("terms_accepted_at"),
  // Bumped to invalidate every existing session for this user. The JWT carries
  // the version it was signed with; authenticateUser rejects any token whose
  // version is behind. Without it a stolen token stayed valid for its full
  // lifetime and nothing — not logging out elsewhere, not unlinking the method it
  // was created through — could stop it.
  tokenVersion: integer("token_version").notNull().default(0),
  // The session id of the browser that currently holds this account, paired with
  // a `session_id` cookie that OUTLIVES the JWT.
  //
  // tokenVersion alone cannot tell a silent restore from a fresh login, because
  // both arrive at /auth/token looking identical. The obvious fix — read the old
  // auth_token cookie — is impossible: COOKIE_OPTIONS.maxAge equals the JWT's
  // expiresIn, so the browser deletes that cookie at the exact moment the token
  // expires. There is nothing left to inspect.
  //
  // A separate long-lived cookie survives that. Matching it against this column
  // answers the one question that matters: was this browser the last to log in?
  // If so its cookie merely expired, and re-issuing must NOT evict anybody.
  //
  // It carries no authority. Firebase or the SMS code remains the only way in;
  // this is evidence of prior holdership, not a credential.
  currentSessionId: text("current_session_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  lastLoginAt: timestamp("last_login_at").defaultNow().notNull(),
});

// Auth identities table - stores linked login methods for account linking
export const authIdentities = pgTable("auth_identities", {
  id: serial("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  identityType: text("identity_type").notNull(), // 'phone' | 'email' | 'google' | 'microsoft'
  identityValue: text("identity_value").notNull(), // normalized phone or email
  providerUserId: text("provider_user_id"), // Firebase UID for Google/Microsoft, null for phone
  isVerified: boolean("is_verified").default(false).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("auth_identities_identity_value_idx").on(table.identityValue),
  index("auth_identities_user_id_idx").on(table.userId),
]);

// Audit logs table - tracks sensitive operations
export const auditLogs = pgTable("audit_logs", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  action: text("action").notNull(), // 'login' | 'logout' | 'create' | 'update' | 'delete'
  resourceType: text("resource_type").notNull(), // 'user' | 'tree' | 'person' | 'relationship'
  resourceId: text("resource_id"),
  details: jsonb("details"), // Additional context
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("audit_logs_created_at_idx").on(table.createdAt),
]);

// Edit history for undo/redo functionality
export const editHistory = pgTable("edit_history", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  treeId: integer("tree_id")
    .notNull()
    .references(() => trees.id, { onDelete: "cascade" }),
  action: text("action").notNull(), // 'create' | 'update' | 'delete'
  resourceType: text("resource_type").notNull(), // 'person' | 'relationship'
  resourceId: integer("resource_id").notNull(),
  previousData: jsonb("previous_data"), // State before change
  newData: jsonb("new_data"), // State after change
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Deletions log - a snapshot of every person (and every relationship touching
// them) removed by a single delete action, so the whole action can be undone.
// Kept as a separate log rather than `deleted_at` columns on people, so no read
// path anywhere has to filter deleted rows — a missed filter would resurrect
// people as ghosts in the tree.
export const deletions = pgTable("deletions", {
  id: serial("id").primaryKey(),
  treeId: integer("tree_id").notNull(),
  deletedBy: text("deleted_by"),
  deletedAt: timestamp("deleted_at").defaultNow().notNull(),
  label: text("label"), // e.g. "هنادي +6"
  // BEFORE state — the rows to put back. For a delete this is what was removed;
  // for an update the old values; for a create it is empty.
  people: jsonb("people").notNull(),
  relationships: jsonb("relationships").notNull(),
  // AFTER state — the rows the action produced. For a create this is what was
  // added; for an update the new values; for a delete it is empty.
  // Undo is then ONE rule for all three kinds: remove anything in *_after whose
  // id is absent from *_before, then write every *_before row back at its own id.
  kind: text("kind").notNull().default("delete"), // 'delete' | 'create' | 'update'
  // One USER action can span several HTTP calls — adding a person with two
  // parents writes three rows. They share a groupId so undo reverses the whole
  // action in one press. Generated in the browser; the server only records it.
  // NULL on rows written before this existed: those undo individually, exactly
  // as they did before.
  groupId: text("group_id"),
  peopleAfter: jsonb("people_after").notNull().default([]),
  relationshipsAfter: jsonb("relationships_after").notNull().default([]),
  restoredAt: timestamp("restored_at"),
}, (table) => [
  index("deletions_tree_idx").on(table.treeId),
]);

// Trees table - represents individual family trees
export const trees = pgTable("trees", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  createdBy: text("created_by").notNull(),
  // Emirate of REGISTRATION — the emirate that issued the family's
  // خلاصة القيد, not where they live. Stored as a fixed CODE
  // (AZ DU SH AJ UQ RK FU), never Arabic text, so display wording can change
  // without touching data and an English directory stays possible.
  emirate: text("emirate"),
  // Publication is opt-in and explicit. NOT NULL so every existing tree is
  // definitively private rather than NULL-as-unknown, which is the wrong state
  // for a privacy flag.
  isPublished: boolean("is_published").notNull().default(false),
  // NULL means DERIVE from getGenealogicalName on the root person. A value here
  // is the owner's override, and clearing it is the revert path — without that,
  // an override freezes and a corrected ancestor name leaves a stale family
  // name with no way back.
  familyName: text("family_name"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// People table - represents family members
export const people = pgTable("people", {
  id: serial("id").primaryKey(),
  treeId: integer("tree_id")
    .notNull()
    .references(() => trees.id, { onDelete: "cascade" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  gender: text("gender").notNull(), // 'male' | 'female'
  birthDate: text("birth_date"),
  birthPlace: text("birth_place"),
  deathDate: text("death_date"),
  isLiving: boolean("is_living").default(true),
  isBreastfed: boolean("is_breastfed").default(false),
  milkFatherName: text("milk_father_name"),
  milkMotherName: text("milk_mother_name"),
  phone: text("phone"),
  email: text("email"),
  identificationNumber: text("identification_number"),
  profession: text("profession"),
  // Free prose about the person, shown in the record card on الأفراد and in the
  // public view. Replaces profession in the form; profession itself is LEFT IN
  // PLACE — one production row still holds a value and dropping the column
  // would destroy it for no gain.
  summary: text("summary"),
  birthOrder: integer("birth_order"),
  photoUrl: text("photo_url"), // URL to uploaded photo
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("people_tree_id_idx").on(table.treeId),
]);

// Relationships table - represents connections between people
export const relationships = pgTable("relationships", {
  id: serial("id").primaryKey(),
  treeId: integer("tree_id")
    .notNull()
    .references(() => trees.id, { onDelete: "cascade" }),
  type: text("type").notNull(), // 'partner' | 'parent-child' | 'sibling'
  person1Id: integer("person1_id").references(() => people.id, {
    onDelete: "cascade",
  }),
  person2Id: integer("person2_id").references(() => people.id, {
    onDelete: "cascade",
  }),
  childId: integer("child_id").references(() => people.id, {
    onDelete: "cascade",
  }),
  parentId: integer("parent_id").references(() => people.id, {
    onDelete: "cascade",
  }),
  // Marital status for a 'partner' row. NULL means married, so every existing
  // row keeps its meaning without a backfill. Until this existed the app had to
  // infer "still married" from isLiving, which is why marking a dead husband
  // alive again silently revived the marriage.
  status: text("status"), // 'married' | 'divorced'  (NULL = married)
  isBreastfeeding: boolean("is_breastfeeding").default(false),
  isDotted: boolean("is_dotted").default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("relationships_tree_id_idx").on(table.treeId),
]);

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
    relationName: "person1Relationships",
  }),
  // Relationships where this person is person2
  relationshipsAsPerson2: many(relationships, {
    relationName: "person2Relationships",
  }),
  // Relationships where this person is a child
  relationshipsAsChild: many(relationships, {
    relationName: "childRelationships",
  }),
  // Relationships where this person is a parent
  relationshipsAsParent: many(relationships, {
    relationName: "parentRelationships",
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
    relationName: "person1Relationships",
  }),
  person2: one(people, {
    fields: [relationships.person2Id],
    references: [people.id],
    relationName: "person2Relationships",
  }),
  child: one(people, {
    fields: [relationships.childId],
    references: [people.id],
    relationName: "childRelationships",
  }),
  parent: one(people, {
    fields: [relationships.parentId],
    references: [people.id],
    relationName: "parentRelationships",
  }),
}));

// TypeScript types removed for JavaScript compatibility
