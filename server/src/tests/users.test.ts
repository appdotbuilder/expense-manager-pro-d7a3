import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type UpdateUserInput } from '../schema';
import { getUsers, getUserById, updateUser, deleteUser, getUserProfile } from '../handlers/users';
import { eq } from 'drizzle-orm';
// Using built-in crypto for test password hashing
const hashPassword = (password: string) => 
  Buffer.from(password + 'test-salt').toString('base64');

// Test data setup
const createTestUser = async (overrides: Partial<typeof usersTable.$inferInsert> = {}) => {
  const defaultUser = {
    email: 'test@example.com',
    password_hash: hashPassword('password123'),
    first_name: 'John',
    last_name: 'Doe',
    role: 'USER' as const,
    is_email_verified: true,
    is_active: true
  };

  const result = await db.insert(usersTable)
    .values({ ...defaultUser, ...overrides })
    .returning()
    .execute();

  return result[0];
};

describe('User Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('getUsers', () => {
    it('should return empty array when no users exist', async () => {
      const users = await getUsers();
      expect(users).toEqual([]);
    });

    it('should return all users', async () => {
      // Create test users
      await createTestUser({ email: 'user1@example.com', first_name: 'Alice' });
      await createTestUser({ email: 'user2@example.com', first_name: 'Bob', role: 'ADMIN' });
      await createTestUser({ email: 'user3@example.com', first_name: 'Charlie', is_active: false });

      const users = await getUsers();

      expect(users).toHaveLength(3);
      expect(users[0].email).toBe('user1@example.com');
      expect(users[0].first_name).toBe('Alice');
      expect(users[0].role).toBe('USER');
      expect(users[0].is_active).toBe(true);
      expect(users[0].created_at).toBeInstanceOf(Date);
      expect(users[0].updated_at).toBeInstanceOf(Date);

      expect(users[1].first_name).toBe('Bob');
      expect(users[1].role).toBe('ADMIN');

      expect(users[2].first_name).toBe('Charlie');
      expect(users[2].is_active).toBe(false);
    });
  });

  describe('getUserById', () => {
    it('should return null for non-existent user', async () => {
      const user = await getUserById(999);
      expect(user).toBeNull();
    });

    it('should return user by id', async () => {
      const testUser = await createTestUser({
        email: 'specific@example.com',
        first_name: 'Specific',
        last_name: 'User',
        role: 'MANAGER'
      });

      const user = await getUserById(testUser.id);

      expect(user).not.toBeNull();
      expect(user!.id).toBe(testUser.id);
      expect(user!.email).toBe('specific@example.com');
      expect(user!.first_name).toBe('Specific');
      expect(user!.last_name).toBe('User');
      expect(user!.role).toBe('MANAGER');
      expect(user!.created_at).toBeInstanceOf(Date);
      expect(user!.updated_at).toBeInstanceOf(Date);
    });
  });

  describe('updateUser', () => {
    it('should throw error for non-existent user', async () => {
      const updateInput: UpdateUserInput = {
        id: 999,
        first_name: 'Updated'
      };

      await expect(updateUser(updateInput)).rejects.toThrow(/not found/i);
    });

    it('should update user with all fields', async () => {
      const testUser = await createTestUser();

      const updateInput: UpdateUserInput = {
        id: testUser.id,
        email: 'updated@example.com',
        first_name: 'Updated',
        last_name: 'Name',
        role: 'ADMIN',
        profile_picture_url: 'https://example.com/avatar.jpg',
        is_active: false
      };

      const updatedUser = await updateUser(updateInput);

      expect(updatedUser.id).toBe(testUser.id);
      expect(updatedUser.email).toBe('updated@example.com');
      expect(updatedUser.first_name).toBe('Updated');
      expect(updatedUser.last_name).toBe('Name');
      expect(updatedUser.role).toBe('ADMIN');
      expect(updatedUser.profile_picture_url).toBe('https://example.com/avatar.jpg');
      expect(updatedUser.is_active).toBe(false);
      expect(updatedUser.updated_at).toBeInstanceOf(Date);
      expect(updatedUser.updated_at.getTime()).toBeGreaterThan(testUser.updated_at.getTime());
    });

    it('should update user with partial fields', async () => {
      const testUser = await createTestUser({
        first_name: 'Original',
        last_name: 'Name'
      });

      const updateInput: UpdateUserInput = {
        id: testUser.id,
        first_name: 'PartialUpdate'
      };

      const updatedUser = await updateUser(updateInput);

      expect(updatedUser.first_name).toBe('PartialUpdate');
      expect(updatedUser.last_name).toBe('Name'); // Should remain unchanged
      expect(updatedUser.email).toBe(testUser.email); // Should remain unchanged
    });

    it('should update user with null profile_picture_url', async () => {
      const testUser = await createTestUser({
        profile_picture_url: 'https://old-avatar.com/pic.jpg'
      });

      const updateInput: UpdateUserInput = {
        id: testUser.id,
        profile_picture_url: null
      };

      const updatedUser = await updateUser(updateInput);

      expect(updatedUser.profile_picture_url).toBeNull();
    });

    it('should persist changes to database', async () => {
      const testUser = await createTestUser();

      const updateInput: UpdateUserInput = {
        id: testUser.id,
        first_name: 'DatabaseTest',
        role: 'MANAGER'
      };

      await updateUser(updateInput);

      // Verify changes persisted to database
      const dbUsers = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, testUser.id))
        .execute();

      expect(dbUsers).toHaveLength(1);
      expect(dbUsers[0].first_name).toBe('DatabaseTest');
      expect(dbUsers[0].role).toBe('MANAGER');
    });
  });

  describe('deleteUser', () => {
    it('should return false for non-existent user', async () => {
      const result = await deleteUser(999);
      expect(result.success).toBe(false);
    });

    it('should soft delete user by setting is_active to false', async () => {
      const testUser = await createTestUser({ is_active: true });

      const result = await deleteUser(testUser.id);

      expect(result.success).toBe(true);

      // Verify user is soft deleted in database
      const dbUsers = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, testUser.id))
        .execute();

      expect(dbUsers).toHaveLength(1);
      expect(dbUsers[0].is_active).toBe(false);
      expect(dbUsers[0].updated_at.getTime()).toBeGreaterThan(testUser.updated_at.getTime());
    });

    it('should handle already inactive user', async () => {
      const testUser = await createTestUser({ is_active: false });

      const result = await deleteUser(testUser.id);

      expect(result.success).toBe(true);

      // Verify user remains inactive
      const dbUsers = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, testUser.id))
        .execute();

      expect(dbUsers).toHaveLength(1);
      expect(dbUsers[0].is_active).toBe(false);
    });
  });

  describe('getUserProfile', () => {
    it('should return null for non-existent user', async () => {
      const user = await getUserProfile(999);
      expect(user).toBeNull();
    });

    it('should return user profile by id', async () => {
      const testUser = await createTestUser({
        email: 'profile@example.com',
        first_name: 'Profile',
        last_name: 'User'
      });

      const user = await getUserProfile(testUser.id);

      expect(user).not.toBeNull();
      expect(user!.id).toBe(testUser.id);
      expect(user!.email).toBe('profile@example.com');
      expect(user!.first_name).toBe('Profile');
      expect(user!.last_name).toBe('User');
      expect(user!.created_at).toBeInstanceOf(Date);
      expect(user!.updated_at).toBeInstanceOf(Date);
    });

    it('should work identically to getUserById', async () => {
      const testUser = await createTestUser();

      const profileResult = await getUserProfile(testUser.id);
      const byIdResult = await getUserById(testUser.id);

      expect(profileResult).toEqual(byIdResult);
    });
  });

  describe('Edge cases and data integrity', () => {
    it('should handle users with various role types', async () => {
      const adminUser = await createTestUser({ role: 'ADMIN' });
      const managerUser = await createTestUser({ role: 'MANAGER', email: 'manager@test.com' });
      const regularUser = await createTestUser({ role: 'USER', email: 'user@test.com' });

      const users = await getUsers();
      const roles = users.map(u => u.role).sort();
      
      expect(roles).toEqual(['ADMIN', 'MANAGER', 'USER']);
    });

    it('should handle nullable fields correctly', async () => {
      const userWithNulls = await createTestUser({
        profile_picture_url: null
      });

      const retrievedUser = await getUserById(userWithNulls.id);

      expect(retrievedUser!.profile_picture_url).toBeNull();
    });

    it('should maintain data consistency across operations', async () => {
      // Create user
      const testUser = await createTestUser({
        email: 'consistency@test.com',
        first_name: 'Consistency'
      });

      // Update user
      await updateUser({
        id: testUser.id,
        last_name: 'Updated'
      });

      // Retrieve via different methods
      const byId = await getUserById(testUser.id);
      const byProfile = await getUserProfile(testUser.id);
      const allUsers = await getUsers();
      const foundInAll = allUsers.find(u => u.id === testUser.id) || null;

      // All should return same data
      expect(byId).toEqual(byProfile);
      expect(byId).toEqual(foundInAll);
      expect(byId!.last_name).toBe('Updated');
      expect(byId!.first_name).toBe('Consistency'); // Should remain unchanged
    });
  });
});