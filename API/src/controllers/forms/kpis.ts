import { Request, Response } from "express";
import { Kpi, FormField, AuditLog } from "../../models";
import { v4 as uuidv4 } from "uuid";
import { createLogger } from "../../utils/logger";
import kpiCalculationService, { KpiFilterOptions } from "../../services/forms/kpiCalculationService";
import sequelize from "../../db/connection";

// Create a logger instance for this module
const logger = createLogger('forms-kpis-controller');

/**
 * Create a new KPI definition
 */
export const createKpi = async (req: Request, res: Response) => {
  logger.info('Creating new KPI definition', { kpiName: req.body.name });
  
  try {
    const { name, description, calculationType, fieldId, aggregationType, filterCriteria } = req.body;

    // Validate required fields
    if (!name || !calculationType || !fieldId || !aggregationType) {
      logger.warn('Missing required fields for KPI definition');
      return res.status(400).json({
        success: false,
        message: "Name, calculationType, fieldId, and aggregationType are required",
      });
    }
    
    // Check if the field exists
    const field = await FormField.findByPk(fieldId);
    if (!field) {
      logger.warn('Field not found', { fieldId });
      return res.status(400).json({
        success: false,
        message: "Field not found",
      });
    }
    
    // Validate calculation type
    const validCalculationTypes = ['COUNT', 'SUM', 'AVERAGE', 'MIN', 'MAX', 'PERCENTAGE', 'CUSTOM'];
    if (!validCalculationTypes.includes(calculationType)) {
      logger.warn('Invalid calculation type', { calculationType });
      return res.status(400).json({
        success: false,
        message: `Calculation type must be one of: ${validCalculationTypes.join(', ')}`,
      });
    }
    
    // Validate aggregation type
    const validAggregationTypes = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'ALL_TIME'];
    if (!validAggregationTypes.includes(aggregationType)) {
      logger.warn('Invalid aggregation type', { aggregationType });
      return res.status(400).json({
        success: false,
        message: `Aggregation type must be one of: ${validAggregationTypes.join(', ')}`,
      });
    }
    
    // Create the KPI
    const kpi = await Kpi.create({
      id: uuidv4(),
      name,
      description,
      calculationType,
      fieldId,
      aggregationType,
      filterCriteria: filterCriteria || null,
      isActive: true,
    });
    
    // Create audit log entry
    await AuditLog.create({
      id: uuidv4(),
      userId: req.user.id,
      action: 'KPI_CREATE',
      description: `Created KPI '${name}'`,
      details: JSON.stringify({
        kpiId: kpi.id,
        fieldId,
        calculationType,
        aggregationType
      }),
      timestamp: new Date()
    });
    
    logger.info('KPI created successfully', { kpiId: kpi.id });
    
    return res.status(201).json({
      success: true,
      message: "KPI created successfully",
      data: kpi,
    });
    
  } catch (error: any) {
    logger.error(`Error creating KPI: ${error.message}`, error);
    return res.status(500).json({
      success: false,
      message: `Error creating KPI: ${error.message}`,
    });
  }
};

/**
 * Calculate a KPI time series for charting
 */
export const calculateKpiSeries = async (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Calculating KPI series', { kpiId: id });

  try {
    // Extract filter parameters from query
    const filters: any = {};

    if (req.query.fromDate) filters.fromDate = new Date(req.query.fromDate as string);
    if (req.query.toDate) filters.toDate = new Date(req.query.toDate as string);
    if (req.query.entityId) filters.entityId = req.query.entityId as string;
    if (req.query.entityType) filters.entityType = req.query.entityType as string;
    if (req.query.projectId) filters.projectId = req.query.projectId as string;
    if (req.query.subprojectId) filters.subprojectId = req.query.subprojectId as string;
    if (req.query.activityId) filters.activityId = req.query.activityId as string;

    // Validate and set groupBy
    const allowed = ['day', 'week', 'month', 'quarter', 'year'];
    const groupBy = (req.query.groupBy as string) || 'month';
    if (!allowed.includes(groupBy)) {
      logger.warn('Invalid groupBy value', { groupBy });
      return res.status(400).json({
        success: false,
        message: `groupBy must be one of: ${allowed.join(', ')}`,
      });
    }

    // Optional ad-hoc data filters (JSON array)
    if (req.query.dataFilters) {
      try {
        const parsed = JSON.parse(req.query.dataFilters as string);
        if (Array.isArray(parsed)) {
          filters.dataFilters = parsed;
        } else {
          logger.warn('dataFilters is not an array');
          return res.status(400).json({ success: false, message: 'dataFilters must be a JSON array' });
        }
      } catch (e: any) {
        logger.warn('Failed to parse dataFilters', { error: e?.message });
        return res.status(400).json({ success: false, message: 'Invalid JSON in dataFilters' });
      }
    }

    const result = await kpiCalculationService.calculateKpiSeries(id, { ...filters, groupBy });

    return res.status(200).json({ success: true, data: result });
  } catch (error: any) {
    logger.error(`Error calculating KPI series ${id}: ${error.message}`, error);
    return res.status(500).json({ success: false, message: `Error calculating KPI series: ${error.message}` });
  }
};

/**
 * Update an existing KPI definition
 */
export const updateKpi = async (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Updating KPI definition', { kpiId: id });
  
  try {
    // Find the KPI
    const kpi = await Kpi.findByPk(id);
    if (!kpi) {
      logger.warn('KPI not found', { kpiId: id });
      return res.status(404).json({
        success: false,
        message: "KPI not found",
      });
    }
    
    const { name, description, calculationType, fieldId, aggregationType, filterCriteria, isActive } = req.body;

    // Update only provided fields
    const updateData: any = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (calculationType !== undefined) {
      // Validate calculation type
      const validCalculationTypes = ['COUNT', 'SUM', 'AVERAGE', 'MIN', 'MAX', 'PERCENTAGE', 'CUSTOM'];
      if (!validCalculationTypes.includes(calculationType)) {
        logger.warn('Invalid calculation type', { calculationType });
        return res.status(400).json({
          success: false,
          message: `Calculation type must be one of: ${validCalculationTypes.join(', ')}`,
        });
      }
      updateData.calculationType = calculationType;
    }
    
    if (fieldId !== undefined) {
      // Check if the field exists
      const field = await FormField.findByPk(fieldId);
      if (!field) {
        logger.warn('Field not found', { fieldId });
        return res.status(400).json({
          success: false,
          message: "Field not found",
        });
      }
      updateData.fieldId = fieldId;
    }
    
    if (aggregationType !== undefined) {
      // Validate aggregation type
      const validAggregationTypes = ['DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY', 'ALL_TIME'];
      if (!validAggregationTypes.includes(aggregationType)) {
        logger.warn('Invalid aggregation type', { aggregationType });
        return res.status(400).json({
          success: false,
          message: `Aggregation type must be one of: ${validAggregationTypes.join(', ')}`,
        });
      }
      updateData.aggregationType = aggregationType;
    }
    
    if (filterCriteria !== undefined) updateData.filterCriteria = filterCriteria;
    if (isActive !== undefined) updateData.isActive = isActive;
    
    // Update the KPI
    await kpi.update(updateData);
    
    // Create audit log entry
    await AuditLog.create({
      id: uuidv4(),
      userId: req.user.id,
      action: 'KPI_UPDATE',
      description: `Updated KPI '${kpi.name}'`,
      details: JSON.stringify({
        kpiId: kpi.id,
        updatedFields: Object.keys(updateData)
      }),
      timestamp: new Date()
    });
    
    logger.info('KPI updated successfully', { kpiId: id });
    
    return res.status(200).json({
      success: true,
      message: "KPI updated successfully",
      data: await Kpi.findByPk(id, {
        include: [{
          model: FormField,
          as: 'field',
        }]
      }),
    });
    
  } catch (error: any) {
    logger.error(`Error updating KPI ${id}: ${error.message}`, error);
    return res.status(500).json({
      success: false,
      message: `Error updating KPI: ${error.message}`,
    });
  }
};

/**
 * Delete a KPI definition
 */
export const deleteKpi = async (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Deleting KPI definition', { kpiId: id });
  
  try {
    // Find the KPI
    const kpi = await Kpi.findByPk(id);
    if (!kpi) {
      logger.warn('KPI not found', { kpiId: id });
      return res.status(404).json({
        success: false,
        message: "KPI not found",
      });
    }
    
    // Use transaction for atomicity
    await sequelize.transaction(async (transaction) => {
      // Delete the KPI
      await kpi.destroy({ transaction });
      
      // Create audit log entry
      await AuditLog.create({
        id: uuidv4(),
        userId: req.user.id,
        action: 'KPI_DELETE',
        description: `Deleted KPI '${kpi.name}'`,
        details: JSON.stringify({
          kpiId: id
        }),
        timestamp: new Date()
      }, { transaction });
    });
    
    logger.info('KPI deleted successfully', { kpiId: id });
    
    return res.status(200).json({
      success: true,
      message: "KPI deleted successfully",
    });
    
  } catch (error: any) {
    logger.error(`Error deleting KPI ${id}: ${error.message}`, error);
    return res.status(500).json({
      success: false,
      message: `Error deleting KPI: ${error.message}`,
    });
  }
};

/**
 * Get all KPI definitions
 */
export const getAllKpis = async (req: Request, res: Response) => {
  logger.info('Getting all KPI definitions');
  
  try {
    // Get all KPIs with their associated fields
    const kpis = await Kpi.findAll({
      include: [{
        model: FormField,
        as: 'field',
      }],
      order: [['createdAt', 'DESC']]
    });
    
    return res.status(200).json({
      success: true,
      data: kpis,
    });
    
  } catch (error: any) {
    logger.error(`Error getting KPIs: ${error.message}`, error);
    return res.status(500).json({
      success: false,
      message: `Error getting KPIs: ${error.message}`,
    });
  }
};

/**
 * Get a KPI definition by ID
 */
export const getKpiById = async (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Getting KPI definition', { kpiId: id });
  
  try {
    // Find the KPI with its associated field
    const kpi = await Kpi.findByPk(id, {
      include: [{
        model: FormField,
        as: 'field',
      }]
    });
    
    if (!kpi) {
      logger.warn('KPI not found', { kpiId: id });
      return res.status(404).json({
        success: false,
        message: "KPI not found",
      });
    }
    
    return res.status(200).json({
      success: true,
      data: kpi,
    });
    
  } catch (error: any) {
    logger.error(`Error getting KPI ${id}: ${error.message}`, error);
    return res.status(500).json({
      success: false,
      message: `Error getting KPI: ${error.message}`,
    });
  }
};

/**
 * Calculate a specific KPI
 */
export const calculateKpi = async (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Calculating KPI', { kpiId: id });
  
  try {
    // Extract filter parameters from query
    const filters: KpiFilterOptions = {};
    
    if (req.query.fromDate) filters.fromDate = new Date(req.query.fromDate as string);
    if (req.query.toDate) filters.toDate = new Date(req.query.toDate as string);
    if (req.query.entityId) filters.entityId = req.query.entityId as string;
    if (req.query.entityType) filters.entityType = req.query.entityType as string;
    if (req.query.projectId) filters.projectId = req.query.projectId as string;
    if (req.query.subprojectId) filters.subprojectId = req.query.subprojectId as string;
    if (req.query.activityId) filters.activityId = req.query.activityId as string;
    
    // Calculate the KPI
    const result = await kpiCalculationService.calculateKpi(id, filters);
    
    return res.status(200).json({
      success: true,
      data: result,
    });
    
  } catch (error: any) {
    logger.error(`Error calculating KPI ${id}: ${error.message}`, error);
    return res.status(500).json({
      success: false,
      message: `Error calculating KPI: ${error.message}`,
    });
  }
};

/**
 * Calculate all KPIs for an entity
 */
export const calculateAllKpisForEntity = async (req: Request, res: Response) => {
  const { entityId, entityType } = req.params;
  logger.info('Calculating all KPIs for entity', { entityId, entityType });
  
  try {
    // Validate entity type
    const validEntityTypes = ['project', 'subproject', 'activity'];
    if (!validEntityTypes.includes(entityType)) {
      logger.warn('Invalid entity type', { entityType });
      return res.status(400).json({
        success: false,
        message: `Entity type must be one of: ${validEntityTypes.join(', ')}`,
      });
    }
    
    // Extract filter parameters from query
    const filters: KpiFilterOptions = {};
    
    if (req.query.fromDate) filters.fromDate = new Date(req.query.fromDate as string);
    if (req.query.toDate) filters.toDate = new Date(req.query.toDate as string);
    
    // Calculate all KPIs
    const results = await kpiCalculationService.calculateAllKpisForEntity(entityId, entityType, filters);
    
    return res.status(200).json({
      success: true,
      data: results,
    });
    
  } catch (error: any) {
    logger.error(`Error calculating KPIs for entity ${entityId}: ${error.message}`, error);
    return res.status(500).json({
      success: false,
      message: `Error calculating KPIs: ${error.message}`,
    });
  }
};

/**
 * Get all available form fields for KPIs
 */
export const getFormFields = async (req: Request, res: Response) => {
  logger.info('Getting all form fields for KPIs');
  
  try {
    const fields = await kpiCalculationService.getKpiFields();
    
    return res.status(200).json({
      success: true,
      data: fields,
    });
    
  } catch (error: any) {
    logger.error(`Error getting form fields: ${error.message}`, error);
    return res.status(500).json({
      success: false,
      message: `Error getting form fields: ${error.message}`,
    });
  }
};

export default {
  createKpi,
  updateKpi,
  deleteKpi,
  getAllKpis,
  getKpiById,
  calculateKpi,
  calculateKpiSeries,
  calculateAllKpisForEntity,
  getFormFields,
};
