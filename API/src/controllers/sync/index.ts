import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { Op, literal } from 'sequelize';
import {
  User,
  Project,
  Subproject,
  Activity,
  FormTemplate,
  Service,
  ServiceAssignment,
  ProjectUser,
  SubprojectUser,
  Beneficiary,
  FormResponse,
  ServiceDelivery,
  AuditLog,
  ActivityUser,
  Role,
  Permission,
  RolePermission,
  UserRole,
  FormField,
  Kpi,
  BeneficiaryDetails,
  BeneficiaryAssignment,
  BeneficiaryMapping,
  BeneficiaryMatchKey,
} from '../../models';
import FormEntityAssociation from '../../models/FormEntityAssociation';
import sequelize from '../../db/connection';
import { decryptField } from '../../utils/crypto';
import { ROLES } from '../../constants/roles';
import validateFormResponse from '../../services/forms/validateFormResponse';
import beneficiariesService from '../../services/beneficiaries/beneficiariesService';
import fs from 'fs';
import os from 'os';
import path from 'path';

const isUuid = (v: any) => typeof v === 'string' && v.length >= 8;

async function getRoleNames(req: Request): Promise<string[]> {
  const cached = (req as any).userRoles as any[] | undefined;
  if (Array.isArray(cached) && cached.length) {
    return cached.map((r: any) => (typeof r === 'string' ? r : r?.name)).filter(Boolean);
  }
  try {
    const u = await User.findByPk((req as any).user?.id, { include: [{ association: 'roles' }] }) as any;
    return (u?.roles || []).map((r: any) => r?.name).filter(Boolean);
  } catch {
    return [];
  }
}

export const pull = async (req: Request, res: Response) => {
  try {
    const sinceRaw = req.body?.since as string | undefined;
    const full = Boolean(req.body?.full);
    const entities = Array.isArray(req.body?.entities) ? (req.body.entities as string[]) : undefined;

    const since = full || !sinceRaw ? undefined : new Date(sinceRaw);
  const whereUpdated = since ? { updatedAt: { [Op.gte]: since } } : {};


    const roleNames = await getRoleNames(req);
    const isAdmin = roleNames.includes(ROLES.SUPER_ADMIN) || roleNames.includes(ROLES.SYSTEM_ADMINISTRATOR);

    // Optional access filter set by auth
    const allowedPrograms = (req as any).user && Array.isArray((req as any).user.allowedProgramIds)
      ? new Set<string>(((req as any).user.allowedProgramIds as any).map(String))
      : null;

    const include = (name: string) => !entities || entities.includes(name);

    // Build filters respecting allowedPrograms if present
    const projWhere: any = { ...whereUpdated };
    if (!isAdmin && allowedPrograms && allowedPrograms.size) {
      projWhere.id = { [Op.in]: Array.from(allowedPrograms) };
    }

    // Service deliveries (scope by allowed programs) - Enhanced for offline functionality
    let serviceDeliveries: any[] = [];
    if (include('serviceDeliveries')) {
      // Include service deliveries with related data for better offline experience
      const rows = await ServiceDelivery.findAll({ 
        where: { ...whereUpdated },
        include: [
          { model: Service, as: 'service', attributes: ['id', 'name', 'description', 'category'] },
          { model: User, as: 'staffUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
          { model: Beneficiary, as: 'beneficiary', attributes: ['id', 'pseudonym', 'status'] }
        ]
      });
      if (isAdmin || !allowedPrograms || !allowedPrograms.size) {
        serviceDeliveries = rows as any[];
      } else {
        // Collect referenced entity ids
        const subIds = new Set<string>();
        const actIds = new Set<string>();
        for (const d of rows) {
          const t = String(d.get('entityType'));
          const e = String(d.get('entityId'));
          if (t === 'subproject') subIds.add(e);
          if (t === 'activity') actIds.add(e);
        }
        const subs = subIds.size ? await Subproject.findAll({ where: { id: { [Op.in]: Array.from(subIds) } }, attributes: ['id', 'projectId'] }) : [];
        const acts = actIds.size ? await Activity.findAll({ where: { id: { [Op.in]: Array.from(actIds) } }, attributes: ['id', 'subprojectId'] }) : [];
        const subToProj = new Map(subs.map((s: any) => [String(s.id), String(s.projectId)]));
        const actToSub = new Map(acts.map((a: any) => [String(a.id), String(a.subprojectId)]));
        serviceDeliveries = (rows as any[]).filter((d: any) => {
          const t = String(d.get('entityType'));
          const e = String(d.get('entityId'));
          if (t === 'project') return allowedPrograms.has(e);
          if (t === 'subproject') return allowedPrograms.has(subToProj.get(e) || '');
          if (t === 'activity') {
            const subId = actToSub.get(e);
            const projId = subId ? subToProj.get(String(subId)) : undefined;
            return projId ? allowedPrograms.has(projId) : false;
          }
          return false;
        });
      }
    }

    // Role/permission related (no special scope)
    const roles = include('roles') ? await Role.findAll({ where: { ...whereUpdated } }) : [];
    const permissions = include('permissions') ? await Permission.findAll({ where: { ...whereUpdated } }) : [];
    const rolePermissions = include('rolePermissions') ? await RolePermission.findAll({ where: { ...whereUpdated } }) : [];
    const userRoles = include('userRoles') ? await UserRole.findAll({ where: { ...whereUpdated } }) : [];

    // Form fields and KPIs
    const formFields = include('formFields') ? await FormField.findAll({ where: { ...whereUpdated } }) : [];
    const kpis = include('kpis') ? await Kpi.findAll({ where: { ...whereUpdated } }) : [];

    // Beneficiary aux tables
    const beneficiaryDetails = include('beneficiaryDetails') ? await BeneficiaryDetails.findAll({ where: { ...whereUpdated } }) : [];
    const beneficiaryAssignments = include('beneficiaryAssignments') ? await BeneficiaryAssignment.findAll({ where: { ...whereUpdated } }) : [];
    const beneficiaryMappings = include('beneficiaryMappings') ? await BeneficiaryMapping.findAll({ where: { ...whereUpdated } }) : [];
    const beneficiaryMatchKeys = include('beneficiaryMatchKeys') ? await BeneficiaryMatchKey.findAll({ where: { ...whereUpdated } }) : [];

    // Form responses (scope by allowed programs) - Enhanced for offline functionality
    let formResponses: any[] = [];
    if (include('formResponses')) {
      // Include form responses with related data for better offline experience
      const rows = await FormResponse.findAll({ 
        where: { ...whereUpdated },
        include: [
          { model: FormTemplate, as: 'formTemplate', attributes: ['id', 'name', 'schema', 'version'] },
          { model: User, as: 'submittedBy', attributes: ['id', 'firstName', 'lastName', 'email'] }
        ]
      });
      if (isAdmin || !allowedPrograms || !allowedPrograms.size) {
        formResponses = rows as any[];
      } else {
        const subIds = new Set<string>();
        const actIds = new Set<string>();
        for (const r of rows) {
          const t = String((r as any).get('entityType'));
          const e = String((r as any).get('entityId'));
          if (t === 'subproject') subIds.add(e);
          if (t === 'activity') actIds.add(e);
        }
        const subs = subIds.size ? await Subproject.findAll({ where: { id: { [Op.in]: Array.from(subIds) } }, attributes: ['id', 'projectId'] }) : [];
        const acts = actIds.size ? await Activity.findAll({ where: { id: { [Op.in]: Array.from(actIds) } }, attributes: ['id', 'subprojectId'] }) : [];
        const subToProj = new Map(subs.map((s: any) => [String(s.id), String(s.projectId)]));
        const actToSub = new Map(acts.map((a: any) => [String(a.id), String(a.subprojectId)]));
        formResponses = (rows as any[]).filter((r: any) => {
          const t = String(r.get('entityType'));
          const e = String(r.get('entityId'));
          if (t === 'project') return allowedPrograms.has(e);
          if (t === 'subproject') return allowedPrograms.has(subToProj.get(e) || '');
          if (t === 'activity') {
            const subId = actToSub.get(e);
            const projId = subId ? subToProj.get(String(subId)) : undefined;
            return projId ? allowedPrograms.has(projId) : false;
          }
          return false;
        });
      }
    }

    const [projects, subprojects, activities] = await Promise.all([
      include('projects') ? Project.findAll({ where: projWhere }) : Promise.resolve([]),
      include('subprojects')
        ? Subproject.findAll({
            where: {
              ...whereUpdated,
              ...(allowedPrograms && !isAdmin ? { projectId: { [Op.in]: Array.from(allowedPrograms) } } : {}),
            },
          })
        : Promise.resolve([]),
      include('activities')
        ? (() => {
            if (isAdmin || !allowedPrograms || !allowedPrograms.size) {
              return Activity.findAll({ where: { ...whereUpdated } });
            }
            // Limit to activities under allowed projectIds via subproject join
            return Activity.findAll({
              where: whereUpdated,
              include: [{ model: Subproject, as: 'subproject', attributes: ['projectId'] }],
            }).then((rows: any[]) => rows.filter(r => allowedPrograms.has(String(r.subproject?.projectId))));
          })()
        : Promise.resolve([]),
    ]);

    // Forms
    const formTemplates = include('formTemplates')
      ? await FormTemplate.findAll({ where: { ...whereUpdated } })
      : [];
    const formEntityAssociations = include('formEntityAssociations')
      ? await FormEntityAssociation.findAll({ where: { ...whereUpdated } })
      : [];

    // Services
    const services = include('services') ? await Service.findAll({ where: { ...whereUpdated } }) : [];
    const entityServices = include('entityServices')
      ? await ServiceAssignment.findAll({ where: { ...whereUpdated } })
      : [];

    // Activity users (scope by allowed programs)
    let activityUsers: any[] = [];
    if (include('activityUsers')) {
      if (isAdmin || !allowedPrograms || !allowedPrograms.size) {
        activityUsers = await ActivityUser.findAll({ where: { ...whereUpdated } });
      } else {
        const rows = await ActivityUser.findAll({ where: { ...whereUpdated } });
        const activityIds = Array.from(new Set(rows.map((r: any) => String(r.get('activityId')))));
        const acts = activityIds.length ? await Activity.findAll({ where: { id: { [Op.in]: activityIds } }, attributes: ['id', 'subprojectId'] }) : [];
        const subIds = Array.from(new Set(acts.map((a: any) => String(a.get('subprojectId')))));
        const subs = subIds.length ? await Subproject.findAll({ where: { id: { [Op.in]: subIds } }, attributes: ['id', 'projectId'] }) : [];
        const subToProj = new Map(subs.map((s: any) => [String(s.id), String(s.projectId)]));
        const actToSub = new Map(acts.map((a: any) => [String(a.id), String(a.subprojectId)]));
        activityUsers = rows.filter((r: any) => {
          const subId = actToSub.get(String(r.get('activityId')));
          const projId = subId ? subToProj.get(subId) : undefined;
          return projId ? allowedPrograms.has(projId) : false;
        });
      }
    }

    // Users and assignments
    const users = include('users') ? await User.findAll({ where: { ...whereUpdated } }) : [];
    const projectUsers = include('projectUsers')
      ? await ProjectUser.findAll({
          where: {
            ...whereUpdated,
            ...(allowedPrograms && !isAdmin ? { projectId: { [Op.in]: Array.from(allowedPrograms) } } : {}),
          },
        })
      : [];
    const subprojectUsers = include('subprojectUsers')
      ? await SubprojectUser.findAll({ where: { ...whereUpdated } })
      : [];

    // Beneficiaries (respect PII policy)
    let beneficiaries: any[] = [];
    if (include('beneficiaries')) {
      const list = await Beneficiary.findAll({
        where: { ...(whereUpdated as any) },
        order: [['createdAt', 'DESC']],
      });
      const canDecrypt = true; // relaxed policy currently used in beneficiaries controller
      beneficiaries = list.map((b: any) => {
        const base: any = {
          id: String(b.id),
          pseudonym: b.pseudonym,
          status: b.status,
          createdAt: b.get('createdAt'),
          updatedAt: b.get('updatedAt'),
        };
        const enc = {
          firstNameEnc: b.get('firstNameEnc'),
          lastNameEnc: b.get('lastNameEnc'),
          dobEnc: b.get('dobEnc'),
          nationalIdEnc: b.get('nationalIdEnc'),
          phoneEnc: b.get('phoneEnc'),
          emailEnc: b.get('emailEnc'),
          addressEnc: b.get('addressEnc'),
          genderEnc: b.get('genderEnc'),
          municipalityEnc: b.get('municipalityEnc'),
          nationalityEnc: b.get('nationalityEnc'),
          ethnicityEnc: b.get('ethnicityEnc'),
          residenceEnc: b.get('residenceEnc'),
          householdMembersEnc: b.get('householdMembersEnc'),
        };
        if (canDecrypt && (isAdmin || true)) {
          return {
            ...base,
            piiEnc: enc,
            pii: {
              firstName: decryptField(enc.firstNameEnc as any),
              lastName: decryptField(enc.lastNameEnc as any),
              dob: decryptField(enc.dobEnc as any),
              nationalId: decryptField(enc.nationalIdEnc as any),
              phone: decryptField(enc.phoneEnc as any),
              email: decryptField(enc.emailEnc as any),
              address: decryptField(enc.addressEnc as any),
              gender: decryptField(enc.genderEnc as any),
              municipality: decryptField(enc.municipalityEnc as any),
              nationality: decryptField(enc.nationalityEnc as any),
              ethnicity: decryptField(enc.ethnicityEnc as any),
              residence: decryptField(enc.residenceEnc as any),
              householdMembers: decryptField(enc.householdMembersEnc as any),
            },
          };
        }
        return { ...base, piiEnc: enc };
      });
    }

    return res.status(200).json({
      success: true,
      snapshotId: uuidv4(),
      serverTime: new Date().toISOString(),
      data: {
        projects,
        subprojects,
        activities,
        users,
        projectUsers,
        subprojectUsers,
        formTemplates,
        formEntityAssociations,
        services,
        entityServices,
        beneficiaries,
        activityUsers,
        serviceDeliveries,
        roles,
        permissions,
        rolePermissions,
        userRoles,
        formFields,
        kpis,
        beneficiaryDetails,
        beneficiaryAssignments,
        beneficiaryMappings,
        beneficiaryMatchKeys,
        formResponses,
      },
    });
  } catch (error: any) {
    console.error('SYNC pull error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error?.message });
  }
};

// Minimal push to support formSubmission style payloads if needed later.
// For now, we accept a generic changes array and acknowledge unknown ops.
export const push = async (req: Request, res: Response) => {
  const body = req.body || {};
  const changes = Array.isArray(body.changes) ? body.changes : [];
  const results: Array<any> = [];

  // Helper to check RBAC scope by entity
  const user = (req as any).user;
  const roleNames = await getRoleNames(req);
  const isAdmin = roleNames.includes(ROLES.SUPER_ADMIN) || roleNames.includes(ROLES.SYSTEM_ADMINISTRATOR);
  const allowed = user && Array.isArray(user.allowedProgramIds) ? new Set<string>(user.allowedProgramIds.map(String)) : null;

  for (const change of changes) {
    const clientMutationId = change?.clientMutationId || uuidv4();
    const method = (change?.method || '').toUpperCase();
    const endpoint = String(change?.endpoint || '');
    const entityType = String(change?.entityType || change?.entity || '');
    const op = String(change?.operation || change?.op || '').toLowerCase();
    const data = change?.data || {};

    try {
      // Form submission support (either explicit entityType or known endpoint pattern)
      const match = endpoint.match(/^\/forms\/templates\/(.+?)\/responses$/);
      const isFormSubmission = entityType === 'formSubmission' || (method === 'POST' && !!match);
      if (isFormSubmission) {
        const templateId: string = data.templateId || (match ? match[1] : '');
        if (!templateId) {
          results.push({ clientMutationId, status: 'error', error: 'templateId missing' });
          continue;
        }

        // Transactionally apply like submitFormResponse
        const result = await sequelize.transaction(async (transaction) => {
          const template = await FormTemplate.findByPk(templateId, {
            include: [{ model: FormEntityAssociation, as: 'entityAssociations' }],
            transaction,
          });
          if (!template) throw new Error('Form template not found');

          const entityId = String(data.entityId || '');
          const entityTypeVal = String(data.entityType || '');
          if (!entityId || !entityTypeVal) throw new Error('entityId and entityType are required');

          // Ensure association exists
          const associated = template.entityAssociations?.some((ea: any) => ea.entityId === entityId && ea.entityType === entityTypeVal);
          if (!associated) throw new Error('Entity not associated with this template');

          // RBAC scope for non-admins: verify entity under allowed projects
          if (!isAdmin && allowed && allowed.size) {
            let projectIdToCheck: string | null = null;
            if (entityTypeVal === 'project') {
              projectIdToCheck = entityId;
            } else if (entityTypeVal === 'subproject') {
              const sub = await Subproject.findByPk(entityId, { attributes: ['projectId'], transaction });
              projectIdToCheck = sub ? String(sub.get('projectId')) : null;
            } else if (entityTypeVal === 'activity') {
              const act = await Activity.findByPk(entityId, { attributes: ['subprojectId'], transaction });
              const subId = act ? String(act.get('subprojectId')) : null;
              if (subId) {
                const sub = await Subproject.findByPk(subId, { attributes: ['projectId'], transaction });
                projectIdToCheck = sub ? String(sub.get('projectId')) : null;
              }
            }
            if (!projectIdToCheck || !allowed.has(projectIdToCheck)) throw new Error('Forbidden: entity outside your scope');
          }

          // Validate form data
          const formData = data.data || data;
          const validation = await validateFormResponse(templateId, formData);
          if (!validation.valid) {
            throw new Error('Validation failed');
          }

          // Beneficiary (optional)
          let beneficiaryId: string | null = data.beneficiaryId ? String(data.beneficiaryId) : null;
          if (beneficiaryId) {
            const exists = await Beneficiary.findByPk(beneficiaryId, { transaction });
            if (!exists) throw new Error('Invalid beneficiaryId');
          }

          // Create form response
          const responseId = uuidv4();
          const formResponse = await FormResponse.create({
            id: responseId,
            formTemplateId: templateId,
            entityId,
            entityType: entityTypeVal,
            submittedBy: user?.id,
            beneficiaryId: beneficiaryId,
            data: validation.data,
            latitude: data.latitude ?? null,
            longitude: data.longitude ?? null,
            submittedAt: data.submittedAt ? new Date(data.submittedAt) : new Date(),
          }, { transaction });

          // Create service deliveries if provided
          const servicesInput = Array.isArray(data.services) ? data.services : [];
          let createdDeliveries = 0;
          let unassignedNotBlocked = 0;
          if (servicesInput.length > 0) {
            const allowedServiceIds = new Set<string>();
            if (entityTypeVal === 'project') {
              const assignments = await ServiceAssignment.findAll({ where: { entityId, entityType: 'project' }, transaction });
              for (const a of assignments) allowedServiceIds.add(String(a.get('serviceId')));
            } else if (entityTypeVal === 'subproject') {
              const [subAssignments, sub] = await Promise.all([
                ServiceAssignment.findAll({ where: { entityId, entityType: 'subproject' }, transaction }),
                Subproject.findByPk(entityId, { transaction }),
              ]);
              for (const a of subAssignments) allowedServiceIds.add(String(a.get('serviceId')));
              const projectId = sub?.get('projectId') as string | undefined;
              if (projectId) {
                const projAssignments = await ServiceAssignment.findAll({ where: { entityId: projectId, entityType: 'project' }, transaction });
                for (const a of projAssignments) allowedServiceIds.add(String(a.get('serviceId')));
              }
            } else if (entityTypeVal === 'activity') {
              const act = await Activity.findByPk(entityId, { transaction });
              const subprojectId = act?.get('subprojectId') as string | undefined;
              if (subprojectId) {
                const [subAssignments, sub] = await Promise.all([
                  ServiceAssignment.findAll({ where: { entityId: subprojectId, entityType: 'subproject' }, transaction }),
                  Subproject.findByPk(subprojectId, { transaction }),
                ]);
                for (const a of subAssignments) allowedServiceIds.add(String(a.get('serviceId')));
                const projectId = sub?.get('projectId') as string | undefined;
                if (projectId) {
                  const projAssignments = await ServiceAssignment.findAll({ where: { entityId: projectId, entityType: 'project' }, transaction });
                  for (const a of projAssignments) allowedServiceIds.add(String(a.get('serviceId')));
                }
              }
            }

            for (const item of servicesInput) {
              const serviceId = item?.serviceId as string | undefined;
              if (!serviceId || !beneficiaryId) continue;
              if (allowedServiceIds.size > 0 && !allowedServiceIds.has(serviceId)) {
                unassignedNotBlocked += 1; // relaxed policy
              }
              await ServiceDelivery.create({
                id: uuidv4(),
                serviceId,
                beneficiaryId,
                entityId,
                entityType: entityTypeVal,
                formResponseId: formResponse.id,
                staffUserId: (item?.staffUserId as string | undefined) || user?.id,
                deliveredAt: item?.deliveredAt ? new Date(item.deliveredAt) : new Date(),
                notes: (item?.notes as string | undefined) || null,
              }, { transaction });
              createdDeliveries += 1;
            }
          }

          // Audit
          await AuditLog.create({
            id: uuidv4(),
            userId: user?.id,
            action: 'FORM_RESPONSE_SUBMIT_SYNC_PUSH',
            description: `Submitted via /sync/push for ${entityTypeVal}:${entityId}`,
            details: JSON.stringify({ templateId, responseId: formResponse.id, services: { created: createdDeliveries, unassignedNotBlocked } }),
            timestamp: new Date(),
          }, { transaction });

          return formResponse;
        });

        results.push({ clientMutationId, status: 'applied', entityType: 'formSubmission', serverId: result.id });
        continue;
      }

      // Default: not recognized -> ignore safely
      // Beneficiaries: create/update/delete
      if (entityType === 'beneficiary' || endpoint.startsWith('/beneficiaries')) {
        // Create
        if (method === 'POST' && (endpoint === '/beneficiaries' || op === 'create')) {
          const created = await sequelize.transaction(async (transaction) => {
            const safe = await beneficiariesService.createBeneficiary(data, { transaction, userId: user?.id });
            await AuditLog.create({
              id: uuidv4(),
              userId: user?.id,
              action: 'BENEFICIARY_CREATE_SYNC_PUSH',
              description: `Created via /sync/push: ${safe.id}`,
              details: JSON.stringify({ clientMutationId }),
              timestamp: new Date(),
            }, { transaction });
            return safe;
          });
          results.push({ clientMutationId, status: 'applied', entityType: 'beneficiary', serverId: created.id });
          continue;
        }

        // Update
        const updMatch = endpoint.match(/^\/beneficiaries\/(.+)$/);
        if ((method === 'PUT' || op === 'update') && updMatch) {
          const id = updMatch[1];
          const updated = await sequelize.transaction(async (transaction) => {
            const safe = await beneficiariesService.updateBeneficiary(id, data, { transaction, userId: user?.id });
            if (!safe) throw new Error('Beneficiary not found');
            await AuditLog.create({
              id: uuidv4(),
              userId: user?.id,
              action: 'BENEFICIARY_UPDATE_SYNC_PUSH',
              description: `Updated via /sync/push: ${id}`,
              details: JSON.stringify({ clientMutationId }),
              timestamp: new Date(),
            }, { transaction });
            return safe;
          });
          results.push({ clientMutationId, status: 'applied', entityType: 'beneficiary', serverId: updated.id });
          continue;
        }

        // Delete -> set inactive
        const delMatch = endpoint.match(/^\/beneficiaries\/(.+)$/);
        if ((method === 'DELETE' || op === 'delete') && delMatch) {
          const id = delMatch[1];
          await sequelize.transaction(async (transaction) => {
            const safe = await beneficiariesService.setBeneficiaryStatus(id, 'inactive', { transaction, userId: user?.id });
            if (!safe) throw new Error('Beneficiary not found');
            await AuditLog.create({
              id: uuidv4(),
              userId: user?.id,
              action: 'BENEFICIARY_DELETE_SYNC_PUSH',
              description: `Set inactive via /sync/push: ${id}`,
              details: JSON.stringify({ clientMutationId }),
              timestamp: new Date(),
            }, { transaction });
          });
          results.push({ clientMutationId, status: 'applied', entityType: 'beneficiary', serverId: id });
          continue;
        }

        // Fallback
        results.push({ clientMutationId, status: 'ignored', reason: 'unhandled_beneficiary_op' });
        continue;
      }

      results.push({ clientMutationId, status: 'ignored', reason: 'unsupported_change' });
    } catch (err: any) {
      results.push({ clientMutationId, status: 'error', error: err?.message || 'unknown' });
    }
  }

  return res.status(200).json({ success: true, results });
};

export const full = async (req: Request, res: Response) => {
  try {
    const roleNames = await getRoleNames(req);
    const isAdmin = roleNames.includes(ROLES.SUPER_ADMIN) || roleNames.includes(ROLES.SYSTEM_ADMINISTRATOR);
    const allowedPrograms = (req as any).user && Array.isArray((req as any).user.allowedProgramIds)
      ? new Set<string>(((req as any).user.allowedProgramIds as any).map(String))
      : null;

    const projWhere: any = {};
    if (!isAdmin && allowedPrograms && allowedPrograms.size) {
      projWhere.id = { [Op.in]: Array.from(allowedPrograms) };
    }

    const [projects, subprojects, activities] = await Promise.all([
      Project.findAll({ where: { ...projWhere } }),
      Subproject.findAll({ where: { ...(allowedPrograms && !isAdmin ? { projectId: { [Op.in]: Array.from(allowedPrograms) } } : {}) } }),
      (async () => {
        if (isAdmin || !allowedPrograms || !allowedPrograms.size) return Activity.findAll({});
        const acts = await Activity.findAll({ include: [{ model: Subproject, as: 'subproject', attributes: ['projectId'] }] }) as any[];
        return acts.filter((a: any) => allowedPrograms.has(String(a.subproject?.projectId)));
      })(),
    ]);

    const projectIds = new Set<string>((projects as any[]).map((p: any) => String(p.id)));
    const subprojectIds = new Set<string>((subprojects as any[]).map((s: any) => String(s.id)));

    const [users, projectUsers, subprojectUsers, formTemplates, formEntityAssociations, services, serviceAssignments] = await Promise.all([
      User.findAll({}),
      ProjectUser.findAll({ where: projectIds.size ? { projectId: { [Op.in]: Array.from(projectIds) } } : {} }),
      SubprojectUser.findAll({ where: subprojectIds.size ? { subprojectId: { [Op.in]: Array.from(subprojectIds) } } : {} }),
      FormTemplate.findAll({}),
      FormEntityAssociation.findAll({}),
      Service.findAll({}),
      ServiceAssignment.findAll({}),
    ]);

    let beneficiariesRaw: any[] = [];
    if (isAdmin || !allowedPrograms || !allowedPrograms.size) {
      beneficiariesRaw = await Beneficiary.findAll({}) as any[];
    } else {
      const allowedProjIds = Array.from(allowedPrograms);
      const allowedSubIds = Array.from(new Set((subprojects as any[]).map((s: any) => String(s.id))));
      const assigns = await BeneficiaryAssignment.findAll({
        where: {
          [Op.or]: [
            { entityType: 'project', entityId: { [Op.in]: allowedProjIds } },
            ...(allowedSubIds.length ? [{ entityType: 'subproject', entityId: { [Op.in]: allowedSubIds } }] : []),
          ],
        } as any,
        attributes: ['beneficiaryId'],
      }) as any[];
      const benIds = Array.from(new Set(assigns.map((a: any) => String(a.get('beneficiaryId')))));
      beneficiariesRaw = benIds.length ? (await Beneficiary.findAll({ where: { id: { [Op.in]: benIds } } })) as any[] : [];
    }
    const beneficiaries = (beneficiariesRaw as any[]).map((b: any) => ({
      id: String(b.id),
      pseudonym: b.pseudonym,
      status: b.status,
      createdAt: b.get('createdAt'),
      updatedAt: b.get('updatedAt'),
      firstNameEnc: b.get('firstNameEnc') ?? null,
      lastNameEnc: b.get('lastNameEnc') ?? null,
      dobEnc: b.get('dobEnc') ?? null,
      genderEnc: b.get('genderEnc') ?? null,
      addressEnc: b.get('addressEnc') ?? null,
      municipalityEnc: b.get('municipalityEnc') ?? null,
      nationalityEnc: b.get('nationalityEnc') ?? null,
      nationalIdEnc: b.get('nationalIdEnc') ?? null,
      phoneEnc: b.get('phoneEnc') ?? null,
      emailEnc: b.get('emailEnc') ?? null,
      ethnicityEnc: b.get('ethnicityEnc') ?? null,
      residenceEnc: b.get('residenceEnc') ?? null,
      householdMembersEnc: b.get('householdMembersEnc') ?? null,
    }));

    const filePath = path.join(os.tmpdir(), `sync_${uuidv4()}.sqlite`);
    let BetterSqlite3: any;
    try {
      // Lazy require to avoid crashing server if module is not installed yet
      BetterSqlite3 = require('better-sqlite3');
    } catch (e: any) {
      return res.status(501).json({
        success: false,
        message: 'SQLite snapshot not available on this server. Missing better-sqlite3 dependency.',
        hint: 'Install better-sqlite3 and use Node 20/22 LTS for prebuilt binaries.'
      });
    }
    const db = new BetterSqlite3(filePath);
    try {
      db.pragma('journal_mode = OFF');
      db.pragma('synchronous = OFF');
      db.exec('BEGIN TRANSACTION');

      db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT,
          description TEXT,
          category TEXT,
          status TEXT,
          createdAt TEXT,
          updatedAt TEXT
        );
        CREATE TABLE IF NOT EXISTS subprojects (
          id TEXT PRIMARY KEY,
          projectId TEXT,
          name TEXT,
          description TEXT,
          category TEXT,
          status TEXT,
          createdAt TEXT,
          updatedAt TEXT
        );
        CREATE TABLE IF NOT EXISTS activities (
          id TEXT PRIMARY KEY,
          subprojectId TEXT,
          name TEXT,
          description TEXT,
          category TEXT,
          frequency TEXT,
          reportingFields TEXT,
          status TEXT,
          createdAt TEXT,
          updatedAt TEXT
        );
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          firstName TEXT,
          lastName TEXT,
          email TEXT,
          status TEXT,
          createdAt TEXT,
          updatedAt TEXT
        );
        CREATE TABLE IF NOT EXISTS project_users (
          id TEXT PRIMARY KEY,
          projectId TEXT,
          userId TEXT,
          createdAt TEXT,
          updatedAt TEXT
        );
        CREATE TABLE IF NOT EXISTS subproject_users (
          id TEXT PRIMARY KEY,
          subprojectId TEXT,
          userId TEXT,
          createdAt TEXT,
          updatedAt TEXT
        );
        CREATE TABLE IF NOT EXISTS form_templates (
          id TEXT PRIMARY KEY,
          name TEXT,
          schema TEXT,
          version INTEGER,
          status TEXT,
          includeBeneficiaries INTEGER,
          createdAt TEXT,
          updatedAt TEXT
        );
        CREATE TABLE IF NOT EXISTS form_entity_associations (
          id TEXT PRIMARY KEY,
          formTemplateId TEXT,
          entityId TEXT,
          entityType TEXT,
          createdAt TEXT,
          updatedAt TEXT
        );
        CREATE TABLE IF NOT EXISTS services (
          id TEXT PRIMARY KEY,
          name TEXT,
          description TEXT,
          category TEXT,
          status TEXT,
          createdAt TEXT,
          updatedAt TEXT
        );
        CREATE TABLE IF NOT EXISTS service_assignments (
          id TEXT PRIMARY KEY,
          serviceId TEXT,
          entityId TEXT,
          entityType TEXT,
          createdAt TEXT,
          updatedAt TEXT
        );
        CREATE TABLE IF NOT EXISTS beneficiaries (
          id TEXT PRIMARY KEY,
          pseudonym TEXT,
          status TEXT,
          createdAt TEXT,
          updatedAt TEXT,
          firstNameEnc TEXT,
          lastNameEnc TEXT,
          dobEnc TEXT,
          genderEnc TEXT,
          addressEnc TEXT,
          municipalityEnc TEXT,
          nationalityEnc TEXT,
          nationalIdEnc TEXT,
          phoneEnc TEXT,
          emailEnc TEXT,
          ethnicityEnc TEXT,
          residenceEnc TEXT,
          householdMembersEnc TEXT
        );
      `);

      const projStmt = db.prepare('INSERT INTO projects (id, name, description, category, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const p of projects as any[]) {
        projStmt.run(String((p as any).id), (p as any).name || null, (p as any).description || null, (p as any).category || null, (p as any).status || null, String((p as any).get('createdAt')), String((p as any).get('updatedAt')));
      }

      const subStmt = db.prepare('INSERT INTO subprojects (id, projectId, name, description, category, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      for (const s of subprojects as any[]) {
        subStmt.run(String((s as any).id), String((s as any).projectId), (s as any).name || null, (s as any).description || null, (s as any).category || null, (s as any).status || null, String((s as any).get('createdAt')), String((s as any).get('updatedAt')));
      }

      const actStmt = db.prepare('INSERT INTO activities (id, subprojectId, name, description, category, frequency, reportingFields, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const a of activities as any[]) {
        actStmt.run(String((a as any).id), String((a as any).subprojectId), (a as any).name || null, (a as any).description || null, (a as any).category || null, (a as any).frequency || null, JSON.stringify((a as any).get ? (a as any).get('reportingFields') : (a as any).reportingFields) || null, (a as any).status || null, String((a as any).get('createdAt')), String((a as any).get('updatedAt')));
      }

      const userStmt = db.prepare('INSERT INTO users (id, firstName, lastName, email, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const u of users as any[]) {
        userStmt.run(String((u as any).id), (u as any).firstName || null, (u as any).lastName || null, (u as any).email || null, (u as any).status || null, String((u as any).get('createdAt')), String((u as any).get('updatedAt')));
      }

      const puStmt = db.prepare('INSERT INTO project_users (id, projectId, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)');
      for (const pu of projectUsers as any[]) {
        puStmt.run(String((pu as any).id), String((pu as any).projectId), String((pu as any).userId), String((pu as any).get('createdAt')), String((pu as any).get('updatedAt')));
      }

      const suStmt = db.prepare('INSERT INTO subproject_users (id, subprojectId, userId, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?)');
      for (const su of subprojectUsers as any[]) {
        suStmt.run(String((su as any).id), String((su as any).subprojectId), String((su as any).userId), String((su as any).get('createdAt')), String((su as any).get('updatedAt')));
      }

      const ftStmt = db.prepare('INSERT INTO form_templates (id, name, schema, version, status, includeBeneficiaries, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
      for (const ft of formTemplates as any[]) {
        ftStmt.run(String((ft as any).id), (ft as any).name || null, JSON.stringify((ft as any).get('schema')) || null, Number((ft as any).version ?? 1), (ft as any).status || null, (ft as any).includeBeneficiaries ? 1 : 0, String((ft as any).get('createdAt')), String((ft as any).get('updatedAt')));
      }

      const feaStmt = db.prepare('INSERT INTO form_entity_associations (id, formTemplateId, entityId, entityType, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)');
      for (const fea of formEntityAssociations as any[]) {
        feaStmt.run(String((fea as any).id), String((fea as any).formTemplateId), String((fea as any).entityId), String((fea as any).entityType), String((fea as any).get('createdAt')), String((fea as any).get('updatedAt')));
      }

      const svcStmt = db.prepare('INSERT INTO services (id, name, description, category, status, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const s of services as any[]) {
        svcStmt.run(String((s as any).id), (s as any).name || null, (s as any).description || null, (s as any).category || null, (s as any).status || null, String((s as any).get('createdAt')), String((s as any).get('updatedAt')));
      }

      const saStmt = db.prepare('INSERT INTO service_assignments (id, serviceId, entityId, entityType, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)');
      for (const sa of serviceAssignments as any[]) {
        saStmt.run(String((sa as any).id), String((sa as any).serviceId), String((sa as any).entityId), String((sa as any).entityType), String((sa as any).get('createdAt')), String((sa as any).get('updatedAt')));
      }

      const benStmt = db.prepare('INSERT INTO beneficiaries (id, pseudonym, status, createdAt, updatedAt, firstNameEnc, lastNameEnc, dobEnc, genderEnc, addressEnc, municipalityEnc, nationalityEnc, nationalIdEnc, phoneEnc, emailEnc, ethnicityEnc, residenceEnc, householdMembersEnc) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)');
      for (const b of beneficiaries as any[]) {
        benStmt.run(
          b.id, b.pseudonym || null, b.status || null, String(b.createdAt), String(b.updatedAt),
          b.firstNameEnc ? JSON.stringify(b.firstNameEnc) : null,
          b.lastNameEnc ? JSON.stringify(b.lastNameEnc) : null,
          b.dobEnc ? JSON.stringify(b.dobEnc) : null,
          b.genderEnc ? JSON.stringify(b.genderEnc) : null,
          b.addressEnc ? JSON.stringify(b.addressEnc) : null,
          b.municipalityEnc ? JSON.stringify(b.municipalityEnc) : null,
          b.nationalityEnc ? JSON.stringify(b.nationalityEnc) : null,
          b.nationalIdEnc ? JSON.stringify(b.nationalIdEnc) : null,
          b.phoneEnc ? JSON.stringify(b.phoneEnc) : null,
          b.emailEnc ? JSON.stringify(b.emailEnc) : null,
          b.ethnicityEnc ? JSON.stringify(b.ethnicityEnc) : null,
          b.residenceEnc ? JSON.stringify(b.residenceEnc) : null,
          b.householdMembersEnc ? JSON.stringify(b.householdMembersEnc) : null
        );
      }

      db.exec('COMMIT');
    } catch (e) {
      try { db.exec('ROLLBACK'); } catch {}
      throw e;
    } finally {
      db.close();
    }

    const buffer = fs.readFileSync(filePath);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="sync_${new Date().toISOString().replace(/[:.]/g, '-')}.sqlite"`);
    res.status(200).send(buffer);
    fs.unlink(filePath, () => {});
  } catch (error: any) {
    console.error('SYNC full error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error?.message });
  }
};

export const upload = async (req: Request, res: Response) => {
  try {
    const mutations = Array.isArray((req.body as any)?.mutations) ? (req.body as any).mutations : [];
    (req as any).body = { changes: mutations };
    return push(req, res);
  } catch (error: any) {
    console.error('SYNC upload error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error?.message });
  }
};

// New endpoint for entity-specific sync (e.g., subproject page)
export const entitySync = async (req: Request, res: Response) => {
  try {
    const { entityType, entityId } = req.params;
    const sinceRaw = req.body?.since as string | undefined;
    const full = Boolean(req.body?.full);

    if (!['project', 'subproject', 'activity'].includes(entityType)) {
      return res.status(400).json({ success: false, message: 'Invalid entity type. Must be project, subproject, or activity' });
    }

    const since = full || !sinceRaw ? undefined : new Date(sinceRaw);
    const whereUpdated = since ? { updatedAt: { [Op.gte]: since } } : {};

    const roleNames = await getRoleNames(req);
    const isAdmin = roleNames.includes(ROLES.SUPER_ADMIN) || roleNames.includes(ROLES.SYSTEM_ADMINISTRATOR);

    // Get the specific entity and its related data
    let entity: any = null;
    let relatedEntities: any = {};

    if (entityType === 'subproject') {
      entity = await Subproject.findByPk(entityId, {
        include: [
          { model: Project, as: 'project', attributes: ['id', 'name', 'description', 'category', 'status'] },
          { model: Activity, as: 'activities', attributes: ['id', 'name', 'description', 'category', 'frequency', 'reportingFields', 'status'] },
          { model: User, as: 'members', attributes: ['id', 'firstName', 'lastName', 'email', 'status'] }
        ]
      });

      if (entity) {
        // Get all form responses for this subproject and its activities
        const activityIds = entity.activities?.map((a: any) => a.id) || [];
        const formResponses = await FormResponse.findAll({
          where: {
            [Op.or]: [
              { entityType: 'subproject', entityId: entityId },
              { entityType: 'activity', entityId: { [Op.in]: activityIds } }
            ],
            ...whereUpdated
          },
          include: [
            { model: FormTemplate, as: 'formTemplate', attributes: ['id', 'name', 'schema', 'version'] },
            { model: User, as: 'submittedBy', attributes: ['id', 'firstName', 'lastName', 'email'] }
          ]
        });

        // Get all service deliveries for this subproject and its activities
        const serviceDeliveries = await ServiceDelivery.findAll({
          where: {
            [Op.or]: [
              { entityType: 'subproject', entityId: entityId },
              { entityType: 'activity', entityId: { [Op.in]: activityIds } }
            ],
            ...whereUpdated
          },
          include: [
            { model: Service, as: 'service', attributes: ['id', 'name', 'description', 'category'] },
            { model: User, as: 'staffUser', attributes: ['id', 'firstName', 'lastName', 'email'] },
            { model: Beneficiary, as: 'beneficiary', attributes: ['id', 'pseudonym', 'status'] }
          ]
        });

        // Get beneficiaries associated with this subproject
        const beneficiaryAssignments = await BeneficiaryAssignment.findAll({
          where: { entityType: 'subproject', entityId: entityId },
          include: [
            { model: Beneficiary, as: 'beneficiary', attributes: ['id', 'pseudonym', 'status'] }
          ]
        });

        // Get form templates associated with this subproject
        const formEntityAssociations = await FormEntityAssociation.findAll({
          where: {
            [Op.or]: [
              { entityType: 'subproject', entityId: entityId },
              { entityType: 'activity', entityId: { [Op.in]: activityIds } }
            ]
          },
          include: [
            { model: FormTemplate, as: 'formTemplate', attributes: ['id', 'name', 'schema', 'version', 'status'] }
          ]
        });

        // Get services assigned to this subproject
        const serviceAssignments = await ServiceAssignment.findAll({
          where: { entityType: 'subproject', entityId: entityId },
          include: [
            { model: Service, as: 'service', attributes: ['id', 'name', 'description', 'category', 'status'] }
          ]
        });

        relatedEntities = {
          formResponses,
          serviceDeliveries,
          beneficiaryAssignments,
          formEntityAssociations,
          serviceAssignments
        };
      }
    }

    if (!entity) {
      return res.status(404).json({ success: false, message: `${entityType} not found` });
    }

    return res.status(200).json({
      success: true,
      snapshotId: uuidv4(),
      serverTime: new Date().toISOString(),
      entityType,
      entityId,
      entity,
      relatedEntities
    });
  } catch (error: any) {
    console.error('SYNC entity sync error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error', error: error?.message });
  }
};

export default { pull, push, full, upload, entitySync };
