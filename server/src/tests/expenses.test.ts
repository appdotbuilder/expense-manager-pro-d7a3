import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, teamsTable, expensesTable } from '../db/schema';
import { type CreateExpenseInput } from '../schema';
import { createExpense } from '../handlers/expenses';
import { eq } from 'drizzle-orm';

// Test data setup
let testUser: any;
let testCategory: any;
let testTeam: any;

const baseExpenseInput: CreateExpenseInput = {
  user_id: 1,
  category_id: 1,
  title: 'Test Expense',
  description: 'A test expense description',
  amount: 99.99,
  receipt_url: 'https://example.com/receipt.pdf',
  tags: ['business', 'travel'],
  is_recurring: false,
  recurring_frequency: null,
  recurring_end_date: null,
  expense_date: new Date('2024-01-15')
};

describe('createExpense', () => {
  beforeEach(async () => {
    await createDB();
    
    // Create prerequisite test data
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashedpassword',
        first_name: 'John',
        last_name: 'Doe',
        role: 'USER'
      })
      .returning()
      .execute();
    testUser = userResult[0];

    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Travel',
        description: 'Travel expenses',
        color: '#FF0000',
        icon: 'travel'
      })
      .returning()
      .execute();
    testCategory = categoryResult[0];

    const teamResult = await db.insert(teamsTable)
      .values({
        name: 'Development Team',
        description: 'Software development team',
        manager_id: testUser.id
      })
      .returning()
      .execute();
    testTeam = teamResult[0];

    // Update test input with actual IDs
    baseExpenseInput.user_id = testUser.id;
    baseExpenseInput.category_id = testCategory.id;
  });

  afterEach(resetDB);

  it('should create an expense with all fields', async () => {
    const result = await createExpense(baseExpenseInput);

    // Verify returned expense structure
    expect(result.id).toBeDefined();
    expect(result.user_id).toEqual(testUser.id);
    expect(result.team_id).toBeNull();
    expect(result.category_id).toEqual(testCategory.id);
    expect(result.title).toEqual('Test Expense');
    expect(result.description).toEqual('A test expense description');
    expect(result.amount).toEqual(99.99);
    expect(typeof result.amount).toBe('number');
    expect(result.receipt_url).toEqual('https://example.com/receipt.pdf');
    expect(result.tags).toEqual(['business', 'travel']);
    expect(result.status).toEqual('PENDING');
    expect(result.is_recurring).toBe(false);
    expect(result.recurring_frequency).toBeNull();
    expect(result.recurring_end_date).toBeNull();
    expect(result.expense_date).toEqual(new Date('2024-01-15'));
    expect(result.approved_by).toBeNull();
    expect(result.approved_at).toBeNull();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should create expense with team assignment', async () => {
    const inputWithTeam: CreateExpenseInput = {
      ...baseExpenseInput,
      team_id: testTeam.id
    };

    const result = await createExpense(inputWithTeam);

    expect(result.team_id).toEqual(testTeam.id);
  });

  it('should create recurring expense', async () => {
    const recurringInput: CreateExpenseInput = {
      ...baseExpenseInput,
      is_recurring: true,
      recurring_frequency: 'MONTHLY',
      recurring_end_date: new Date('2024-12-31')
    };

    const result = await createExpense(recurringInput);

    expect(result.is_recurring).toBe(true);
    expect(result.recurring_frequency).toEqual('MONTHLY');
    expect(result.recurring_end_date).toEqual(new Date('2024-12-31'));
  });

  it('should create expense with minimal fields', async () => {
    const minimalInput: CreateExpenseInput = {
      user_id: testUser.id,
      category_id: testCategory.id,
      title: 'Minimal Expense',
      amount: 25.50,
      tags: [],
      is_recurring: false,
      expense_date: new Date('2024-01-20')
    };

    const result = await createExpense(minimalInput);

    expect(result.title).toEqual('Minimal Expense');
    expect(result.amount).toEqual(25.50);
    expect(result.description).toBeNull();
    expect(result.receipt_url).toBeNull();
    expect(result.tags).toEqual([]);
    expect(result.team_id).toBeNull();
    expect(result.is_recurring).toBe(false);
  });

  it('should save expense to database correctly', async () => {
    const result = await createExpense(baseExpenseInput);

    // Query database to verify storage
    const expenses = await db.select()
      .from(expensesTable)
      .where(eq(expensesTable.id, result.id))
      .execute();

    expect(expenses).toHaveLength(1);
    const dbExpense = expenses[0];
    
    expect(dbExpense.title).toEqual('Test Expense');
    expect(parseFloat(dbExpense.amount)).toEqual(99.99);
    expect(dbExpense.tags).toEqual(['business', 'travel']);
    expect(dbExpense.status).toEqual('PENDING');
    expect(new Date(dbExpense.expense_date)).toEqual(new Date('2024-01-15'));
  });

  it('should handle empty tags array correctly', async () => {
    const inputWithEmptyTags: CreateExpenseInput = {
      ...baseExpenseInput,
      tags: []
    };

    const result = await createExpense(inputWithEmptyTags);

    expect(result.tags).toEqual([]);
  });

  it('should handle large expense amounts', async () => {
    const largeAmountInput: CreateExpenseInput = {
      ...baseExpenseInput,
      amount: 999999.99
    };

    const result = await createExpense(largeAmountInput);

    expect(result.amount).toEqual(999999.99);
    expect(typeof result.amount).toBe('number');
  });

  it('should throw error when user does not exist', async () => {
    const invalidUserInput: CreateExpenseInput = {
      ...baseExpenseInput,
      user_id: 99999
    };

    await expect(createExpense(invalidUserInput)).rejects.toThrow(/User with id 99999 does not exist/i);
  });

  it('should throw error when category does not exist', async () => {
    const invalidCategoryInput: CreateExpenseInput = {
      ...baseExpenseInput,
      category_id: 99999
    };

    await expect(createExpense(invalidCategoryInput)).rejects.toThrow(/Category with id 99999 does not exist/i);
  });

  it('should throw error when team does not exist', async () => {
    const invalidTeamInput: CreateExpenseInput = {
      ...baseExpenseInput,
      team_id: 99999
    };

    await expect(createExpense(invalidTeamInput)).rejects.toThrow(/Team with id 99999 does not exist/i);
  });

  it('should handle different expense dates correctly', async () => {
    const pastDateInput: CreateExpenseInput = {
      ...baseExpenseInput,
      expense_date: new Date('2023-12-01')
    };

    const result = await createExpense(pastDateInput);

    expect(result.expense_date).toEqual(new Date('2023-12-01'));
  });

  it('should handle complex tag arrays', async () => {
    const complexTagsInput: CreateExpenseInput = {
      ...baseExpenseInput,
      tags: ['urgent', 'client-meeting', 'reimbursable', 'q1-2024']
    };

    const result = await createExpense(complexTagsInput);

    expect(result.tags).toEqual(['urgent', 'client-meeting', 'reimbursable', 'q1-2024']);
  });
});