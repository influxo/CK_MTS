import { Request, Response } from 'express';
import sequelize from '../../db/connection';
import { Op } from 'sequelize';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger';
import { AuditLog, Beneficiary, ServiceDelivery, Service, User, Project, Subproject, Activity, FormResponse, BeneficiaryDetails, BeneficiaryAssignment } from '../../models';
import beneficiariesService from '../../services/beneficiaries/beneficiariesService';
import { decryptField } from '../../utils/crypto';
import { ROLES } from '../../constants/roles';

const logger = createLogger('beneficiaries-controller');

const list = async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? Math.max(parseInt(String(req.query.page), 10) || 1, 1) : 1;
    const limit = req.query.limit ? Math.max(1, Math.min(parseInt(String(req.query.limit), 10) || 20, 100)) : 20;
    const offset = (page - 1) * limit;
    const status = req.query.status as 'active' | 'inactive' | undefined;
    const searchParam = req.query.search;
    const chronicConditionCodes = req.query.chronicConditionCodes
      ? String(req.query.chronicConditionCodes).split(',').filter(Boolean)
      : undefined;
    const hasSearch = searchParam && typeof searchParam === 'string' && searchParam.trim();

    // Determine if caller can view decrypted PII
    // Policy: All authenticated users with authorized access can decrypt PII
    // Authorization is enforced at the route level via authorize() middleware
    const canDecrypt = true;
    logger.info('Beneficiaries.list role evaluation', { canDecrypt, chronicConditionCodes });

    // Helper to map a raw beneficiary to response shape
    const mapBeneficiary = (it: any) => {
      const pii = {
        firstName: decryptField(it.firstNameEnc as any),
        lastName: decryptField(it.lastNameEnc as any),
        dob: decryptField(it.dobEnc as any),
        nationalId: decryptField(it.nationalIdEnc as any),
        phone: decryptField(it.phoneEnc as any),
        email: decryptField(it.emailEnc as any),
        address: decryptField(it.addressEnc as any),
        gender: decryptField(it.genderEnc as any),
        municipality: decryptField(it.municipalityEnc as any),
        nationality: decryptField(it.nationalityEnc as any),
        ethnicity: decryptField(it.ethnicityEnc as any),
        residence: decryptField(it.residenceEnc as any),
        householdMembers: decryptField(it.householdMembersEnc as any),
      };
      const base: any = {
        id: it.id,
        pseudonym: it.pseudonym,
        status: it.status,
        createdAt: it.createdAt,
        updatedAt: it.updatedAt,
        piiEnc: {
          firstNameEnc: it.firstNameEnc,
          lastNameEnc: it.lastNameEnc,
          dobEnc: it.dobEnc,
          nationalIdEnc: it.nationalIdEnc,
          phoneEnc: it.phoneEnc,
          emailEnc: it.emailEnc,
          addressEnc: it.addressEnc,
          genderEnc: it.genderEnc,
          municipalityEnc: it.municipalityEnc,
          nationalityEnc: it.nationalityEnc,
          ethnicityEnc: it.ethnicityEnc,
          residenceEnc: it.residenceEnc,
          householdMembersEnc: it.householdMembersEnc,
        },
      };
      if (canDecrypt) base.pii = pii;
      return { mapped: base, pii };
    };

    let items: any[];
    let totalItems: number;
    let totalPages: number;

    if (hasSearch || chronicConditionCodes) {
      // When searching or filtering by chronic conditions, fetch ALL records, decrypt, filter in memory, then paginate
      const allResult = await beneficiariesService.listBeneficiaries({ page: 1, limit: 100000, status, includeEnc: true });
      const searchLower = searchParam ? (searchParam as string).trim().toLowerCase() : '';

      const filtered = allResult.items
        .map((it: any) => {
          const { mapped, pii } = mapBeneficiary(it);
          // Load beneficiary details for chronic condition filtering
          return { mapped, pii, details: it.details?.details || null };
        })
        .filter(({ mapped, pii, details }) => {
          // Search filter
          if (hasSearch) {
            if (mapped.pseudonym && mapped.pseudonym.toLowerCase().includes(searchLower)) return true;
            const piiValues = Object.values(pii) as (string | null)[];
            if (piiValues.some((val) => val && val.toLowerCase().includes(searchLower))) return true;
          }
          // Chronic condition filter (by ICD-10 code)
          if (chronicConditionCodes && chronicConditionCodes.length > 0) {
            const beneficiaryConditionCodes = details?.chronicConditionCodes || [];
            if (!Array.isArray(beneficiaryConditionCodes)) return false;
            const hasMatchingCode = chronicConditionCodes.some((code: string) =>
              beneficiaryConditionCodes.includes(code.toUpperCase())
            );
            if (!hasMatchingCode) return false;
          }
          return hasSearch || true;
        });

      totalItems = filtered.length;
      totalPages = Math.ceil(totalItems / limit);
      items = filtered.slice(offset, offset + limit).map(({ mapped }) => mapped);
    } else {
      // No search or chronic condition filter — use efficient DB-level pagination
      const result = await beneficiariesService.listBeneficiaries({ page, limit, status, includeEnc: true, includeDetails: false });
      items = result.items.map((it: any) => mapBeneficiary(it).mapped);
      totalItems = result.totalItems;
      totalPages = result.totalPages;
    }

    if (canDecrypt) {
      // Audit bulk PII read (list)
      try {
        await AuditLog.create({
          id: uuidv4(),
          userId: req.user.id,
          action: 'BENEFICIARY_PII_LIST_READ',
          description: `Read PII for ${items.length} beneficiaries via GET /beneficiaries`,
          details: JSON.stringify({ count: items.length, page, limit, searched: !!hasSearch }),
          timestamp: new Date(),
        });
      } catch (_) { /* ignore audit failures */ }

      // Prevent caching decrypted responses
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('X-PII-Access', 'decrypt');
    } else {
      res.setHeader('X-PII-Access', 'encrypted');
    }

    return res.status(200).json({ success: true, items, page, limit, totalItems, totalPages });
  } catch (error: any) {
    logger.error('Error listing beneficiaries', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const getById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await sequelize.transaction(async (transaction) => {
      const b = await Beneficiary.findByPk(id, { transaction });
      if (!b) return null;

      // Load additional details (non-PII) if available
      const detailsRow = await BeneficiaryDetails.findOne({ where: { beneficiaryId: id }, attributes: ['details'], transaction });
      const extra = { details: detailsRow ? detailsRow.get('details') : null } as any;

      const base = {
        id: b.id,
        pseudonym: b.pseudonym,
        status: b.status,
        createdAt: b.get('createdAt'),
        updatedAt: b.get('updatedAt'),
        ...extra,
      } as any;

      // Policy: All authenticated users with authorized access can decrypt PII
      // Authorization is enforced at the route level via authorize() middleware
      const canDecrypt = true;
      logger.info('Beneficiaries.getById role evaluation', { id, canDecrypt });

      if (canDecrypt) {
        const piiEnc = {
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
        const pii = {
          firstName: decryptField(piiEnc.firstNameEnc as any),
          lastName: decryptField(piiEnc.lastNameEnc as any),
          dob: decryptField(piiEnc.dobEnc as any),
          nationalId: decryptField(piiEnc.nationalIdEnc as any),
          phone: decryptField(piiEnc.phoneEnc as any),
          email: decryptField(piiEnc.emailEnc as any),
          address: decryptField(piiEnc.addressEnc as any),
          gender: decryptField(piiEnc.genderEnc as any),
          municipality: decryptField(piiEnc.municipalityEnc as any),
          nationality: decryptField(piiEnc.nationalityEnc as any),
          ethnicity: decryptField(piiEnc.ethnicityEnc as any),
          residence: decryptField(piiEnc.residenceEnc as any),
          householdMembers: decryptField(piiEnc.householdMembersEnc as any),
        };

        await AuditLog.create({
          id: uuidv4(),
          userId: req.user.id,
          action: 'BENEFICIARY_PII_READ',
          description: `Read PII for beneficiary '${b.pseudonym}' via GET /beneficiaries/:id`,
          details: JSON.stringify({ beneficiaryId: b.id, fields: Object.keys(pii) }),
          timestamp: new Date(),
        }, { transaction });

        return { data: { ...base, piiEnc, pii }, cacheControl: 'no-store' };
      }

      // Not authorized to decrypt: return encrypted fields
      const piiEnc = {
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

      return { data: { ...base, piiEnc } };
    });

    if (!result) return res.status(404).json({ success: false, message: 'Beneficiary not found' });

    if (result.cacheControl === 'no-store') {
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('X-PII-Access', 'decrypt');
    }
    if (!result.cacheControl) {
      res.setHeader('X-PII-Access', 'encrypted');
    }

    return res.status(200).json({ success: true, data: result.data });
  } catch (error: any) {
    logger.error('Error fetching beneficiary', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

// Return decrypted PII for a beneficiary (RBAC-protected). Never cache.
const getPIIById = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await sequelize.transaction(async (transaction) => {
      const b = await Beneficiary.findByPk(id, { transaction });
      if (!b) return null;

      const pii = {
        firstName: decryptField(b.get('firstNameEnc') as any),
        lastName: decryptField(b.get('lastNameEnc') as any),
        dob: decryptField(b.get('dobEnc') as any),
        nationalId: decryptField(b.get('nationalIdEnc') as any),
        phone: decryptField(b.get('phoneEnc') as any),
        email: decryptField(b.get('emailEnc') as any),
        address: decryptField(b.get('addressEnc') as any),
        gender: decryptField(b.get('genderEnc') as any),
        municipality: decryptField(b.get('municipalityEnc') as any),
        nationality: decryptField(b.get('nationalityEnc') as any),
        ethnicity: decryptField(b.get('ethnicityEnc') as any),
        residence: decryptField(b.get('residenceEnc') as any),
        householdMembers: decryptField(b.get('householdMembersEnc') as any),
      } as const;

      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'BENEFICIARY_PII_READ',
        description: `Read PII for beneficiary '${b.pseudonym}'`,
        details: JSON.stringify({ beneficiaryId: b.id, fields: Object.keys(pii) }),
        timestamp: new Date(),
      }, { transaction });

      return { id: b.id, pseudonym: b.pseudonym, status: b.status, pii };
    });

    if (!result) return res.status(404).json({ success: false, message: 'Beneficiary not found' });

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    logger.error('Error reading beneficiary PII', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const create = async (req: Request, res: Response) => {
  const input = {
    firstName: req.body?.firstName ?? null,
    lastName: req.body?.lastName ?? null,
    dob: req.body?.dob ?? null,
    nationalId: req.body?.nationalId ?? null,
    phone: req.body?.phone ?? null,
    email: req.body?.email ?? null,
    address: req.body?.address ?? null,
    gender: req.body?.gender ?? null,
    status: req.body?.status ?? 'active',
    municipality: req.body?.municipality ?? null,
    nationality: req.body?.nationality ?? null,
    ethnicity: req.body?.ethnicity ?? null,
    residence: req.body?.residence ?? null,
    householdMembers: req.body?.householdMembers ?? null,
  } as any;
  const details = (req.body && typeof req.body.details === 'object') ? req.body.details : null;

  try {
    const created = await sequelize.transaction(async (transaction) => {
      const safe = await beneficiariesService.createBeneficiary(input, { transaction, userId: req.user.id });

      // If details provided, upsert BeneficiaryDetails linked to this beneficiary
      // Convert chronicConditions (IDs) to chronicConditionCodes (ICD-10 codes) if needed
      if (details) {
        const processedDetails = { ...details };
        // If chronicConditions array is provided, convert to chronicConditionCodes
        if (details.chronicConditions && Array.isArray(details.chronicConditions)) {
          const { CHRONIC_CONDITIONS } = await import('../../constants/chronicConditions');
          const codes = details.chronicConditions
            .map((id: string) => (CHRONIC_CONDITIONS as any)[id]?.code)
            .filter((code: string) => code !== undefined);
          processedDetails.chronicConditionCodes = codes;
          delete processedDetails.chronicConditions;
        }
        await BeneficiaryDetails.upsert({
          id: uuidv4(),
          beneficiaryId: safe.id,
          details: processedDetails,
        }, { transaction });
      }

      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'BENEFICIARY_CREATE',
        description: `Created beneficiary '${safe.pseudonym}'`,
        details: JSON.stringify({ beneficiaryId: safe.id, hasDetails: !!details }),
        timestamp: new Date(),
      }, { transaction });

      // Attach details to response (non-PII)
      return { ...safe, details: details ?? null };
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    logger.error('Error creating beneficiary', { 
      error: error.message, 
      stack: error.stack,
      sql: error.sql,
      original: error.original?.message 
    });
    return res.status(500).json({ 
      success: false, 
      message: 'Internal server error',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

const update = async (req: Request, res: Response) => {
  const { id } = req.params;
  const input = {
    firstName: req.body?.firstName,
    lastName: req.body?.lastName,
    dob: req.body?.dob,
    nationalId: req.body?.nationalId,
    phone: req.body?.phone,
    email: req.body?.email,
    address: req.body?.address,
    gender: req.body?.gender,
    status: req.body?.status,
    municipality: req.body?.municipality,
    nationality: req.body?.nationality,
    ethnicity: req.body?.ethnicity,
    residence: req.body?.residence,
    householdMembers: req.body?.householdMembers,
  } as any;

  try {
    const updated = await sequelize.transaction(async (transaction) => {
      const safe = await beneficiariesService.updateBeneficiary(id, input, { transaction, userId: req.user.id });
      if (!safe) return null;

      const changedFields = Object.keys(req.body || {});
      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'BENEFICIARY_UPDATE',
        description: `Updated beneficiary '${safe.pseudonym}'`,
        details: JSON.stringify({ beneficiaryId: safe.id, changedFields }),
        timestamp: new Date(),
      }, { transaction });

      return safe;
    });

    if (!updated) return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    return res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    logger.error('Error updating beneficiary', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const setStatus = async (req: Request, res: Response) => {
  const { id } = req.params;
  const { status } = req.body || {};
  if (!status || !['active', 'inactive'].includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status. Must be 'active' or 'inactive'" });
  }

  try {
    const updated = await sequelize.transaction(async (transaction) => {
      const safe = await beneficiariesService.setBeneficiaryStatus(id, status, { transaction, userId: req.user.id });
      if (!safe) return null;

      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'BENEFICIARY_STATUS_UPDATE',
        description: `Updated beneficiary status for '${safe.pseudonym}' to ${status}`,
        details: JSON.stringify({ beneficiaryId: safe.id, status }),
        timestamp: new Date(),
      }, { transaction });

      return safe;
    });

    if (!updated) return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    return res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    logger.error('Error setting beneficiary status', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const remove = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const removed = await sequelize.transaction(async (transaction) => {
      const safe = await beneficiariesService.setBeneficiaryStatus(id, 'inactive', { transaction, userId: req.user.id });
      if (!safe) return null;

      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'BENEFICIARY_DELETE',
        description: `Deactivated beneficiary '${safe.pseudonym}'`,
        details: JSON.stringify({ beneficiaryId: safe.id }),
        timestamp: new Date(),
      }, { transaction });

      return safe;
    });

    if (!removed) return res.status(404).json({ success: false, message: 'Beneficiary not found' });
    return res.status(200).json({ success: true, data: removed });
  } catch (error: any) {
    logger.error('Error deleting beneficiary', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const servicesForBeneficiary = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    // Validate beneficiary exists (quick check)
    const exists = await Beneficiary.findByPk(id, { attributes: ['id'] });
    if (!exists) return res.status(404).json({ success: false, message: 'Beneficiary not found' });

    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
    const limitRaw = parseInt(String(req.query.limit || '20'), 10) || 20;
    const limit = Math.max(1, Math.min(limitRaw, 100));
    const offset = (page - 1) * limit;
    const fromDate = req.query.fromDate ? new Date(String(req.query.fromDate)) : null;
    const toDate = req.query.toDate ? new Date(String(req.query.toDate)) : null;

    const where: any = { beneficiaryId: id };
    if (fromDate && toDate) where.deliveredAt = { [Op.between]: [fromDate, toDate] };
    else if (fromDate) where.deliveredAt = { [Op.gte]: fromDate };
    else if (toDate) where.deliveredAt = { [Op.lte]: toDate };

    // Fetch deliveries with service and staff basic info
    const { rows, count } = await ServiceDelivery.findAndCountAll({
      where,
      limit,
      offset,
      order: [['deliveredAt', 'DESC']],
      include: [
        { model: Service, as: 'service', attributes: ['id', 'name', 'category'] },
        { model: User, as: 'staff', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
    });

    // Collect entity IDs by type for name resolution
    const projIds = new Set<string>();
    const subIds = new Set<string>();
    const actIds = new Set<string>();
    for (const d of rows) {
      const t = d.get('entityType') as string;
      const eId = String(d.get('entityId'));
      if (t === 'project') projIds.add(eId);
      else if (t === 'subproject') subIds.add(eId);
      else if (t === 'activity') actIds.add(eId);
    }

    // Bulk load entities
    const [projects, subprojects, activities] = await Promise.all([
      projIds.size ? Project.findAll({ where: { id: Array.from(projIds) }, attributes: ['id', 'name'] }) : Promise.resolve([] as any[]),
      subIds.size ? Subproject.findAll({ where: { id: Array.from(subIds) }, attributes: ['id', 'name', 'projectId'] }) : Promise.resolve([] as any[]),
      actIds.size ? Activity.findAll({ where: { id: Array.from(actIds) }, attributes: ['id', 'name', 'subprojectId'] }) : Promise.resolve([] as any[]),
    ]);

    const projMap = new Map(projects.map((p: any) => [String(p.id), { id: p.id, name: p.name, type: 'project' }]));
    const subMap = new Map(subprojects.map((s: any) => [String(s.id), { id: s.id, name: s.name, type: 'subproject', projectId: s.projectId }]));
    const actMap = new Map(activities.map((a: any) => [String(a.id), { id: a.id, name: a.name, type: 'activity', subprojectId: a.subprojectId }]));

    // Access filter: if user has restricted allowedProgramIds, drop deliveries whose entityId not allowed
    let deliveries = rows as any[];
    const allowed = (req.user && Array.isArray(req.user.allowedProgramIds)) ? new Set<string>(req.user.allowedProgramIds as any) : null;
    if (allowed) deliveries = deliveries.filter(d => {
      const t = d.get('entityType') as 'project' | 'subproject' | 'activity';
      const eId = String(d.get('entityId'));
      if (t === 'project') return allowed.has(eId);
      if (t === 'subproject') {
        const sub = subMap.get(eId);
        return sub ? allowed.has(sub.projectId) : false;
      }
      if (t === 'activity') {
        const act = actMap.get(eId) || null;
        const sub = act ? subMap.get(String(act.subprojectId)) : undefined;
        return sub ? allowed.has(sub.projectId) : false;
      }
      return false;
    });

    // Enrich deliveries with entity names
    const items = deliveries.map(d => {
      const entityType = d.get('entityType') as 'project' | 'subproject' | 'activity';
      const entityId = String(d.get('entityId'));
      let entity: any = { id: entityId, type: entityType };
      if (entityType === 'project') entity = projMap.get(entityId) || entity;
      if (entityType === 'subproject') entity = subMap.get(entityId) || entity;
      if (entityType === 'activity') entity = actMap.get(entityId) || entity;
      const sd: any = d as any; // eager-loaded associations are available at runtime but not in TS typings
      return {
        id: d.get('id'),
        service: sd.service ? { id: sd.service.id, name: sd.service.name, category: sd.service.category } : null,
        deliveredAt: d.get('deliveredAt'),
        staff: sd.staff ? { id: sd.staff.id, firstName: sd.staff.firstName, lastName: sd.staff.lastName, email: sd.staff.email } : null,
        notes: d.get('notes'),
        entity,
        formResponseId: d.get('formResponseId') || null,
      };
    });

    const totalPages = Math.ceil(count / limit);
    return res.status(200).json({ success: true, data: items, meta: { page, limit, totalPages, totalItems: count } });
  } catch (error: any) {
    logger.error('Error fetching beneficiary services', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const entitiesForBeneficiary = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const exists = await Beneficiary.findByPk(id, { attributes: ['id'] });
    if (!exists) return res.status(404).json({ success: false, message: 'Beneficiary not found' });

    // Pull entities from FormResponse, where beneficiary was associated via forms
    const responses = await FormResponse.findAll({
      where: { beneficiaryId: id },
      attributes: ['id', 'formTemplateId', 'entityId', 'entityType', 'submittedAt'],
      order: [['submittedAt', 'DESC']],
    });

    // Initial ID collections for enrichment (names + parent mapping)
    const projIds = new Set<string>();
    const subIds = new Set<string>();
    const actIds = new Set<string>();
    for (const r of responses) {
      const t = r.get('entityType') as string;
      const eId = String(r.get('entityId'));
      if (t === 'project') projIds.add(eId);
      else if (t === 'subproject') subIds.add(eId);
      else if (t === 'activity') actIds.add(eId);
    }

    // We'll also include ServiceDeliveries; collect after fetching to expand sub/act IDs if needed

    // Preload entities we already know from form responses
    const [projectsA, subprojectsA, activitiesA] = await Promise.all([
      projIds.size ? Project.findAll({ where: { id: Array.from(projIds) }, attributes: ['id', 'name'] }) : Promise.resolve([] as any[]),
      subIds.size ? Subproject.findAll({ where: { id: Array.from(subIds) }, attributes: ['id', 'name', 'projectId'] }) : Promise.resolve([] as any[]),
      actIds.size ? Activity.findAll({ where: { id: Array.from(actIds) }, attributes: ['id', 'name', 'subprojectId'] }) : Promise.resolve([] as any[]),
    ]);

    const projById = new Map(projectsA.map((p: any) => [String(p.id), { id: String(p.id), name: p.name }]));
    const subById = new Map(subprojectsA.map((s: any) => [String(s.id), { id: String(s.id), name: s.name, projectId: String(s.projectId) }]));
    const actById = new Map(activitiesA.map((a: any) => [String(a.id), { id: String(a.id), name: a.name, subprojectId: String(a.subprojectId) }]));

    // Access filter: allowedProgramIds are project IDs. Map subproject/activity to its parent project before filtering.
    const allowed = (req.user && Array.isArray(req.user.allowedProgramIds)) ? new Set<string>((req.user.allowedProgramIds as any).map(String)) : null;
    const responsesFiltered = allowed
      ? responses.filter(r => {
          const t = r.get('entityType') as 'project' | 'subproject' | 'activity';
          const eId = String(r.get('entityId'));
          if (t === 'project') return allowed.has(eId);
          if (t === 'subproject') {
            const sub = subById.get(eId);
            return sub ? allowed.has(sub.projectId) : false;
          }
          if (t === 'activity') {
            const act = actById.get(eId) || null;
            const sub = act ? subById.get(String(act.subprojectId)) : undefined;
            return sub ? allowed.has(sub.projectId) : false;
          }
          return false;
        })
      : responses;

    // Also fetch services delivered to this beneficiary and apply the same access filter
    const deliveries = await ServiceDelivery.findAll({
      where: { beneficiaryId: id },
      attributes: ['id', 'serviceId', 'entityId', 'entityType', 'deliveredAt', 'notes', 'formResponseId', 'staffUserId'],
      order: [['deliveredAt', 'DESC']],
      include: [
        { model: Service, as: 'service', attributes: ['id', 'name', 'category'] },
        { model: User, as: 'staff', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
    });

    // Enrich ID sets with any entities referenced only by service deliveries
    for (const d of deliveries) {
      const t = d.get('entityType') as string;
      const eId = String(d.get('entityId'));
      if (t === 'project' && !projById.has(eId)) projIds.add(eId);
      else if (t === 'subproject' && !subById.has(eId)) subIds.add(eId);
      else if (t === 'activity' && !actById.has(eId)) actIds.add(eId);
    }

    // Load any missing entity records discovered via deliveries
    const [projectsB, subprojectsB, activitiesB] = await Promise.all([
      projIds.size ? Project.findAll({ where: { id: Array.from(projIds).filter(id2 => !projById.has(id2)) }, attributes: ['id', 'name'] }) : Promise.resolve([] as any[]),
      subIds.size ? Subproject.findAll({ where: { id: Array.from(subIds).filter(id2 => !subById.has(id2)) }, attributes: ['id', 'name', 'projectId'] }) : Promise.resolve([] as any[]),
      actIds.size ? Activity.findAll({ where: { id: Array.from(actIds).filter(id2 => !actById.has(id2)) }, attributes: ['id', 'name', 'subprojectId'] }) : Promise.resolve([] as any[]),
    ]);
    for (const p of projectsB) projById.set(String(p.id), { id: String(p.id), name: p.name });
    for (const s of subprojectsB) subById.set(String(s.id), { id: String(s.id), name: s.name, projectId: String(s.projectId) });
    for (const a of activitiesB) actById.set(String(a.id), { id: String(a.id), name: a.name, subprojectId: String(a.subprojectId) });

    const deliveriesFiltered = allowed
      ? deliveries.filter(d => {
          const t = d.get('entityType') as 'project' | 'subproject' | 'activity';
          const eId = String(d.get('entityId'));
          if (t === 'project') return allowed.has(eId);
          if (t === 'subproject') {
            const sub = subById.get(eId);
            return sub ? allowed.has(sub.projectId) : false;
          }
          if (t === 'activity') {
            const act = actById.get(eId) || null;
            const sub = act ? subById.get(String(act.subprojectId)) : undefined;
            return sub ? allowed.has(sub.projectId) : false;
          }
          return false;
        })
      : deliveries;

    // Group by entity key and assemble payloads
    type EntityKey = string;
    interface EntityBucket {
      entityId: string;
      entityType: 'project' | 'subproject' | 'activity';
      formResponses: Array<{ id: string; formTemplateId: string; submittedAt: Date }>;
      services: Array<{ id: string; service: { id: string; name: string; category: string } | null; deliveredAt: Date; staff: { id: string; firstName: string; lastName: string; email: string } | null; notes: any; formResponseId: string | null }>;
    }

    const buckets = new Map<EntityKey, EntityBucket>();

    // Seed from form responses
    for (const r of responsesFiltered) {
      const type = r.get('entityType') as 'project' | 'subproject' | 'activity';
      const entityId = String(r.get('entityId'));
      const key = `${type}:${entityId}`;
      if (!buckets.has(key)) {
        buckets.set(key, { entityId, entityType: type, formResponses: [], services: [] });
      }
      buckets.get(key)!.formResponses.push({
        id: String(r.get('id')),
        formTemplateId: String(r.get('formTemplateId')),
        submittedAt: r.get('submittedAt') as Date,
      });
    }

    // Add deliveries
    for (const d of deliveriesFiltered) {
      const type = d.get('entityType') as 'project' | 'subproject' | 'activity';
      const entityId = String(d.get('entityId'));
      const key = `${type}:${entityId}`;
      if (!buckets.has(key)) {
        buckets.set(key, { entityId, entityType: type, formResponses: [], services: [] });
      }
      const sd: any = d as any; // eager-loaded associations are available at runtime but not in TS typings
      buckets.get(key)!.services.push({
        id: String(d.get('id')),
        service: sd.service ? { id: sd.service.id, name: sd.service.name, category: sd.service.category } : null,
        deliveredAt: d.get('deliveredAt'),
        staff: sd.staff ? { id: sd.staff.id, firstName: sd.staff.firstName, lastName: sd.staff.lastName, email: sd.staff.email } : null,
        notes: d.get('notes'),
        formResponseId: (d.get('formResponseId') ? String(d.get('formResponseId')) : null),
      });
    }

    // Build final list with entity names
    const items = Array.from(buckets.values()).map(g => {
      let name: string | undefined;
      if (g.entityType === 'project') name = projById.get(g.entityId)?.name;
      else if (g.entityType === 'subproject') name = subById.get(g.entityId)?.name;
      else name = actById.get(g.entityId)?.name;
      return {
        entity: { id: g.entityId, type: g.entityType, name },
        formResponses: g.formResponses.sort((a, b) => (b.submittedAt as any) - (a.submittedAt as any)),
        services: g.services.sort((a, b) => (b.deliveredAt as any) - (a.deliveredAt as any)),
      };
    });

    return res.status(200).json({ success: true, data: items });
  } catch (error: any) {
    logger.error('Error fetching beneficiary entities', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const demographics = async (req: Request, res: Response) => {
  try {
    // Policy: All authenticated users with authorized access can decrypt PII
    // Authorization is enforced at the route level via authorize() middleware
    const canDecrypt = true;

    const beneficiaries = await Beneficiary.findAll({
      attributes: ['dobEnc', 'genderEnc'],
      order: [['createdAt', 'DESC']],
    });

    const now = new Date();
    const ageBuckets: Record<string, number> = { '0-20': 0, '19-35': 0, '36-55': 0, '55+': 0 };
    const genderCounts: Record<string, number> = { M: 0, F: 0, Unknown: 0 };

    const calcAge = (dobIso?: string | null) => {
      if (!dobIso) return null;
      const d = new Date(dobIso);
      if (isNaN(d.getTime())) return null;
      let age = now.getFullYear() - d.getFullYear();
      const m = now.getMonth() - d.getMonth();
      if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
      return age;
    };

    for (const b of beneficiaries) {
      const dob = decryptField(b.get('dobEnc') as any) as string | null;
      const gender = (decryptField(b.get('genderEnc') as any) as 'M' | 'F' | null) || null;

      const age = calcAge(dob);
      if (age != null) {
        if (age <= 20) ageBuckets['0-20']++;
        else if (age <= 35) ageBuckets['19-35']++;
        else if (age <= 55) ageBuckets['36-55']++;
        else ageBuckets['55+']++;
      }

      if (gender === 'M') genderCounts.M++;
      else if (gender === 'F') genderCounts.F++;
      else genderCounts.Unknown++;
    }

    // Audit aggregate PII read
    try {
      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'BENEFICIARY_PII_AGGREGATE',
        description: 'Computed beneficiary demographics',
        details: JSON.stringify({ total: beneficiaries.length }),
        timestamp: new Date(),
      });
    } catch (_) { /* ignore */ }

    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('X-PII-Access', 'decrypt');

    return res.status(200).json({
      success: true,
      data: {
        age: [
          { name: '0-20', value: ageBuckets['0-20'] },
          { name: '19-35', value: ageBuckets['19-35'] },
          { name: '36-55', value: ageBuckets['36-55'] },
          { name: '55+', value: ageBuckets['55+'] },
        ],
        gender: [
          { name: 'Male', count: genderCounts.M },
          { name: 'Female', count: genderCounts.F },
          { name: 'Unknown', count: genderCounts.Unknown },
        ],
      },
    });
  } catch (error: any) {
    logger.error('Error computing demographics', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const serviceHistoryForBeneficiary = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const exists = await Beneficiary.findByPk(id, { attributes: ['id'] });
    if (!exists) return res.status(404).json({ success: false, message: 'Beneficiary not found' });

    const page = Math.max(parseInt(String(req.query.page || '1'), 10) || 1, 1);
    const limitRaw = parseInt(String(req.query.limit || '50'), 10) || 50;
    const limit = Math.max(1, Math.min(limitRaw, 200));
    const offset = (page - 1) * limit;
    const fromDate = req.query.fromDate ? new Date(String(req.query.fromDate)) : null;
    const toDate = req.query.toDate ? new Date(String(req.query.toDate)) : null;

    const where: any = { beneficiaryId: id };
    if (fromDate && toDate) where.deliveredAt = { [Op.between]: [fromDate, toDate] };
    else if (fromDate) where.deliveredAt = { [Op.gte]: fromDate };
    else if (toDate) where.deliveredAt = { [Op.lte]: toDate };

    const { rows, count } = await ServiceDelivery.findAndCountAll({
      where,
      limit,
      offset,
      order: [['deliveredAt', 'ASC']],
      include: [
        { model: Service, as: 'service', attributes: ['id', 'name', 'category'] },
        { model: User, as: 'staff', attributes: ['id', 'firstName', 'lastName', 'email'] },
      ],
    });

    // RBAC: filter by allowedProgramIds (project IDs); map subproject/activity to its parent project
    let deliveries = rows as any[];
    const allowed = (req.user && Array.isArray(req.user.allowedProgramIds)) ? new Set<string>(req.user.allowedProgramIds as any) : null;
    if (allowed) deliveries = deliveries.filter(d => {
      const t = d.get('entityType') as 'project' | 'subproject' | 'activity';
      const eId = String(d.get('entityId'));
      if (t === 'project') return allowed.has(eId);
      if (t === 'subproject') return true; // parent mapping resolved below with names
      if (t === 'activity') return true;
      return false;
    });

    // Collect IDs for name resolution
    const projIds = new Set<string>();
    const subIds = new Set<string>();
    const actIds = new Set<string>();
    for (const d of deliveries) {
      const t = d.get('entityType') as string;
      const eId = String(d.get('entityId'));
      if (t === 'project') projIds.add(eId);
      else if (t === 'subproject') subIds.add(eId);
      else if (t === 'activity') actIds.add(eId);
    }

    const [projects, subs, acts] = await Promise.all([
      projIds.size ? Project.findAll({ where: { id: Array.from(projIds) }, attributes: ['id', 'name'] }) : Promise.resolve([] as any[]),
      subIds.size ? Subproject.findAll({ where: { id: Array.from(subIds) }, attributes: ['id', 'name', 'projectId'] }) : Promise.resolve([] as any[]),
      actIds.size ? Activity.findAll({ where: { id: Array.from(actIds) }, attributes: ['id', 'name', 'subprojectId'] }) : Promise.resolve([] as any[]),
    ]);

    const projMap = new Map(projects.map((p: any) => [String(p.id), { id: String(p.id), name: p.name }]));
    const subMap = new Map(subs.map((s: any) => [String(s.id), { id: String(s.id), name: s.name, projectId: String(s.projectId) }]));
    const actMap = new Map(acts.map((a: any) => [String(a.id), { id: String(a.id), name: a.name, subprojectId: String(a.subprojectId) }]));

    // Apply full RBAC for subproject/activity by mapping to parent project IDs
    if (allowed) {
      deliveries = deliveries.filter(d => {
        const t = d.get('entityType') as 'project' | 'subproject' | 'activity';
        const eId = String(d.get('entityId'));
        if (t === 'project') return allowed.has(eId);
        if (t === 'subproject') {
          const sub = subMap.get(eId);
          return sub ? allowed.has(sub.projectId) : false;
        }
        if (t === 'activity') {
          const act = actMap.get(eId) || null;
          const sub = act ? subMap.get(String(act.subprojectId)) : undefined;
          return sub ? allowed.has(sub.projectId) : false;
        }
        return false;
      });
    }

    const items = deliveries.map(d => {
      const entityType = d.get('entityType') as 'project' | 'subproject' | 'activity';
      const entityId = String(d.get('entityId'));
      let entity: any = { id: entityId, type: entityType };
      if (entityType === 'project') entity = projMap.get(entityId) || entity;
      if (entityType === 'subproject') entity = subMap.get(entityId) || entity;
      if (entityType === 'activity') entity = actMap.get(entityId) || entity;
      const sd: any = d as any;
      return {
        id: d.get('id'),
        service: sd.service ? { id: sd.service.id, name: sd.service.name, category: sd.service.category } : null,
        deliveredAt: d.get('deliveredAt'),
        staff: sd.staff ? { id: sd.staff.id, firstName: sd.staff.firstName, lastName: sd.staff.lastName, email: sd.staff.email } : null,
        notes: d.get('notes'),
        entity,
        formResponseId: d.get('formResponseId') || null,
      };
    });

    const totalPages = Math.ceil(count / limit);
    return res.status(200).json({ success: true, data: items, meta: { page, limit, totalPages, totalItems: count } });
  } catch (error: any) {
    logger.error('Error fetching beneficiary service history', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const associateWithEntity = async (req: Request, res: Response) => {
  const { id } = req.params; // beneficiaryId
  // Accept either an array at root, or { associations: [...] }, or a single object
  const raw = Array.isArray(req.body) ? req.body : (Array.isArray(req.body?.associations) ? req.body.associations : [req.body]);
  const associations: Array<{ entityId: string; entityType: 'project' | 'subproject' }> = (raw || []).filter(Boolean);

  if (!associations.length) {
    return res.status(400).json({ success: false, message: "Request body must be an array of {entityId, entityType} (or provide 'associations' array)" });
  }

  // Basic validation and deduplication
  const normalized: Array<{ entityId: string; entityType: 'project' | 'subproject' }> = [];
  const seen = new Set<string>();
  for (const a of associations) {
    const eId = String(a?.entityId || '').trim();
    const eType = String(a?.entityType || '').trim() as any;
    if (!eId || !['project', 'subproject'].includes(eType)) {
      return res.status(400).json({ success: false, message: "Each association requires 'entityId' and valid 'entityType' ('project'|'subproject')" });
    }
    const key = `${eType}:${eId}`;
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push({ entityId: eId, entityType: eType });
    }
  }

  try {
    // Validate beneficiary
    const beneficiary = await Beneficiary.findByPk(id, { attributes: ['id', 'pseudonym'] });
    if (!beneficiary) return res.status(404).json({ success: false, message: 'Beneficiary not found' });

    const allowed = (req.user && Array.isArray(req.user.allowedProgramIds)) ? new Set<string>((req.user.allowedProgramIds as any).map(String)) : null;

    const results: Array<{ entityId: string; entityType: 'project' | 'subproject'; created: boolean; id?: string }> = [];

    // Process each association
    for (const { entityId, entityType } of normalized) {
      // Validate entity and RBAC per-entity
      let projectIdForAuth: string | null = null;
      if (entityType === 'project') {
        const proj = await Project.findByPk(entityId, { attributes: ['id'] });
        if (!proj) {
          results.push({ entityId, entityType, created: false });
          continue;
        }
        projectIdForAuth = String(proj.id);
      } else {
        const sub = await Subproject.findByPk(entityId, { attributes: ['id', 'projectId'] });
        if (!sub) {
          results.push({ entityId, entityType, created: false });
          continue;
        }
        projectIdForAuth = String(sub.projectId);
      }

      if (allowed && projectIdForAuth && !allowed.has(projectIdForAuth)) {
        // Skip unauthorized entity
        results.push({ entityId, entityType, created: false });
        continue;
      }

      const [row, created] = await BeneficiaryAssignment.findOrCreate({
        where: { beneficiaryId: id, entityId, entityType },
        defaults: { id: undefined as unknown as string, beneficiaryId: id, entityId, entityType },
      });
      results.push({ entityId, entityType, created, id: String(row.get('id')) });
    }

    // Audit once summarizing batch
    try {
      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'BENEFICIARY_ASSIGN_ENTITY_BATCH',
        description: `Associated beneficiary '${beneficiary.pseudonym}' to ${results.length} entities (batch)`,
        details: JSON.stringify({ beneficiaryId: id, results }),
        timestamp: new Date(),
      });
    } catch (_) { /* ignore */ }

    const createdCount = results.filter(r => r.created).length;
    const existingCount = results.length - createdCount;
    return res.status(200).json({ success: true, data: { created: createdCount, existing: existingCount, results } });
  } catch (error: any) {
    logger.error('Error associating beneficiary with entities', { id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const dissociateFromEntity = async (req: Request, res: Response) => {
  const { id } = req.params; // beneficiaryId
  const { entityId, entityType } = req.body || {};
  if (!entityId || !['project', 'subproject'].includes(entityType)) {
    return res.status(400).json({ success: false, message: "entityId and valid entityType ('project'|'subproject') are required" });
  }

  try {
    // Validate beneficiary
    const beneficiary = await Beneficiary.findByPk(id, { attributes: ['id', 'pseudonym'] });
    if (!beneficiary) return res.status(404).json({ success: false, message: 'Beneficiary not found' });

    // RBAC project-level check
    let projectIdForAuth: string | null = null;
    if (entityType === 'project') {
      const proj = await Project.findByPk(String(entityId), { attributes: ['id'] });
      if (!proj) return res.status(404).json({ success: false, message: 'Project not found' });
      projectIdForAuth = String(proj.id);
    } else {
      const sub = await Subproject.findByPk(String(entityId), { attributes: ['id', 'projectId'] });
      if (!sub) return res.status(404).json({ success: false, message: 'Subproject not found' });
      projectIdForAuth = String(sub.projectId);
    }
    const allowed = (req.user && Array.isArray(req.user.allowedProgramIds)) ? new Set<string>((req.user.allowedProgramIds as any).map(String)) : null;
    if (allowed && projectIdForAuth && !allowed.has(projectIdForAuth)) {
      return res.status(403).json({ success: false, message: 'Forbidden: not allowed for this entity\'s project' });
    }

    const count = await BeneficiaryAssignment.destroy({ where: { beneficiaryId: id, entityId: String(entityId), entityType } });

    try {
      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'BENEFICIARY_UNASSIGN_ENTITY',
        description: `Dissociated beneficiary '${beneficiary.pseudonym}' from ${entityType} ${entityId}`,
        details: JSON.stringify({ beneficiaryId: id, entityId: String(entityId), entityType, removed: count }),
        timestamp: new Date(),
      });
    } catch (_) { /* ignore */ }

    return res.status(200).json({ success: true, data: { removed: count } });
  } catch (error: any) {
    logger.error('Error dissociating beneficiary from entity', { id, entityId, entityType, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const listByEntity = async (req: Request, res: Response) => {
  const entityId = String(req.query.entityId || '');
  const entityType = String(req.query.entityType || '');
  const status = (req.query.status as 'active' | 'inactive' | undefined) || undefined;
  if (!entityId || !['project', 'subproject'].includes(entityType)) {
    return res.status(400).json({ success: false, message: "Query params 'entityId' and valid 'entityType' ('project'|'subproject') are required" });
  }

  try {
    // RBAC project-level check and gather scope
    let projectIdForAuth: string | null = null;
    let subprojectIds: string[] = [];
    if (entityType === 'project') {
      const proj = await Project.findByPk(entityId, { attributes: ['id'] });
      if (!proj) return res.status(404).json({ success: false, message: 'Project not found' });
      projectIdForAuth = String(proj.id);
      // collect subprojects under this project
      const subs = await Subproject.findAll({ where: { projectId: proj.id }, attributes: ['id'] });
      subprojectIds = subs.map((s: any) => String(s.id));
    } else {
      const sub = await Subproject.findByPk(entityId, { attributes: ['id', 'projectId'] });
      if (!sub) return res.status(404).json({ success: false, message: 'Subproject not found' });
      projectIdForAuth = String(sub.projectId);
    }
    const allowed = (req.user && Array.isArray(req.user.allowedProgramIds)) ? new Set<string>((req.user.allowedProgramIds as any).map(String)) : null;
    if (allowed && projectIdForAuth && !allowed.has(projectIdForAuth)) {
      return res.status(403).json({ success: false, message: 'Forbidden' });
    }

    const page = req.query.page ? Math.max(parseInt(String(req.query.page), 10) || 1, 1) : 1;
    const limitRaw = req.query.limit ? parseInt(String(req.query.limit), 10) || 20 : 20;
    const limit = Math.max(1, Math.min(limitRaw, 100));
    const offset = (page - 1) * limit;

    // Gather assignments for the scope
    let assignments: any[] = [];
    if (entityType === 'project') {
      const projectAssignments = await BeneficiaryAssignment.findAll({
        where: { entityType: 'project', entityId },
        attributes: ['beneficiaryId', 'createdAt'],
        order: [['createdAt', 'DESC']],
      });
      const subAssignments = subprojectIds.length
        ? await BeneficiaryAssignment.findAll({
            where: { entityType: 'subproject', entityId: subprojectIds },
            attributes: ['beneficiaryId', 'createdAt'],
            order: [['createdAt', 'DESC']],
          })
        : [];
      assignments = [...projectAssignments, ...subAssignments];
    } else {
      assignments = await BeneficiaryAssignment.findAll({
        where: { entityType: 'subproject', entityId },
        attributes: ['beneficiaryId', 'createdAt'],
        order: [['createdAt', 'DESC']],
      });
    }

    // Deduplicate by beneficiary, track most recent assignment date for sorting
    const latestMap = new Map<string, Date>();
    for (const a of assignments) {
      const bId = String(a.get('beneficiaryId'));
      const dt = new Date(String(a.get('createdAt')));
      const prev = latestMap.get(bId);
      if (!prev || dt > prev) latestMap.set(bId, dt);
    }
    let uniqueIds = Array.from(latestMap.entries())
      .sort((a, b) => (b[1] as any) - (a[1] as any))
      .map(([bid]) => bid);

    // Optional status filter: pre-filter IDs using a light query
    if (status && uniqueIds.length) {
      const candidates = await Beneficiary.findAll({ where: { id: uniqueIds, status }, attributes: ['id'] });
      const allowedIdSet = new Set(candidates.map(c => String(c.id)));
      uniqueIds = uniqueIds.filter(id2 => allowedIdSet.has(id2));
    }

    // Policy: All authenticated users with authorized access can decrypt PII
    // Authorization is enforced at the route level via authorize() middleware
    const canDecrypt = true;

    const searchParam = req.query.search;
    const hasSearch = searchParam && typeof searchParam === 'string' && searchParam.trim();

    // Helper to map a raw beneficiary to response shape
    const mapBeneficiary = (b: any) => {
      const pii = {
        firstName: decryptField(b.get('firstNameEnc') as any),
        lastName: decryptField(b.get('lastNameEnc') as any),
        dob: decryptField(b.get('dobEnc') as any),
        nationalId: decryptField(b.get('nationalIdEnc') as any),
        phone: decryptField(b.get('phoneEnc') as any),
        email: decryptField(b.get('emailEnc') as any),
        address: decryptField(b.get('addressEnc') as any),
        gender: decryptField(b.get('genderEnc') as any),
        municipality: decryptField(b.get('municipalityEnc') as any),
        nationality: decryptField(b.get('nationalityEnc') as any),
        ethnicity: decryptField(b.get('ethnicityEnc') as any),
        residence: decryptField(b.get('residenceEnc') as any),
        householdMembers: decryptField(b.get('householdMembersEnc') as any),
      };
      const base: any = {
        id: b.id,
        pseudonym: b.pseudonym,
        status: b.status,
        createdAt: b.get('createdAt'),
        updatedAt: b.get('updatedAt'),
        piiEnc: {
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
        },
      };
      if (canDecrypt) base.pii = pii;
      return { mapped: base, pii };
    };

    let items: any[];
    let totalItems: number;
    let totalPages: number;

    if (hasSearch) {
      // When searching, load ALL beneficiaries, decrypt, filter in memory, then paginate
      const allBeneficiaries = uniqueIds.length
        ? await Beneficiary.findAll({ where: { id: uniqueIds } })
        : [];

      // Preserve order from uniqueIds
      const byId = new Map(allBeneficiaries.map((b: any) => [String(b.id), b]));
      const ordered = uniqueIds.map(id2 => byId.get(id2)).filter(Boolean);

      const searchLower = (searchParam as string).trim().toLowerCase();
      const filtered = ordered
        .map((b: any) => mapBeneficiary(b))
        .filter(({ mapped, pii }) => {
          if (mapped.pseudonym && mapped.pseudonym.toLowerCase().includes(searchLower)) return true;
          const piiValues = Object.values(pii) as (string | null)[];
          return piiValues.some((val) => val && val.toLowerCase().includes(searchLower));
        });

      totalItems = filtered.length;
      totalPages = Math.ceil(totalItems / limit);
      items = filtered.slice(offset, offset + limit).map(({ mapped }) => mapped);
    } else {
      // No search — use efficient slice-based pagination
      totalItems = uniqueIds.length;
      totalPages = Math.ceil(totalItems / limit);
      const pageIds = uniqueIds.slice(offset, offset + limit);

      const beneficiaries = pageIds.length
        ? await Beneficiary.findAll({ where: { id: pageIds } })
        : [];

      const byId = new Map(beneficiaries.map((b: any) => [String(b.id), b]));
      items = pageIds.map(id2 => byId.get(id2)).filter(Boolean).map((b: any) => mapBeneficiary(b).mapped);
    }

    if (canDecrypt) {
      // Audit PII list read
      try {
        await AuditLog.create({
          id: uuidv4(),
          userId: req.user.id,
          action: 'BENEFICIARY_PII_LIST_READ_BY_ENTITY',
          description: `Read PII for ${items.length} beneficiaries via GET /beneficiaries/by-entity`,
          details: JSON.stringify({ count: items.length, entityId, entityType, page, limit, searched: !!hasSearch }),
          timestamp: new Date(),
        });
      } catch (_) { /* ignore */ }

      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('X-PII-Access', 'decrypt');
    } else {
      res.setHeader('X-PII-Access', 'encrypted');
    }

    return res.status(200).json({ success: true, items, page, limit, totalItems, totalPages });
  } catch (error: any) {
    logger.error('Error listing beneficiaries by entity', { entityId, entityType, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export default {
  list,
  getById,
  getPIIById,
  create,
  update,
  setStatus,
  remove,
  servicesForBeneficiary,
  entitiesForBeneficiary,
  demographics,
  serviceHistoryForBeneficiary,
  associateWithEntity,
  dissociateFromEntity,
  listByEntity,
};
