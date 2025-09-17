import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, teamsTable, teamMembersTable } from '../db/schema';
import { type CreateTeamInput, type UpdateTeamInput } from '../schema';
import { 
  createTeam, 
  getTeams, 
  getTeamById, 
  updateTeam, 
  deleteTeam, 
  addTeamMember, 
  removeTeamMember, 
  getTeamMembers 
} from '../handlers/teams';
import { eq, and } from 'drizzle-orm';

// Test data
const testManager = {
  email: 'manager@test.com',
  password_hash: 'hashed_password',
  first_name: 'John',
  last_name: 'Manager',
  role: 'MANAGER' as const
};

const testUser = {
  email: 'user@test.com',
  password_hash: 'hashed_password',
  first_name: 'Jane',
  last_name: 'User',
  role: 'USER' as const
};

const testTeamInput: CreateTeamInput = {
  name: 'Development Team',
  description: 'Main development team',
  manager_id: 1 // Will be set after user creation
};

describe('Team Handlers', () => {
  let managerId: number;
  let userId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test users
    const managers = await db.insert(usersTable)
      .values(testManager)
      .returning()
      .execute();
    managerId = managers[0].id;

    const users = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    userId = users[0].id;
  });

  afterEach(resetDB);

  describe('createTeam', () => {
    it('should create a team successfully', async () => {
      const input = { ...testTeamInput, manager_id: managerId };
      const result = await createTeam(input);

      expect(result.name).toEqual('Development Team');
      expect(result.description).toEqual('Main development team');
      expect(result.manager_id).toEqual(managerId);
      expect(result.id).toBeDefined();
      expect(result.created_at).toBeInstanceOf(Date);
      expect(result.updated_at).toBeInstanceOf(Date);
    });

    it('should create a team without description', async () => {
      const input = { 
        name: 'Simple Team',
        manager_id: managerId
      };
      const result = await createTeam(input);

      expect(result.name).toEqual('Simple Team');
      expect(result.description).toBeNull();
      expect(result.manager_id).toEqual(managerId);
    });

    it('should save team to database', async () => {
      const input = { ...testTeamInput, manager_id: managerId };
      const result = await createTeam(input);

      const teams = await db.select()
        .from(teamsTable)
        .where(eq(teamsTable.id, result.id))
        .execute();

      expect(teams).toHaveLength(1);
      expect(teams[0].name).toEqual('Development Team');
      expect(teams[0].manager_id).toEqual(managerId);
    });

    it('should throw error for non-existent manager', async () => {
      const input = { ...testTeamInput, manager_id: 999 };

      await expect(createTeam(input)).rejects.toThrow(/manager not found/i);
    });
  });

  describe('getTeams', () => {
    it('should return empty array when no teams exist', async () => {
      const result = await getTeams();
      expect(result).toEqual([]);
    });

    it('should return all teams', async () => {
      // Create multiple teams
      await createTeam({ name: 'Team 1', manager_id: managerId });
      await createTeam({ name: 'Team 2', description: 'Second team', manager_id: managerId });

      const result = await getTeams();

      expect(result).toHaveLength(2);
      expect(result[0].name).toEqual('Team 1');
      expect(result[1].name).toEqual('Team 2');
      expect(result[1].description).toEqual('Second team');
    });
  });

  describe('getTeamById', () => {
    it('should return team when found', async () => {
      const created = await createTeam({ ...testTeamInput, manager_id: managerId });
      const result = await getTeamById(created.id);

      expect(result).not.toBeNull();
      expect(result!.name).toEqual('Development Team');
      expect(result!.manager_id).toEqual(managerId);
    });

    it('should return null when team not found', async () => {
      const result = await getTeamById(999);
      expect(result).toBeNull();
    });
  });

  describe('updateTeam', () => {
    let teamId: number;

    beforeEach(async () => {
      const team = await createTeam({ ...testTeamInput, manager_id: managerId });
      teamId = team.id;
    });

    it('should update team name', async () => {
      const input: UpdateTeamInput = {
        id: teamId,
        name: 'Updated Team Name'
      };
      const result = await updateTeam(input);

      expect(result.name).toEqual('Updated Team Name');
      expect(result.manager_id).toEqual(managerId);
      expect(result.description).toEqual('Main development team');
    });

    it('should update team description', async () => {
      const input: UpdateTeamInput = {
        id: teamId,
        description: 'Updated description'
      };
      const result = await updateTeam(input);

      expect(result.description).toEqual('Updated description');
      expect(result.name).toEqual('Development Team');
    });

    it('should update manager', async () => {
      const input: UpdateTeamInput = {
        id: teamId,
        manager_id: userId
      };
      const result = await updateTeam(input);

      expect(result.manager_id).toEqual(userId);
      expect(result.name).toEqual('Development Team');
    });

    it('should update multiple fields', async () => {
      const input: UpdateTeamInput = {
        id: teamId,
        name: 'New Name',
        description: 'New Description',
        manager_id: userId
      };
      const result = await updateTeam(input);

      expect(result.name).toEqual('New Name');
      expect(result.description).toEqual('New Description');
      expect(result.manager_id).toEqual(userId);
    });

    it('should throw error for non-existent team', async () => {
      const input: UpdateTeamInput = {
        id: 999,
        name: 'Updated Name'
      };

      await expect(updateTeam(input)).rejects.toThrow(/team not found/i);
    });

    it('should throw error for non-existent manager', async () => {
      const input: UpdateTeamInput = {
        id: teamId,
        manager_id: 999
      };

      await expect(updateTeam(input)).rejects.toThrow(/manager not found/i);
    });
  });

  describe('deleteTeam', () => {
    it('should delete existing team', async () => {
      const team = await createTeam({ ...testTeamInput, manager_id: managerId });
      const result = await deleteTeam(team.id);

      expect(result.success).toBe(true);

      // Verify team is deleted from database
      const teams = await db.select()
        .from(teamsTable)
        .where(eq(teamsTable.id, team.id))
        .execute();

      expect(teams).toHaveLength(0);
    });

    it('should throw error for non-existent team', async () => {
      await expect(deleteTeam(999)).rejects.toThrow(/team not found/i);
    });

    it('should cascade delete team members', async () => {
      const team = await createTeam({ ...testTeamInput, manager_id: managerId });
      await addTeamMember(team.id, userId);

      // Verify member exists
      const membersBefore = await db.select()
        .from(teamMembersTable)
        .where(eq(teamMembersTable.team_id, team.id))
        .execute();
      expect(membersBefore).toHaveLength(1);

      // Delete team
      await deleteTeam(team.id);

      // Verify team members are also deleted
      const membersAfter = await db.select()
        .from(teamMembersTable)
        .where(eq(teamMembersTable.team_id, team.id))
        .execute();
      expect(membersAfter).toHaveLength(0);
    });
  });

  describe('addTeamMember', () => {
    let teamId: number;

    beforeEach(async () => {
      const team = await createTeam({ ...testTeamInput, manager_id: managerId });
      teamId = team.id;
    });

    it('should add team member successfully', async () => {
      const result = await addTeamMember(teamId, userId);

      expect(result.team_id).toEqual(teamId);
      expect(result.user_id).toEqual(userId);
      expect(result.id).toBeDefined();
      expect(result.joined_at).toBeInstanceOf(Date);
    });

    it('should save team member to database', async () => {
      await addTeamMember(teamId, userId);

      const members = await db.select()
        .from(teamMembersTable)
        .where(and(
          eq(teamMembersTable.team_id, teamId),
          eq(teamMembersTable.user_id, userId)
        ))
        .execute();

      expect(members).toHaveLength(1);
      expect(members[0].team_id).toEqual(teamId);
      expect(members[0].user_id).toEqual(userId);
    });

    it('should throw error for non-existent team', async () => {
      await expect(addTeamMember(999, userId)).rejects.toThrow(/team not found/i);
    });

    it('should throw error for non-existent user', async () => {
      await expect(addTeamMember(teamId, 999)).rejects.toThrow(/user not found/i);
    });

    it('should throw error when user is already a member', async () => {
      await addTeamMember(teamId, userId);

      await expect(addTeamMember(teamId, userId)).rejects.toThrow(/already a team member/i);
    });
  });

  describe('removeTeamMember', () => {
    let teamId: number;

    beforeEach(async () => {
      const team = await createTeam({ ...testTeamInput, manager_id: managerId });
      teamId = team.id;
      await addTeamMember(teamId, userId);
    });

    it('should remove team member successfully', async () => {
      const result = await removeTeamMember(teamId, userId);
      expect(result.success).toBe(true);

      // Verify member is removed from database
      const members = await db.select()
        .from(teamMembersTable)
        .where(and(
          eq(teamMembersTable.team_id, teamId),
          eq(teamMembersTable.user_id, userId)
        ))
        .execute();

      expect(members).toHaveLength(0);
    });

    it('should throw error for non-existent membership', async () => {
      // Remove the member first
      await removeTeamMember(teamId, userId);

      // Try to remove again
      await expect(removeTeamMember(teamId, userId)).rejects.toThrow(/membership not found/i);
    });
  });

  describe('getTeamMembers', () => {
    let teamId: number;

    beforeEach(async () => {
      const team = await createTeam({ ...testTeamInput, manager_id: managerId });
      teamId = team.id;
    });

    it('should return empty array when no members', async () => {
      const result = await getTeamMembers(teamId);
      expect(result).toEqual([]);
    });

    it('should return all team members', async () => {
      await addTeamMember(teamId, userId);
      await addTeamMember(teamId, managerId);

      const result = await getTeamMembers(teamId);

      expect(result).toHaveLength(2);
      expect(result[0].team_id).toEqual(teamId);
      expect(result[1].team_id).toEqual(teamId);
      
      const userIds = result.map(m => m.user_id).sort();
      expect(userIds).toEqual([userId, managerId].sort());
    });

    it('should throw error for non-existent team', async () => {
      await expect(getTeamMembers(999)).rejects.toThrow(/team not found/i);
    });
  });
});