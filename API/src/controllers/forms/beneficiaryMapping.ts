import { Request, Response } from 'express';
import { BeneficiaryMapping, AuditLog, FormTemplate } from '../../models';
import sequelize from '../../db/connection';
import { v4 as uuidv4 } from 'uuid';
import { createLogger } from '../../utils/logger';

const logger = createLogger('beneficiary-mapping-controller');

const getMapping = async (req: Request, res: Response) => {
  const { id } = req.params; // form template id
  try {
    const mapping = await BeneficiaryMapping.findOne({ where: { formTemplateId: id } });
    if (!mapping) {
      return res.status(404).json({ success: false, message: 'Beneficiary mapping not found for this template' });
    }
    return res.status(200).json({ success: true, data: mapping });
  } catch (error: any) {
    logger.error('Error fetching beneficiary mapping', { templateId: id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const createMapping = async (req: Request, res: Response) => {
  const { id } = req.params; // form template id
  const { mapping } = req.body || {};

  if (!mapping || typeof mapping !== 'object') {
    return res.status(400).json({ success: false, message: 'Mapping object is required' });
  }

  try {
    const template = await FormTemplate.findByPk(id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Form template not found' });
    }

    const exists = await BeneficiaryMapping.findOne({ where: { formTemplateId: id } });
    if (exists) {
      return res.status(409).json({ success: false, message: 'Mapping already exists. Use PUT to update.' });
    }

    const created = await sequelize.transaction(async (transaction) => {
      const rec = await BeneficiaryMapping.create({ id: uuidv4(), formTemplateId: id, mapping }, { transaction });

      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'BENEFICIARY_MAPPING_CREATE',
        description: `Created beneficiary mapping for form template '${template.name}'`,
        details: JSON.stringify({ templateId: id }),
        timestamp: new Date(),
      }, { transaction });

      return rec;
    });

    return res.status(201).json({ success: true, data: created });
  } catch (error: any) {
    logger.error('Error creating beneficiary mapping', { templateId: id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

const updateMapping = async (req: Request, res: Response) => {
  const { id } = req.params; // form template id
  const { mapping } = req.body || {};

  if (!mapping || typeof mapping !== 'object') {
    return res.status(400).json({ success: false, message: 'Mapping object is required' });
  }

  try {
    const template = await FormTemplate.findByPk(id);
    if (!template) {
      return res.status(404).json({ success: false, message: 'Form template not found' });
    }

    const updated = await sequelize.transaction(async (transaction) => {
      const [count] = await BeneficiaryMapping.update({ mapping }, { where: { formTemplateId: id }, transaction });
      let rec = await BeneficiaryMapping.findOne({ where: { formTemplateId: id }, transaction });
      if (!rec) {
        rec = await BeneficiaryMapping.create({ id: uuidv4(), formTemplateId: id, mapping }, { transaction });
      }

      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'BENEFICIARY_MAPPING_UPDATE',
        description: `Updated beneficiary mapping for form template '${template.name}'`,
        details: JSON.stringify({ templateId: id }),
        timestamp: new Date(),
      }, { transaction });

      return rec;
    });

    return res.status(200).json({ success: true, data: updated });
  } catch (error: any) {
    logger.error('Error updating beneficiary mapping', { templateId: id, error: error.message });
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export default {
  getMapping,
  createMapping,
  updateMapping,
};
