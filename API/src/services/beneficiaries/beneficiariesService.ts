import { Transaction, Op, FindAndCountOptions } from 'sequelize';
import { Beneficiary, BeneficiaryMatchKey, BeneficiaryMapping } from '../../models';
import {
  encryptField,
  hmacSha256,
  normalizeName,
  normalizeDob,
  normalizePhone,
  makePseudonym,
} from '../../utils/crypto';

export type UpsertOptions = {
  transaction: Transaction;
  userId: string;
};

export type UpsertEntity = {
  entityId: string;
  entityType: 'project' | 'subproject' | 'activity';
};

const getByPath = (obj: any, path?: string): any => {
  if (!obj || !path) return undefined;
  const parts = path.split('.');
  let cur = obj;
  for (const p of parts) {
    if (cur == null) return undefined;
    cur = cur[p];
  }
  return cur;
};

const VALID_STRATEGIES = new Set(['nationalId', 'phone+dob', 'name+dob']);

type BeneficiaryInput = {
  firstName?: string | null;
  lastName?: string | null;
  dob?: string | null; // ISO or parseable date
  nationalId?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  gender?: 'M' | 'F' | null;
  status?: 'active' | 'inactive';
  municipality?: string | null;
  nationality?: string | null;
  ethnicity?: string | null;
  residence?: string | null;
  householdMembers?: number | null;
};

const buildCandidateKeysFromInput = (input: BeneficiaryInput): Array<{ keyType: string; keyHash: string }> => {
  const normName = `${normalizeName(input.firstName)} ${normalizeName(input.lastName)}`.trim();
  const normDob = normalizeDob(input.dob);
  const normPhone = normalizePhone(input.phone);
  const keys: Array<{ keyType: string; keyHash: string }> = [];
  if (input.nationalId) keys.push({ keyType: 'nationalId', keyHash: hmacSha256(input.nationalId) });
  if (normPhone && normDob) keys.push({ keyType: 'phone+dob', keyHash: hmacSha256(`${normPhone}|${normDob}`) });
  if (normName && normDob) keys.push({ keyType: 'name+dob', keyHash: hmacSha256(`${normName}|${normDob}`) });
  return keys;
};

const toSafe = (b: Beneficiary) => ({
  id: b.id,
  pseudonym: b.pseudonym,
  status: b.status,
  createdAt: b.get('createdAt'),
  updatedAt: b.get('updatedAt'),
});

export async function upsertFromFormResponse(
  formTemplateId: string,
  data: any,
  entity: UpsertEntity,
  opts: UpsertOptions
): Promise<{ beneficiaryId?: string; created: boolean }>
{
  // Load mapping
  const mapping = await BeneficiaryMapping.findOne({
    where: { formTemplateId },
    transaction: opts.transaction,
  });

  if (!mapping) {
    // No mapping configured for this template
    return { created: false };
  }

  const map = mapping.mapping || {};
  const fields = map.fields || {};
  const strategies: string[] = (Array.isArray(map.strategies) ? map.strategies : ['nationalId', 'phone+dob', 'name+dob'])
    .filter((s: string) => VALID_STRATEGIES.has(s));

  // Extract plaintext fields from data based on mapping
  const firstName = String(getByPath(data, fields.firstName) ?? '').trim() || undefined;
  const lastName = String(getByPath(data, fields.lastName) ?? '').trim() || undefined;
  const dobRaw = String(getByPath(data, fields.dob) ?? '').trim() || undefined;
  const nationalId = String(getByPath(data, fields.nationalId) ?? '').trim() || undefined;
  const phoneRaw = String(getByPath(data, fields.phone) ?? '').trim() || undefined;
  const email = String(getByPath(data, fields.email) ?? '').trim() || undefined;
  const address = String(getByPath(data, fields.address) ?? '').trim() || undefined;
  const municipality = String(getByPath(data, fields.municipality) ?? '').trim() || undefined;
  const nationality = String(getByPath(data, fields.nationality) ?? '').trim() || undefined;
  const ethnicity = String(getByPath(data, fields.ethnicity) ?? '').trim() || undefined;
  const residence = String(getByPath(data, fields.residence) ?? '').trim() || undefined;
  const householdMembersRaw = getByPath(data, fields.householdMembers);
  const householdMembers = householdMembersRaw != null ? parseInt(String(householdMembersRaw), 10) : undefined;
  const genderRaw = String(getByPath(data, fields.gender) ?? '').trim() || undefined;
  const gender = genderRaw
    ? (genderRaw.toUpperCase().startsWith('M') ? 'M' : genderRaw.toUpperCase().startsWith('F') ? 'F' : undefined)
    : undefined;

  const normName = `${normalizeName(firstName)} ${normalizeName(lastName)}`.trim();
  const normDob = normalizeDob(dobRaw);
  const normPhone = normalizePhone(phoneRaw);

  // Build match keys
  const candidateKeys: Array<{ keyType: string; keyHash: string }> = [];
  if (strategies.includes('nationalId') && nationalId) {
    candidateKeys.push({ keyType: 'nationalId', keyHash: hmacSha256(nationalId) });
  }
  if (strategies.includes('phone+dob') && normPhone && normDob) {
    candidateKeys.push({ keyType: 'phone+dob', keyHash: hmacSha256(`${normPhone}|${normDob}`) });
  }
  if (strategies.includes('name+dob') && normName && normDob) {
    candidateKeys.push({ keyType: 'name+dob', keyHash: hmacSha256(`${normName}|${normDob}`) });
  }

  let existingBeneficiaryId: string | undefined;
  if (candidateKeys.length > 0) {
    const matches = await BeneficiaryMatchKey.findAll({
      where: {
        [Op.or]: candidateKeys.map(k => ({ keyType: k.keyType, keyHash: k.keyHash }))
      },
      transaction: opts.transaction,
    });

    if (matches.length > 0) {
      // Pick the first match's beneficiaryId
      existingBeneficiaryId = matches[0].get('beneficiaryId') as string;
    }
  }

  if (existingBeneficiaryId) {
    // Optionally update encrypted fields if new values are provided
    await Beneficiary.update({
      firstNameEnc: firstName ? encryptField(firstName) : undefined,
      lastNameEnc: lastName ? encryptField(lastName) : undefined,
      dobEnc: dobRaw ? encryptField(normalizeDob(dobRaw)) : undefined,
      nationalIdEnc: nationalId ? encryptField(nationalId) : undefined,
      phoneEnc: phoneRaw ? encryptField(normPhone) : undefined,
      emailEnc: email ? encryptField(email) : undefined,
      addressEnc: address ? encryptField(address) : undefined,
      municipalityEnc: municipality ? encryptField(municipality) : undefined,
      nationalityEnc: nationality ? encryptField(nationality) : undefined,
      ethnicityEnc: ethnicity ? encryptField(ethnicity) : undefined,
      residenceEnc: residence ? encryptField(residence) : undefined,
      householdMembersEnc: householdMembers != null ? encryptField(String(householdMembers)) : undefined,
      genderEnc: gender ? encryptField(gender) : undefined,
    }, {
      where: { id: existingBeneficiaryId },
      transaction: opts.transaction,
    });

    // Ensure all keys exist
    for (const { keyType, keyHash } of candidateKeys) {
      try {
        await BeneficiaryMatchKey.findOrCreate({
          where: { keyType, keyHash },
          defaults: { id: undefined as unknown as string, beneficiaryId: existingBeneficiaryId, keyType, keyHash },
          transaction: opts.transaction,
        });
      } catch (_) {
        // ignore unique conflicts
      }
    }

    return { beneficiaryId: existingBeneficiaryId, created: false };
  }

  // Create new beneficiary
  const created = await Beneficiary.create({
    pseudonym: makePseudonym(),
    status: 'active',
    firstNameEnc: firstName ? encryptField(firstName) : null,
    lastNameEnc: lastName ? encryptField(lastName) : null,
    dobEnc: dobRaw ? encryptField(normDob) : null,
    nationalIdEnc: nationalId ? encryptField(nationalId) : null,
    phoneEnc: phoneRaw ? encryptField(normPhone) : null,
    emailEnc: email ? encryptField(email) : null,
    addressEnc: address ? encryptField(address) : null,
    municipalityEnc: municipality ? encryptField(municipality) : null,
    nationalityEnc: nationality ? encryptField(nationality) : null,
    ethnicityEnc: ethnicity ? encryptField(ethnicity) : null,
    residenceEnc: residence ? encryptField(residence) : null,
    householdMembersEnc: householdMembers != null ? encryptField(String(householdMembers)) : null,
    genderEnc: gender ? encryptField(gender) : null,
  }, { transaction: opts.transaction });

  for (const { keyType, keyHash } of candidateKeys) {
    try {
      await BeneficiaryMatchKey.create({ beneficiaryId: created.id, keyType, keyHash }, { transaction: opts.transaction });
    } catch (_) {
      // ignore unique conflicts
    }
  }

  return { beneficiaryId: created.id, created: true };
}

export default {
  upsertFromFormResponse,
  async createBeneficiary(input: BeneficiaryInput, opts: { transaction: Transaction; userId: string }) {
    const normDob = normalizeDob(input.dob);
    const normPhone = normalizePhone(input.phone);
    const created = await Beneficiary.create({
      pseudonym: makePseudonym(),
      status: input.status ?? 'active',
      firstNameEnc: encryptField(input.firstName ?? null),
      lastNameEnc: encryptField(input.lastName ?? null),
      dobEnc: encryptField(normDob || null),
      nationalIdEnc: encryptField(input.nationalId ?? null),
      phoneEnc: encryptField(normPhone || null),
      emailEnc: encryptField(input.email ?? null),
      addressEnc: encryptField(input.address ?? null),
      genderEnc: encryptField(input.gender ?? null),
      municipalityEnc: encryptField(input.municipality ?? null),
      nationalityEnc: encryptField(input.nationality ?? null),
      ethnicityEnc: encryptField(input.ethnicity ?? null),
      residenceEnc: encryptField(input.residence ?? null),
      householdMembersEnc: encryptField(input.householdMembers != null ? String(input.householdMembers) : null),
    }, { transaction: opts.transaction });

    // Create match keys
    const keys = buildCandidateKeysFromInput({ ...input, dob: normDob, phone: normPhone });
    for (const { keyType, keyHash } of keys) {
      try {
        await BeneficiaryMatchKey.create({ beneficiaryId: created.id, keyType, keyHash }, { transaction: opts.transaction });
      } catch (_) { /* ignore unique */ }
    }
    return toSafe(created);
  },

  async updateBeneficiary(id: string, input: BeneficiaryInput, opts: { transaction: Transaction; userId: string }) {
    const existing = await Beneficiary.findByPk(id, { transaction: opts.transaction });
    if (!existing) return null;

    const normDob = input.dob !== undefined ? normalizeDob(input.dob) : undefined;
    const normPhone = input.phone !== undefined ? normalizePhone(input.phone) : undefined;

    const update: any = {};
    if (input.status) update.status = input.status;
    if (input.firstName !== undefined) update.firstNameEnc = encryptField(input.firstName);
    if (input.lastName !== undefined) update.lastNameEnc = encryptField(input.lastName);
    if (input.dob !== undefined) update.dobEnc = encryptField(normDob || null);
    if (input.nationalId !== undefined) update.nationalIdEnc = encryptField(input.nationalId);
    if (input.phone !== undefined) update.phoneEnc = encryptField(normPhone || null);
    if (input.email !== undefined) update.emailEnc = encryptField(input.email);
    if (input.address !== undefined) update.addressEnc = encryptField(input.address);
    if (input.gender !== undefined) update.genderEnc = encryptField(input.gender ?? null);
    if (input.municipality !== undefined) update.municipalityEnc = encryptField(input.municipality);
    if (input.nationality !== undefined) update.nationalityEnc = encryptField(input.nationality);
    if (input.ethnicity !== undefined) update.ethnicityEnc = encryptField(input.ethnicity);
    if (input.residence !== undefined) update.residenceEnc = encryptField(input.residence);
    if (input.householdMembers !== undefined) update.householdMembersEnc = encryptField(input.householdMembers != null ? String(input.householdMembers) : null);

    await existing.update(update, { transaction: opts.transaction });

    // Ensure keys
    const keys = buildCandidateKeysFromInput({
      firstName: input.firstName,
      lastName: input.lastName,
      dob: normDob,
      nationalId: input.nationalId,
      phone: normPhone,
      email: input.email,
      address: input.address,
      municipality: input.municipality,
      nationality: input.nationality,
    });
    for (const { keyType, keyHash } of keys) {
      try {
        await BeneficiaryMatchKey.findOrCreate({
          where: { keyType, keyHash },
          defaults: { beneficiaryId: id, keyType, keyHash },
          transaction: opts.transaction,
        });
      } catch (_) { /* ignore */ }
    }

    return toSafe(existing);
  },

  async getBeneficiaryById(id: string, opts?: { transaction?: Transaction }) {
    const b = await Beneficiary.findByPk(id, { transaction: opts?.transaction });
    return b ? toSafe(b) : null;
  },

  async listBeneficiaries(params: { page?: number; limit?: number; status?: 'active' | 'inactive'; includeEnc?: boolean }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const offset = (page - 1) * limit;
    const where: any = {};
    if (params.status) where.status = params.status;
    const attributes: any = ['id', 'pseudonym', 'status', 'createdAt', 'updatedAt'];
    if (params.includeEnc) {
      attributes.push(
        'firstNameEnc',
        'lastNameEnc',
        'dobEnc',
        'nationalIdEnc',
        'phoneEnc',
        'emailEnc',
        'addressEnc',
        'genderEnc',
        'municipalityEnc',
        'nationalityEnc',
        'ethnicityEnc',
        'residenceEnc',
        'householdMembersEnc',
      );
    }
    const { rows, count } = await Beneficiary.findAndCountAll({
      where,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      attributes,
    } as FindAndCountOptions);
    const items = rows.map(r => {
      const base: any = { id: r.id, pseudonym: r.pseudonym, status: r.status, createdAt: r.get('createdAt'), updatedAt: r.get('updatedAt') };
      if (params.includeEnc) {
        base.firstNameEnc = r.get('firstNameEnc');
        base.lastNameEnc = r.get('lastNameEnc');
        base.dobEnc = r.get('dobEnc');
        base.nationalIdEnc = r.get('nationalIdEnc');
        base.phoneEnc = r.get('phoneEnc');
        base.emailEnc = r.get('emailEnc');
        base.addressEnc = r.get('addressEnc');
        base.genderEnc = r.get('genderEnc');
        base.municipalityEnc = r.get('municipalityEnc');
        base.nationalityEnc = r.get('nationalityEnc');
        base.ethnicityEnc = r.get('ethnicityEnc');
        base.residenceEnc = r.get('residenceEnc');
        base.householdMembersEnc = r.get('householdMembersEnc');
      }
      return base;
    });
    return {
      items,
      page,
      limit,
      totalItems: count,
      totalPages: Math.ceil(count / limit),
    };
  },

  async setBeneficiaryStatus(id: string, status: 'active' | 'inactive', opts: { transaction: Transaction; userId: string }) {
    const b = await Beneficiary.findByPk(id, { transaction: opts.transaction });
    if (!b) return null;
    await b.update({ status }, { transaction: opts.transaction });
    return toSafe(b);
  },
};
