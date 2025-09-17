import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  createUserInputSchema,
  loginInputSchema,
  updateUserInputSchema,
  createTeamInputSchema,
  updateTeamInputSchema,
  createCategoryInputSchema,
  updateCategoryInputSchema,
  createBudgetInputSchema,
  updateBudgetInputSchema,
  budgetAnalyticsSchema,
  createExpenseInputSchema,
  updateExpenseInputSchema,
  approveExpenseInputSchema,
  expenseFilterSchema,
  createNotificationInputSchema,
  reportGenerationSchema
} from './schema';

// Import handlers
import { registerUser, loginUser, verifyEmail, resetPassword } from './handlers/auth';
import { getUsers, getUserById, updateUser, deleteUser, getUserProfile } from './handlers/users';
import { createTeam, getTeams, getTeamById, updateTeam, deleteTeam, addTeamMember, removeTeamMember, getTeamMembers } from './handlers/teams';
import { createCategory, getCategories, getCategoryById, updateCategory, deleteCategory, getGlobalCategories } from './handlers/categories';
import { createBudget, getBudgets, getBudgetById, updateBudget, deleteBudget, getBudgetOverview, getBudgetAnalytics, checkBudgetAlerts } from './handlers/budgets';
import { createExpense, getExpenses, getExpenseById, updateExpense, deleteExpense, approveExpense, searchExpenses, getRecurringExpenses, processRecurringExpenses, uploadReceipt } from './handlers/expenses';
import { createNotification, getNotifications, markNotificationAsRead, markAllNotificationsAsRead, deleteNotification, getUnreadNotificationCount, sendBudgetAlert, sendExpenseApprovalNotification, sendExpenseReminderNotification } from './handlers/notifications';
import { getDashboardStats, getSpendingTrends, getCategoryAnalytics, getExpensePredictions, getTeamDashboardStats } from './handlers/dashboard';
import { generateExpenseReport, generateBudgetReport, generateTeamReport, exportExpenseData, importExpenseData, scheduledReportGeneration } from './handlers/reports';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  auth: router({
    register: publicProcedure
      .input(createUserInputSchema)
      .mutation(({ input }) => registerUser(input)),
    
    login: publicProcedure
      .input(loginInputSchema)
      .mutation(({ input }) => loginUser(input)),
    
    verifyEmail: publicProcedure
      .input(z.object({ token: z.string() }))
      .mutation(({ input }) => verifyEmail(input.token)),
    
    resetPassword: publicProcedure
      .input(z.object({ email: z.string().email() }))
      .mutation(({ input }) => resetPassword(input.email))
  }),

  // User management routes
  users: router({
    getAll: publicProcedure
      .query(() => getUsers()),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getUserById(input.id)),
    
    getProfile: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => getUserProfile(input.userId)),
    
    update: publicProcedure
      .input(updateUserInputSchema)
      .mutation(({ input }) => updateUser(input)),
    
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteUser(input.id))
  }),

  // Team management routes
  teams: router({
    create: publicProcedure
      .input(createTeamInputSchema)
      .mutation(({ input }) => createTeam(input)),
    
    getAll: publicProcedure
      .query(() => getTeams()),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getTeamById(input.id)),
    
    update: publicProcedure
      .input(updateTeamInputSchema)
      .mutation(({ input }) => updateTeam(input)),
    
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteTeam(input.id)),
    
    addMember: publicProcedure
      .input(z.object({ teamId: z.number(), userId: z.number() }))
      .mutation(({ input }) => addTeamMember(input.teamId, input.userId)),
    
    removeMember: publicProcedure
      .input(z.object({ teamId: z.number(), userId: z.number() }))
      .mutation(({ input }) => removeTeamMember(input.teamId, input.userId)),
    
    getMembers: publicProcedure
      .input(z.object({ teamId: z.number() }))
      .query(({ input }) => getTeamMembers(input.teamId))
  }),

  // Category management routes
  categories: router({
    create: publicProcedure
      .input(createCategoryInputSchema)
      .mutation(({ input }) => createCategory(input)),
    
    getAll: publicProcedure
      .input(z.object({ userId: z.number().optional() }))
      .query(({ input }) => getCategories(input.userId)),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getCategoryById(input.id)),
    
    update: publicProcedure
      .input(updateCategoryInputSchema)
      .mutation(({ input }) => updateCategory(input)),
    
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteCategory(input.id)),
    
    getGlobal: publicProcedure
      .query(() => getGlobalCategories())
  }),

  // Budget management routes
  budgets: router({
    create: publicProcedure
      .input(createBudgetInputSchema)
      .mutation(({ input }) => createBudget(input)),
    
    getByUser: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => getBudgets(input.userId)),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getBudgetById(input.id)),
    
    update: publicProcedure
      .input(updateBudgetInputSchema)
      .mutation(({ input }) => updateBudget(input)),
    
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteBudget(input.id)),
    
    getOverview: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => getBudgetOverview(input.userId)),
    
    getAnalytics: publicProcedure
      .input(budgetAnalyticsSchema)
      .query(({ input }) => getBudgetAnalytics(input)),
    
    checkAlerts: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => checkBudgetAlerts(input.userId))
  }),

  // Expense management routes
  expenses: router({
    create: publicProcedure
      .input(createExpenseInputSchema)
      .mutation(({ input }) => createExpense(input)),
    
    getAll: publicProcedure
      .input(expenseFilterSchema)
      .query(({ input }) => getExpenses(input)),
    
    getById: publicProcedure
      .input(z.object({ id: z.number() }))
      .query(({ input }) => getExpenseById(input.id)),
    
    update: publicProcedure
      .input(updateExpenseInputSchema)
      .mutation(({ input }) => updateExpense(input)),
    
    delete: publicProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ input }) => deleteExpense(input.id)),
    
    approve: publicProcedure
      .input(approveExpenseInputSchema)
      .mutation(({ input }) => approveExpense(input)),
    
    search: publicProcedure
      .input(z.object({ query: z.string(), userId: z.number() }))
      .query(({ input }) => searchExpenses(input.query, input.userId)),
    
    getRecurring: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => getRecurringExpenses(input.userId)),
    
    processRecurring: publicProcedure
      .mutation(() => processRecurringExpenses()),
    
    uploadReceipt: publicProcedure
      .input(z.object({ file: z.any(), filename: z.string() }))
      .mutation(({ input }) => uploadReceipt(input.file, input.filename))
  }),

  // Notification routes
  notifications: router({
    create: publicProcedure
      .input(createNotificationInputSchema)
      .mutation(({ input }) => createNotification(input)),
    
    getByUser: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => getNotifications(input.userId)),
    
    markAsRead: publicProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(({ input }) => markNotificationAsRead(input.notificationId)),
    
    markAllAsRead: publicProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(({ input }) => markAllNotificationsAsRead(input.userId)),
    
    delete: publicProcedure
      .input(z.object({ notificationId: z.number() }))
      .mutation(({ input }) => deleteNotification(input.notificationId)),
    
    getUnreadCount: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => getUnreadNotificationCount(input.userId)),
    
    sendBudgetAlert: publicProcedure
      .input(z.object({ userId: z.number(), budgetId: z.number(), percentage: z.number() }))
      .mutation(({ input }) => sendBudgetAlert(input.userId, input.budgetId, input.percentage)),
    
    sendExpenseApproval: publicProcedure
      .input(z.object({ expenseId: z.number(), managerId: z.number() }))
      .mutation(({ input }) => sendExpenseApprovalNotification(input.expenseId, input.managerId)),
    
    sendExpenseReminder: publicProcedure
      .input(z.object({ userId: z.number() }))
      .mutation(({ input }) => sendExpenseReminderNotification(input.userId))
  }),

  // Dashboard routes
  dashboard: router({
    getStats: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => getDashboardStats(input.userId)),
    
    getSpendingTrends: publicProcedure
      .input(z.object({ userId: z.number(), months: z.number().optional() }))
      .query(({ input }) => getSpendingTrends(input.userId, input.months)),
    
    getCategoryAnalytics: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => getCategoryAnalytics(input.userId)),
    
    getPredictions: publicProcedure
      .input(z.object({ userId: z.number() }))
      .query(({ input }) => getExpensePredictions(input.userId)),
    
    getTeamStats: publicProcedure
      .input(z.object({ teamId: z.number() }))
      .query(({ input }) => getTeamDashboardStats(input.teamId))
  }),

  // Reports routes
  reports: router({
    generateExpenseReport: publicProcedure
      .input(reportGenerationSchema)
      .mutation(({ input }) => generateExpenseReport(input)),
    
    generateBudgetReport: publicProcedure
      .input(z.object({ userId: z.number(), startDate: z.coerce.date(), endDate: z.coerce.date() }))
      .mutation(({ input }) => generateBudgetReport(input.userId, input.startDate, input.endDate)),
    
    generateTeamReport: publicProcedure
      .input(z.object({ teamId: z.number(), startDate: z.coerce.date(), endDate: z.coerce.date() }))
      .mutation(({ input }) => generateTeamReport(input.teamId, input.startDate, input.endDate)),
    
    exportData: publicProcedure
      .input(z.object({ 
        userId: z.number(), 
        format: z.enum(['CSV', 'JSON']), 
        filters: z.any().optional() 
      }))
      .mutation(({ input }) => exportExpenseData(input.userId, input.format, input.filters)),
    
    importData: publicProcedure
      .input(z.object({ 
        userId: z.number(), 
        fileBuffer: z.any(), 
        format: z.enum(['CSV', 'BANK_STATEMENT']) 
      }))
      .mutation(({ input }) => importExpenseData(input.userId, input.fileBuffer, input.format)),
    
    generateScheduledReports: publicProcedure
      .mutation(() => scheduledReportGeneration())
  })
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors({
        origin: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization']
      })(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  
  server.listen(port);
  console.log(`🚀 Advanced Monthly Expense Manager TRPC Server`);
  console.log(`🌟 Server listening at port: ${port}`);
  console.log(`💜 Purple-themed expense management with comprehensive features!`);
  console.log(`📊 Features: User Auth, Teams, Budgets, Expenses, Analytics, Reports`);
}

start().catch(console.error);