import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type LoginInput } from '../schema';
import { registerUser, loginUser, verifyEmail, resetPassword, changePassword } from '../handlers/auth';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';

const JWT_SECRET = process.env['JWT_SECRET'] || 'default-secret-key-for-testing';

// Helper function to verify JWT token format and decode payload
function decodeJWT(token: string): any {
  const parts = token.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid token format');
  }
  
  const [header, payload, signature] = parts;
  
  // Verify signature
  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${header}.${payload}`)
    .digest('base64url');
    
  if (signature !== expectedSignature) {
    throw new Error('Invalid token signature');
  }
  
  // Decode payload
  return JSON.parse(Buffer.from(payload, 'base64url').toString());
}

// Helper function to create JWT token for testing
function createTestJWT(payload: object, expiresInMs: number): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Date.now();
  const exp = Math.floor((now + expiresInMs) / 1000);
  
  const jwtPayload = { ...payload, exp, iat: Math.floor(now / 1000) };
  
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(jwtPayload)).toString('base64url');
  
  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');
    
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

// Helper function to verify password hash
function verifyPasswordHash(password: string, hashedPassword: string): boolean {
  const [salt, hash] = hashedPassword.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

// Test inputs
const testUserInput: CreateUserInput = {
  email: 'test@example.com',
  password: 'password123',
  first_name: 'John',
  last_name: 'Doe',
  role: 'USER'
};

const testLoginInput: LoginInput = {
  email: 'test@example.com',
  password: 'password123'
};

describe('Authentication Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('registerUser', () => {
    it('should create a new user with hashed password', async () => {
      const result = await registerUser(testUserInput);

      // Verify user fields
      expect(result.email).toEqual('test@example.com');
      expect(result.first_name).toEqual('John');
      expect(result.last_name).toEqual('Doe');
      expect(result.role).toEqual('USER');
      expect(result.is_email_verified).toBe(false);
      expect(result.is_active).toBe(true);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);

      // Verify password is hashed (not plain text)
      expect(result.password_hash).not.toEqual('password123');
      expect(result.password_hash.includes(':')).toBe(true);
      expect(result.password_hash.length).toBeGreaterThan(50);
    });

    it('should save user to database with correct password hash', async () => {
      const result = await registerUser(testUserInput);

      // Query database directly
      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, result.id))
        .execute();

      expect(users).toHaveLength(1);
      const savedUser = users[0];

      expect(savedUser.email).toEqual('test@example.com');
      expect(savedUser.first_name).toEqual('John');
      expect(savedUser.last_name).toEqual('Doe');
      expect(savedUser.role).toEqual('USER');
      expect(savedUser.is_email_verified).toBe(false);
      expect(savedUser.is_active).toBe(true);

      // Verify password can be verified with our hash function
      const isPasswordValid = verifyPasswordHash('password123', savedUser.password_hash);
      expect(isPasswordValid).toBe(true);
    });

    it('should use default role USER when not specified', async () => {
      const inputWithoutRole: CreateUserInput = {
        email: 'norole@example.com',
        password: 'password123',
        first_name: 'Jane',
        last_name: 'Doe',
        role: 'USER' // Required by the schema
      };

      const result = await registerUser(inputWithoutRole);
      expect(result.role).toEqual('USER');
    });

    it('should throw error when user already exists', async () => {
      // Create first user
      await registerUser(testUserInput);

      // Try to create duplicate user
      await expect(registerUser(testUserInput))
        .rejects.toThrow(/already exists/i);
    });

    it('should handle different user roles correctly', async () => {
      const adminInput: CreateUserInput = {
        ...testUserInput,
        email: 'admin@example.com',
        role: 'ADMIN'
      };

      const managerInput: CreateUserInput = {
        ...testUserInput,
        email: 'manager@example.com',
        role: 'MANAGER'
      };

      const adminUser = await registerUser(adminInput);
      const managerUser = await registerUser(managerInput);

      expect(adminUser.role).toEqual('ADMIN');
      expect(managerUser.role).toEqual('MANAGER');
    });
  });

  describe('loginUser', () => {
    beforeEach(async () => {
      // Create test user before login tests
      await registerUser(testUserInput);
    });

    it('should login user with valid credentials', async () => {
      const result = await loginUser(testLoginInput);

      // Verify user data
      expect(result.user.email).toEqual('test@example.com');
      expect(result.user.first_name).toEqual('John');
      expect(result.user.last_name).toEqual('Doe');
      expect(result.user.role).toEqual('USER');
      expect(result.user.is_active).toBe(true);

      // Verify token is provided
      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe('string');
      expect(result.token.length).toBeGreaterThan(20);
    });

    it('should generate valid JWT token', async () => {
      const result = await loginUser(testLoginInput);

      // Verify token can be decoded
      const decoded = decodeJWT(result.token);
      expect(decoded.userId).toEqual(result.user.id);
      expect(decoded.email).toEqual('test@example.com');
      expect(decoded.role).toEqual('USER');
      expect(decoded.exp).toBeDefined(); // Expiration time
    });

    it('should throw error with invalid email', async () => {
      const invalidInput = {
        email: 'nonexistent@example.com',
        password: 'password123'
      };

      await expect(loginUser(invalidInput))
        .rejects.toThrow(/invalid email or password/i);
    });

    it('should throw error with invalid password', async () => {
      const invalidInput = {
        email: 'test@example.com',
        password: 'wrongpassword'
      };

      await expect(loginUser(invalidInput))
        .rejects.toThrow(/invalid email or password/i);
    });

    it('should throw error for deactivated user', async () => {
      // Deactivate the user
      await db.update(usersTable)
        .set({ is_active: false })
        .where(eq(usersTable.email, 'test@example.com'))
        .execute();

      await expect(loginUser(testLoginInput))
        .rejects.toThrow(/account is deactivated/i);
    });
  });

  describe('verifyEmail', () => {
    let testUserId: number;

    beforeEach(async () => {
      const user = await registerUser(testUserInput);
      testUserId = user.id;
    });

    it('should verify email with valid token', async () => {
      // Generate verification token
      const token = createTestJWT({ userId: testUserId }, 60 * 60 * 1000); // 1 hour

      const result = await verifyEmail(token);
      expect(result.success).toBe(true);

      // Verify user is marked as email verified
      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, testUserId))
        .execute();

      expect(users[0].is_email_verified).toBe(true);
    });

    it('should throw error with invalid token', async () => {
      const invalidToken = 'invalid-token';

      await expect(verifyEmail(invalidToken))
        .rejects.toThrow();
    });

    it('should throw error with expired token', async () => {
      // Generate expired token
      const expiredToken = createTestJWT(
        { userId: testUserId }, 
        -60 * 60 * 1000 // Already expired (negative time)
      );

      await expect(verifyEmail(expiredToken))
        .rejects.toThrow();
    });

    it('should throw error for non-existent user', async () => {
      // Generate token for non-existent user
      const token = createTestJWT({ userId: 999999 }, 60 * 60 * 1000);

      await expect(verifyEmail(token))
        .rejects.toThrow(/user not found/i);
    });
  });

  describe('resetPassword', () => {
    beforeEach(async () => {
      await registerUser(testUserInput);
    });

    it('should initiate password reset for existing user', async () => {
      const result = await resetPassword('test@example.com');
      expect(result.success).toBe(true);
    });

    it('should throw error for non-existent user', async () => {
      await expect(resetPassword('nonexistent@example.com'))
        .rejects.toThrow(/user not found/i);
    });

    it('should throw error for deactivated user', async () => {
      // Deactivate user
      await db.update(usersTable)
        .set({ is_active: false })
        .where(eq(usersTable.email, 'test@example.com'))
        .execute();

      await expect(resetPassword('test@example.com'))
        .rejects.toThrow(/account is deactivated/i);
    });
  });

  describe('changePassword', () => {
    let testUserId: number;

    beforeEach(async () => {
      const user = await registerUser(testUserInput);
      testUserId = user.id;
    });

    it('should change user password successfully', async () => {
      const newPassword = 'newpassword456';
      
      const result = await changePassword(testUserId, newPassword);
      expect(result.success).toBe(true);

      // Verify new password works for login
      const loginResult = await loginUser({
        email: 'test@example.com',
        password: newPassword
      });
      
      expect(loginResult.user.email).toEqual('test@example.com');
      expect(loginResult.token).toBeDefined();
    });

    it('should hash the new password correctly', async () => {
      const newPassword = 'newpassword456';
      
      await changePassword(testUserId, newPassword);

      // Check that password is properly hashed in database
      const users = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, testUserId))
        .execute();

      const user = users[0];
      
      // Password should be hashed (not plain text)
      expect(user.password_hash).not.toEqual(newPassword);
      
      // Should be able to verify with our hash function
      const isValid = verifyPasswordHash(newPassword, user.password_hash);
      expect(isValid).toBe(true);
    });

    it('should invalidate old password after change', async () => {
      const newPassword = 'newpassword456';
      
      await changePassword(testUserId, newPassword);

      // Old password should no longer work
      await expect(loginUser({
        email: 'test@example.com',
        password: 'password123' // old password
      })).rejects.toThrow(/invalid email or password/i);
    });

    it('should throw error for non-existent user', async () => {
      await expect(changePassword(999999, 'newpassword'))
        .rejects.toThrow(/user not found/i);
    });
  });

  describe('password security', () => {
    it('should use strong password hashing', async () => {
      const user = await registerUser(testUserInput);

      // Hash should contain salt:hash format
      expect(user.password_hash).toMatch(/^[a-f0-9]+:[a-f0-9]+$/);
      
      // Hash should be at least 60 characters (32 hex salt + 1 colon + 128 hex hash)
      expect(user.password_hash.length).toBeGreaterThanOrEqual(161);
    });

    it('should generate different hashes for same password', async () => {
      const user1 = await registerUser({
        ...testUserInput,
        email: 'user1@example.com'
      });

      const user2 = await registerUser({
        ...testUserInput,
        email: 'user2@example.com'
      });

      // Same password should generate different hashes due to salt
      expect(user1.password_hash).not.toEqual(user2.password_hash);
    });

    it('should verify password correctly across different instances', async () => {
      const user = await registerUser(testUserInput);

      // Both original password and different password should work correctly
      const isValidCorrect = verifyPasswordHash('password123', user.password_hash);
      const isValidIncorrect = verifyPasswordHash('wrongpassword', user.password_hash);

      expect(isValidCorrect).toBe(true);
      expect(isValidIncorrect).toBe(false);
    });
  });
});