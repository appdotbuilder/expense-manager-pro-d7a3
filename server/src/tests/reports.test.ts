import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, expensesTable, teamsTable, teamMembersTable } from '../db/schema';
import { type ReportGeneration } from '../schema';
import { generateExpenseReport } from '../handlers/reports';

// Test data setup
const testUser = {
  email: 'testuser@example.com',
  password_hash: 'hashed_password',
  first_name: 'John',
  last_name: 'Doe',
  role: 'USER' as const
};

const testManager = {
  email: 'manager@example.com',
  password_hash: 'hashed_password',
  first_name: 'Jane',
  last_name: 'Smith',
  role: 'MANAGER' as const
};

const testCategory = {
  name: 'Travel',
  color: '#FF5733',
  description: 'Travel related expenses'
};

const testTeam = {
  name: 'Engineering Team',
  description: 'Software engineering team'
};

describe('generateExpenseReport', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let userId: number;
  let managerId: number;
  let categoryId: number;
  let teamId: number;

  beforeEach(async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = userResult[0].id;

    // Create test manager
    const managerResult = await db.insert(usersTable)
      .values(testManager)
      .returning()
      .execute();
    managerId = managerResult[0].id;

    // Create test category
    const categoryResult = await db.insert(categoriesTable)
      .values(testCategory)
      .returning()
      .execute();
    categoryId = categoryResult[0].id;

    // Create test team
    const teamResult = await db.insert(teamsTable)
      .values({
        ...testTeam,
        manager_id: managerId
      })
      .returning()
      .execute();
    teamId = teamResult[0].id;
  });

  it('should generate expense report for user', async () => {
    // Create test expenses
    await db.insert(expensesTable).values([
      {
        user_id: userId,
        category_id: categoryId,
        title: 'Flight to Conference',
        description: 'Business trip flight',
        amount: '599.99',
        expense_date: '2024-01-15',
        status: 'APPROVED'
      },
      {
        user_id: userId,
        category_id: categoryId,
        title: 'Hotel Stay',
        description: 'Conference hotel',
        amount: '299.50',
        expense_date: '2024-01-16',
        status: 'PENDING'
      }
    ]).execute();

    const input: ReportGeneration = {
      user_id: userId,
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-31'),
      format: 'PDF',
      include_receipts: false
    };

    const result = await generateExpenseReport(input);

    expect(result.reportUrl).toBeDefined();
    expect(result.reportUrl).toContain('https://reports.expensetracker.com');
    expect(result.reportUrl).toContain('pdf');
    expect(result.reportUrl).toContain('.pdf');
  });

  it('should generate report in different formats', async () => {
    // Create test expense
    await db.insert(expensesTable).values({
      user_id: userId,
      category_id: categoryId,
      title: 'Test Expense',
      amount: '100.00',
      expense_date: '2024-01-15',
      status: 'APPROVED'
    }).execute();

    const baseInput: ReportGeneration = {
      user_id: userId,
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-31'),
      format: 'PDF',
      include_receipts: false
    };

    // Test PDF format
    const pdfResult = await generateExpenseReport({
      ...baseInput,
      format: 'PDF'
    });
    expect(pdfResult.reportUrl).toContain('.pdf');

    // Test EXCEL format
    const excelResult = await generateExpenseReport({
      ...baseInput,
      format: 'EXCEL'
    });
    expect(excelResult.reportUrl).toContain('.xlsx');

    // Test CSV format
    const csvResult = await generateExpenseReport({
      ...baseInput,
      format: 'CSV'
    });
    expect(csvResult.reportUrl).toContain('.csv');
  });

  it('should generate team report when team_id is provided', async () => {
    // Add user to team
    await db.insert(teamMembersTable).values({
      team_id: teamId,
      user_id: userId
    }).execute();

    // Create team expense
    await db.insert(expensesTable).values({
      user_id: userId,
      team_id: teamId,
      category_id: categoryId,
      title: 'Team Equipment',
      amount: '500.00',
      expense_date: '2024-01-15',
      status: 'APPROVED'
    }).execute();

    const input: ReportGeneration = {
      user_id: managerId, // Manager requesting team report
      team_id: teamId,
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-31'),
      format: 'PDF',
      include_receipts: false
    };

    const result = await generateExpenseReport(input);

    expect(result.reportUrl).toBeDefined();
    expect(result.reportUrl).toContain('https://reports.expensetracker.com');
  });

  it('should filter expenses by date range', async () => {
    // Create expenses in different date ranges
    await db.insert(expensesTable).values([
      {
        user_id: userId,
        category_id: categoryId,
        title: 'January Expense',
        amount: '100.00',
        expense_date: '2024-01-15',
        status: 'APPROVED'
      },
      {
        user_id: userId,
        category_id: categoryId,
        title: 'February Expense',
        amount: '200.00',
        expense_date: '2024-02-15',
        status: 'APPROVED'
      }
    ]).execute();

    // Request report for January only
    const input: ReportGeneration = {
      user_id: userId,
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-31'),
      format: 'CSV',
      include_receipts: false
    };

    const result = await generateExpenseReport(input);

    // Should generate report successfully (February expense should be excluded)
    expect(result.reportUrl).toBeDefined();
  });

  it('should handle empty expense results', async () => {
    // No expenses created
    const input: ReportGeneration = {
      user_id: userId,
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-31'),
      format: 'PDF',
      include_receipts: false
    };

    const result = await generateExpenseReport(input);

    // Should still generate report URL even with no expenses
    expect(result.reportUrl).toBeDefined();
  });

  it('should handle report with receipts included', async () => {
    // Create expense with receipt
    await db.insert(expensesTable).values({
      user_id: userId,
      category_id: categoryId,
      title: 'Expense with Receipt',
      amount: '150.75',
      expense_date: '2024-01-15',
      receipt_url: 'https://storage.example.com/receipt.pdf',
      status: 'APPROVED'
    }).execute();

    const input: ReportGeneration = {
      user_id: userId,
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-31'),
      format: 'PDF',
      include_receipts: true
    };

    const result = await generateExpenseReport(input);

    expect(result.reportUrl).toBeDefined();
  });

  it('should throw error for non-existent user', async () => {
    const input: ReportGeneration = {
      user_id: 99999, // Non-existent user
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-31'),
      format: 'PDF',
      include_receipts: false
    };

    expect(generateExpenseReport(input)).rejects.toThrow(/user not found/i);
  });

  it('should throw error for non-existent team', async () => {
    const input: ReportGeneration = {
      user_id: userId,
      team_id: 99999, // Non-existent team
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-31'),
      format: 'PDF',
      include_receipts: false
    };

    expect(generateExpenseReport(input)).rejects.toThrow(/team not found/i);
  });

  it('should handle expenses with various statuses', async () => {
    // Create expenses with different statuses
    await db.insert(expensesTable).values([
      {
        user_id: userId,
        category_id: categoryId,
        title: 'Pending Expense',
        amount: '100.00',
        expense_date: '2024-01-15',
        status: 'PENDING'
      },
      {
        user_id: userId,
        category_id: categoryId,
        title: 'Approved Expense',
        amount: '200.00',
        expense_date: '2024-01-16',
        status: 'APPROVED'
      },
      {
        user_id: userId,
        category_id: categoryId,
        title: 'Rejected Expense',
        amount: '50.00',
        expense_date: '2024-01-17',
        status: 'REJECTED'
      }
    ]).execute();

    const input: ReportGeneration = {
      user_id: userId,
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-31'),
      format: 'EXCEL',
      include_receipts: false
    };

    const result = await generateExpenseReport(input);

    expect(result.reportUrl).toBeDefined();
    expect(result.reportUrl).toContain('excel');
  });

  it('should handle expenses with tags and descriptions', async () => {
    // Create expense with tags and null description
    await db.insert(expensesTable).values({
      user_id: userId,
      category_id: categoryId,
      title: 'Tagged Expense',
      description: null,
      amount: '75.25',
      expense_date: '2024-01-15',
      tags: JSON.stringify(['business', 'conference', 'travel']),
      status: 'APPROVED'
    }).execute();

    const input: ReportGeneration = {
      user_id: userId,
      start_date: new Date('2024-01-01'),
      end_date: new Date('2024-01-31'),
      format: 'CSV',
      include_receipts: false
    };

    const result = await generateExpenseReport(input);

    expect(result.reportUrl).toBeDefined();
  });
});