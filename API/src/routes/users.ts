import express, { Request, Response, Router } from 'express';
import { User } from '../models';

const router: Router = Router();

// Get all users
router.get('/', (req: Request, res: Response) => {
  User.findAll({
    attributes: { exclude: ['password'] }
  })
    .then(users => {
      res.status(200).json(users);
    })
    .catch(error => {
      console.error('Error fetching users:', error);
      res.status(500).json({ message: 'Internal server error' });
    });
});

// Get user by ID
router.get('/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  
  User.findByPk(id, {
    attributes: { exclude: ['password'] }
  })
    .then(user => {
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }
      res.status(200).json(user);
    })
    .catch(error => {
      console.error('Error fetching user:', error);
      res.status(500).json({ message: 'Internal server error' });
    });
});

// Create a new user
router.post('/', function(req: Request, res: Response) {
  const { firstName, lastName, email, password, role } = req.body;
  
  // Simple validation
  if (!firstName || !lastName || !email || !password) {
    res.status(400).json({ message: 'Please provide all required fields' });
    return;
  }
  
  // Check if user already exists and create if not
  User.findOne({ where: { email } })
    .then(existingUser => {
      if (existingUser) {
        res.status(400).json({ message: 'User with this email already exists' });
        return null; // Return null to skip the next then block
      }
      
      // Create user
      return User.create({
        firstName,
        lastName,
        email,
        password, // Note: In a real app, you should hash this password
        role: role || 'user'
      });
    })
    .then(user => {
      if (!user) return; // Skip if user is null (already exists)
      
      // Return user without password
      const userObj = user.get({ plain: true });
      const { password: _, ...userWithoutPassword } = userObj;
      res.status(201).json(userWithoutPassword);
    })
    .catch(error => {
      console.error('Error creating user:', error);
      res.status(500).json({ message: 'Internal server error' });
    });
});

export default router;
