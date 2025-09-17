import { z } from 'zod';

// Enum definitions
export const userRoleEnum = z.enum(['ADMIN', 'MANAGER', 'USER']);
export const expenseStatusEnum = z.enum(['PENDING', 'APPROVED', 'REJECTED']);
export const notificationTypeEnum = z.enum(['BUDGET_ALERT', 'EXPENSE_APPROVAL', 'EXPENSE_REMINDER', 'SYSTEM_UPDATE']);
export const budgetPeriodEnum = z.enum(['MONTHLY', 'YEARLY']);
export const recurringFrequencyEnum = z.enum(['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']);

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  password_hash: z.string(),
  first_name: z.string(),
  last_name: z.string(),
  role: userRoleEnum,
  profile_picture_url: z.string().nullable(),
  is_email_verified: z.boolean(),
  is_active: z.boolean(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Team schema
export const teamSchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  manager_id: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Team = z.infer<typeof teamSchema>;

// Team member schema
export const teamMemberSchema = z.object({
  id: z.number(),
  team_id: z.number(),
  user_id: z.number(),
  joined_at: z.coerce.date()
});

export type TeamMember = z.infer<typeof teamMemberSchema>;

// Category schema
export const categorySchema = z.object({
  id: z.number(),
  name: z.string(),
  description: z.string().nullable(),
  color: z.string(),
  icon: z.string().nullable(),
  user_id: z.number().nullable(), // null for global categories
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Category = z.infer<typeof categorySchema>;

// Budget schema
export const budgetSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  category_id: z.number().nullable(), // null for overall budget
  amount: z.number(),
  period: budgetPeriodEnum,
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  alert_threshold: z.number(), // percentage (e.g., 80 for 80%)
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Budget = z.infer<typeof budgetSchema>;

// Expense schema
export const expenseSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  team_id: z.number().nullable(),
  category_id: z.number(),
  title: z.string(),
  description: z.string().nullable(),
  amount: z.number(),
  receipt_url: z.string().nullable(),
  tags: z.array(z.string()),
  status: expenseStatusEnum,
  is_recurring: z.boolean(),
  recurring_frequency: recurringFrequencyEnum.nullable(),
  recurring_end_date: z.coerce.date().nullable(),
  expense_date: z.coerce.date(),
  approved_by: z.number().nullable(),
  approved_at: z.coerce.date().nullable(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Expense = z.infer<typeof expenseSchema>;

// Notification schema
export const notificationSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  type: notificationTypeEnum,
  title: z.string(),
  message: z.string(),
  is_read: z.boolean(),
  related_expense_id: z.number().nullable(),
  created_at: z.coerce.date()
});

export type Notification = z.infer<typeof notificationSchema>;

// Input schemas for creating/updating entities

// User input schemas
export const createUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  first_name: z.string(),
  last_name: z.string(),
  role: userRoleEnum.optional().default('USER')
});

export type CreateUserInput = z.infer<typeof createUserInputSchema>;

export const updateUserInputSchema = z.object({
  id: z.number(),
  email: z.string().email().optional(),
  first_name: z.string().optional(),
  last_name: z.string().optional(),
  role: userRoleEnum.optional(),
  profile_picture_url: z.string().nullable().optional(),
  is_active: z.boolean().optional()
});

export type UpdateUserInput = z.infer<typeof updateUserInputSchema>;

export const loginInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginInput = z.infer<typeof loginInputSchema>;

// Team input schemas
export const createTeamInputSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  manager_id: z.number()
});

export type CreateTeamInput = z.infer<typeof createTeamInputSchema>;

export const updateTeamInputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  manager_id: z.number().optional()
});

export type UpdateTeamInput = z.infer<typeof updateTeamInputSchema>;

// Category input schemas
export const createCategoryInputSchema = z.object({
  name: z.string(),
  description: z.string().nullable().optional(),
  color: z.string(),
  icon: z.string().nullable().optional(),
  user_id: z.number().nullable().optional()
});

export type CreateCategoryInput = z.infer<typeof createCategoryInputSchema>;

export const updateCategoryInputSchema = z.object({
  id: z.number(),
  name: z.string().optional(),
  description: z.string().nullable().optional(),
  color: z.string().optional(),
  icon: z.string().nullable().optional()
});

export type UpdateCategoryInput = z.infer<typeof updateCategoryInputSchema>;

// Budget input schemas
export const createBudgetInputSchema = z.object({
  user_id: z.number(),
  category_id: z.number().nullable().optional(),
  amount: z.number().positive(),
  period: budgetPeriodEnum,
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  alert_threshold: z.number().min(0).max(100).optional().default(80)
});

export type CreateBudgetInput = z.infer<typeof createBudgetInputSchema>;

export const updateBudgetInputSchema = z.object({
  id: z.number(),
  amount: z.number().positive().optional(),
  alert_threshold: z.number().min(0).max(100).optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional()
});

export type UpdateBudgetInput = z.infer<typeof updateBudgetInputSchema>;

// Expense input schemas
export const createExpenseInputSchema = z.object({
  user_id: z.number(),
  team_id: z.number().nullable().optional(),
  category_id: z.number(),
  title: z.string(),
  description: z.string().nullable().optional(),
  amount: z.number().positive(),
  receipt_url: z.string().nullable().optional(),
  tags: z.array(z.string()).optional().default([]),
  is_recurring: z.boolean().optional().default(false),
  recurring_frequency: recurringFrequencyEnum.nullable().optional(),
  recurring_end_date: z.coerce.date().nullable().optional(),
  expense_date: z.coerce.date()
});

export type CreateExpenseInput = z.infer<typeof createExpenseInputSchema>;

export const updateExpenseInputSchema = z.object({
  id: z.number(),
  category_id: z.number().optional(),
  title: z.string().optional(),
  description: z.string().nullable().optional(),
  amount: z.number().positive().optional(),
  receipt_url: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  expense_date: z.coerce.date().optional()
});

export type UpdateExpenseInput = z.infer<typeof updateExpenseInputSchema>;

export const approveExpenseInputSchema = z.object({
  expense_id: z.number(),
  status: z.enum(['APPROVED', 'REJECTED']),
  approved_by: z.number()
});

export type ApproveExpenseInput = z.infer<typeof approveExpenseInputSchema>;

// Notification input schemas
export const createNotificationInputSchema = z.object({
  user_id: z.number(),
  type: notificationTypeEnum,
  title: z.string(),
  message: z.string(),
  related_expense_id: z.number().nullable().optional()
});

export type CreateNotificationInput = z.infer<typeof createNotificationInputSchema>;

// Query schemas
export const expenseFilterSchema = z.object({
  user_id: z.number().optional(),
  team_id: z.number().optional(),
  category_id: z.number().optional(),
  status: expenseStatusEnum.optional(),
  start_date: z.coerce.date().optional(),
  end_date: z.coerce.date().optional(),
  min_amount: z.number().optional(),
  max_amount: z.number().optional(),
  tags: z.array(z.string()).optional(),
  search: z.string().optional(),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(100).optional().default(20)
});

export type ExpenseFilter = z.infer<typeof expenseFilterSchema>;

export const budgetAnalyticsSchema = z.object({
  user_id: z.number(),
  period: budgetPeriodEnum,
  start_date: z.coerce.date(),
  end_date: z.coerce.date()
});

export type BudgetAnalytics = z.infer<typeof budgetAnalyticsSchema>;

export const reportGenerationSchema = z.object({
  user_id: z.number(),
  team_id: z.number().optional(),
  start_date: z.coerce.date(),
  end_date: z.coerce.date(),
  format: z.enum(['PDF', 'EXCEL', 'CSV']),
  include_receipts: z.boolean().optional().default(false)
});

export type ReportGeneration = z.infer<typeof reportGenerationSchema>;

// Response schemas
export const expenseListResponseSchema = z.object({
  expenses: z.array(expenseSchema),
  total_count: z.number(),
  page: z.number(),
  limit: z.number(),
  total_pages: z.number()
});

export type ExpenseListResponse = z.infer<typeof expenseListResponseSchema>;

export const budgetOverviewResponseSchema = z.object({
  budgets: z.array(budgetSchema),
  total_budget: z.number(),
  total_spent: z.number(),
  remaining: z.number(),
  percentage_used: z.number()
});

export type BudgetOverviewResponse = z.infer<typeof budgetOverviewResponseSchema>;

export const dashboardStatsResponseSchema = z.object({
  total_expenses: z.number(),
  total_amount_spent: z.number(),
  budget_usage_percentage: z.number(),
  category_breakdown: z.array(z.object({
    category_name: z.string(),
    amount_spent: z.number(),
    percentage: z.number()
  })),
  monthly_trend: z.array(z.object({
    month: z.string(),
    amount: z.number()
  })),
  recent_expenses: z.array(expenseSchema)
});

export type DashboardStatsResponse = z.infer<typeof dashboardStatsResponseSchema>;