import { seed } from './seeds/createRolesAndUsers';
import initDatabase from './init';

/**
 * Main function to initialize database and run seeds
 */
export async function seedDatabase() {
  try {
    console.log('Initializing database...');
    await initDatabase();
    
    console.log('Running seeds...');
    await seed();
    
    console.log('Database seeding completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Database seeding failed:', error);
    process.exit(1);
  }
}

// Export the function to be called explicitly
// Don't run automatically to prevent duplicate execution
