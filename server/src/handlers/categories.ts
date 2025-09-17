import { db } from '../db';
import { categoriesTable, expensesTable } from '../db/schema';
import { type Category, type CreateCategoryInput, type UpdateCategoryInput } from '../schema';
import { eq, or, isNull, and, desc } from 'drizzle-orm';

export async function createCategory(input: CreateCategoryInput): Promise<Category> {
  try {
    const result = await db.insert(categoriesTable)
      .values({
        name: input.name,
        description: input.description || null,
        color: input.color,
        icon: input.icon || null,
        user_id: input.user_id || null
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Category creation failed:', error);
    throw error;
  }
}

export async function getCategories(userId?: number): Promise<Category[]> {
  try {
    let query = db.select()
      .from(categoriesTable)
      .orderBy(desc(categoriesTable.created_at));

    if (userId !== undefined) {
      // Get global categories (user_id is null) and user-specific categories
      const results = await query.where(
        or(
          isNull(categoriesTable.user_id),
          eq(categoriesTable.user_id, userId)
        )
      ).execute();
      return results;
    } else {
      // Get only global categories when no user ID provided
      const results = await query.where(isNull(categoriesTable.user_id)).execute();
      return results;
    }
  } catch (error) {
    console.error('Failed to fetch categories:', error);
    throw error;
  }
}

export async function getCategoryById(id: number): Promise<Category | null> {
  try {
    const results = await db.select()
      .from(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .execute();

    return results.length > 0 ? results[0] : null;
  } catch (error) {
    console.error('Failed to fetch category by ID:', error);
    throw error;
  }
}

export async function updateCategory(input: UpdateCategoryInput): Promise<Category> {
  try {
    // Build update object with only provided fields
    const updateData: Partial<typeof categoriesTable.$inferInsert> = {};
    
    if (input.name !== undefined) {
      updateData.name = input.name;
    }
    
    if (input.description !== undefined) {
      updateData.description = input.description;
    }
    
    if (input.color !== undefined) {
      updateData.color = input.color;
    }
    
    if (input.icon !== undefined) {
      updateData.icon = input.icon;
    }

    const result = await db.update(categoriesTable)
      .set(updateData)
      .where(eq(categoriesTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Category not found');
    }

    return result[0];
  } catch (error) {
    console.error('Category update failed:', error);
    throw error;
  }
}

export async function deleteCategory(id: number): Promise<{ success: boolean }> {
  try {
    // First check if category has any associated expenses
    const expenses = await db.select()
      .from(expensesTable)
      .where(eq(expensesTable.category_id, id))
      .limit(1)
      .execute();

    if (expenses.length > 0) {
      throw new Error('Cannot delete category with existing expenses');
    }

    const result = await db.delete(categoriesTable)
      .where(eq(categoriesTable.id, id))
      .returning()
      .execute();

    return { success: result.length > 0 };
  } catch (error) {
    console.error('Category deletion failed:', error);
    throw error;
  }
}

export async function getGlobalCategories(): Promise<Category[]> {
  try {
    const results = await db.select()
      .from(categoriesTable)
      .where(isNull(categoriesTable.user_id))
      .orderBy(desc(categoriesTable.created_at))
      .execute();

    return results;
  } catch (error) {
    console.error('Failed to fetch global categories:', error);
    throw error;
  }
}