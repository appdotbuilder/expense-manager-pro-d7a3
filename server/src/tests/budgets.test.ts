import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, budgetsTable, expensesTable } from '../db/schema';
import { type CreateBudgetInput, type UpdateBudgetInput, type BudgetAnalytics } from '../schema';
import { 
  createBudget, 
  getBudgets, 
  getBudgetById, 
  updateBudget, 
  deleteBudget,
  getBudgetOverview,
  getBudgetAnalytics,
  checkBudgetAlerts 
} from '../handlers/budgets';
import { eq } from 'drizzle-orm';

// Test data
const testUser = {
  email: 'testuser@example.com',
  password_hash: 'hashed_password',
  first_name: 'Test',
  last_name: 'User',
  role: 'USER' as const
};

const testCategory = {
  name: 'Test Category',
  description: 'A test category',
  color: '#FF0000',
  icon: 'test-icon',
  user_id: null
};

const testBudgetInput: CreateBudgetInput = {
  user_id: 1,
  category_id: 1,
  amount: 1000.50,
  period: 'MONTHLY',
  start_date: new Date('2024-01-01'),
  end_date: new Date('2024-01-31'),
  alert_threshold: 80
};

describe('Budget Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createBudget', () => {
    it('should create a budget successfully', async () => {
      // Create prerequisite data
      const user = await db.insert(usersTable).values(testUser).returning().execute();
      const category = await db.insert(categoriesTable).values(testCategory).returning().execute();

      const budgetInput: CreateBudgetInput = {
        ...testBudgetInput,
        user_id: user[0].id,
        category_id: category[0].id
      };

      const result = await createBudget(budgetInput);

      expect(result.user_id).toBe(user[0].id);
      expect(result.category_id).toBe(category[0].id);
      expect(result.amount).toBe(1000.50);
      expect(typeof result.amount).toBe('number');
      expect(result.period).toBe('MONTHLY');
      expect(result.alert_threshold).toBe(80);
      expect(typeof result.alert_threshold).toBe('number');
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create budget without category (overall budget)', async () => {
      const user = await db.insert(usersTable).values(testUser).returning().execute();

      const budgetInput: CreateBudgetInput = {
        ...testBudgetInput,
        user_id: user[0].id,
        category_id: null
      };

      const result = await createBudget(budgetInput);

      expect(result.category_id).toBe(null);
      expect(result.user_id).toBe(user[0].id);
      expect(result.amount).toBe(1000.50);
    });

    it('should apply default alert threshold when not provided', async () => {
      const user = await db.insert(usersTable).values(testUser).returning().execute();

      const budgetInput: CreateBudgetInput = {
        user_id: user[0].id,
        amount: 500,
        period: 'YEARLY',
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31'),
        alert_threshold: 80
      };

      const result = await createBudget(budgetInput);

      expect(result.alert_threshold).toBe(80);
    });

    it('should throw error for non-existent user', async () => {
      const budgetInput: CreateBudgetInput = {
        ...testBudgetInput,
        user_id: 999999
      };

      await expect(createBudget(budgetInput)).rejects.toThrow(/user not found/i);
    });

    it('should throw error for non-existent category', async () => {
      const user = await db.insert(usersTable).values(testUser).returning().execute();

      const budgetInput: CreateBudgetInput = {
        ...testBudgetInput,
        user_id: user[0].id,
        category_id: 999999
      };

      await expect(createBudget(budgetInput)).rejects.toThrow(/category not found/i);
    });
  });

  describe('getBudgets', () => {
    it('should return all budgets for a user', async () => {
      const user = await db.insert(usersTable).values(testUser).returning().execute();
      const category = await db.insert(categoriesTable).values(testCategory).returning().execute();

      // Create multiple budgets
      const budget1Input: CreateBudgetInput = {
        user_id: user[0].id,
        category_id: category[0].id,
        amount: 1000,
        period: 'MONTHLY',
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31'),
        alert_threshold: 80
      };

      const budget2Input: CreateBudgetInput = {
        user_id: user[0].id,
        category_id: null,
        amount: 500,
        period: 'YEARLY',
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-12-31'),
        alert_threshold: 80
      };

      await createBudget(budget1Input);
      await createBudget(budget2Input);

      const results = await getBudgets(user[0].id);

      expect(results).toHaveLength(2);
      expect(results[0].amount).toBeTypeOf('number');
      expect(results[1].amount).toBeTypeOf('number');
      expect(results.some(b => b.period === 'MONTHLY')).toBe(true);
      expect(results.some(b => b.period === 'YEARLY')).toBe(true);
    });

    it('should return empty array for user with no budgets', async () => {
      const user = await db.insert(usersTable).values(testUser).returning().execute();

      const results = await getBudgets(user[0].id);

      expect(results).toHaveLength(0);
    });
  });

  describe('getBudgetById', () => {
    it('should return budget by ID', async () => {
      const user = await db.insert(usersTable).values(testUser).returning().execute();
      const category = await db.insert(categoriesTable).values(testCategory).returning().execute();

      const budgetInput: CreateBudgetInput = {
        ...testBudgetInput,
        user_id: user[0].id,
        category_id: category[0].id
      };

      const created = await createBudget(budgetInput);
      const result = await getBudgetById(created.id);

      expect(result).not.toBe(null);
      expect(result!.id).toBe(created.id);
      expect(result!.amount).toBe(1000.50);
      expect(typeof result!.amount).toBe('number');
      expect(result!.user_id).toBe(user[0].id);
    });

    it('should return null for non-existent budget', async () => {
      const result = await getBudgetById(999999);

      expect(result).toBe(null);
    });
  });

  describe('updateBudget', () => {
    it('should update budget fields', async () => {
      const user = await db.insert(usersTable).values(testUser).returning().execute();
      const category = await db.insert(categoriesTable).values(testCategory).returning().execute();

      const budgetInput: CreateBudgetInput = {
        ...testBudgetInput,
        user_id: user[0].id,
        category_id: category[0].id
      };

      const created = await createBudget(budgetInput);

      const updateInput: UpdateBudgetInput = {
        id: created.id,
        amount: 2000.75,
        alert_threshold: 90,
        start_date: new Date('2024-02-01'),
        end_date: new Date('2024-02-29')
      };

      const result = await updateBudget(updateInput);

      expect(result.id).toBe(created.id);
      expect(result.amount).toBe(2000.75);
      expect(typeof result.amount).toBe('number');
      expect(result.alert_threshold).toBe(90);
      expect(typeof result.alert_threshold).toBe('number');
      expect(result.start_date).toEqual(new Date('2024-02-01'));
      expect(result.end_date).toEqual(new Date('2024-02-29'));
      expect(result.updated_at.getTime()).toBeGreaterThan(created.updated_at.getTime());
    });

    it('should throw error for non-existent budget', async () => {
      const updateInput: UpdateBudgetInput = {
        id: 999999,
        amount: 1000
      };

      await expect(updateBudget(updateInput)).rejects.toThrow(/budget not found/i);
    });
  });

  describe('deleteBudget', () => {
    it('should delete budget successfully', async () => {
      const user = await db.insert(usersTable).values(testUser).returning().execute();

      const budgetInput: CreateBudgetInput = {
        ...testBudgetInput,
        user_id: user[0].id,
        category_id: null
      };

      const created = await createBudget(budgetInput);
      const result = await deleteBudget(created.id);

      expect(result.success).toBe(true);

      // Verify budget is deleted
      const found = await getBudgetById(created.id);
      expect(found).toBe(null);
    });

    it('should throw error for non-existent budget', async () => {
      await expect(deleteBudget(999999)).rejects.toThrow(/budget not found/i);
    });
  });

  describe('getBudgetOverview', () => {
    it('should return budget overview with spending analysis', async () => {
      const user = await db.insert(usersTable).values(testUser).returning().execute();
      const category = await db.insert(categoriesTable).values(testCategory).returning().execute();

      // Create budgets
      const budget1Input: CreateBudgetInput = {
        user_id: user[0].id,
        category_id: category[0].id,
        amount: 1000,
        period: 'MONTHLY',
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31'),
        alert_threshold: 80
      };

      const budget2Input: CreateBudgetInput = {
        user_id: user[0].id,
        category_id: null,
        amount: 500,
        period: 'MONTHLY',
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31'),
        alert_threshold: 80
      };

      await createBudget(budget1Input);
      await createBudget(budget2Input);

      // Create approved expense
      await db.insert(expensesTable).values({
        user_id: user[0].id,
        category_id: category[0].id,
        title: 'Test Expense',
        amount: '300.00',
        status: 'APPROVED',
        expense_date: '2024-01-15',
        tags: []
      }).execute();

      const result = await getBudgetOverview(user[0].id);

      expect(result.budgets).toHaveLength(2);
      expect(result.total_budget).toBe(1500);
      expect(result.total_spent).toBe(300);
      expect(result.remaining).toBe(1200);
      expect(result.percentage_used).toBeCloseTo(20, 1);
    });

    it('should handle user with no budgets', async () => {
      const user = await db.insert(usersTable).values(testUser).returning().execute();

      const result = await getBudgetOverview(user[0].id);

      expect(result.budgets).toHaveLength(0);
      expect(result.total_budget).toBe(0);
      expect(result.total_spent).toBe(0);
      expect(result.remaining).toBe(0);
      expect(result.percentage_used).toBe(0);
    });
  });

  describe('getBudgetAnalytics', () => {
    it('should return budget analytics for specified period', async () => {
      const user = await db.insert(usersTable).values(testUser).returning().execute();
      const category = await db.insert(categoriesTable).values(testCategory).returning().execute();

      // Create budget
      const budgetInput: CreateBudgetInput = {
        user_id: user[0].id,
        category_id: category[0].id,
        amount: 1000,
        period: 'MONTHLY',
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31'),
        alert_threshold: 80
      };

      await createBudget(budgetInput);

      // Create expenses
      await db.insert(expensesTable).values({
        user_id: user[0].id,
        category_id: category[0].id,
        title: 'Test Expense 1',
        amount: '400.00',
        status: 'APPROVED',
        expense_date: '2024-01-10',
        tags: []
      }).execute();

      await db.insert(expensesTable).values({
        user_id: user[0].id,
        category_id: category[0].id,
        title: 'Test Expense 2',
        amount: '200.00',
        status: 'APPROVED',
        expense_date: '2024-01-20',
        tags: []
      }).execute();

      const analyticsInput: BudgetAnalytics = {
        user_id: user[0].id,
        period: 'MONTHLY',
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31')
      };

      const result = await getBudgetAnalytics(analyticsInput);

      expect(result.budget_utilization).toBeCloseTo(60, 1);
      expect(result.category_breakdown).toHaveLength(1);
      expect(result.category_breakdown[0].amount_spent).toBe(600);
      expect(result.spending_trend).toHaveLength(1);
      expect(result.recommendations).toBeInstanceOf(Array);
    });
  });

  describe('checkBudgetAlerts', () => {
    it('should return alerts for budgets exceeding threshold', async () => {
      const user = await db.insert(usersTable).values(testUser).returning().execute();
      const category = await db.insert(categoriesTable).values(testCategory).returning().execute();

      // Create budget with 80% threshold
      const budgetInput: CreateBudgetInput = {
        user_id: user[0].id,
        category_id: category[0].id,
        amount: 1000,
        period: 'MONTHLY',
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31'),
        alert_threshold: 80
      };

      const created = await createBudget(budgetInput);

      // Create expense that puts spending at 85% (above threshold)
      await db.insert(expensesTable).values({
        user_id: user[0].id,
        category_id: category[0].id,
        title: 'High Expense',
        amount: '850.00',
        status: 'APPROVED',
        expense_date: '2024-01-15',
        tags: []
      }).execute();

      const alerts = await checkBudgetAlerts(user[0].id);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].budget_id).toBe(created.id);
      expect(alerts[0].usage_percentage).toBeCloseTo(85, 1);
      expect(alerts[0].amount_spent).toBe(850);
      expect(alerts[0].alert_threshold).toBe(80);
    });

    it('should return empty array when no budgets exceed threshold', async () => {
      const user = await db.insert(usersTable).values(testUser).returning().execute();
      const category = await db.insert(categoriesTable).values(testCategory).returning().execute();

      // Create budget
      const budgetInput: CreateBudgetInput = {
        user_id: user[0].id,
        category_id: category[0].id,
        amount: 1000,
        period: 'MONTHLY',
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31'),
        alert_threshold: 80
      };

      await createBudget(budgetInput);

      // Create expense below threshold (50%)
      await db.insert(expensesTable).values({
        user_id: user[0].id,
        category_id: category[0].id,
        title: 'Low Expense',
        amount: '500.00',
        status: 'APPROVED',
        expense_date: '2024-01-15',
        tags: []
      }).execute();

      const alerts = await checkBudgetAlerts(user[0].id);

      expect(alerts).toHaveLength(0);
    });

    it('should handle overall budgets (no category)', async () => {
      const user = await db.insert(usersTable).values(testUser).returning().execute();
      const category = await db.insert(categoriesTable).values(testCategory).returning().execute();

      // Create overall budget
      const budgetInput: CreateBudgetInput = {
        user_id: user[0].id,
        category_id: null,
        amount: 1000,
        period: 'MONTHLY',
        start_date: new Date('2024-01-01'),
        end_date: new Date('2024-01-31'),
        alert_threshold: 75
      };

      await createBudget(budgetInput);

      // Create expenses across any category
      await db.insert(expensesTable).values({
        user_id: user[0].id,
        category_id: category[0].id,
        title: 'Any Category Expense',
        amount: '800.00',
        status: 'APPROVED',
        expense_date: '2024-01-15',
        tags: []
      }).execute();

      const alerts = await checkBudgetAlerts(user[0].id);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].category_id).toBe(null);
      expect(alerts[0].usage_percentage).toBeCloseTo(80, 1);
    });
  });
});