import { Router } from 'express';
import { z } from 'zod';

import { AuthRequest, anonymousFallback } from '../middleware/auth.middleware';
import { prisma } from '../server';

const router = Router();

router.use(anonymousFallback);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const PROJECT_ROLES_RANKED = ['VIEWER', 'EXECUTOR', 'EDITOR', 'ADMIN'] as const;

function hasProjectRole(
  memberRole: string,
  minimumRole: (typeof PROJECT_ROLES_RANKED)[number]
): boolean {
  const memberIdx = PROJECT_ROLES_RANKED.indexOf(
    memberRole as (typeof PROJECT_ROLES_RANKED)[number]
  );
  const minIdx = PROJECT_ROLES_RANKED.indexOf(minimumRole);
  return memberIdx >= 0 && memberIdx >= minIdx;
}

// ---------------------------------------------------------------------------
// GET / — List projects for the current tenant
// ---------------------------------------------------------------------------

router.get('/', async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const projects = await prisma.project.findMany({
      where: { tenantId: req.user.tenantId },
      include: {
        _count: { select: { members: true, runbooks: true } },
        members: {
          where: { userId: req.user.id },
          select: { role: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const result = projects.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      allowedShellDir: p.allowedShellDir,
      memberCount: p._count.members,
      runbookCount: p._count.runbooks,
      myRole: p.members[0]?.role ?? null,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    res.json({ projects: result });
  } catch (error) {
    req.log.error({ error }, 'List projects error');
    res.status(500).json({ error: 'Failed to list projects' });
  }
});

// ---------------------------------------------------------------------------
// POST / — Create a project (tenant ADMINs only)
// ---------------------------------------------------------------------------

const createProjectSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1).optional(),
  description: z.string().optional(),
  allowedShellDir: z.string().optional(),
});

router.post('/', async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    if (req.user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only tenant admins can create projects' });
    }

    const data = createProjectSchema.parse(req.body);
    const slug = data.slug || slugify(data.name);

    const existing = await prisma.project.findUnique({
      where: { tenantId_slug: { tenantId: req.user.tenantId, slug } },
    });
    if (existing) {
      return res.status(409).json({ error: 'A project with this slug already exists' });
    }

    const project = await prisma.project.create({
      data: {
        name: data.name,
        slug,
        description: data.description,
        allowedShellDir: data.allowedShellDir,
        tenantId: req.user.tenantId,
        members: {
          create: {
            userId: req.user.id,
            role: 'ADMIN',
          },
        },
      },
      include: {
        _count: { select: { members: true, runbooks: true } },
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
      },
    });

    res.status(201).json(project);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    req.log.error({ error }, 'Create project error');
    res.status(500).json({ error: 'Failed to create project' });
  }
});

// ---------------------------------------------------------------------------
// GET /:id — Project detail (members only)
// ---------------------------------------------------------------------------

router.get('/:id', async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const project = await prisma.project.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
      include: {
        members: {
          include: { user: { select: { id: true, name: true, email: true } } },
        },
        runbooks: {
          select: {
            id: true,
            name: true,
            slug: true,
            description: true,
            isActive: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: 'desc' },
        },
      },
    });

    if (!project) return res.status(404).json({ error: 'Project not found' });

    const isMember = project.members.some((m) => m.userId === req.user!.id);
    if (!isMember) return res.status(403).json({ error: 'Not a project member' });

    res.json(project);
  } catch (error) {
    req.log.error({ error }, 'Get project error');
    res.status(500).json({ error: 'Failed to get project' });
  }
});

// ---------------------------------------------------------------------------
// PUT /:id — Update project (project ADMINs only)
// ---------------------------------------------------------------------------

const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  allowedShellDir: z.string().nullish(),
});

router.put('/:id', async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const project = await prisma.project.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: req.user.id, projectId: project.id } },
    });
    if (!membership || membership.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only project admins can update projects' });
    }

    const data = updateProjectSchema.parse(req.body);

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.allowedShellDir !== undefined) updateData.allowedShellDir = data.allowedShellDir;

    const updated = await prisma.project.update({
      where: { id: project.id },
      data: updateData,
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    req.log.error({ error }, 'Update project error');
    res.status(500).json({ error: 'Failed to update project' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id — Delete project (project ADMINs only)
// ---------------------------------------------------------------------------

router.delete('/:id', async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const project = await prisma.project.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: req.user.id, projectId: project.id } },
    });
    if (!membership || membership.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only project admins can delete projects' });
    }

    // Nullify projectId on associated runbooks before deleting
    await prisma.runbook.updateMany({
      where: { projectId: project.id },
      data: { projectId: null },
    });

    await prisma.project.delete({ where: { id: project.id } });

    res.status(204).send();
  } catch (error) {
    req.log.error({ error }, 'Delete project error');
    res.status(500).json({ error: 'Failed to delete project' });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/members — Add member (project ADMINs only)
// ---------------------------------------------------------------------------

const addMemberSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(['VIEWER', 'EXECUTOR', 'EDITOR', 'ADMIN']),
});

router.post('/:id/members', async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const project = await prisma.project.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: req.user.id, projectId: project.id } },
    });
    if (!membership || membership.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only project admins can add members' });
    }

    const data = addMemberSchema.parse(req.body);

    // Verify user belongs to the same tenant
    const targetUser = await prisma.user.findFirst({
      where: { id: data.userId, tenantId: req.user.tenantId },
    });
    if (!targetUser) {
      return res.status(404).json({ error: 'User not found in this tenant' });
    }

    const existingMember = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: data.userId, projectId: project.id } },
    });
    if (existingMember) {
      return res.status(409).json({ error: 'User is already a member of this project' });
    }

    const member = await prisma.projectMember.create({
      data: {
        userId: data.userId,
        projectId: project.id,
        role: data.role,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.status(201).json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    req.log.error({ error }, 'Add project member error');
    res.status(500).json({ error: 'Failed to add project member' });
  }
});

// ---------------------------------------------------------------------------
// PUT /:id/members/:userId — Change member role (project ADMINs only)
// ---------------------------------------------------------------------------

const updateMemberSchema = z.object({
  role: z.enum(['VIEWER', 'EXECUTOR', 'EDITOR', 'ADMIN']),
});

router.put('/:id/members/:userId', async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const project = await prisma.project.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const callerMembership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: req.user.id, projectId: project.id } },
    });
    if (!callerMembership || callerMembership.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only project admins can change member roles' });
    }

    const data = updateMemberSchema.parse(req.body);
    const targetUserId = req.params.userId;

    const targetMembership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: targetUserId, projectId: project.id } },
    });
    if (!targetMembership) {
      return res.status(404).json({ error: 'Member not found in this project' });
    }

    const updated = await prisma.projectMember.update({
      where: { userId_projectId: { userId: targetUserId, projectId: project.id } },
      data: { role: data.role },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    req.log.error({ error }, 'Update project member error');
    res.status(500).json({ error: 'Failed to update project member' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id/members/:userId — Remove member (project ADMINs only)
// ---------------------------------------------------------------------------

router.delete('/:id/members/:userId', async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const project = await prisma.project.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const callerMembership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: req.user.id, projectId: project.id } },
    });
    if (!callerMembership || callerMembership.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Only project admins can remove members' });
    }

    const targetUserId = req.params.userId;

    const targetMembership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: targetUserId, projectId: project.id } },
    });
    if (!targetMembership) {
      return res.status(404).json({ error: 'Member not found in this project' });
    }

    await prisma.projectMember.delete({
      where: { userId_projectId: { userId: targetUserId, projectId: project.id } },
    });

    res.status(204).send();
  } catch (error) {
    req.log.error({ error }, 'Remove project member error');
    res.status(500).json({ error: 'Failed to remove project member' });
  }
});

// ---------------------------------------------------------------------------
// POST /:id/runbooks/:runbookId — Associate a runbook (EDITOR+)
// ---------------------------------------------------------------------------

router.post('/:id/runbooks/:runbookId', async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const project = await prisma.project.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: req.user.id, projectId: project.id } },
    });
    if (!membership || !hasProjectRole(membership.role, 'EDITOR')) {
      return res.status(403).json({ error: 'Requires EDITOR role or higher' });
    }

    const runbook = await prisma.runbook.findFirst({
      where: { id: req.params.runbookId, tenantId: req.user.tenantId },
    });
    if (!runbook) return res.status(404).json({ error: 'Runbook not found' });

    const updated = await prisma.runbook.update({
      where: { id: runbook.id },
      data: { projectId: project.id },
      select: { id: true, name: true, projectId: true },
    });

    res.json(updated);
  } catch (error) {
    req.log.error({ error }, 'Associate runbook error');
    res.status(500).json({ error: 'Failed to associate runbook' });
  }
});

// ---------------------------------------------------------------------------
// DELETE /:id/runbooks/:runbookId — Disassociate a runbook (EDITOR+)
// ---------------------------------------------------------------------------

router.delete('/:id/runbooks/:runbookId', async (req: AuthRequest, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });

    const project = await prisma.project.findFirst({
      where: { id: req.params.id, tenantId: req.user.tenantId },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const membership = await prisma.projectMember.findUnique({
      where: { userId_projectId: { userId: req.user.id, projectId: project.id } },
    });
    if (!membership || !hasProjectRole(membership.role, 'EDITOR')) {
      return res.status(403).json({ error: 'Requires EDITOR role or higher' });
    }

    const runbook = await prisma.runbook.findFirst({
      where: { id: req.params.runbookId, projectId: project.id, tenantId: req.user.tenantId },
    });
    if (!runbook) return res.status(404).json({ error: 'Runbook not found in this project' });

    await prisma.runbook.update({
      where: { id: runbook.id },
      data: { projectId: null },
    });

    res.status(204).send();
  } catch (error) {
    req.log.error({ error }, 'Disassociate runbook error');
    res.status(500).json({ error: 'Failed to disassociate runbook' });
  }
});

export default router;