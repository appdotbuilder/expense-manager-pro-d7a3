import { db } from '../db';
import { usersTable } from '../db/schema';
import { type CreateUserInput, type LoginInput, type User } from '../schema';
import { eq } from 'drizzle-orm';
import * as crypto from 'crypto';

const JWT_SECRET = process.env['JWT_SECRET'] || 'default-secret-key-for-testing';
const JWT_EXPIRES_IN = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Simple JWT implementation using Node.js crypto
function createJWT(payload: object, expiresInMs: number): string {
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

function verifyJWT(token: string): any {
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
  const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString());
  
  // Check expiration
  if (decodedPayload.exp && decodedPayload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('Token expired');
  }
  
  return decodedPayload;
}

// Password hashing using Node.js crypto
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password: string, hashedPassword: string): boolean {
  const [salt, hash] = hashedPassword.split(':');
  const verifyHash = crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
  return hash === verifyHash;
}

export async function registerUser(input: CreateUserInput): Promise<User> {
  try {
    // Check if user already exists
    const existingUser = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (existingUser.length > 0) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = hashPassword(input.password);

    // Insert new user
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        password_hash: passwordHash,
        first_name: input.first_name,
        last_name: input.last_name,
        role: input.role || 'USER',
        is_email_verified: false,
        is_active: true
      })
      .returning()
      .execute();

    const user = result[0];
    return {
      ...user,
      // No numeric conversion needed for user fields
    };
  } catch (error) {
    console.error('User registration failed:', error);
    throw error;
  }
}

export async function loginUser(input: LoginInput): Promise<{ user: User; token: string }> {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = verifyPassword(input.password, user.password_hash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const token = createJWT(
      { 
        userId: user.id, 
        email: user.email, 
        role: user.role 
      },
      JWT_EXPIRES_IN
    );

    return {
      user: {
        ...user,
        // No numeric conversion needed for user fields
      },
      token
    };
  } catch (error) {
    console.error('User login failed:', error);
    throw error;
  }
}

export async function verifyEmail(token: string): Promise<{ success: boolean }> {
  try {
    // Verify JWT token
    const decoded = verifyJWT(token);

    if (!decoded.userId) {
      throw new Error('Invalid token payload');
    }

    // Update user email verification status
    const result = await db.update(usersTable)
      .set({ 
        is_email_verified: true,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, decoded.userId))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('User not found');
    }

    return { success: true };
  } catch (error) {
    console.error('Email verification failed:', error);
    throw error;
  }
}

export async function resetPassword(email: string): Promise<{ success: boolean }> {
  try {
    // Check if user exists
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, email))
      .execute();

    if (users.length === 0) {
      throw new Error('User not found');
    }

    const user = users[0];

    // Check if user is active
    if (!user.is_active) {
      throw new Error('Account is deactivated');
    }

    // Generate reset token (in production, you would send this via email)
    const resetToken = createJWT(
      { userId: user.id, type: 'password-reset' },
      60 * 60 * 1000 // 1 hour
    );

    // In a real application, you would send this token via email
    // For now, we'll just return success
    console.log(`Password reset token for ${email}: ${resetToken}`);

    return { success: true };
  } catch (error) {
    console.error('Password reset failed:', error);
    throw error;
  }
}

export async function changePassword(userId: number, newPassword: string): Promise<{ success: boolean }> {
  try {
    // Hash new password
    const passwordHash = hashPassword(newPassword);

    // Update user password
    const result = await db.update(usersTable)
      .set({ 
        password_hash: passwordHash,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, userId))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('User not found');
    }

    return { success: true };
  } catch (error) {
    console.error('Password change failed:', error);
    throw error;
  }
}