import { Request, Response } from "express";
import { CITY_VALUES } from "../../constants/cities";

/**
 * Get all cities
 */
export const getCities = async (req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      data: CITY_VALUES,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch cities",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Default export for the controller
export default {
  getCities,
};
