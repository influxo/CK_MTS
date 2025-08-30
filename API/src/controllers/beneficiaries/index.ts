import { Request, Response } from 'express';
import sequelize from '../../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger';
import { AuditLog, Beneficiary } from '../../models';
import beneficiariesService from '../../services/beneficiaries/beneficiariesService';
import { decryptField } from '../../utils/crypto';
import { ROLES } from '../../constants/roles';

const logger = createLogger('beneficiaries-controller');

const list = async (req: Request, res: Response) => {
  try {
    const page = req.query.page ? parseInt(String(req.query.page), 10) : 1;
    const limit = req.query.limit ? parseInt(String(req.query.limit), 10) : 20;
    const status = req.query.status as 'active' | 'inactive' | undefined;

    // Determine if caller can view decrypted PII
    const roles = req.userRoles || [];
    const roleNames: string[] = roles.map((r: any) => (typeof r === 'string' ? r : r?.name)).filter(Boolean);
    const canDecrypt = roleNames.includes(ROLES.SUPER_ADMIN) || roleNames.includes(ROLES.SYSTEM_ADMINISTRATOR);
    logger.info('Beneficiaries.list role evaluation', { roleNames, canDecrypt });

    // Always include encrypted fields from DB so we can decrypt or return as-is
    const result = await beneficiariesService.listBeneficiaries({ page, limit, status, includeEnc: true });

    let items: any[] = result.items;
    if (canDecrypt) {
      items = result.items.map((it: any) => ({
        id: it.id,
        pseudonym: it.pseudonym,
        status: it.status,
        createdAt: it.createdAt,
        updatedAt: it.updatedAt,
        // Include both encrypted and decrypted for authorized users
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
        },
        pii: {
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
        },
      }));

      // Audit bulk PII read (list)
      try {
        await AuditLog.create({
          id: uuidv4(),
          userId: req.user.id,
          action: 'BENEFICIARY_PII_LIST_READ',
          description: `Read PII for ${items.length} beneficiaries via GET /beneficiaries`,
          details: JSON.stringify({ count: items.length, page, limit }),
          timestamp: new Date(),
        });
      } catch (_) { /* ignore audit failures */ }

      // Prevent caching decrypted responses
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('X-PII-Access', 'decrypt');
    } else {
      // Wrap encrypted fields under piiEnc for clarity
      items = result.items.map((it: any) => ({
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
        },
      }));
    }

    if (!canDecrypt) {
      res.setHeader('X-PII-Access', 'encrypted');
    }
    return res.status(200).json({ success: true, items, page: result.page, limit: result.limit, totalItems: result.totalItems, totalPages: result.totalPages });
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

      const base = {
        id: b.id,
        pseudonym: b.pseudonym,
        status: b.status,
        createdAt: b.get('createdAt'),
        updatedAt: b.get('updatedAt'),
      } as any;

      const roles = req.userRoles || [];
      const roleNames: string[] = roles.map((r: any) => (typeof r === 'string' ? r : r?.name)).filter(Boolean);
      const canDecrypt = roleNames.includes(ROLES.SUPER_ADMIN) || roleNames.includes(ROLES.SYSTEM_ADMINISTRATOR);
      logger.info('Beneficiaries.getById role evaluation', { id, roleNames, canDecrypt });

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
  } as any;

  try {
    const created = await sequelize.transaction(async (transaction) => {
      const safe = await beneficiariesService.createBeneficiary(input, { transaction, userId: req.user.id });

      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'BENEFICIARY_CREATE',
        description: `Created beneficiary '${safe.pseudonym}'`,
        details: JSON.stringify({ beneficiaryId: safe.id }),
        timestamp: new Date(),
      }, { transaction });

      return safe;
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    logger.error('Error creating beneficiary', { error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
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

export default {
  list,
  getById,
  getPIIById,
  create,
  update,
  setStatus,
  remove,
  async demographics(req: Request, res: Response) {
    try {
      const roles = req.userRoles || [];
      const roleNames: string[] = roles.map((r: any) => (typeof r === 'string' ? r : r?.name)).filter(Boolean);
      const canDecrypt = roleNames.includes(ROLES.SUPER_ADMIN) || roleNames.includes(ROLES.SYSTEM_ADMINISTRATOR);
      if (!canDecrypt) {
        return res.status(403).json({ success: false, message: 'Forbidden' });
      }

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
  },
};
