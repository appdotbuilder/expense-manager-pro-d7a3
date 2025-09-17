import { db } from '../db';
import { teamsTable, teamMembersTable, usersTable } from '../db/schema';
import { type Team, type CreateTeamInput, type UpdateTeamInput, type TeamMember } from '../schema';
import { eq, and } from 'drizzle-orm';

export async function createTeam(input: CreateTeamInput): Promise<Team> {
  try {
    // Verify that the manager exists and has appropriate permissions
    const manager = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.manager_id))
      .execute();

    if (manager.length === 0) {
      throw new Error('Manager not found');
    }

    // Create the team
    const result = await db.insert(teamsTable)
      .values({
        name: input.name,
        description: input.description || null,
        manager_id: input.manager_id
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Team creation failed:', error);
    throw error;
  }
}

export async function getTeams(): Promise<Team[]> {
  try {
    const teams = await db.select()
      .from(teamsTable)
      .execute();

    return teams;
  } catch (error) {
    console.error('Failed to fetch teams:', error);
    throw error;
  }
}

export async function getTeamById(id: number): Promise<Team | null> {
  try {
    const teams = await db.select()
      .from(teamsTable)
      .where(eq(teamsTable.id, id))
      .execute();

    return teams.length > 0 ? teams[0] : null;
  } catch (error) {
    console.error('Failed to fetch team:', error);
    throw error;
  }
}

export async function updateTeam(input: UpdateTeamInput): Promise<Team> {
  try {
    // If manager_id is being updated, verify the new manager exists
    if (input.manager_id !== undefined) {
      const manager = await db.select()
        .from(usersTable)
        .where(eq(usersTable.id, input.manager_id))
        .execute();

      if (manager.length === 0) {
        throw new Error('Manager not found');
      }
    }

    const updateData: any = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.manager_id !== undefined) updateData.manager_id = input.manager_id;

    const result = await db.update(teamsTable)
      .set(updateData)
      .where(eq(teamsTable.id, input.id))
      .returning()
      .execute();

    if (result.length === 0) {
      throw new Error('Team not found');
    }

    return result[0];
  } catch (error) {
    console.error('Team update failed:', error);
    throw error;
  }
}

export async function deleteTeam(id: number): Promise<{ success: boolean }> {
  try {
    // First check if team exists
    const existingTeam = await db.select()
      .from(teamsTable)
      .where(eq(teamsTable.id, id))
      .execute();

    if (existingTeam.length === 0) {
      throw new Error('Team not found');
    }

    // Delete the team (cascade will handle team members)
    await db.delete(teamsTable)
      .where(eq(teamsTable.id, id))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Team deletion failed:', error);
    throw error;
  }
}

export async function addTeamMember(teamId: number, userId: number): Promise<TeamMember> {
  try {
    // Verify team exists
    const team = await db.select()
      .from(teamsTable)
      .where(eq(teamsTable.id, teamId))
      .execute();

    if (team.length === 0) {
      throw new Error('Team not found');
    }

    // Verify user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Check if user is already a member
    const existingMembership = await db.select()
      .from(teamMembersTable)
      .where(and(
        eq(teamMembersTable.team_id, teamId),
        eq(teamMembersTable.user_id, userId)
      ))
      .execute();

    if (existingMembership.length > 0) {
      throw new Error('User is already a team member');
    }

    // Add the team member
    const result = await db.insert(teamMembersTable)
      .values({
        team_id: teamId,
        user_id: userId
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Failed to add team member:', error);
    throw error;
  }
}

export async function removeTeamMember(teamId: number, userId: number): Promise<{ success: boolean }> {
  try {
    // Check if membership exists
    const existingMembership = await db.select()
      .from(teamMembersTable)
      .where(and(
        eq(teamMembersTable.team_id, teamId),
        eq(teamMembersTable.user_id, userId)
      ))
      .execute();

    if (existingMembership.length === 0) {
      throw new Error('Team membership not found');
    }

    // Remove the team member
    await db.delete(teamMembersTable)
      .where(and(
        eq(teamMembersTable.team_id, teamId),
        eq(teamMembersTable.user_id, userId)
      ))
      .execute();

    return { success: true };
  } catch (error) {
    console.error('Failed to remove team member:', error);
    throw error;
  }
}

export async function getTeamMembers(teamId: number): Promise<TeamMember[]> {
  try {
    // Verify team exists
    const team = await db.select()
      .from(teamsTable)
      .where(eq(teamsTable.id, teamId))
      .execute();

    if (team.length === 0) {
      throw new Error('Team not found');
    }

    const members = await db.select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.team_id, teamId))
      .execute();

    return members;
  } catch (error) {
    console.error('Failed to fetch team members:', error);
    throw error;
  }
}