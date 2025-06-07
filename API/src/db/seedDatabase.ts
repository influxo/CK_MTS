import { seed } from './seeds/createRolesAndUsers';
import initDatabase from './init';

/**
 * Main function to initialize database and run seeds
 */
async function seedDatabase() {
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

// Run the seed function
seedDatabase();
