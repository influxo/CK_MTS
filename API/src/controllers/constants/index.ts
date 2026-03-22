import { Request, Response } from "express";
import { CITY_VALUES } from "../../constants/cities";
import { CHRONIC_CONDITION_VALUES } from "../../constants/chronicConditions";

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

/**
 * Get all chronic conditions / ICD-10 diagnoses
 */
export const getChronicConditions = async (req: Request, res: Response) => {
  try {
    res.status(200).json({
      success: true,
      data: CHRONIC_CONDITION_VALUES,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to fetch chronic conditions",
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Default export for the controller
export default {
  getCities,
  getChronicConditions,
};
