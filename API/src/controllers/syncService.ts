import { Request, Response } from "express";
import { Op } from "sequelize";
import { 
  Project, 
  Subproject, 
  Activity, 
  Beneficiary, 
  FormTemplate, 
  FormResponse, 
  Service, 
  ServiceDelivery,
  User,
  Role,
  Permission,
  UserRole,
  RolePermission,
  ProjectUser,
  SubprojectUser,
  ActivityUser,
  BeneficiaryAssignment,
  ServiceAssignment
} from "../models";
import FormEntityAssociation from "../models/FormEntityAssociation";
import BeneficiaryMapping from "../models/BeneficiaryMapping";
import { ROLES } from "../constants/roles";
import { decryptField, encryptField } from "../utils/crypto";
import { validateFormResponse } from "../services/forms/validateFormResponse";
import { upsertFromFormResponse } from "../services/beneficiaries/beneficiariesService";
import { v4 as uuidv4 } from "uuid";
import sequelize from "../db/connection";

// Helper function to generate storage mapping for form templates
function generateStorageMapping(template: any, beneficiaryMapping: any) {
  const storageMapping: any = {
    targetTable: "form_responses",
    beneficiaryFields: {},
    responseFields: {},
    entityMapping: {
      projectId: "entityId",
      subprojectId: "entityId", 
      entityType: "subproject"
    },
    serviceMapping: {
      serviceIds: "serviceId",
      deliveredAt: "deliveredAt",
      notes: "notes"
    }
  };

  // If beneficiary mapping exists, use it for PII field extraction
  if (beneficiaryMapping && beneficiaryMapping.fields) {
    storageMapping.beneficiaryFields = {
      firstName: beneficiaryMapping.fields.firstName || "firstName",
      lastName: beneficiaryMapping.fields.lastName || "lastName",
      dob: beneficiaryMapping.fields.dob || "dob",
      nationalId: beneficiaryMapping.fields.nationalId || "nationalId",
      phone: beneficiaryMapping.fields.phone || "phone",
      email: beneficiaryMapping.fields.email || "email",
      address: beneficiaryMapping.fields.address || "address",
      gender: beneficiaryMapping.fields.gender || "gender",
      municipality: beneficiaryMapping.fields.municipality || "municipality",
      nationality: beneficiaryMapping.fields.nationality || "nationality",
      ethnicity: beneficiaryMapping.fields.ethnicity || "ethnicity",
      residence: beneficiaryMapping.fields.residence || "residence",
      householdMembers: beneficiaryMapping.fields.householdMembers || "householdMembers"
    };
  }

  // Generate response fields mapping from template schema
  if (template.schema && template.schema.fields) {
    const responseFields: any = {};
    template.schema.fields.forEach((field: any) => {
      responseFields[field.name] = field.name;
    });
    storageMapping.responseFields = responseFields;
  }

  return storageMapping;
}

// Helper function to get role names from request
async function getRoleNames(req: Request): Promise<string[]> {
  const user = req.user;
  if (!user) return [];
  
  const userRoles = await UserRole.findAll({
    where: { userId: user.id },
    attributes: ['roleId']
  });
  
  if (userRoles.length === 0) return [];
  
  const roleIds = userRoles.map(ur => ur.roleId);
  const roles = await Role.findAll({
    where: { id: { [Op.in]: roleIds } },
    attributes: ['name']
  });
  
  return roles.map(role => role.name);
}

/**
 * Data Dump Endpoint - Provides complete dataset for Flutter offline use
 * GET /sync/datadump
 */
export async function dataDump(req: Request, res: Response) {
  try {
    const user = req.user;
    const roleNames = await getRoleNames(req);
    const isAdmin = roleNames.includes(ROLES.SUPER_ADMIN) || roleNames.includes(ROLES.SYSTEM_ADMINISTRATOR);
    
    // Get user's assigned projects for RBAC filtering
    let allowedPrograms: Set<string> | null = null;
    if (!isAdmin) {
      const userProjects = await ProjectUser.findAll({
        where: { userId: user.id },
        attributes: ['projectId']
      });
      allowedPrograms = new Set<string>(userProjects.map(pu => String(pu.projectId)));
    }

    // Get accessible subproject and activity IDs for filtering
    const accessibleSubprojectIds = new Set<string>();
    const accessibleActivityIds = new Set<string>();
    
    if (allowedPrograms && allowedPrograms.size) {
      const subprojects = await Subproject.findAll({
        where: { projectId: { [Op.in]: Array.from(allowedPrograms) } },
        attributes: ['id']
      });
      subprojects.forEach(s => accessibleSubprojectIds.add(String(s.id)));
      
      const activities = await Activity.findAll({
        where: { subprojectId: { [Op.in]: Array.from(accessibleSubprojectIds) } },
        attributes: ['id']
      });
      activities.forEach(a => accessibleActivityIds.add(String(a.id)));
    }

    // Fetch only essential data that the user actually needs
    const [projects, subprojects, activities, formTemplates, services, beneficiaries] = await Promise.all([
      // Core entities - only user's accessible projects
      Project.findAll({ 
        where: allowedPrograms && !isAdmin ? { id: { [Op.in]: Array.from(allowedPrograms) } } : {}
      }),
      
      Subproject.findAll({
        where: allowedPrograms && !isAdmin ? { projectId: { [Op.in]: Array.from(allowedPrograms) } } : {}
      }),
      
      Activity.findAll({
        where: allowedPrograms && !isAdmin ? { subprojectId: { [Op.in]: Array.from(accessibleSubprojectIds) } } : {}
      }),
      
      // Form templates - only those associated with accessible entities
      (async () => {
        if (isAdmin || !allowedPrograms || !allowedPrograms.size) {
          const templates = await FormTemplate.findAll({});
          // Get storage mappings for all templates
          const mappings = await BeneficiaryMapping.findAll({});
          const mappingMap = new Map(mappings.map(m => [m.formTemplateId, m.mapping]));
          
          return templates.map(template => ({
            ...template.toJSON(),
            storageMapping: generateStorageMapping(template, mappingMap.get(template.id))
          }));
        }
        
        const formEntityAssocs = await FormEntityAssociation.findAll({
          where: {
            [Op.or]: [
              { entityType: 'project', entityId: { [Op.in]: Array.from(allowedPrograms) } },
              { entityType: 'subproject', entityId: { [Op.in]: Array.from(accessibleSubprojectIds) } },
              { entityType: 'activity', entityId: { [Op.in]: Array.from(accessibleActivityIds) } }
            ]
          },
          attributes: ['formTemplateId']
        });
        
        const formTemplateIds = new Set<string>();
        formEntityAssocs.forEach((fea: any) => formTemplateIds.add(String(fea.formTemplateId)));
        
        const templates = await FormTemplate.findAll({
          where: { id: { [Op.in]: Array.from(formTemplateIds) } }
        });
        
        // Get storage mappings for accessible templates
        const mappings = await BeneficiaryMapping.findAll({
          where: { formTemplateId: { [Op.in]: Array.from(formTemplateIds) } }
        });
        const mappingMap = new Map(mappings.map(m => [m.formTemplateId, m.mapping]));
        
        return templates.map(template => ({
          ...template.toJSON(),
          storageMapping: generateStorageMapping(template, mappingMap.get(template.id))
        }));
      })(),
      
      // Services - only those assigned to accessible entities
      (async () => {
        if (isAdmin || !allowedPrograms || !allowedPrograms.size) return Service.findAll({});
        
        const serviceAssignments = await ServiceAssignment.findAll({
          where: {
            [Op.or]: [
              { entityType: 'project', entityId: { [Op.in]: Array.from(allowedPrograms) } },
              { entityType: 'subproject', entityId: { [Op.in]: Array.from(accessibleSubprojectIds) } },
              { entityType: 'activity', entityId: { [Op.in]: Array.from(accessibleActivityIds) } }
            ]
          },
          attributes: ['serviceId']
        });
        
        const serviceIds = new Set<string>();
        serviceAssignments.forEach(sa => serviceIds.add(String(sa.serviceId)));
        
        return Service.findAll({
          where: { id: { [Op.in]: Array.from(serviceIds) } }
        });
      })(),
      
      // Beneficiaries - only those assigned to accessible projects
      (async () => {
        if (isAdmin || !allowedPrograms || !allowedPrograms.size) {
          return Beneficiary.findAll({});
        }
        
        const assignments = await BeneficiaryAssignment.findAll({
          where: {
            [Op.or]: [
              { entityType: 'project', entityId: { [Op.in]: Array.from(allowedPrograms) } },
              { entityType: 'subproject', entityId: { [Op.in]: Array.from(accessibleSubprojectIds) } },
              { entityType: 'activity', entityId: { [Op.in]: Array.from(accessibleActivityIds) } }
            ]
          },
          attributes: ['beneficiaryId']
        });
        
        const beneficiaryIds = new Set<string>();
        assignments.forEach(a => beneficiaryIds.add(String(a.beneficiaryId)));
        
        return Beneficiary.findAll({
          where: { id: { [Op.in]: Array.from(beneficiaryIds) } }
        });
      })(),
    ]);

    // Get form responses - only for accessible entities
    const formResponses = await FormResponse.findAll({
      where: allowedPrograms && !isAdmin ? {
        [Op.or]: [
          { entityType: 'project', entityId: { [Op.in]: Array.from(allowedPrograms) } },
          { entityType: 'subproject', entityId: { [Op.in]: Array.from(accessibleSubprojectIds) } },
          { entityType: 'activity', entityId: { [Op.in]: Array.from(accessibleActivityIds) } }
        ]
      } : {},
      include: [
        { model: FormTemplate, as: 'template', attributes: ['id', 'name', 'schema', 'version'] },
        { model: User, as: 'submitter', attributes: ['id', 'firstName', 'lastName', 'email'] }
      ]
    }) as any[];

    // Get service deliveries - only for accessible entities
    const serviceDeliveries = await ServiceDelivery.findAll({
      where: allowedPrograms && !isAdmin ? {
        [Op.or]: [
          { entityType: 'project', entityId: { [Op.in]: Array.from(allowedPrograms) } },
          { entityType: 'subproject', entityId: { [Op.in]: Array.from(accessibleSubprojectIds) } },
          { entityType: 'activity', entityId: { [Op.in]: Array.from(accessibleActivityIds) } }
        ]
      } : {},
      include: [
        { model: Service, as: 'service', attributes: ['id', 'name', 'description', 'category'] },
        { model: User, as: 'staff', attributes: ['id', 'firstName', 'lastName', 'email'] },
        { model: Beneficiary, as: 'beneficiary', attributes: ['id', 'pseudonym', 'status'] }
      ]
    }) as any[];

    // Process beneficiaries for PII handling with proper RBAC
    const isAdminForPII = roleNames.includes(ROLES.SUPER_ADMIN) || roleNames.includes(ROLES.SYSTEM_ADMINISTRATOR);
    
    // Get beneficiary assignments to check if user has access to specific beneficiaries
    const beneficiaryAssignmentsForPII = await BeneficiaryAssignment.findAll({
      where: allowedPrograms && !isAdminForPII ? { 
        entityId: { [Op.in]: Array.from(allowedPrograms) },
        entityType: 'project'
      } : {}
    });
    
    const accessibleBeneficiaryIds = new Set<string>();
    if (isAdminForPII || !allowedPrograms || !allowedPrograms.size) {
      (beneficiaries as any[]).forEach(b => accessibleBeneficiaryIds.add(String(b.id)));
    } else {
      for (const assignment of beneficiaryAssignmentsForPII) {
        accessibleBeneficiaryIds.add(String(assignment.beneficiaryId));
      }
    }
    
    const processedBeneficiaries = (beneficiaries as any[]).map((b: any) => {
      const base: any = {
        id: b.id,
        pseudonym: b.pseudonym,
        status: b.status,
        createdAt: b.createdAt,
        updatedAt: b.updatedAt
      };
      
      const enc: any = {
        firstNameEnc: b.firstNameEnc,
        lastNameEnc: b.lastNameEnc,
        dobEnc: b.dobEnc,
        genderEnc: b.genderEnc,
        addressEnc: b.addressEnc,
        municipalityEnc: b.municipalityEnc,
        nationalityEnc: b.nationalityEnc,
        nationalIdEnc: b.nationalIdEnc,
        phoneEnc: b.phoneEnc,
        emailEnc: b.emailEnc,
        ethnicityEnc: b.ethnicityEnc,
        residenceEnc: b.residenceEnc,
        householdMembersEnc: b.householdMembersEnc
      };
      
      const canDecryptThisBeneficiary = accessibleBeneficiaryIds.has(String(b.id));
      
      if (canDecryptThisBeneficiary) {
        // Decrypt PII for this beneficiary
        const pii: any = {};
        try {
          if (b.firstNameEnc) pii.firstName = decryptField(b.firstNameEnc);
          if (b.lastNameEnc) pii.lastName = decryptField(b.lastNameEnc);
          if (b.dobEnc) pii.dob = decryptField(b.dobEnc);
          if (b.genderEnc) pii.gender = decryptField(b.genderEnc);
          if (b.addressEnc) pii.address = decryptField(b.addressEnc);
          if (b.municipalityEnc) pii.municipality = decryptField(b.municipalityEnc);
          if (b.nationalityEnc) pii.nationality = decryptField(b.nationalityEnc);
          if (b.nationalIdEnc) pii.nationalId = decryptField(b.nationalIdEnc);
          if (b.phoneEnc) pii.phone = decryptField(b.phoneEnc);
          if (b.emailEnc) pii.email = decryptField(b.emailEnc);
          if (b.ethnicityEnc) pii.ethnicity = decryptField(b.ethnicityEnc);
          if (b.residenceEnc) pii.residence = decryptField(b.residenceEnc);
          if (b.householdMembersEnc) pii.householdMembers = decryptField(b.householdMembersEnc);
        } catch (err: any) {
          console.error('Error decrypting PII for beneficiary', b.id, err);
        }
        
        return {
          ...base,
          piiEnc: enc,
          pii: {
            ...pii,
            beneficiaryId: b.id // Link PII to beneficiary using beneficiary UUID
          }
        };
      }
      
      return { ...base, piiEnc: enc };
    });

    // Build association-aware form_templates for this user's scope
    const augmentedFormTemplates = [] as any[];
    for (const ft of (formTemplates as any[])) {
      // Find entity association for this template within user's accessible scope
      const feaWhere: any = { formTemplateId: ft.id };
      const feaOptions: any = { where: { formTemplateId: ft.id } };
      const feaList = await FormEntityAssociation.findAll({ where: { formTemplateId: ft.id } });

      // Prefer subproject association within scope, else project association within scope
      let associatedSubprojectId: string | null = null;
      let associatedProjectId: string | null = null;
      for (const fea of feaList as any[]) {
        if (fea.entityType === 'subproject') {
          const idStr = String(fea.entityId);
          if (!allowedPrograms || isAdmin || accessibleSubprojectIds.has(idStr)) {
            associatedSubprojectId = idStr;
            break;
          }
        }
      }
      if (!associatedSubprojectId) {
        for (const fea of feaList as any[]) {
          if (fea.entityType === 'project') {
            const idStr = String(fea.entityId);
            if (!allowedPrograms || isAdmin || (allowedPrograms as Set<string>).has(idStr)) {
              associatedProjectId = idStr;
              break;
            }
          }
        }
      }

      // Derive services and beneficiaries for the associated entity
      const associationEntityId = associatedSubprojectId || associatedProjectId;
      const associationEntityType = associatedSubprojectId ? 'subproject' : (associatedProjectId ? 'project' : null);

      let assocServiceIds: string[] = [];
      let assocBeneficiaryIds: string[] = [];
      if (associationEntityId && associationEntityType) {
        const [svcAssigns, benAssigns] = await Promise.all([
          ServiceAssignment.findAll({ where: { entityId: associationEntityId, entityType: associationEntityType }, attributes: ['serviceId'] }),
          BeneficiaryAssignment.findAll({ where: { entityId: associationEntityId, entityType: associationEntityType }, attributes: ['beneficiaryId'] })
        ]);
        assocServiceIds = (svcAssigns as any[]).map(sa => String(sa.serviceId));
        assocBeneficiaryIds = (benAssigns as any[]).map(ba => String(ba.beneficiaryId));
      }

      augmentedFormTemplates.push({
        ...ft,
        associations: {
          subprojectId: associatedSubprojectId || undefined,
          projectId: associatedProjectId || undefined,
          serviceIds: assocServiceIds,
          beneficiaryIds: assocBeneficiaryIds
        }
      });
    }

    // Return minimal, essential data only
    res.json({
      meta: {
        schemaVersion: 2,
        generatedAt: new Date().toISOString(),
        userId: user.id,
        roleNames,
        isAdmin,
        allowedPrograms: allowedPrograms ? Array.from(allowedPrograms) : null,
        accessibleBeneficiaries: accessibleBeneficiaryIds.size,
        totalBeneficiaries: (beneficiaries as any[]).length,
        piiAccessPolicy: isAdminForPII ? 'full' : 'project-scoped'
      },
      // Core entities - only what the user has access to
      projects: (projects as any[]).map(p => ({
        id: p.id,
        name: p.name,
        description: p.description,
        category: p.category,
        status: p.status,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt
      })),
      subprojects: (subprojects as any[]).map(s => ({
        id: s.id,
        projectId: s.projectId,
        name: s.name,
        description: s.description,
        category: s.category,
        status: s.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      })),
      activities: (activities as any[]).map(a => ({
        id: a.id,
        subprojectId: a.subprojectId,
        name: a.name,
        description: a.description,
        category: a.category,
        frequency: a.frequency,
        reportingFields: a.reportingFields,
        status: a.status,
        createdAt: a.createdAt,
        updatedAt: a.updatedAt
      })),
      
      // Forms and templates - only accessible ones with storage mapping and associations
      form_templates: augmentedFormTemplates,
      form_responses: formResponses.map(fr => ({
        id: fr.id,
        formTemplateId: fr.formTemplateId,
        entityId: fr.entityId,
        entityType: fr.entityType,
        submittedBy: fr.submittedBy,
        beneficiaryId: fr.beneficiaryId,
        data: fr.data,
        latitude: fr.latitude,
        longitude: fr.longitude,
        submittedAt: fr.submittedAt,
        template: fr.template,
        submitter: fr.submitter,
        createdAt: fr.createdAt,
        updatedAt: fr.updatedAt
      })),
      
      // Services - only accessible ones
      services: (services as any[]).map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        category: s.category,
        status: s.status,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      })),
      service_deliveries: serviceDeliveries.map(sd => ({
        id: sd.id,
        serviceId: sd.serviceId,
        beneficiaryId: sd.beneficiaryId,
        entityId: sd.entityId,
        entityType: sd.entityType,
        formResponseId: sd.formResponseId,
        staffUserId: sd.staffUserId,
        deliveredAt: sd.deliveredAt,
        notes: sd.notes,
        service: sd.service,
        staff: sd.staff,
        beneficiary: sd.beneficiary,
        createdAt: sd.createdAt,
        updatedAt: sd.updatedAt
      })),
      
      // Beneficiaries - only accessible ones with proper PII handling
      beneficiaries: processedBeneficiaries
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ error: "Failed to generate datadump", message: err instanceof Error ? err.message : "Unknown error" });
  }
}

/**
 * Upload Endpoint - Handles offline survey responses from Flutter
 * POST /sync/uploads
 */
export async function upload(req: Request, res: Response) {
  try {
    const { surveys } = req.body;
    const user = req.user;

    if (!surveys || !Array.isArray(surveys)) {
      return res.status(400).json({ 
        status: "error",
        message: "Invalid surveys array" 
      });
    }

    const results: any[] = [];
    const manifestId = `manifest-${new Date().toISOString()}`;
    const manifestData: any[] = [];

    for (const survey of surveys) {
      try {
        const {
          clientRequestId,
          projectId,
          subprojectId,
          formId,
          beneficiaryId, // legacy single id
          beneficiaryIds: beneficiaryIdsArr, // new array contract
          serviceIds = [],
          answers = {},
          metadata = {}
        } = survey;

        // Validate required fields (subprojectId optional; fallback to project)
        if (!clientRequestId || !projectId || !formId) {
          results.push({
            clientRequestId: clientRequestId || 'unknown',
            status: "error",
            message: "Missing required fields: clientRequestId, projectId, formId"
          });
          continue;
        }

        // Start transaction for this survey
        const transaction = await sequelize.transaction();

        try {
          // 1. Lookup Form Template and validate
          const formTemplate = await FormTemplate.findByPk(formId, { transaction });
          if (!formTemplate) {
            throw new Error(`Form template not found: ${formId}`);
          }

          // Validate form data against schema
          const validation = await validateFormResponse(formId, answers);
          if (!validation.valid) {
            throw new Error(`Form validation failed: ${validation.errors?.join(', ')}`);
          }

          // 2. Validate project and subproject access
          const project = await Project.findByPk(projectId, { transaction });
          if (!project) {
            throw new Error(`Project not found: ${projectId}`);
          }

          let subproject: any = null;
          if (subprojectId) {
            subproject = await Subproject.findByPk(subprojectId, { transaction });
            if (!subproject || subproject.projectId !== projectId) {
              throw new Error(`Subproject not found or not associated with project: ${subprojectId}`);
            }
          }

          // Check RBAC - user must have access to this project
          const userProjects = await ProjectUser.findAll({
            where: { userId: user.id },
            transaction
          });
          const userProjectIds = userProjects.map(pu => pu.projectId);
          
          if (!userProjectIds.includes(projectId)) {
            throw new Error(`Access denied: User not assigned to project ${projectId}`);
          }

          // 3. Association validation (subproject preferred; project fallback)
          const feaList = await FormEntityAssociation.findAll({ where: { formTemplateId: formId }, transaction });
          let assocSubprojectId: string | null = null;
          let assocProjectId: string | null = null;
          for (const fea of (feaList as any[])) {
            if (fea.entityType === 'subproject') { assocSubprojectId = String(fea.entityId); break; }
          }
          if (!assocSubprojectId) {
            for (const fea of (feaList as any[])) {
              if (fea.entityType === 'project') { assocProjectId = String(fea.entityId); break; }
            }
          }

          if (assocSubprojectId) {
            if (!subprojectId || String(subprojectId) !== assocSubprojectId) {
              await transaction.rollback();
              return res.status(422).json({ status: 'error', code: 'INVALID_ASSOCIATION', message: 'subprojectId does not match form associations' });
            }
          } else if (assocProjectId) {
            if (String(projectId) !== assocProjectId) {
              await transaction.rollback();
              return res.status(422).json({ status: 'error', code: 'INVALID_ASSOCIATION', message: 'projectId does not match form associations' });
            }
          }

          // Validate services subset for associated entity
          const assocEntityId = assocSubprojectId || assocProjectId;
          const assocEntityType = assocSubprojectId ? 'subproject' : 'project';
          if (assocEntityId && serviceIds && serviceIds.length) {
            const svcAssigns = await ServiceAssignment.findAll({ where: { entityId: assocEntityId, entityType: assocEntityType }, attributes: ['serviceId'], transaction });
            const allowedSvc = new Set((svcAssigns as any[]).map(sa => String(sa.serviceId)));
            const invalidSvc = serviceIds.filter((sid: string) => !allowedSvc.has(String(sid)));
            if (invalidSvc.length) {
              await transaction.rollback();
              return res.status(422).json({ status: 'error', code: 'INVALID_ASSOCIATION', message: `ServiceIds not allowed for form: ${invalidSvc.join(', ')}` });
            }
          }

          // Validate beneficiaryIds subset when includeBeneficiaries
          const beneficiaryIds = Array.isArray(beneficiaryIdsArr) ? beneficiaryIdsArr : (beneficiaryId ? [beneficiaryId] : []);
          if (formTemplate.includeBeneficiaries) {
            if (beneficiaryIds.length) {
              const benAssigns = await BeneficiaryAssignment.findAll({ where: { entityId: assocEntityId, entityType: assocEntityType }, attributes: ['beneficiaryId'], transaction });
              const allowedBen = new Set((benAssigns as any[]).map(ba => String(ba.beneficiaryId)));
              const invalidBen = beneficiaryIds.filter((bid: string) => !allowedBen.has(String(bid)));
              if (invalidBen.length) {
                await transaction.rollback();
                return res.status(422).json({ status: 'error', code: 'INVALID_ASSOCIATION', message: `BeneficiaryIds not allowed for form: ${invalidBen.join(', ')}` });
              }
            }
          } else {
            if (beneficiaryIds.length) {
              await transaction.rollback();
              return res.status(422).json({ status: 'error', code: 'INVALID_ASSOCIATION', message: 'BeneficiaryIds provided for a form without beneficiaries' });
            }
          }

          // 4. Process Beneficiary (if needed)
          let finalBeneficiaryId = beneficiaryIds[0];
          if (formTemplate.includeBeneficiaries) {
            if (finalBeneficiaryId) {
              const existingBeneficiary = await Beneficiary.findByPk(finalBeneficiaryId, { transaction });
              if (!existingBeneficiary) {
                throw new Error(`Beneficiary not found: ${finalBeneficiaryId}`);
              }
            } else {
              // Create new beneficiary from form data
              const beneficiaryResult = await upsertFromFormResponse(
                formId,
                answers,
                { entityId: subprojectId || projectId, entityType: subprojectId ? 'subproject' : 'project' },
                { transaction, userId: user.id }
              );
              if (beneficiaryResult.created && beneficiaryResult.beneficiaryId) {
                finalBeneficiaryId = beneficiaryResult.beneficiaryId;
                // Assign beneficiary to associated entities
                await BeneficiaryAssignment.findOrCreate({
                  where: { beneficiaryId: finalBeneficiaryId, entityId: projectId, entityType: 'project' },
                  defaults: { id: uuidv4(), beneficiaryId: finalBeneficiaryId, entityId: projectId, entityType: 'project' },
                  transaction
                });
                if (subprojectId) {
                  await BeneficiaryAssignment.findOrCreate({
                    where: { beneficiaryId: finalBeneficiaryId, entityId: subprojectId, entityType: 'subproject' },
                    defaults: { id: uuidv4(), beneficiaryId: finalBeneficiaryId, entityId: subprojectId, entityType: 'subproject' },
                    transaction
                  });
                }
              }
            }
          }

          // 4. Create Form Response
          const formResponse = await FormResponse.create({
            id: uuidv4(),
            formTemplateId: formId,
            entityId: subprojectId || projectId,
            entityType: subprojectId ? 'subproject' : 'project',
              submittedBy: user.id,
            beneficiaryId: finalBeneficiaryId,
            data: validation.data || answers, // Use sanitized data
            latitude: metadata.location?.lat || null,
            longitude: metadata.location?.lng || null,
            submittedAt: new Date(metadata.timestamp || new Date())
          }, { transaction });

          // 5. Create Service Deliveries
          const serviceDeliveries = [];
          const serviceDetails = new Map(); // Store service details for manifest
          
          for (const serviceId of serviceIds) {
            // Validate service exists and is assigned to this subproject
            const service = await Service.findByPk(serviceId, { transaction });
            if (!service) {
              throw new Error(`Service not found: ${serviceId}`);
            }

            // Store service details for manifest
            serviceDetails.set(serviceId, {
              id: service.id,
              name: service.name,
              description: service.description,
              category: service.category
            });

            const serviceAssignment = await ServiceAssignment.findOne({
              where: {
                serviceId,
                entityId: subprojectId,
                entityType: 'subproject'
              },
              transaction
            });

            if (!serviceAssignment) {
              throw new Error(`Service ${serviceId} not assigned to subproject ${subprojectId}`);
            }

            const serviceDelivery = await ServiceDelivery.create({
              id: uuidv4(),
              serviceId,
              beneficiaryId: finalBeneficiaryId,
              entityId: subprojectId,
              entityType: 'subproject',
              formResponseId: formResponse.id,
              staffUserId: user.id,
              deliveredAt: new Date(metadata.timestamp || new Date()),
              notes: `Offline survey submission - ${metadata.deviceId || 'unknown device'}`
            }, { transaction });

            serviceDeliveries.push(serviceDelivery);
          }

          await transaction.commit();

          // Collect comprehensive manifest data for this survey
          const manifestEntry = {
            clientRequestId,
            serverSurveyId: formResponse.id,
            form: {
              id: formTemplate.id,
              name: formTemplate.name,
              version: formTemplate.version,
              includeBeneficiaries: formTemplate.includeBeneficiaries,
              schema: {
                fields: formTemplate.schema?.fields || [],
                fieldCount: formTemplate.schema?.fields?.length || 0
              }
            },
            project: {
              id: project.id,
              name: project.name,
              description: project.description,
              category: project.category,
              status: project.status
            },
            subproject: {
              id: subproject.id,
              name: subproject.name,
              description: subproject.description,
              category: subproject.category,
              status: subproject.status
            },
            beneficiary: finalBeneficiaryId ? {
              id: finalBeneficiaryId,
              // Note: We don't include PII in manifest for security
              status: "processed",
              wasCreated: !beneficiaryId, // true if we created a new beneficiary
              wasExisting: !!beneficiaryId // true if we used an existing beneficiary
            } : null,
            services: serviceDeliveries.map(sd => ({
              id: sd.serviceId,
              deliveryId: sd.id,
              deliveredAt: sd.deliveredAt,
              notes: sd.notes,
              // Get service details for manifest
              service: serviceDetails.get(sd.serviceId) || {
                id: sd.serviceId,
                name: 'Unknown Service',
                description: '',
                category: ''
              }
            })),
            surveyData: {
              submittedAt: formResponse.submittedAt,
              location: metadata.location ? {
                lat: metadata.location.lat,
                lng: metadata.location.lng
              } : null,
              deviceInfo: {
                deviceId: metadata.deviceId,
                appVersion: metadata.appVersion
              },
              answersCount: Object.keys(answers).length,
              hasLocation: !!(metadata.location?.lat && metadata.location?.lng),
              fieldAnswers: Object.keys(answers).map(fieldName => ({
                field: fieldName,
                value: answers[fieldName],
                type: typeof answers[fieldName]
              }))
            },
            processing: {
              processedAt: new Date().toISOString(),
              processingTimeMs: Date.now() - new Date(metadata.timestamp || new Date()).getTime(),
              transactionId: 'tx-' + Date.now() // Generate a simple transaction ID
            }
          };

          manifestData.push(manifestEntry);

        results.push({
            clientRequestId,
            serverSurveyId: formResponse.id,
            manifestId,
            status: "applied",
            entityType: "formSubmission"
          });

        } catch (error: any) {
          await transaction.rollback();
          throw error;
        }

      } catch (err: any) {
        console.error(`Error processing survey ${survey.clientRequestId}:`, err);
        results.push({
          clientRequestId: survey.clientRequestId || 'unknown',
          status: "error",
          message: err instanceof Error ? err.message : "Unknown error occurred"
        });
      }
    }


    // Generate comprehensive manifest summary
    const successfulSurveys = results.filter(r => r.status === "applied");
    const failedSurveys = results.filter(r => r.status === "error");
    
    // Collect unique forms, services, and beneficiaries from successful surveys
    const uniqueForms = new Map();
    const uniqueServices = new Map();
    const uniqueBeneficiaries = new Set();
    const uniqueProjects = new Map();
    const uniqueSubprojects = new Map();
    
    manifestData.forEach(entry => {
      // Collect unique forms
      if (!uniqueForms.has(entry.form.id)) {
        uniqueForms.set(entry.form.id, {
          id: entry.form.id,
          name: entry.form.name,
          version: entry.form.version,
          includeBeneficiaries: entry.form.includeBeneficiaries,
          fieldCount: entry.form.schema.fieldCount,
          usageCount: 0
        });
      }
      uniqueForms.get(entry.form.id).usageCount++;
      
      // Collect unique projects
      if (!uniqueProjects.has(entry.project.id)) {
        uniqueProjects.set(entry.project.id, {
          id: entry.project.id,
          name: entry.project.name,
          category: entry.project.category,
          status: entry.project.status
        });
      }
      
      // Collect unique subprojects
      if (!uniqueSubprojects.has(entry.subproject.id)) {
        uniqueSubprojects.set(entry.subproject.id, {
          id: entry.subproject.id,
          name: entry.subproject.name,
          category: entry.subproject.category,
          status: entry.subproject.status,
          projectId: entry.project.id
        });
      }
      
      // Collect unique beneficiaries
      if (entry.beneficiary) {
        uniqueBeneficiaries.add(entry.beneficiary.id);
      }
      
      // Collect unique services
      entry.services.forEach((serviceDelivery: any) => {
        if (!uniqueServices.has(serviceDelivery.id)) {
          uniqueServices.set(serviceDelivery.id, {
            id: serviceDelivery.id,
            name: serviceDelivery.service.name,
            description: serviceDelivery.service.description,
            category: serviceDelivery.service.category,
            deliveryCount: 0
          });
        }
        uniqueServices.get(serviceDelivery.id).deliveryCount++;
      });
    });

    res.json({
      status: "ok",
      manifestId,
      manifest: {
        id: manifestId,
        generatedAt: new Date().toISOString(),
        summary: {
          totalSurveys: surveys.length,
          successfulSurveys: successfulSurveys.length,
          failedSurveys: failedSurveys.length,
          successRate: surveys.length > 0 ? (successfulSurveys.length / surveys.length * 100).toFixed(2) + '%' : '0%'
        },
        forms: {
          count: uniqueForms.size,
          forms: Array.from(uniqueForms.values())
        },
        projects: {
          count: uniqueProjects.size,
          projects: Array.from(uniqueProjects.values())
        },
        subprojects: {
          count: uniqueSubprojects.size,
          subprojects: Array.from(uniqueSubprojects.values())
        },
        beneficiaries: {
          count: uniqueBeneficiaries.size,
          surveyed: Array.from(uniqueBeneficiaries),
          created: manifestData.filter(entry => entry.beneficiary?.wasCreated).length,
          existing: manifestData.filter(entry => entry.beneficiary?.wasExisting).length
        },
        services: {
          count: uniqueServices.size,
          services: Array.from(uniqueServices.values()),
          totalDeliveries: manifestData.reduce((sum, entry) => sum + entry.services.length, 0)
        },
        data: manifestData
      },
      results
    });

  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ 
      status: "error",
      message: err instanceof Error ? err.message : "Unknown error" 
    });
  }
}
