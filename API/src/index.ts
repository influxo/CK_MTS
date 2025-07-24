import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import routes from "./routes";
import initDatabase from "./db/init";
import loggerMiddleware from "./middlewares/logger";
import { swaggerUi, swaggerSpec } from "./config/swagger";
import {seedDatabase} from "./db/seedDatabase";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' })); // Set 2MB limit for JSON payloads
app.use(express.urlencoded({ extended: true, limit: '2mb' }));

// Request logging middleware
app.use(loggerMiddleware);

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/api', routes);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'production' ? {} : err
  });
});

// Initialize database and start server
initDatabase()
  .then(() => {
    // Run seedDatabase to populate the empty database
    // seedDatabase();
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });