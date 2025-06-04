import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';

dotenv.config();

// Database connection parameters should be in your .env file
// DB_HOST=localhost
// DB_PORT=5432
// DB_NAME=caritas
// DB_USER=postgres
// DB_PASSWORD=yourpassword

const sequelize = new Sequelize(
  process.env.DB_NAME || 'caritas',
  process.env.DB_USER || 'postgres',
  process.env.DB_PASSWORD || 'password',
  {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    dialect: 'postgres',
    logging: false,
    pool: {
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000
    }
  }
);

export default sequelize;
