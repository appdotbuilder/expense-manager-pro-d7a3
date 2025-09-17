import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { categoriesTable, usersTable, expensesTable } from '../db/schema';
import { type CreateCategoryInput, type UpdateCategoryInput } from '../schema';
import { 
  createCategory, 
  getCategories, 
  getCategoryById, 
  updateCategory, 
  deleteCategory, 
  getGlobalCategories 
} from '../handlers/categories';
import { eq } from 'drizzle-orm';

// Test input data
const testGlobalCategory: CreateCategoryInput = {
  name: 'Travel',
  description: 'Travel and transportation expenses',
  color: '#3b82f6',
  icon: 'plane'
};

const testUserCategory: CreateCategoryInput = {
  name: 'Personal',
  description: 'Personal expenses',
  color: '#ef4444',
  icon: 'user',
  user_id: 1
};

describe('Category Handlers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  describe('createCategory', () => {
    it('should create a global category', async () => {
      const result = await createCategory(testGlobalCategory);

      expect(result.name).toEqual('Travel');
      expect(result.description).toEqual('Travel and transportation expenses');
      expect(result.color).toEqual('#3b82f6');
      expect(result.icon).toEqual('plane');
      expect(result.user_id).toBeNull();
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create a user-specific category', async () => {
      // Create a test user first
      const user = await db.insert(usersTable)
        .values({
          email: 'test@example.com',
          password_hash: 'hashed_password',
          first_name: 'Test',
          last_name: 'User',
          role: 'USER'
        })
        .returning()
        .execute();

      const categoryWithUser = { ...testUserCategory, user_id: user[0].id };
      const result = await createCategory(categoryWithUser);

      expect(result.name).toEqual('Personal');
      expect(result.user_id).toEqual(user[0].id);
      expect(result.id).toBeDefined();
    });

    it('should save category to database', async () => {
      const result = await createCategory(testGlobalCategory);

      const categories = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, result.id))
        .execute();

      expect(categories).toHaveLength(1);
      expect(categories[0].name).toEqual('Travel');
      expect(categories[0].color).toEqual('#3b82f6');
    });

    it('should handle nullable fields correctly', async () => {
      const minimalCategory: CreateCategoryInput = {
        name: 'Minimal Category',
        color: '#000000'
      };

      const result = await createCategory(minimalCategory);

      expect(result.name).toEqual('Minimal Category');
      expect(result.description).toBeNull();
      expect(result.icon).toBeNull();
      expect(result.user_id).toBeNull();
    });
  });

  describe('getCategories', () => {
    beforeEach(async () => {
      // Create test user
      await db.insert(usersTable)
        .values({
          id: 1,
          email: 'test@example.com',
          password_hash: 'hashed_password',
          first_name: 'Test',
          last_name: 'User',
          role: 'USER'
        })
        .execute();

      // Create test categories
      await createCategory(testGlobalCategory);
      await createCategory(testUserCategory);
    });

    it('should return global and user-specific categories for a user', async () => {
      const result = await getCategories(1);

      expect(result).toHaveLength(2);
      expect(result.some(cat => cat.name === 'Travel' && cat.user_id === null)).toBe(true);
      expect(result.some(cat => cat.name === 'Personal' && cat.user_id === 1)).toBe(true);
    });

    it('should return only global categories when no user ID provided', async () => {
      const result = await getCategories();

      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('Travel');
      expect(result[0].user_id).toBeNull();
    });

    it('should return categories ordered by creation date (newest first)', async () => {
      // Create additional category with slight delay
      await new Promise(resolve => setTimeout(resolve, 10));
      const newerCategory: CreateCategoryInput = {
        name: 'Newer Category',
        color: '#10b981'
      };
      await createCategory(newerCategory);

      const result = await getCategories();
      expect(result).toHaveLength(2);
      expect(result[0].name).toEqual('Newer Category'); // Should be first (newest)
      expect(result[1].name).toEqual('Travel');
    });
  });

  describe('getCategoryById', () => {
    it('should return category when found', async () => {
      const created = await createCategory(testGlobalCategory);
      const result = await getCategoryById(created.id);

      expect(result).not.toBeNull();
      expect(result!.name).toEqual('Travel');
      expect(result!.id).toEqual(created.id);
    });

    it('should return null when category not found', async () => {
      const result = await getCategoryById(999);
      expect(result).toBeNull();
    });
  });

  describe('updateCategory', () => {
    it('should update category fields', async () => {
      const created = await createCategory(testGlobalCategory);
      
      const updateInput: UpdateCategoryInput = {
        id: created.id,
        name: 'Updated Travel',
        description: 'Updated description',
        color: '#06b6d4'
      };

      const result = await updateCategory(updateInput);

      expect(result.name).toEqual('Updated Travel');
      expect(result.description).toEqual('Updated description');
      expect(result.color).toEqual('#06b6d4');
      expect(result.icon).toEqual('plane'); // Should remain unchanged
    });

    it('should update only provided fields', async () => {
      const created = await createCategory(testGlobalCategory);
      
      const updateInput: UpdateCategoryInput = {
        id: created.id,
        name: 'Only Name Updated'
      };

      const result = await updateCategory(updateInput);

      expect(result.name).toEqual('Only Name Updated');
      expect(result.description).toEqual('Travel and transportation expenses'); // Unchanged
      expect(result.color).toEqual('#3b82f6'); // Unchanged
    });

    it('should throw error when category not found', async () => {
      const updateInput: UpdateCategoryInput = {
        id: 999,
        name: 'Non-existent'
      };

      expect(updateCategory(updateInput)).rejects.toThrow(/Category not found/i);
    });

    it('should save updates to database', async () => {
      const created = await createCategory(testGlobalCategory);
      
      const updateInput: UpdateCategoryInput = {
        id: created.id,
        name: 'Database Updated'
      };

      await updateCategory(updateInput);

      const dbCategory = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.id, created.id))
        .execute();

      expect(dbCategory[0].name).toEqual('Database Updated');
    });
  });

  describe('deleteCategory', () => {
    it('should delete category when no expenses exist', async () => {
      const created = await createCategory(testGlobalCategory);
      
      const result = await deleteCategory(created.id);
      expect(result.success).toBe(true);

      const dbCategory = await getCategoryById(created.id);
      expect(dbCategory).toBeNull();
    });

    it('should throw error when category has associated expenses', async () => {
      // Create prerequisite data
      const user = await db.insert(usersTable)
        .values({
          email: 'test@example.com',
          password_hash: 'hashed_password',
          first_name: 'Test',
          last_name: 'User',
          role: 'USER'
        })
        .returning()
        .execute();

      const category = await createCategory(testGlobalCategory);

      // Create an expense with this category
      await db.insert(expensesTable)
        .values({
          user_id: user[0].id,
          category_id: category.id,
          title: 'Test Expense',
          amount: '100.00',
          expense_date: '2024-01-01',
          tags: []
        })
        .execute();

      expect(deleteCategory(category.id)).rejects.toThrow(/Cannot delete category with existing expenses/i);
    });

    it('should return false when category not found', async () => {
      const result = await deleteCategory(999);
      expect(result.success).toBe(false);
    });
  });

  describe('getGlobalCategories', () => {
    beforeEach(async () => {
      // Create test user
      await db.insert(usersTable)
        .values({
          id: 1,
          email: 'test@example.com',
          password_hash: 'hashed_password',
          first_name: 'Test',
          last_name: 'User',
          role: 'USER'
        })
        .execute();

      // Create both global and user-specific categories
      await createCategory(testGlobalCategory);
      await createCategory(testUserCategory);
    });

    it('should return only global categories', async () => {
      const result = await getGlobalCategories();

      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('Travel');
      expect(result[0].user_id).toBeNull();
    });

    it('should return empty array when no global categories exist', async () => {
      // Delete the global category
      const globalCat = await db.select()
        .from(categoriesTable)
        .where(eq(categoriesTable.name, 'Travel'))
        .execute();
      
      await db.delete(categoriesTable)
        .where(eq(categoriesTable.id, globalCat[0].id))
        .execute();

      const result = await getGlobalCategories();
      expect(result).toHaveLength(0);
    });
  });
});