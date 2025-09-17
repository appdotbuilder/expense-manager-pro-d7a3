import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, budgetsTable, expensesTable } from '../db/schema';
import { getDashboardStats } from '../handlers/dashboard';

describe('getDashboardStats', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty stats for user with no data', async () => {
    // Create a user with no expenses or budgets
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'USER'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;
    const result = await getDashboardStats(userId);

    expect(result.total_expenses).toBe(0);
    expect(result.total_amount_spent).toBe(0);
    expect(result.budget_usage_percentage).toBe(0);
    expect(result.category_breakdown).toEqual([]);
    expect(result.monthly_trend).toEqual([]);
    expect(result.recent_expenses).toEqual([]);
  });

  it('should calculate total expenses and amount spent correctly', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'USER'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create category
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Food',
        description: 'Food expenses',
        color: '#FF0000',
        icon: 'food'
      })
      .returning()
      .execute();

    const categoryId = categoryResult[0].id;

    // Create multiple expenses
    await db.insert(expensesTable)
      .values([
        {
          user_id: userId,
          category_id: categoryId,
          title: 'Lunch',
          amount: '25.50',
          expense_date: '2023-10-15',
          status: 'APPROVED'
        },
        {
          user_id: userId,
          category_id: categoryId,
          title: 'Dinner',
          amount: '45.75',
          expense_date: '2023-10-16',
          status: 'PENDING'
        },
        {
          user_id: userId,
          category_id: categoryId,
          title: 'Groceries',
          amount: '120.25',
          expense_date: '2023-10-17',
          status: 'APPROVED'
        }
      ])
      .execute();

    const result = await getDashboardStats(userId);

    expect(result.total_expenses).toBe(3);
    expect(result.total_amount_spent).toBe(191.5);
  });

  it('should calculate budget usage percentage correctly', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'USER'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create category
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Food',
        description: 'Food expenses',
        color: '#FF0000',
        icon: 'food'
      })
      .returning()
      .execute();

    const categoryId = categoryResult[0].id;

    // Create budget
    await db.insert(budgetsTable)
      .values({
        user_id: userId,
        category_id: categoryId,
        amount: '1000.00',
        period: 'MONTHLY',
        start_date: '2023-10-01',
        end_date: '2023-10-31',
        alert_threshold: '80.00'
      })
      .execute();

    // Create expense (25% of budget)
    await db.insert(expensesTable)
      .values({
        user_id: userId,
        category_id: categoryId,
        title: 'Groceries',
        amount: '250.00',
        expense_date: '2023-10-15',
        status: 'APPROVED'
      })
      .execute();

    const result = await getDashboardStats(userId);

    expect(result.total_amount_spent).toBe(250);
    expect(result.budget_usage_percentage).toBe(25);
  });

  it('should provide category breakdown with percentages', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'USER'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create categories
    const foodCategoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Food',
        description: 'Food expenses',
        color: '#FF0000',
        icon: 'food'
      })
      .returning()
      .execute();

    const transportCategoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Transport',
        description: 'Transport expenses',
        color: '#00FF00',
        icon: 'transport'
      })
      .returning()
      .execute();

    const foodCategoryId = foodCategoryResult[0].id;
    const transportCategoryId = transportCategoryResult[0].id;

    // Create expenses in different categories
    await db.insert(expensesTable)
      .values([
        {
          user_id: userId,
          category_id: foodCategoryId,
          title: 'Groceries',
          amount: '300.00',
          expense_date: '2023-10-15',
          status: 'APPROVED'
        },
        {
          user_id: userId,
          category_id: transportCategoryId,
          title: 'Gas',
          amount: '100.00',
          expense_date: '2023-10-16',
          status: 'APPROVED'
        }
      ])
      .execute();

    const result = await getDashboardStats(userId);

    expect(result.category_breakdown).toHaveLength(2);
    
    const foodBreakdown = result.category_breakdown.find(c => c.category_name === 'Food');
    const transportBreakdown = result.category_breakdown.find(c => c.category_name === 'Transport');
    
    expect(foodBreakdown).toBeDefined();
    expect(foodBreakdown?.amount_spent).toBe(300);
    expect(foodBreakdown?.percentage).toBe(75); // 300/400 * 100
    
    expect(transportBreakdown).toBeDefined();
    expect(transportBreakdown?.amount_spent).toBe(100);
    expect(transportBreakdown?.percentage).toBe(25); // 100/400 * 100
  });

  it('should provide monthly trend data', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'USER'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create category
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Food',
        description: 'Food expenses',
        color: '#FF0000',
        icon: 'food'
      })
      .returning()
      .execute();

    const categoryId = categoryResult[0].id;

    // Create expenses across different months
    await db.insert(expensesTable)
      .values([
        {
          user_id: userId,
          category_id: categoryId,
          title: 'September Expense',
          amount: '150.00',
          expense_date: '2023-09-15',
          status: 'APPROVED'
        },
        {
          user_id: userId,
          category_id: categoryId,
          title: 'October Expense 1',
          amount: '200.00',
          expense_date: '2023-10-15',
          status: 'APPROVED'
        },
        {
          user_id: userId,
          category_id: categoryId,
          title: 'October Expense 2',
          amount: '100.00',
          expense_date: '2023-10-20',
          status: 'APPROVED'
        }
      ])
      .execute();

    const result = await getDashboardStats(userId);

    expect(result.monthly_trend.length).toBeGreaterThan(0);
    
    const septemberTrend = result.monthly_trend.find(t => t.month === '2023-09');
    const octoberTrend = result.monthly_trend.find(t => t.month === '2023-10');
    
    if (septemberTrend) {
      expect(septemberTrend.amount).toBe(150);
    }
    
    if (octoberTrend) {
      expect(octoberTrend.amount).toBe(300);
    }
  });

  it('should return recent expenses sorted by creation date', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'USER'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create category
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Food',
        description: 'Food expenses',
        color: '#FF0000',
        icon: 'food'
      })
      .returning()
      .execute();

    const categoryId = categoryResult[0].id;

    // Create 7 expenses to test limit of 5
    for (let i = 1; i <= 7; i++) {
      await db.insert(expensesTable)
        .values({
          user_id: userId,
          category_id: categoryId,
          title: `Expense ${i}`,
          amount: `${i * 10}.00`,
          expense_date: '2023-10-15',
          status: 'APPROVED',
          tags: ['test', `tag${i}`]
        })
        .execute();
      
      // Small delay to ensure different created_at timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    const result = await getDashboardStats(userId);

    expect(result.recent_expenses).toHaveLength(5);
    expect(result.recent_expenses[0].title).toBe('Expense 7'); // Most recent first
    expect(typeof result.recent_expenses[0].amount).toBe('number');
    expect(Array.isArray(result.recent_expenses[0].tags)).toBe(true);
    expect(result.recent_expenses[0].tags).toContain('test');
  });

  it('should handle user with only budgets but no expenses', async () => {
    // Create user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        password_hash: 'hashed_password',
        first_name: 'Test',
        last_name: 'User',
        role: 'USER'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Create category
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Food',
        description: 'Food expenses',
        color: '#FF0000',
        icon: 'food'
      })
      .returning()
      .execute();

    const categoryId = categoryResult[0].id;

    // Create budget only
    await db.insert(budgetsTable)
      .values({
        user_id: userId,
        category_id: categoryId,
        amount: '1000.00',
        period: 'MONTHLY',
        start_date: '2023-10-01',
        end_date: '2023-10-31',
        alert_threshold: '80.00'
      })
      .execute();

    const result = await getDashboardStats(userId);

    expect(result.total_expenses).toBe(0);
    expect(result.total_amount_spent).toBe(0);
    expect(result.budget_usage_percentage).toBe(0);
    expect(result.category_breakdown).toEqual([]);
    expect(result.recent_expenses).toEqual([]);
  });

  it('should only include data for the specified user', async () => {
    // Create two users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        password_hash: 'hashed_password',
        first_name: 'User',
        last_name: 'One',
        role: 'USER'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        password_hash: 'hashed_password',
        first_name: 'User',
        last_name: 'Two',
        role: 'USER'
      })
      .returning()
      .execute();

    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;

    // Create category
    const categoryResult = await db.insert(categoriesTable)
      .values({
        name: 'Food',
        description: 'Food expenses',
        color: '#FF0000',
        icon: 'food'
      })
      .returning()
      .execute();

    const categoryId = categoryResult[0].id;

    // Create expenses for both users
    await db.insert(expensesTable)
      .values([
        {
          user_id: user1Id,
          category_id: categoryId,
          title: 'User 1 Expense',
          amount: '100.00',
          expense_date: '2023-10-15',
          status: 'APPROVED'
        },
        {
          user_id: user2Id,
          category_id: categoryId,
          title: 'User 2 Expense',
          amount: '200.00',
          expense_date: '2023-10-16',
          status: 'APPROVED'
        }
      ])
      .execute();

    const user1Stats = await getDashboardStats(user1Id);

    expect(user1Stats.total_expenses).toBe(1);
    expect(user1Stats.total_amount_spent).toBe(100);
    expect(user1Stats.recent_expenses).toHaveLength(1);
    expect(user1Stats.recent_expenses[0].title).toBe('User 1 Expense');
  });
});