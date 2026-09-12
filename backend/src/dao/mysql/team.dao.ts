import prisma from '../../utils/prisma';
import {
  TeamDao,
  TeamRecord,
  TeamWithCounts,
  TeamTreeNode,
  TeamMemberRecord,
  TeamMemberWithUser,
  CreateTeamData,
  UpdateTeamData,
  UpsertTeamMemberData,
} from '../interfaces/TeamDao';

const MEMBER_USER = {
  select: { id: true, email: true, firstName: true, lastName: true, username: true },
} as const;

export class MySQLTeamDao implements TeamDao {
  async createTeam(data: CreateTeamData): Promise<TeamRecord> {
    // Use raw insert to be resilient to outdated client, but try prisma first
    try {
      return await prisma.team.create({ data } as any) as any;
    } catch (e) {
      // Fallback raw: prisma may not know parentId/depth yet
      const id = (data as any).id || `cuid_${Date.now()}`;
      await prisma.$executeRawUnsafe(
        `INSERT INTO Team (id, orgId, name, slug, description, createdBy, isDefault, parentId, depth, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        id,
        data.orgId,
        data.name,
        data.slug,
        data.description || null,
        data.createdBy,
        data.isDefault ? 1 : 0,
        (data as any).parentId || null,
        (data as any).depth ?? 0
      );
      return (await prisma.team.findUnique({ where: { id } })) as any;
    }
  }

  async findTeamById(id: string): Promise<TeamRecord | null> {
    try {
      return await prisma.team.findUnique({ where: { id } }) as any;
    } catch {
      const rows = await prisma.$queryRawUnsafe(`SELECT * FROM Team WHERE id = ? LIMIT 1`, id) as any[];
      return rows[0] ? this.mapRawTeam(rows[0]) : null;
    }
  }

  async findTeamBySlug(orgId: string, slug: string): Promise<TeamRecord | null> {
    try {
      return await prisma.team.findUnique({ where: { orgId_slug: { orgId, slug } } }) as any;
    } catch {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT * FROM Team WHERE orgId = ? AND slug = ? LIMIT 1`,
        orgId,
        slug
      ) as any[];
      return rows[0] ? this.mapRawTeam(rows[0]) : null;
    }
  }

  async findDefaultTeam(orgId: string): Promise<TeamRecord | null> {
    try {
      return await prisma.team.findFirst({ where: { orgId, isDefault: true } }) as any;
    } catch {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT * FROM Team WHERE orgId = ? AND isDefault = 1 LIMIT 1`,
        orgId
      ) as any[];
      return rows[0] ? this.mapRawTeam(rows[0]) : null;
    }
  }

  async findTeamsByOrg(orgId: string): Promise<TeamWithCounts[]> {
    try {
      return await prisma.team.findMany({
        where: { orgId },
        include: { _count: { select: { members: true, forms: true } } },
        orderBy: { name: 'asc' },
      }) as any;
    } catch (e) {
      // Fallback: raw query with counts
      const rows = await prisma.$queryRawUnsafe(
        `SELECT t.*, 
          (SELECT COUNT(*) FROM TeamMember tm WHERE tm.teamId = t.id) as memberCount,
          (SELECT COUNT(*) FROM Form f WHERE f.teamId = t.id) as formCount
         FROM Team t WHERE t.orgId = ? ORDER BY t.name ASC`,
        orgId
      ) as any[];
      return rows.map((r: any) => ({
        ...this.mapRawTeam(r),
        _count: { members: Number(r.memberCount || 0), forms: Number(r.formCount || 0) },
      })) as any;
    }
  }

  async findAllTeamsByOrg(orgId: string): Promise<TeamWithCounts[]> {
    try {
      const flat = await prisma.team.findMany({
        where: { orgId },
        include: { _count: { select: { members: true, forms: true } } },
        orderBy: { name: 'asc' },
      }) as any as TeamWithCounts[];
      // Sort in memory by depth then name (resilient to missing depth orderBy)
      return flat.sort((a: any, b: any) => {
        const da = (a.depth ?? 0) - (b.depth ?? 0);
        if (da !== 0) return da;
        return a.name.localeCompare(b.name);
      });
    } catch {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT t.*, 
          (SELECT COUNT(*) FROM TeamMember tm WHERE tm.teamId = t.id) as memberCount,
          (SELECT COUNT(*) FROM Form f WHERE f.teamId = t.id) as formCount
         FROM Team t WHERE t.orgId = ? ORDER BY t.name ASC`,
        orgId
      ) as any[];
      const mapped = rows.map((r: any) => ({
        ...this.mapRawTeam(r),
        _count: { members: Number(r.memberCount || 0), forms: Number(r.formCount || 0) },
      })) as TeamWithCounts[];
      return mapped.sort((a, b) => (a.depth - b.depth) || a.name.localeCompare(b.name));
    }
  }

  async findTeamsTree(orgId: string): Promise<TeamTreeNode[]> {
    let flat: TeamWithCounts[];
    try {
      flat = await prisma.team.findMany({
        where: { orgId },
        include: { _count: { select: { members: true, forms: true } } },
        orderBy: { name: 'asc' },
      }) as any as TeamWithCounts[];
      flat = flat.sort((a: any, b: any) => ((a.depth ?? 0) - (b.depth ?? 0)) || a.name.localeCompare(b.name));
    } catch {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT t.*, 
          (SELECT COUNT(*) FROM TeamMember tm WHERE tm.teamId = t.id) as memberCount,
          (SELECT COUNT(*) FROM Form f WHERE f.teamId = t.id) as formCount
         FROM Team t WHERE t.orgId = ? ORDER BY t.name ASC`,
        orgId
      ) as any[];
      flat = rows.map((r: any) => ({
        ...this.mapRawTeam(r),
        _count: { members: Number(r.memberCount || 0), forms: Number(r.formCount || 0) },
      })) as any;
      flat = flat.sort((a: any, b: any) => (a.depth - b.depth) || a.name.localeCompare(b.name));
    }

    const map = new Map<string, TeamTreeNode>();
    for (const t of flat) {
      map.set(t.id, { ...t, children: [] } as any);
    }

    const roots: TeamTreeNode[] = [];
    for (const team of flat) {
      const node = map.get(team.id)!;
      const parentId = (team as any).parentId;
      if (parentId && map.has(parentId)) {
        map.get(parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    const sortRecursive = (nodes: TeamTreeNode[]) => {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      for (const n of nodes) sortRecursive(n.children);
    };
    sortRecursive(roots);

    return roots;
  }

  async findDirectChildren(teamId: string): Promise<TeamRecord[]> {
    try {
      return await prisma.team.findMany({
        where: { parentId: teamId } as any,
        orderBy: { name: 'asc' },
      }) as any;
    } catch {
      const rows = await prisma.$queryRawUnsafe(
        `SELECT * FROM Team WHERE parentId = ? ORDER BY name ASC`,
        teamId
      ) as any[];
      return rows.map((r: any) => this.mapRawTeam(r));
    }
  }

  async findDescendants(teamId: string): Promise<TeamRecord[]> {
    try {
      const root = await prisma.team.findUnique({ where: { id: teamId }, select: { orgId: true } } as any) as any;
      if (!root) {
        const rawRoot = await prisma.$queryRawUnsafe(`SELECT orgId FROM Team WHERE id = ? LIMIT 1`, teamId) as any[];
        if (!rawRoot[0]) return [];
        root.orgId = rawRoot[0].orgId;
      }

      const all = await prisma.team.findMany({
        where: { orgId: root.orgId },
      }) as any as TeamRecord[];

      return this.bfsDescendants(all, teamId);
    } catch {
      // Raw fallback
      const rootRows = await prisma.$queryRawUnsafe(`SELECT orgId FROM Team WHERE id = ? LIMIT 1`, teamId) as any[];
      if (!rootRows[0]) return [];
      const orgId = rootRows[0].orgId;
      const all = await prisma.$queryRawUnsafe(`SELECT * FROM Team WHERE orgId = ?`, orgId) as any[];
      const mapped = all.map((r: any) => this.mapRawTeam(r));
      return this.bfsDescendants(mapped, teamId);
    }
  }

  private bfsDescendants(all: TeamRecord[], teamId: string): TeamRecord[] {
    const mapByParent = new Map<string, TeamRecord[]>();
    for (const t of all) {
      if (!t.parentId) continue;
      if (!mapByParent.has(t.parentId)) mapByParent.set(t.parentId, []);
      mapByParent.get(t.parentId)!.push(t);
    }

    const result: TeamRecord[] = [];
    const queue: string[] = [teamId];
    const visited = new Set<string>();

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const children = mapByParent.get(current) || [];
      for (const child of children) {
        result.push(child);
        queue.push(child.id);
      }
    }
    return result;
  }

  async findAncestors(teamId: string): Promise<TeamRecord[]> {
    const ancestors: TeamRecord[] = [];
    let currentId: string | null = teamId;
    const visited = new Set<string>();

    while (currentId) {
      if (visited.has(currentId)) break;
      visited.add(currentId);
      let team: TeamRecord | null = null;
      try {
        team = (await prisma.team.findUnique({ where: { id: currentId } })) as any;
      } catch {
        const rows = await prisma.$queryRawUnsafe(`SELECT * FROM Team WHERE id = ? LIMIT 1`, currentId) as any[];
        team = rows[0] ? this.mapRawTeam(rows[0]) : null;
      }
      if (!team || !team.parentId) break;
      let parent: TeamRecord | null = null;
      try {
        parent = (await prisma.team.findUnique({ where: { id: team.parentId } })) as any;
      } catch {
        const rows = await prisma.$queryRawUnsafe(`SELECT * FROM Team WHERE id = ? LIMIT 1`, team.parentId) as any[];
        parent = rows[0] ? this.mapRawTeam(rows[0]) : null;
      }
      if (!parent) break;
      ancestors.push(parent);
      currentId = parent.id;
    }

    return ancestors.reverse();
  }

  async getMaxSubtreeDepth(teamId: string): Promise<number> {
    const descendants = await this.findDescendants(teamId);
    if (descendants.length === 0) return 0;
    const root = await this.findTeamById(teamId);
    if (!root) return 0;
    let maxDepth = root.depth;
    for (const d of descendants) {
      if (d.depth > maxDepth) maxDepth = d.depth;
    }
    return maxDepth - root.depth;
  }

  async moveTeamSubtree(teamId: string, newParentId: string | null, depthDelta: number): Promise<void> {
    try {
      await prisma.team.update({
        where: { id: teamId },
        data: { parentId: newParentId, depth: { increment: depthDelta } } as any,
      });
    } catch {
      await prisma.$executeRawUnsafe(
        `UPDATE Team SET parentId = ?, depth = depth + ?, updatedAt = NOW() WHERE id = ?`,
        newParentId,
        depthDelta,
        teamId
      );
    }

    if (depthDelta === 0) return;

    const descendants = await this.findDescendants(teamId);
    for (const desc of descendants) {
      try {
        await prisma.team.update({
          where: { id: desc.id },
          data: { depth: desc.depth + depthDelta } as any,
        });
      } catch {
        await prisma.$executeRawUnsafe(
          `UPDATE Team SET depth = ?, updatedAt = NOW() WHERE id = ?`,
          desc.depth + depthDelta,
          desc.id
        );
      }
    }
  }

  async updateTeam(id: string, data: UpdateTeamData): Promise<TeamRecord> {
    try {
      return await prisma.team.update({ where: { id }, data: data as any }) as any;
    } catch {
      // Raw fallback for name/desc only (parentId/depth handled via moveTeamSubtree)
      if (data.name !== undefined || data.description !== undefined) {
        const sets: string[] = [];
        const vals: any[] = [];
        if (data.name !== undefined) {
          sets.push(`name = ?`);
          vals.push(data.name);
        }
        if (data.description !== undefined) {
          sets.push(`description = ?`);
          vals.push(data.description);
        }
        sets.push(`updatedAt = NOW()`);
        vals.push(id);
        await prisma.$executeRawUnsafe(
          `UPDATE Team SET ${sets.join(', ')} WHERE id = ?`,
          ...vals
        );
      }
      return (await this.findTeamById(id)) as TeamRecord;
    }
  }

  async deleteTeam(id: string): Promise<void> {
    try {
      await prisma.team.delete({ where: { id } });
    } catch {
      await prisma.$executeRawUnsafe(`DELETE FROM Team WHERE id = ?`, id);
    }
  }

  // --- membership ----------------------------------------------------------

  async findMember(teamId: string, userId: string): Promise<TeamMemberRecord | null> {
    return prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } }) as any;
  }

  async findMembers(teamId: string): Promise<TeamMemberWithUser[]> {
    return prisma.teamMember.findMany({
      where: { teamId },
      include: { user: MEMBER_USER },
      orderBy: { createdAt: 'asc' },
    }) as any;
  }

  async findTeamsForUser(
    orgId: string,
    userId: string
  ): Promise<(TeamMemberRecord & { team: TeamRecord })[]> {
    return prisma.teamMember.findMany({
      where: { userId, team: { orgId } },
      include: { team: true },
      orderBy: { createdAt: 'asc' },
    }) as any;
  }

  async upsertMember(data: UpsertTeamMemberData): Promise<TeamMemberRecord> {
    return prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: data.teamId, userId: data.userId } },
      create: data,
      update: {},
    }) as any;
  }

  async deleteMember(teamId: string, userId: string): Promise<void> {
    await prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId } } });
  }

  async deleteMembershipsForUserInOrg(orgId: string, userId: string): Promise<string[]> {
    const memberships = await prisma.teamMember.findMany({
      where: { userId, team: { orgId } },
      select: { teamId: true },
    });
    if (memberships.length === 0) return [];

    const teamIds = memberships.map((m: { teamId: string }) => m.teamId);
    await prisma.teamMember.deleteMany({ where: { userId, teamId: { in: teamIds } } });
    return teamIds;
  }

  private mapRawTeam(row: any): TeamRecord {
    return {
      id: row.id,
      orgId: row.orgId,
      name: row.name,
      slug: row.slug,
      description: row.description || null,
      isDefault: Boolean(row.isDefault),
      parentId: row.parentId || null,
      depth: Number(row.depth ?? 0),
      createdBy: row.createdBy,
      createdAt: row.createdAt ? new Date(row.createdAt) : new Date(),
      updatedAt: row.updatedAt ? new Date(row.updatedAt) : new Date(),
    };
  }
}
