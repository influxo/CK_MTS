import { Request, Response } from "express";
import { Subproject, Project } from "../../models";
import { v4 as uuidv4 } from "uuid";
import assignmentsController from "../assignments/assignments";

/**
 * Get all subprojects
 */
export const getAllSubprojects = async (req: Request, res: Response) => {
  try {
    const subprojects = await Subproject.findAll();

    return res.status(200).json({
      success: true,
      data: subprojects,
    });
  } catch (error) {
    console.error("Error fetching subprojects:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get subproject by ID
 */
export const getSubprojectById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const subproject = await Subproject.findByPk(id);

    if (!subproject) {
      return res.status(404).json({
        success: false,
        message: "Subproject not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: subproject,
    });
  } catch (error) {
    console.error("Error fetching subproject:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get all subprojects for a project
 */
export const getSubprojectsByProjectId = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    // Check if project exists
    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    const subprojects = await Subproject.findAll({
      where: { projectId },
    });

    return res.status(200).json({
      success: true,
      data: subprojects,
    });
  } catch (error) {
    console.error("Error fetching subprojects:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Create a new subproject
 */
export const createSubproject = async (req: Request, res: Response) => {
  try {
    const { name, description, category, status, projectId } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Subproject name is required",
      });
    }

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required",
      });
    }

    // Check if project exists
    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Create subproject
    const subproject = await Subproject.create({
      id: uuidv4(),
      name,
      description,
      category,
      status: status || "active",
      projectId,
    });

    return res.status(201).json({
      success: true,
      message: "Subproject created successfully",
      data: subproject,
    });
  } catch (error: any) {
    console.error("Error creating subproject:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating subproject",
      error: error.message,
    });
  }
};

/**
 * Update an existing subproject
 */
export const updateSubproject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, category, status } = req.body;

    // Find subproject
    const subproject = await Subproject.findByPk(id);
    if (!subproject) {
      return res.status(404).json({
        success: false,
        message: "Subproject not found",
      });
    }

    // Update subproject
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (status !== undefined) {
      // Validate status
      if (!["active", "inactive"].includes(status)) {
        return res.status(400).json({
          success: false,
          message: 'Status must be either "active" or "inactive"',
        });
      }
      updateData.status = status;
    }

    await subproject.update(updateData);

    return res.status(200).json({
      success: true,
      message: "Subproject updated successfully",
      data: subproject,
    });
  } catch (error) {
    console.error("Error updating subproject:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Delete a subproject
 */
export const deleteSubproject = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Find subproject
    const subproject = await Subproject.findByPk(id);
    if (!subproject) {
      return res.status(404).json({
        success: false,
        message: "Subproject not found",
      });
    }

    // Delete subproject
    await subproject.destroy();

    return res.status(200).json({
      success: true,
      message: "Subproject deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting subproject:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export default {
  getAllSubprojects,
  getSubprojectById,
  getSubprojectsByProjectId,
  createSubproject,
  updateSubproject,
  deleteSubproject,
  assignments: assignmentsController,
};
