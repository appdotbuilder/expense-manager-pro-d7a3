import { 
  serial, 
  text, 
  pgTable, 
  timestamp, 
  numeric, 
  integer, 
  boolean, 
  pgEnum,
  jsonb,
  date
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enum definitions
export const userRoleEnum = pgEnum('user_role', ['ADMIN', 'MANAGER', 'USER']);
export const expenseStatusEnum = pgEnum('expense_status', ['PENDING', 'APPROVED', 'REJECTED']);
export const notificationTypeEnum = pgEnum('notification_type', ['BUDGET_ALERT', 'EXPENSE_APPROVAL', 'EXPENSE_REMINDER', 'SYSTEM_UPDATE']);
export const budgetPeriodEnum = pgEnum('budget_period', ['MONTHLY', 'YEARLY']);
export const recurringFrequencyEnum = pgEnum('recurring_frequency', ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: text('email').notNull().unique(),
  password_hash: text('password_hash').notNull(),
  first_name: text('first_name').notNull(),
  last_name: text('last_name').notNull(),
  role: userRoleEnum('role').notNull().default('USER'),
  profile_picture_url: text('profile_picture_url'),
  is_email_verified: boolean('is_email_verified').notNull().default(false),
  is_active: boolean('is_active').notNull().default(true),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Teams table
export const teamsTable = pgTable('teams', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  manager_id: integer('manager_id').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Team members junction table
export const teamMembersTable = pgTable('team_members', {
  id: serial('id').primaryKey(),
  team_id: integer('team_id').notNull().references(() => teamsTable.id, { onDelete: 'cascade' }),
  user_id: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  joined_at: timestamp('joined_at').defaultNow().notNull(),
});

// Categories table
export const categoriesTable = pgTable('categories', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  description: text('description'),
  color: text('color').notNull(),
  icon: text('icon'),
  user_id: integer('user_id').references(() => usersTable.id), // null for global categories
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Budgets table
export const budgetsTable = pgTable('budgets', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  category_id: integer('category_id').references(() => categoriesTable.id), // null for overall budget
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  period: budgetPeriodEnum('period').notNull(),
  start_date: date('start_date').notNull(),
  end_date: date('end_date').notNull(),
  alert_threshold: numeric('alert_threshold', { precision: 5, scale: 2 }).notNull().default('80.00'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Expenses table
export const expensesTable = pgTable('expenses', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  team_id: integer('team_id').references(() => teamsTable.id),
  category_id: integer('category_id').notNull().references(() => categoriesTable.id),
  title: text('title').notNull(),
  description: text('description'),
  amount: numeric('amount', { precision: 12, scale: 2 }).notNull(),
  receipt_url: text('receipt_url'),
  tags: jsonb('tags').notNull().default('[]'),
  status: expenseStatusEnum('status').notNull().default('PENDING'),
  is_recurring: boolean('is_recurring').notNull().default(false),
  recurring_frequency: recurringFrequencyEnum('recurring_frequency'),
  recurring_end_date: date('recurring_end_date'),
  expense_date: date('expense_date').notNull(),
  approved_by: integer('approved_by').references(() => usersTable.id),
  approved_at: timestamp('approved_at'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Notifications table
export const notificationsTable = pgTable('notifications', {
  id: serial('id').primaryKey(),
  user_id: integer('user_id').notNull().references(() => usersTable.id, { onDelete: 'cascade' }),
  type: notificationTypeEnum('type').notNull(),
  title: text('title').notNull(),
  message: text('message').notNull(),
  is_read: boolean('is_read').notNull().default(false),
  related_expense_id: integer('related_expense_id').references(() => expensesTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Define relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  managedTeams: many(teamsTable),
  teamMemberships: many(teamMembersTable),
  categories: many(categoriesTable),
  budgets: many(budgetsTable),
  expenses: many(expensesTable),
  approvedExpenses: many(expensesTable),
  notifications: many(notificationsTable),
}));

export const teamsRelations = relations(teamsTable, ({ one, many }) => ({
  manager: one(usersTable, {
    fields: [teamsTable.manager_id],
    references: [usersTable.id],
  }),
  members: many(teamMembersTable),
  expenses: many(expensesTable),
}));

export const teamMembersRelations = relations(teamMembersTable, ({ one }) => ({
  team: one(teamsTable, {
    fields: [teamMembersTable.team_id],
    references: [teamsTable.id],
  }),
  user: one(usersTable, {
    fields: [teamMembersTable.user_id],
    references: [usersTable.id],
  }),
}));

export const categoriesRelations = relations(categoriesTable, ({ one, many }) => ({
  user: one(usersTable, {
    fields: [categoriesTable.user_id],
    references: [usersTable.id],
  }),
  budgets: many(budgetsTable),
  expenses: many(expensesTable),
}));

export const budgetsRelations = relations(budgetsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [budgetsTable.user_id],
    references: [usersTable.id],
  }),
  category: one(categoriesTable, {
    fields: [budgetsTable.category_id],
    references: [categoriesTable.id],
  }),
}));

export const expensesRelations = relations(expensesTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [expensesTable.user_id],
    references: [usersTable.id],
  }),
  team: one(teamsTable, {
    fields: [expensesTable.team_id],
    references: [teamsTable.id],
  }),
  category: one(categoriesTable, {
    fields: [expensesTable.category_id],
    references: [categoriesTable.id],
  }),
  approver: one(usersTable, {
    fields: [expensesTable.approved_by],
    references: [usersTable.id],
  }),
}));

export const notificationsRelations = relations(notificationsTable, ({ one }) => ({
  user: one(usersTable, {
    fields: [notificationsTable.user_id],
    references: [usersTable.id],
  }),
  relatedExpense: one(expensesTable, {
    fields: [notificationsTable.related_expense_id],
    references: [expensesTable.id],
  }),
}));

// TypeScript types for the table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Team = typeof teamsTable.$inferSelect;
export type NewTeam = typeof teamsTable.$inferInsert;

export type TeamMember = typeof teamMembersTable.$inferSelect;
export type NewTeamMember = typeof teamMembersTable.$inferInsert;

export type Category = typeof categoriesTable.$inferSelect;
export type NewCategory = typeof categoriesTable.$inferInsert;

export type Budget = typeof budgetsTable.$inferSelect;
export type NewBudget = typeof budgetsTable.$inferInsert;

export type Expense = typeof expensesTable.$inferSelect;
export type NewExpense = typeof expensesTable.$inferInsert;

export type Notification = typeof notificationsTable.$inferSelect;
export type NewNotification = typeof notificationsTable.$inferInsert;

// Export all tables for proper query building
export const tables = {
  users: usersTable,
  teams: teamsTable,
  teamMembers: teamMembersTable,
  categories: categoriesTable,
  budgets: budgetsTable,
  expenses: expensesTable,
  notifications: notificationsTable,
};