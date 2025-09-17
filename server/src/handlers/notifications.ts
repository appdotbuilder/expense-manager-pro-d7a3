import { db } from '../db';
import { notificationsTable, budgetsTable, expensesTable, usersTable } from '../db/schema';
import { type Notification, type CreateNotificationInput } from '../schema';
import { eq, and, count } from 'drizzle-orm';

export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
  try {
    // Verify user exists
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.user_id))
      .execute();

    if (users.length === 0) {
      throw new Error(`User with id ${input.user_id} not found`);
    }

    // Verify related expense exists if provided
    if (input.related_expense_id) {
      const expenses = await db.select()
        .from(expensesTable)
        .where(eq(expensesTable.id, input.related_expense_id))
        .execute();

      if (expenses.length === 0) {
        throw new Error(`Expense with id ${input.related_expense_id} not found`);
      }
    }

    // Insert notification
    const result = await db.insert(notificationsTable)
      .values({
        user_id: input.user_id,
        type: input.type,
        title: input.title,
        message: input.message,
        related_expense_id: input.related_expense_id || null
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Notification creation failed:', error);
    throw error;
  }
}

export async function getNotifications(userId: number): Promise<Notification[]> {
  try {
    // Verify user exists
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      throw new Error(`User with id ${userId} not found`);
    }

    const notifications = await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.user_id, userId))
      .orderBy(notificationsTable.created_at)
      .execute();

    return notifications;
  } catch (error) {
    console.error('Get notifications failed:', error);
    throw error;
  }
}

export async function markNotificationAsRead(notificationId: number): Promise<{ success: boolean }> {
  try {
    // Verify notification exists
    const notifications = await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, notificationId))
      .execute();

    if (notifications.length === 0) {
      throw new Error(`Notification with id ${notificationId} not found`);
    }

    await db.update(notificationsTable)
      .set({ is_read: true })
      .where(eq(notificationsTable.id, notificationId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Mark notification as read failed:', error);
    throw error;
  }
}

export async function markAllNotificationsAsRead(userId: number): Promise<{ success: boolean }> {
  try {
    // Verify user exists
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      throw new Error(`User with id ${userId} not found`);
    }

    await db.update(notificationsTable)
      .set({ is_read: true })
      .where(
        and(
          eq(notificationsTable.user_id, userId),
          eq(notificationsTable.is_read, false)
        )
      )
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Mark all notifications as read failed:', error);
    throw error;
  }
}

export async function deleteNotification(notificationId: number): Promise<{ success: boolean }> {
  try {
    // Verify notification exists
    const notifications = await db.select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, notificationId))
      .execute();

    if (notifications.length === 0) {
      throw new Error(`Notification with id ${notificationId} not found`);
    }

    await db.delete(notificationsTable)
      .where(eq(notificationsTable.id, notificationId))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Delete notification failed:', error);
    throw error;
  }
}

export async function getUnreadNotificationCount(userId: number): Promise<{ count: number }> {
  try {
    // Verify user exists
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      throw new Error(`User with id ${userId} not found`);
    }

    const result = await db.select({ count: count() })
      .from(notificationsTable)
      .where(
        and(
          eq(notificationsTable.user_id, userId),
          eq(notificationsTable.is_read, false)
        )
      )
      .execute();

    return { count: result[0].count };
  } catch (error) {
    console.error('Get unread notification count failed:', error);
    throw error;
  }
}

export async function sendBudgetAlert(userId: number, budgetId: number, percentage: number): Promise<void> {
  try {
    // Verify user exists
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      throw new Error(`User with id ${userId} not found`);
    }

    // Verify budget exists
    const budgets = await db.select()
      .from(budgetsTable)
      .where(eq(budgetsTable.id, budgetId))
      .execute();

    if (budgets.length === 0) {
      throw new Error(`Budget with id ${budgetId} not found`);
    }

    const budget = budgets[0];
    const budgetAmount = parseFloat(budget.amount);

    await db.insert(notificationsTable)
      .values({
        user_id: userId,
        type: 'BUDGET_ALERT',
        title: 'Budget Alert',
        message: `You have used ${percentage}% of your budget (${budgetAmount}). Consider reviewing your spending.`
      })
      .execute();
  } catch (error) {
    console.error('Send budget alert failed:', error);
    throw error;
  }
}

export async function sendExpenseApprovalNotification(expenseId: number, managerId: number): Promise<void> {
  try {
    // Verify manager exists
    const managers = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, managerId))
      .execute();

    if (managers.length === 0) {
      throw new Error(`Manager with id ${managerId} not found`);
    }

    // Verify expense exists
    const expenses = await db.select()
      .from(expensesTable)
      .where(eq(expensesTable.id, expenseId))
      .execute();

    if (expenses.length === 0) {
      throw new Error(`Expense with id ${expenseId} not found`);
    }

    const expense = expenses[0];
    const expenseAmount = parseFloat(expense.amount);

    await db.insert(notificationsTable)
      .values({
        user_id: managerId,
        type: 'EXPENSE_APPROVAL',
        title: 'Expense Approval Required',
        message: `An expense "${expense.title}" of $${expenseAmount} requires your approval.`,
        related_expense_id: expenseId
      })
      .execute();
  } catch (error) {
    console.error('Send expense approval notification failed:', error);
    throw error;
  }
}

export async function sendExpenseReminderNotification(userId: number): Promise<void> {
  try {
    // Verify user exists
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (users.length === 0) {
      throw new Error(`User with id ${userId} not found`);
    }

    await db.insert(notificationsTable)
      .values({
        user_id: userId,
        type: 'EXPENSE_REMINDER',
        title: 'Expense Reminder',
        message: 'Don\'t forget to submit your recent expenses to keep your records up to date.'
      })
      .execute();
  } catch (error) {
    console.error('Send expense reminder notification failed:', error);
    throw error;
  }
}