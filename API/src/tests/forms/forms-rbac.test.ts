import request from 'supertest';
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import routes from '../../routes';
import { ROLES } from '../../constants/roles';
import { FormTemplate, FormResponse, User, Project, Log } from '../../models';
import sequelize from '../../db/connection';

// Mock models and their methods
jest.mock('../../models', () => {
  const mockFormTemplate = {
    findByPk: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  
  const mockFormResponse = {
    findAll: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
  };
  
  const mockUser = {};
  
  const mockProject = {
    findByPk: jest.fn(),
  };
  
  const mockLog = {
    create: jest.fn(),
  };
  
  return {
    FormTemplate: mockFormTemplate,
    FormResponse: mockFormResponse,
    User: mockUser,
    Project: mockProject,
    Log: mockLog,
  };
});

// Mock logger
jest.mock('../../utils/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }),
}));

// Mock DB connection
jest.mock('../../db/connection', () => {
  const mockSequelize = {
    transaction: jest.fn().mockImplementation((cb) => {
      const mockTransaction = {
        commit: jest.fn().mockResolvedValue(true),
        rollback: jest.fn(),
      };
      return Promise.resolve(cb(mockTransaction));
    }),
  };
  return {
    sequelize: mockSequelize,
    transaction: mockSequelize.transaction,
  };
});

describe('Forms Module RBAC Tests', () => {
  let app: express.Application;
  
  // Test data
  const testFormTemplateId = uuidv4();
  const testProgramId = uuidv4();
  const testUserId = uuidv4();
  
  // JWT token generation helper
  const generateToken = (role: string, allowedProgramIds: string[] = []) => {
    const payload = { 
      id: testUserId, 
      role,
      allowedProgramIds
    };
    return jwt.sign(payload, 'test-secret-key', { expiresIn: '1h' });
  };
  
  beforeAll(() => {
    // Simpler approach to mocking JWT verification to avoid TypeScript errors
    jest.mock('jsonwebtoken', () => ({
      verify: (token: string, _secretOrKey: any, options: any, callback?: any) => {
        try {
          // Just use the token itself as a payload for testing purposes
          // In real tests, we'd want to parse the actual JWT payload properly
          const payload = { id: testUserId };
          
          if (typeof options === 'function') {
            // Handle case where options is actually the callback
            options(null, payload);
            return payload;
          }
          
          if (callback) {
            callback(null, payload);
          }
          return payload;
        } catch (error) {
          const jwtError = new jwt.JsonWebTokenError('Invalid token');
          if (typeof options === 'function') {
            options(jwtError, undefined);
          } else if (callback) {
            callback(jwtError, undefined);
          }
          throw jwtError;
        }
      },
      sign: jest.fn().mockImplementation((payload) => {
        // Return a simple mock JWT for testing
        return 'mock.jwt.token';
      }),
      JsonWebTokenError: jest.fn().mockImplementation(function(this: { name: string; message: string }, message: string) {
        this.name = 'JsonWebTokenError';
        this.message = message;
      })
    }));
    
    // No need for spyOn as we're mocking the whole module
    
    // Set up express app with routes
    app = express();
    app.use(express.json());
    app.use('/api', routes);
  });
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup default mocks
    (Project.findByPk as jest.Mock).mockResolvedValue({
      id: testProgramId,
      name: 'Test Program'
    });
    
    (FormTemplate.findByPk as jest.Mock).mockResolvedValue({
      id: testFormTemplateId,
      name: 'Test Template',
      programId: testProgramId,
      schema: { fields: [] },
      version: 1,
      destroy: jest.fn().mockResolvedValue(true)
    });
    
    (FormTemplate.create as jest.Mock).mockResolvedValue({
      id: testFormTemplateId,
      name: 'Test Template',
      programId: testProgramId,
      schema: { fields: [] },
      version: 1
    });
  });
  
  describe('Form Template Endpoints', () => {
    describe('POST /api/forms/templates', () => {
      test('Should return 401 when no token is provided', async () => {
        const response = await request(app)
          .post('/api/forms/templates')
          .send({
            name: 'Test Form',
            programId: testProgramId,
            schema: { fields: [] }
          });
        
        expect(response.status).toBe(401);
      });
      
      test('Should return 403 when user role is not authorized', async () => {
        const token = generateToken('VIEWER_ROLE');
        
        const response = await request(app)
          .post('/api/forms/templates')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: 'Test Form',
            programId: testProgramId,
            schema: { fields: [] }
          });
        
        expect(response.status).toBe(403);
      });
      
      test('Should return 403 when user does not have access to program', async () => {
        // User has PROGRAM_MANAGER role but not for this program
        const token = generateToken(ROLES.PROGRAM_MANAGER, ['some-other-program-id']);
        
        const response = await request(app)
          .post('/api/forms/templates')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: 'Test Form',
            programId: testProgramId,
            schema: { fields: [] }
          });
        
        expect(response.status).toBe(403);
      });
      
      test('Should return 201 when authorized admin creates template', async () => {
        const token = generateToken(ROLES.SUPER_ADMIN);
        
        const response = await request(app)
          .post('/api/forms/templates')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: 'Test Form',
            programId: testProgramId,
            schema: { fields: [] }
          });
        
        expect(response.status).toBe(201);
        expect(FormTemplate.create).toHaveBeenCalled();
      });
      
      test('Should return 201 when program manager with access creates template', async () => {
        const token = generateToken(ROLES.PROGRAM_MANAGER, [testProgramId]);
        
        const response = await request(app)
          .post('/api/forms/templates')
          .set('Authorization', `Bearer ${token}`)
          .send({
            name: 'Test Form',
            programId: testProgramId,
            schema: { fields: [] }
          });
        
        expect(response.status).toBe(201);
        expect(FormTemplate.create).toHaveBeenCalled();
      });
    });
    
    describe('DELETE /api/forms/templates/:id', () => {
      test('Should return 403 when field operator tries to delete', async () => {
        const token = generateToken(ROLES.FIELD_OPERATOR, [testProgramId]);
        
        const response = await request(app)
          .delete(`/api/forms/templates/${testFormTemplateId}`)
          .set('Authorization', `Bearer ${token}`);
        
        expect(response.status).toBe(403);
      });
      
      test('Should return 200 when admin deletes template', async () => {
        const token = generateToken(ROLES.SUPER_ADMIN);
        
        const response = await request(app)
          .delete(`/api/forms/templates/${testFormTemplateId}`)
          .set('Authorization', `Bearer ${token}`);
        
        expect(response.status).toBe(200);
      });
    });
  });
  
  describe('Form Response Endpoints', () => {
    describe('POST /api/forms/templates/:id/responses', () => {
      beforeEach(() => {
        (FormResponse.create as jest.Mock).mockResolvedValue({
          id: uuidv4(),
          form_template_id: testFormTemplateId,
          programId: testProgramId,
          submitted_by: testUserId,
          data: { question1: 'answer1' },
          submitted_at: new Date()
        });
      });
      
      test('Should return 403 when viewer tries to submit response', async () => {
        // Assume there's a VIEWER role in the system
        const token = generateToken('VIEWER', [testProgramId]);
        
        const response = await request(app)
          .post(`/api/forms/templates/${testFormTemplateId}/responses`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            data: { question1: 'answer1' }
          });
        
        expect(response.status).toBe(403);
      });
      
      test('Should return 201 when field operator submits response', async () => {
        const token = generateToken(ROLES.FIELD_OPERATOR, [testProgramId]);
        
        const response = await request(app)
          .post(`/api/forms/templates/${testFormTemplateId}/responses`)
          .set('Authorization', `Bearer ${token}`)
          .send({
            data: { question1: 'answer1' },
            latitude: 41.123456,
            longitude: 20.654321
          });
        
        expect(response.status).toBe(201);
        expect(FormResponse.create).toHaveBeenCalled();
      });
    });
    
    describe('GET /api/forms/templates/:id/responses', () => {
      beforeEach(() => {
        (FormResponse.findAll as jest.Mock).mockResolvedValue([
          {
            id: uuidv4(),
            form_template_id: testFormTemplateId,
            programId: testProgramId,
            submitted_by: testUserId,
            data: { question1: 'answer1' },
            latitude: 41.123456,
            longitude: 20.654321,
            submitted_at: new Date()
          }
        ]);
        
        (FormResponse.count as jest.Mock).mockResolvedValue(1);
      });
      
      test('Should return 200 with pagination when fetching responses', async () => {
        const token = generateToken(ROLES.PROGRAM_MANAGER, [testProgramId]);
        
        const response = await request(app)
          .get(`/api/forms/templates/${testFormTemplateId}/responses`)
          .query({ page: 1, limit: 10 })
          .set('Authorization', `Bearer ${token}`);
        
        expect(response.status).toBe(200);
        expect(response.body.meta).toBeDefined();
        expect(response.body.meta.page).toBe(1);
        expect(FormResponse.findAll).toHaveBeenCalledWith(
          expect.objectContaining({
            limit: 10,
            offset: 0
          })
        );
      });
      
      test('Should apply date filters when provided', async () => {
        const token = generateToken(ROLES.PROGRAM_MANAGER, [testProgramId]);
        const fromDate = '2025-01-01T00:00:00.000Z';
        const toDate = '2025-12-31T23:59:59.999Z';
        
        const response = await request(app)
          .get(`/api/forms/templates/${testFormTemplateId}/responses`)
          .query({ fromDate, toDate })
          .set('Authorization', `Bearer ${token}`);
        
        expect(response.status).toBe(200);
        expect(FormResponse.findAll).toHaveBeenCalledWith(
          expect.objectContaining({
            where: expect.objectContaining({
              submitted_at: expect.anything()
            })
          })
        );
      });
    });
  });
});
