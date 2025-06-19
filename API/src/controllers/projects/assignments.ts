import { Request, Response } from "express";
import { Project, User, ProjectUser } from "../../models";
import { v4 as uuidv4 } from "uuid";

/**
 * Get all users assigned to a project
 */
export const getProjectUsers = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;

    console.log("Getting project users.")
    
    // Verify project exists
    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }
    console.log(`Project ${projectId} found.`)

    // Get all users assigned to this project
    const projectWithUsers = await Project.findByPk(projectId, {
      include: [
        {
          model: User,
          as: "members",
          attributes: ["id", "firstName", "lastName", "email", "status"],
          through: { attributes: [] } // Exclude the join table attributes
        }
      ]
    });
    console.log(`Project users found: ${projectWithUsers?.members?.length || 0}`)

    return res.status(200).json({
      success: true,
      data: projectWithUsers?.members || [],
    });
  } catch (error) {
    console.error("Error fetching project users:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

/**
 * Assign a user to a project
 */
export const assignUserToProject = async (req: Request, res: Response) => {
  try {
    const { projectId } = req.params;
    const { userId } = req.body;

    // Validate required fields
    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    // Verify project exists
    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Verify user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is already assigned to this project
    const existingAssignment = await ProjectUser.findOne({
      where: { projectId, userId }
    });

    if (existingAssignment) {
      return res.status(400).json({
        success: false,
        message: "User is already assigned to this project",
      });
    }

    // Create assignment using the add method from the association
    await project.addMember(user);

    // Get the user with their details
    const assignedUser = await User.findByPk(userId, {
      attributes: ["id", "firstName", "lastName", "email", "status"]
    });

    return res.status(201).json({
      success: true,
      message: "User assigned to project successfully",
      data: assignedUser,
    });
  } catch (error) {
    console.error("Error assigning user to project:", error);
    return res.status(500).json({
      success: false,
      message: "Error assigning user to project",
      error: error as Error,
    });
  }
};

/**
 * Remove a user from a project
 */
export const removeUserFromProject = async (req: Request, res: Response) => {
  try {
    const { projectId, userId } = req.params;

    // Verify project exists
    const project = await Project.findByPk(projectId);
    if (!project) {
      return res.status(404).json({
        success: false,
        message: "Project not found",
      });
    }

    // Verify user exists
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if user is assigned to this project
    const existingAssignment = await ProjectUser.findOne({
      where: { projectId, userId }
    });

    if (!existingAssignment) {
      return res.status(404).json({
        success: false,
        message: "User is not assigned to this project",
      });
    }

    // Remove user from project using the remove method from the association
    await project.removeMember(user);

    return res.status(200).json({
      success: true,
      message: "User removed from project successfully",
    });
  } catch (error) {
    console.error("Error removing user from project:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export default {
  getProjectUsers,
  assignUserToProject,
  removeUserFromProject,
};
