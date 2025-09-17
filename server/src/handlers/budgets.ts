import { db } from '../db';
import { budgetsTable, usersTable, categoriesTable, expensesTable } from '../db/schema';
import { 
    type Budget, 
    type CreateBudgetInput, 
    type UpdateBudgetInput,
    type BudgetAnalytics,
    type BudgetOverviewResponse
} from '../schema';
import { eq, and, gte, lte, sum, sql, SQL } from 'drizzle-orm';

// Helper function to convert database budget to application Budget type
function convertBudget(dbBudget: any): Budget {
  return {
    ...dbBudget,
    amount: parseFloat(dbBudget.amount),
    alert_threshold: parseFloat(dbBudget.alert_threshold),
    start_date: new Date(dbBudget.start_date),
    end_date: new Date(dbBudget.end_date)
  };
}

export async function createBudget(input: CreateBudgetInput): Promise<Budget> {
  try {
    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .limit(1)
      .execute();
    
    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Verify category exists if provided
    if (input.category_id !== null && input.category_id !== undefined) {
      const category = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, input.category_id))
        .limit(1)
        .execute();
      
      if (category.length === 0) {
        throw new Error('Category not found');
      }
    }

    // Insert budget record
    const result = await db.insert(budgetsTable)
      .values({
        user_id: input.user_id,
        category_id: input.category_id || null,
        amount: input.amount.toString(),
        period: input.period,
        start_date: input.start_date.toISOString().split('T')[0], // Convert Date to YYYY-MM-DD string
        end_date: input.end_date.toISOString().split('T')[0], // Convert Date to YYYY-MM-DD string
        alert_threshold: (input.alert_threshold || 80).toString()
      })
      .returning()
      .execute();

    // Convert back to proper types
    return convertBudget(result[0]);
  } catch (error) {
    console.error('Budget creation failed:', error);
    throw error;
  }
}

export async function getBudgets(userId: number): Promise<Budget[]> {
  try {
    const results = await db.select()
      .from(budgetsTable)
      .where(eq(budgetsTable.user_id, userId))
      .execute();

    return results.map(convertBudget);
  } catch (error) {
    console.error('Get budgets failed:', error);
    throw error;
  }
}

export async function getBudgetById(id: number): Promise<Budget | null> {
  try {
    const results = await db.select()
      .from(budgetsTable)
      .where(eq(budgetsTable.id, id))
      .limit(1)
      .execute();

    if (results.length === 0) {
      return null;
    }

    return convertBudget(results[0]);
  } catch (error) {
    console.error('Get budget by ID failed:', error);
    throw error;
  }
}

export async function updateBudget(input: UpdateBudgetInput): Promise<Budget> {
  try {
    // Verify budget exists
    const existing = await getBudgetById(input.id);
    if (!existing) {
      throw new Error('Budget not found');
    }

    // Build update values
    const updateValues: any = {};
    if (input.amount !== undefined) {
      updateValues.amount = input.amount.toString();
    }
    if (input.alert_threshold !== undefined) {
      updateValues.alert_threshold = input.alert_threshold.toString();
    }
    if (input.start_date !== undefined) {
      updateValues.start_date = input.start_date.toISOString().split('T')[0];
    }
    if (input.end_date !== undefined) {
      updateValues.end_date = input.end_date.toISOString().split('T')[0];
    }

    // Update timestamp
    updateValues.updated_at = sql`NOW()`;

    const result = await db.update(budgetsTable)
      .set(updateValues)
      .where(eq(budgetsTable.id, input.id))
      .returning()
      .execute();

    return convertBudget(result[0]);
  } catch (error) {
    console.error('Budget update failed:', error);
    throw error;
  }
}

export async function deleteBudget(id: number): Promise<{ success: boolean }> {
  try {
    // Verify budget exists
    const existing = await getBudgetById(id);
    if (!existing) {
      throw new Error('Budget not found');
    }

    await db.delete(budgetsTable)
      .where(eq(budgetsTable.id, id))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Budget deletion failed:', error);
    throw error;
  }
}

export async function getBudgetOverview(userId: number): Promise<BudgetOverviewResponse> {
  try {
    // Get all budgets for the user
    const budgets = await getBudgets(userId);

    // Calculate total budget
    const total_budget = budgets.reduce((sum, budget) => sum + budget.amount, 0);

    // Get total spent across all expenses for this user
    const spentResults = await db.select({
      total_spent: sum(expensesTable.amount)
    })
    .from(expensesTable)
    .where(and(
      eq(expensesTable.user_id, userId),
      eq(expensesTable.status, 'APPROVED')
    ))
    .execute();

    const total_spent = spentResults[0]?.total_spent ? parseFloat(spentResults[0].total_spent) : 0;
    const remaining = total_budget - total_spent;
    const percentage_used = total_budget > 0 ? (total_spent / total_budget) * 100 : 0;

    return {
      budgets,
      total_budget,
      total_spent,
      remaining,
      percentage_used
    };
  } catch (error) {
    console.error('Budget overview failed:', error);
    throw error;
  }
}

export async function getBudgetAnalytics(input: BudgetAnalytics): Promise<any> {
  try {
    // Convert dates to strings for comparison with database
    const startDateStr = input.start_date.toISOString().split('T')[0];
    const endDateStr = input.end_date.toISOString().split('T')[0];

    // Get budgets for the user in the specified period
    const budgets = await db.select()
      .from(budgetsTable)
      .where(and(
        eq(budgetsTable.user_id, input.user_id),
        eq(budgetsTable.period, input.period),
        gte(budgetsTable.end_date, startDateStr),
        lte(budgetsTable.start_date, endDateStr)
      ))
      .execute();

    const parsedBudgets = budgets.map(convertBudget);

    // Get expenses in the date range
    const expenses = await db.select({
      category_id: expensesTable.category_id,
      total_amount: sum(expensesTable.amount)
    })
    .from(expensesTable)
    .where(and(
      eq(expensesTable.user_id, input.user_id),
      eq(expensesTable.status, 'APPROVED'),
      gte(expensesTable.expense_date, startDateStr),
      lte(expensesTable.expense_date, endDateStr)
    ))
    .groupBy(expensesTable.category_id)
    .execute();

    // Calculate budget utilization
    const total_budgeted = parsedBudgets.reduce((sum, budget) => sum + budget.amount, 0);
    const total_spent = expenses.reduce((sum, expense) => 
      sum + (expense.total_amount ? parseFloat(expense.total_amount) : 0), 0
    );
    
    const budget_utilization = total_budgeted > 0 ? (total_spent / total_budgeted) * 100 : 0;

    // Create category breakdown
    const category_breakdown = expenses.map(expense => ({
      category_id: expense.category_id,
      amount_spent: expense.total_amount ? parseFloat(expense.total_amount) : 0,
      percentage: total_spent > 0 ? (parseFloat(expense.total_amount || '0') / total_spent) * 100 : 0
    }));

    // Simple spending trend (monthly aggregation)
    const spending_trend = [{
      period: `${input.start_date.getFullYear()}-${(input.start_date.getMonth() + 1).toString().padStart(2, '0')}`,
      amount: total_spent
    }];

    // Basic recommendations
    const recommendations = [];
    if (budget_utilization > 90) {
      recommendations.push('Consider reducing spending or increasing budget allocation');
    }
    if (budget_utilization < 50) {
      recommendations.push('You have room to increase spending within your budget');
    }

    return {
      budget_utilization,
      category_breakdown,
      spending_trend,
      recommendations
    };
  } catch (error) {
    console.error('Budget analytics failed:', error);
    throw error;
  }
}

export async function checkBudgetAlerts(userId: number): Promise<any[]> {
  try {
    // Get all active budgets for the user
    const budgets = await getBudgets(userId);
    const alerts = [];

    for (const budget of budgets) {
      // Convert dates to strings for database comparison
      const startDateStr = budget.start_date.toISOString().split('T')[0];
      const endDateStr = budget.end_date.toISOString().split('T')[0];

      // Build base query conditions
      const conditions: SQL<unknown>[] = [
        eq(expensesTable.user_id, userId),
        eq(expensesTable.status, 'APPROVED'),
        gte(expensesTable.expense_date, startDateStr),
        lte(expensesTable.expense_date, endDateStr)
      ];

      // Add category filter if budget is category-specific
      if (budget.category_id) {
        conditions.push(eq(expensesTable.category_id, budget.category_id));
      }

      const spentResults = await db.select({
        total_spent: sum(expensesTable.amount)
      })
      .from(expensesTable)
      .where(and(...conditions))
      .execute();

      const total_spent = spentResults[0]?.total_spent ? parseFloat(spentResults[0].total_spent) : 0;
      
      const usage_percentage = budget.amount > 0 ? (total_spent / budget.amount) * 100 : 0;

      if (usage_percentage >= budget.alert_threshold) {
        alerts.push({
          budget_id: budget.id,
          category_id: budget.category_id,
          budget_amount: budget.amount,
          amount_spent: total_spent,
          usage_percentage,
          alert_threshold: budget.alert_threshold,
          period: budget.period,
          start_date: budget.start_date,
          end_date: budget.end_date
        });
      }
    }

    return alerts;
  } catch (error) {
    console.error('Budget alerts check failed:', error);
    throw error;
  }
}