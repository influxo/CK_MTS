import { Request, Response } from "express";
import { Activity, Subproject } from "../../models";
import { v4 as uuidv4 } from "uuid";

/**
 * Get all activities
 */
export const getAllActivities = async (req: Request, res: Response) => {
  try {
    const activities = await Activity.findAll();

    return res.status(200).json({
      success: true,
      data: activities,
    });
  } catch (error) {
    console.error("Error fetching activities:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get activity by ID
 */
export const getActivityById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const activity = await Activity.findByPk(id);

    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: activity,
    });
  } catch (error) {
    console.error("Error fetching activity:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Get all activities for a subproject
 */
export const getActivitiesBySubprojectId = async (req: Request, res: Response) => {
  try {
    const { subprojectId } = req.params;

    // Check if subproject exists
    const subproject = await Subproject.findByPk(subprojectId);
    if (!subproject) {
      return res.status(404).json({
        success: false,
        message: "Subproject not found",
      });
    }

    const activities = await Activity.findAll({
      where: { subprojectId },
    });

    return res.status(200).json({
      success: true,
      data: activities,
    });
  } catch (error) {
    console.error("Error fetching activities:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Create a new activity
 */
export const createActivity = async (req: Request, res: Response) => {
  try {
    const { name, description, category, frequency, reportingFields, subprojectId, status } = req.body;

    // Validate required fields
    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Activity name is required",
      });
    }

    if (!subprojectId) {
      return res.status(400).json({
        success: false,
        message: "Subproject ID is required",
      });
    }

    // Check if subproject exists
    const subproject = await Subproject.findByPk(subprojectId);
    if (!subproject) {
      return res.status(404).json({
        success: false,
        message: "Subproject not found",
      });
    }

    // Create activity
    const activity = await Activity.create({
      id: uuidv4(),
      name,
      description,
      category,
      frequency,
      reportingFields,
      subprojectId,
      status: status || "active",
    });

    return res.status(201).json({
      success: true,
      message: "Activity created successfully",
      data: activity,
    });
  } catch (error: any) {
    console.error("Error creating activity:", error);
    return res.status(500).json({
      success: false,
      message: "Error creating activity",
      error: error.message,
    });
  }
};

/**
 * Update an existing activity
 */
export const updateActivity = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, description, category, frequency, reportingFields, status } = req.body;

    // Find activity
    const activity = await Activity.findByPk(id);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    // Update activity
    const updateData: any = {};

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (category !== undefined) updateData.category = category;
    if (frequency !== undefined) updateData.frequency = frequency;
    if (reportingFields !== undefined) updateData.reportingFields = reportingFields;
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

    await activity.update(updateData);

    return res.status(200).json({
      success: true,
      message: "Activity updated successfully",
      data: activity,
    });
  } catch (error) {
    console.error("Error updating activity:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Delete an activity
 */
export const deleteActivity = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // Find activity
    const activity = await Activity.findByPk(id);
    if (!activity) {
      return res.status(404).json({
        success: false,
        message: "Activity not found",
      });
    }

    // Delete activity
    await activity.destroy();

    return res.status(200).json({
      success: true,
      message: "Activity deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting activity:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export default {
  getAllActivities,
  getActivityById,
  getActivitiesBySubprojectId,
  createActivity,
  updateActivity,
  deleteActivity,
};
