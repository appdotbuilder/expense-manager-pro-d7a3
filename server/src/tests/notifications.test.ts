import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, categoriesTable, budgetsTable, expensesTable, notificationsTable } from '../db/schema';
import { type CreateNotificationInput } from '../schema';
import { eq, and } from 'drizzle-orm';
import {
  createNotification,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  deleteNotification,
  getUnreadNotificationCount,
  sendBudgetAlert,
  sendExpenseApprovalNotification,
  sendExpenseReminderNotification
} from '../handlers/notifications';

// Test data
const testUser = {
  email: 'test@example.com',
  password_hash: 'hashed_password',
  first_name: 'Test',
  last_name: 'User',
  role: 'USER' as const
};

const testManager = {
  email: 'manager@example.com',
  password_hash: 'hashed_password',
  first_name: 'Test',
  last_name: 'Manager',
  role: 'MANAGER' as const
};

const testCategory = {
  name: 'Test Category',
  color: '#FF5733',
  user_id: null
};

const testNotificationInput: CreateNotificationInput = {
  user_id: 1,
  type: 'SYSTEM_UPDATE',
  title: 'Test Notification',
  message: 'This is a test notification'
};

describe('Notification Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createNotification', () => {
    it('should create a notification successfully', async () => {
      // Create prerequisite user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();
      
      const userId = userResult[0].id;
      const input = { ...testNotificationInput, user_id: userId };

      const result = await createNotification(input);

      expect(result.user_id).toEqual(userId);
      expect(result.type).toEqual('SYSTEM_UPDATE');
      expect(result.title).toEqual('Test Notification');
      expect(result.message).toEqual('This is a test notification');
      expect(result.is_read).toEqual(false);
      expect(result.related_expense_id).toBeNull();
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
    });

    it('should create notification with related expense', async () => {
      // Create prerequisites
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      const categoryResult = await db.insert(categoriesTable)
        .values(testCategory)
        .returning()
        .execute();

      const expenseResult = await db.insert(expensesTable)
        .values({
          user_id: userResult[0].id,
          category_id: categoryResult[0].id,
          title: 'Test Expense',
          amount: '100.00',
          expense_date: new Date().toISOString().split('T')[0]
        })
        .returning()
        .execute();

      const input: CreateNotificationInput = {
        user_id: userResult[0].id,
        type: 'EXPENSE_APPROVAL',
        title: 'Expense Needs Approval',
        message: 'Please review the expense',
        related_expense_id: expenseResult[0].id
      };

      const result = await createNotification(input);

      expect(result.related_expense_id).toEqual(expenseResult[0].id);
      expect(result.type).toEqual('EXPENSE_APPROVAL');
    });

    it('should throw error for non-existent user', async () => {
      const input = { ...testNotificationInput, user_id: 999 };

      expect(createNotification(input)).rejects.toThrow(/User with id 999 not found/i);
    });

    it('should throw error for non-existent expense', async () => {
      // Create user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      const input: CreateNotificationInput = {
        user_id: userResult[0].id,
        type: 'EXPENSE_APPROVAL',
        title: 'Test',
        message: 'Test message',
        related_expense_id: 999
      };

      expect(createNotification(input)).rejects.toThrow(/Expense with id 999 not found/i);
    });

    it('should save notification to database', async () => {
      // Create user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      const userId = userResult[0].id;
      const input = { ...testNotificationInput, user_id: userId };

      const result = await createNotification(input);

      // Verify in database
      const notifications = await db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.id, result.id))
        .execute();

      expect(notifications).toHaveLength(1);
      expect(notifications[0].user_id).toEqual(userId);
      expect(notifications[0].title).toEqual('Test Notification');
      expect(notifications[0].is_read).toEqual(false);
    });
  });

  describe('getNotifications', () => {
    it('should get all notifications for a user', async () => {
      // Create user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      const userId = userResult[0].id;

      // Create multiple notifications
      await createNotification({ ...testNotificationInput, user_id: userId, title: 'First Notification' });
      await createNotification({ ...testNotificationInput, user_id: userId, title: 'Second Notification' });

      const notifications = await getNotifications(userId);

      expect(notifications).toHaveLength(2);
      expect(notifications[0].title).toEqual('First Notification');
      expect(notifications[1].title).toEqual('Second Notification');
      expect(notifications.every(n => n.user_id === userId)).toBe(true);
    });

    it('should return empty array for user with no notifications', async () => {
      // Create user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      const notifications = await getNotifications(userResult[0].id);

      expect(notifications).toHaveLength(0);
    });

    it('should throw error for non-existent user', async () => {
      expect(getNotifications(999)).rejects.toThrow(/User with id 999 not found/i);
    });
  });

  describe('markNotificationAsRead', () => {
    it('should mark notification as read', async () => {
      // Create user and notification
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      const notification = await createNotification({ ...testNotificationInput, user_id: userResult[0].id });

      const result = await markNotificationAsRead(notification.id);

      expect(result.success).toBe(true);

      // Verify in database
      const updated = await db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.id, notification.id))
        .execute();

      expect(updated[0].is_read).toBe(true);
    });

    it('should throw error for non-existent notification', async () => {
      expect(markNotificationAsRead(999)).rejects.toThrow(/Notification with id 999 not found/i);
    });
  });

  describe('markAllNotificationsAsRead', () => {
    it('should mark all unread notifications as read', async () => {
      // Create user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      const userId = userResult[0].id;

      // Create multiple notifications
      await createNotification({ ...testNotificationInput, user_id: userId, title: 'First' });
      await createNotification({ ...testNotificationInput, user_id: userId, title: 'Second' });

      const result = await markAllNotificationsAsRead(userId);

      expect(result.success).toBe(true);

      // Verify all are read
      const notifications = await db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.user_id, userId))
        .execute();

      expect(notifications.every(n => n.is_read === true)).toBe(true);
    });

    it('should throw error for non-existent user', async () => {
      expect(markAllNotificationsAsRead(999)).rejects.toThrow(/User with id 999 not found/i);
    });
  });

  describe('deleteNotification', () => {
    it('should delete notification successfully', async () => {
      // Create user and notification
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      const notification = await createNotification({ ...testNotificationInput, user_id: userResult[0].id });

      const result = await deleteNotification(notification.id);

      expect(result.success).toBe(true);

      // Verify deletion
      const deleted = await db.select()
        .from(notificationsTable)
        .where(eq(notificationsTable.id, notification.id))
        .execute();

      expect(deleted).toHaveLength(0);
    });

    it('should throw error for non-existent notification', async () => {
      expect(deleteNotification(999)).rejects.toThrow(/Notification with id 999 not found/i);
    });
  });

  describe('getUnreadNotificationCount', () => {
    it('should return correct unread count', async () => {
      // Create user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      const userId = userResult[0].id;

      // Create notifications (all unread by default)
      await createNotification({ ...testNotificationInput, user_id: userId, title: 'First' });
      await createNotification({ ...testNotificationInput, user_id: userId, title: 'Second' });
      const thirdNotification = await createNotification({ ...testNotificationInput, user_id: userId, title: 'Third' });

      // Mark one as read
      await markNotificationAsRead(thirdNotification.id);

      const result = await getUnreadNotificationCount(userId);

      expect(result.count).toEqual(2);
    });

    it('should return zero for user with no notifications', async () => {
      // Create user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      const result = await getUnreadNotificationCount(userResult[0].id);

      expect(result.count).toEqual(0);
    });

    it('should throw error for non-existent user', async () => {
      expect(getUnreadNotificationCount(999)).rejects.toThrow(/User with id 999 not found/i);
    });
  });

  describe('sendBudgetAlert', () => {
    it('should create budget alert notification', async () => {
      // Create user and budget
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      const budgetResult = await db.insert(budgetsTable)
        .values({
          user_id: userResult[0].id,
          amount: '1000.00',
          period: 'MONTHLY',
          start_date: new Date().toISOString().split('T')[0],
          end_date: new Date().toISOString().split('T')[0]
        })
        .returning()
        .execute();

      await sendBudgetAlert(userResult[0].id, budgetResult[0].id, 85);

      // Verify notification was created
      const notifications = await db.select()
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.user_id, userResult[0].id),
            eq(notificationsTable.type, 'BUDGET_ALERT')
          )
        )
        .execute();

      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toEqual('Budget Alert');
      expect(notifications[0].message).toContain('85%');
      expect(notifications[0].message).toContain('1000');
    });

    it('should throw error for non-existent user', async () => {
      expect(sendBudgetAlert(999, 1, 80)).rejects.toThrow(/User with id 999 not found/i);
    });

    it('should throw error for non-existent budget', async () => {
      // Create user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      expect(sendBudgetAlert(userResult[0].id, 999, 80)).rejects.toThrow(/Budget with id 999 not found/i);
    });
  });

  describe('sendExpenseApprovalNotification', () => {
    it('should create expense approval notification', async () => {
      // Create manager and user
      const managerResult = await db.insert(usersTable)
        .values(testManager)
        .returning()
        .execute();

      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      // Create category and expense
      const categoryResult = await db.insert(categoriesTable)
        .values(testCategory)
        .returning()
        .execute();

      const expenseResult = await db.insert(expensesTable)
        .values({
          user_id: userResult[0].id,
          category_id: categoryResult[0].id,
          title: 'Business Lunch',
          amount: '50.00',
          expense_date: new Date().toISOString().split('T')[0]
        })
        .returning()
        .execute();

      await sendExpenseApprovalNotification(expenseResult[0].id, managerResult[0].id);

      // Verify notification was created
      const notifications = await db.select()
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.user_id, managerResult[0].id),
            eq(notificationsTable.type, 'EXPENSE_APPROVAL')
          )
        )
        .execute();

      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toEqual('Expense Approval Required');
      expect(notifications[0].message).toContain('Business Lunch');
      expect(notifications[0].message).toContain('50');
      expect(notifications[0].related_expense_id).toEqual(expenseResult[0].id);
    });

    it('should throw error for non-existent manager', async () => {
      expect(sendExpenseApprovalNotification(1, 999)).rejects.toThrow(/Manager with id 999 not found/i);
    });

    it('should throw error for non-existent expense', async () => {
      // Create manager
      const managerResult = await db.insert(usersTable)
        .values(testManager)
        .returning()
        .execute();

      expect(sendExpenseApprovalNotification(999, managerResult[0].id)).rejects.toThrow(/Expense with id 999 not found/i);
    });
  });

  describe('sendExpenseReminderNotification', () => {
    it('should create expense reminder notification', async () => {
      // Create user
      const userResult = await db.insert(usersTable)
        .values(testUser)
        .returning()
        .execute();

      await sendExpenseReminderNotification(userResult[0].id);

      // Verify notification was created
      const notifications = await db.select()
        .from(notificationsTable)
        .where(
          and(
            eq(notificationsTable.user_id, userResult[0].id),
            eq(notificationsTable.type, 'EXPENSE_REMINDER')
          )
        )
        .execute();

      expect(notifications).toHaveLength(1);
      expect(notifications[0].title).toEqual('Expense Reminder');
      expect(notifications[0].message).toContain('submit your recent expenses');
    });

    it('should throw error for non-existent user', async () => {
      expect(sendExpenseReminderNotification(999)).rejects.toThrow(/User with id 999 not found/i);
    });
  });
});