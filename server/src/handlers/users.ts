import { db } from '../db';
import { usersTable } from '../db/schema';
import { type User, type UpdateUserInput } from '../schema';
import { eq } from 'drizzle-orm';

export async function getUsers(): Promise<User[]> {
  try {
    const results = await db.select()
      .from(usersTable)
      .execute();

    // Convert numeric fields back to numbers
    return results.map(user => ({
      ...user,
      id: user.id,
      created_at: user.created_at,
      updated_at: user.updated_at
    }));
  } catch (error) {
    console.error('Failed to fetch users:', error);
    throw error;
  }
}

export async function getUserById(id: number): Promise<User | null> {
  try {
    const results = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .execute();

    if (results.length === 0) {
      return null;
    }

    const user = results[0];
    return {
      ...user,
      id: user.id,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    console.error('Failed to fetch user by ID:', error);
    throw error;
  }
}

export async function updateUser(input: UpdateUserInput): Promise<User> {
  try {
    // Check if user exists first
    const existingUser = await getUserById(input.id);
    if (!existingUser) {
      throw new Error(`User with id ${input.id} not found`);
    }

    // Build update object with only provided fields
    const updateData: Partial<typeof usersTable.$inferInsert> = {
      updated_at: new Date()
    };

    if (input.email !== undefined) updateData.email = input.email;
    if (input.first_name !== undefined) updateData.first_name = input.first_name;
    if (input.last_name !== undefined) updateData.last_name = input.last_name;
    if (input.role !== undefined) updateData.role = input.role;
    if (input.profile_picture_url !== undefined) updateData.profile_picture_url = input.profile_picture_url;
    if (input.is_active !== undefined) updateData.is_active = input.is_active;

    const results = await db.update(usersTable)
      .set(updateData)
      .where(eq(usersTable.id, input.id))
      .returning()
      .execute();

    const user = results[0];
    return {
      ...user,
      id: user.id,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
  } catch (error) {
    console.error('Failed to update user:', error);
    throw error;
  }
}

export async function deleteUser(id: number): Promise<{ success: boolean }> {
  try {
    // Check if user exists first
    const existingUser = await getUserById(id);
    if (!existingUser) {
      return { success: false };
    }

    // Soft delete by setting is_active to false
    await db.update(usersTable)
      .set({ 
        is_active: false,
        updated_at: new Date()
      })
      .where(eq(usersTable.id, id))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Failed to delete user:', error);
    throw error;
  }
}

export async function getUserProfile(userId: number): Promise<User | null> {
  // This is essentially the same as getUserById
  return getUserById(userId);
}