import { 
    type Expense, 
    type CreateExpenseInput, 
    type UpdateExpenseInput, 
    type ApproveExpenseInput,
    type ExpenseFilter,
    type ExpenseListResponse
} from '../schema';
import { db } from '../db';
import { expensesTable, usersTable, categoriesTable, teamsTable, type NewExpense } from '../db/schema';
import { eq } from 'drizzle-orm';

export async function createExpense(input: CreateExpenseInput): Promise<Expense> {
    try {
        // Verify foreign key constraints before insertion
        
        // Check if user exists
        const userExists = await db.select()
            .from(usersTable)
            .where(eq(usersTable.id, input.user_id))
            .execute();
        
        if (userExists.length === 0) {
            throw new Error(`User with id ${input.user_id} does not exist`);
        }

        // Check if category exists
        const categoryExists = await db.select()
            .from(categoriesTable)
            .where(eq(categoriesTable.id, input.category_id))
            .execute();
        
        if (categoryExists.length === 0) {
            throw new Error(`Category with id ${input.category_id} does not exist`);
        }

        // Check if team exists (if team_id is provided)
        if (input.team_id) {
            const teamExists = await db.select()
                .from(teamsTable)
                .where(eq(teamsTable.id, input.team_id))
                .execute();
            
            if (teamExists.length === 0) {
                throw new Error(`Team with id ${input.team_id} does not exist`);
            }
        }

        // Insert expense record
        const insertData: NewExpense = {
            user_id: input.user_id,
            team_id: input.team_id || null,
            category_id: input.category_id,
            title: input.title,
            description: input.description || null,
            amount: input.amount.toString(), // Convert number to string for numeric column
            receipt_url: input.receipt_url || null,
            tags: input.tags || [], // JSONB field accepts array directly
            status: 'PENDING',
            is_recurring: input.is_recurring || false,
            recurring_frequency: input.recurring_frequency || null,
            recurring_end_date: input.recurring_end_date ? input.recurring_end_date.toISOString().split('T')[0] : null,
            expense_date: input.expense_date.toISOString().split('T')[0] // Convert Date to YYYY-MM-DD string
        };

        const result = await db.insert(expensesTable)
            .values(insertData)
            .returning()
            .execute();

        // Convert numeric and date fields back to proper types before returning
        const expense = result[0];
        return {
            ...expense,
            amount: parseFloat(expense.amount), // Convert string back to number
            tags: expense.tags as string[], // Type assertion for JSON field
            expense_date: new Date(expense.expense_date), // Convert string to Date
            recurring_end_date: expense.recurring_end_date ? new Date(expense.recurring_end_date) : null // Convert string to Date if exists
        };
    } catch (error) {
        console.error('Expense creation failed:', error);
        throw error;
    }
}

export async function getExpenses(filter: ExpenseFilter): Promise<ExpenseListResponse> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to fetch expenses with advanced filtering and pagination
    return Promise.resolve({
        expenses: [],
        total_count: 0,
        page: filter.page || 1,
        limit: filter.limit || 20,
        total_pages: 0
    });
}

export async function getExpenseById(id: number): Promise<Expense | null> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to fetch a specific expense by ID with full details
    return Promise.resolve(null);
}

export async function updateExpense(input: UpdateExpenseInput): Promise<Expense> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to update expense information
    return Promise.resolve({
        id: input.id,
        user_id: 1,
        team_id: null,
        category_id: input.category_id || 1,
        title: input.title || 'Expense Title',
        description: input.description || null,
        amount: input.amount || 100,
        receipt_url: input.receipt_url || null,
        tags: input.tags || [],
        status: 'PENDING',
        is_recurring: false,
        recurring_frequency: null,
        recurring_end_date: null,
        expense_date: input.expense_date || new Date(),
        approved_by: null,
        approved_at: null,
        created_at: new Date(),
        updated_at: new Date()
    } as Expense);
}

export async function deleteExpense(id: number): Promise<{ success: boolean }> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to delete an expense (only by owner or admin)
    return Promise.resolve({ success: true });
}

export async function approveExpense(input: ApproveExpenseInput): Promise<Expense> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to approve or reject expense (manager/admin only)
    return Promise.resolve({
        id: input.expense_id,
        user_id: 1,
        team_id: null,
        category_id: 1,
        title: 'Approved Expense',
        description: null,
        amount: 100,
        receipt_url: null,
        tags: [],
        status: input.status,
        is_recurring: false,
        recurring_frequency: null,
        recurring_end_date: null,
        expense_date: new Date(),
        approved_by: input.approved_by,
        approved_at: new Date(),
        created_at: new Date(),
        updated_at: new Date()
    } as Expense);
}

export async function searchExpenses(query: string, userId: number): Promise<Expense[]> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to perform full-text search across expense details
    return Promise.resolve([]);
}

export async function getRecurringExpenses(userId: number): Promise<Expense[]> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to fetch all recurring expenses for a user
    return Promise.resolve([]);
}

export async function processRecurringExpenses(): Promise<{ created: number }> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to automatically create recurring expenses (scheduled job)
    return Promise.resolve({ created: 0 });
}

export async function uploadReceipt(file: Buffer, filename: string): Promise<{ url: string }> {
    // This is a placeholder declaration! Real code should be implemented here.
    // The goal of this handler is to upload receipt image to cloud storage
    return Promise.resolve({ url: 'https://placeholder-receipt-url.com' });
}