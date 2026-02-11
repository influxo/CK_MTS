import { Request, Response } from "express";
import { Project, AuditLog } from "../../models";
import { v4 as uuidv4 } from "uuid";
import { Op } from "sequelize";
import assignmentsController from "../assignments/assignments";
import { createLogger } from "../../utils/logger";
import { CITY_VALUES } from "../../constants/cities";

// Create a logger instance for this module
const logger = createLogger('projects-controller');

/**
 * Get all projects
 */
export const getAllProjects = async (req: Request, res: Response) => {
  logger.info('Getting all projects');
  try {
    const { city, includeArchived } = req.query;
    const where: any = {
      isArchived: includeArchived === 'true' ? { [Op.in]: [true, false] } : false,
    };
    if (city) where.city = city;

    const projects = await Project.findAll({ where });
    logger.info(`Found ${projects.length} projects`);
    return res.status(200).json({
      success: true,
      data: projects,
    });
  } catch (error) {
    logger.error('Error fetching projects', error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get project by ID
 */
export const getProjectById = async (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Getting project by ID', { projectId: id });
  
  try {
    const project = await Project.findByPk(id);

    if (!project) {
      logger.warn('Project not found', { projectId: id });
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    logger.info('Successfully retrieved project', { projectId: id });
    return res.status(200).json({
      success: true,
      data: project,
    });
  } catch (error) {
    logger.error(`Error fetching project with ID: ${id}`, error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Create a new project
 */
export const createProject = async (req: Request, res: Response) => {
  logger.info('Creating new project', { projectName: req.body.name });
  
  try {
    const { name, description, category, city, status } = req.body;

    // Validate required fields
    if (!name) {
      logger.warn('Missing project name for creation');
      return res.status(400).json({
        success: false,
        message: "Project name is required",
      });
    }

    // Validate city if provided
    if (city && !CITY_VALUES.includes(city)) {
      logger.warn('Invalid city provided for project creation', { city });
      return res.status(400).json({
        success: false,
        message: `Invalid city. Must be one of: ${CITY_VALUES.join(', ')}`,
      });
    }

    // Create project
    logger.info('Creating project record', { name, category });
    const project = await Project.create({
      id: uuidv4(),
      name,
      description,
      category,
      city,
      status: status || "active",
    });

    logger.info('Project created successfully', { projectId: project.id });

    // Write human-readable audit log
    const actor = (req as any).user;
    const actorName = actor ? `${actor.firstName || ''} ${actor.lastName || ''}`.trim() || actor.email || actor.id : 'System';
    await AuditLog.create({
      userId: actor?.id || 'system',
      action: 'PROJECT_CREATED',
      description: `${actorName} created a new project named "${name}"`,
      details: JSON.stringify({ projectId: project.id, name, category, status: project.status })
    });
    return res.status(201).json({
      success: true,
      message: "Project created successfully",
      data: project,
    });
  } catch (error: any) {
    logger.error('Error creating project', error);
    return res.status(500).json({
      success: false,
      message: "Error creating project",
      error: error.message,
    });
  }
};

/**
 * Update an existing project
 */
export const updateProject = async (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Updating project', { projectId: id });
  
  try {
    const { name, description, category, city, status } = req.body;

    // Find project
    const project = await Project.findByPk(id);
    if (!project) {
      logger.warn('Project not found for update', { projectId: id });
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Update project
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (city !== undefined) {
      if (city !== null && !CITY_VALUES.includes(city)) {
        logger.warn('Invalid city provided for project update', { projectId: id, city });
        return res.status(400).json({
          success: false,
          message: `Invalid city. Must be one of: ${CITY_VALUES.join(', ')}`,
        });
      }
      updateData.city = city;
    }
    if (status !== undefined) {
      // Validate status
      if (!["active", "inactive"].includes(status)) {
        logger.warn('Invalid status provided for project update', { projectId: id, status });
        return res.status(400).json({
          success: false,
          message: 'Status must be either "active" or "inactive"',
        });
      }
      updateData.status = status;
    }

    logger.info('Updating project data', { projectId: id, fields: Object.keys(updateData) });
    await project.update(updateData);

    logger.info('Project updated successfully', { projectId: id });

    // Human-readable audit log
    const actor = (req as any).user;
    const actorName = actor ? `${actor.firstName || ''} ${actor.lastName || ''}`.trim() || actor.email || actor.id : 'System';
    await AuditLog.create({
      userId: actor?.id || 'system',
      action: 'PROJECT_UPDATED',
      description: `${actorName} updated project "${project.name}"`,
      details: JSON.stringify({ projectId: id, fields: Object.keys(updateData) })
    });
    return res.status(200).json({
      success: true,
      message: "Project updated successfully",
      data: project,
    });
  } catch (error) {
    logger.error(`Error updating project with ID: ${id}`, error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Archive a project (soft delete)
 */
export const deleteProject = async (req: Request, res: Response) => {
  const { id } = req.params;
  logger.info('Archiving project', { projectId: id });
  
  try {
    // Find project
    const project = await Project.findByPk(id);
    if (!project) {
      logger.warn('Project not found for archiving', { projectId: id });
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Check if already archived
    if (project.isArchived) {
      logger.warn('Project already archived', { projectId: id });
      return res.status(400).json({
        success: false,
        message: "Project is already archived",
      });
    }

    // Archive project
    logger.info('Archiving project record', { projectId: id });
    await project.update({
      isArchived: true,
      archivedAt: new Date(),
    });

    logger.info('Project archived successfully', { projectId: id });

    // Human-readable audit log
    const actor = (req as any).user;
    const actorName = actor ? `${actor.firstName || ''} ${actor.lastName || ''}`.trim() || actor.email || actor.id : 'System';
    await AuditLog.create({
      userId: actor?.id || 'system',
      action: 'PROJECT_ARCHIVED',
      description: `${actorName} archived project "${project.name}"`,
      details: JSON.stringify({ projectId: id })
    });
    return res.status(200).json({
      success: true,
      message: "Project archived successfully",
    });
  } catch (error) {
    logger.error(`Error archiving project with ID: ${id}`, error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export default {
  getAllProjects,
  getProjectById,
  createProject,
  updateProject,
  deleteProject,
  assignments: assignmentsController,
};
