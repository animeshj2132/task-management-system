import request from 'supertest';
import app from '../app.js';
import User from '../models/userModel.js';
import Task from '../models/taskModel.js';
import mongoose from 'mongoose';

describe('API Endpoints', () => {
  let token;
  let userId;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true });
    
    // Create a test user and get token
    const response = await request(app)
      .post('/api/auth/register')
      .send({
        username: 'testuser',
        email: 'testuser@example.com',
        password: 'password123'
      });
    
    token = response.body.token;
    userId = response.body.user._id;
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Task.deleteMany({});
    await mongoose.connection.close();
  });

  describe('Task API', () => {
    it('should create a new task', async () => {
      const response = await request(app)
        .post('/api/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({
          title: 'Test Task',
          description: 'This is a test task',
          dueDate: new Date(),
          priority: 'medium'
        });

      expect(response.statusCode).toBe(201);
      expect(response.body.title).toBe('Test Task');
    });

    it('should get all tasks', async () => {
      const response = await request(app)
        .get('/api/tasks')
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(Array.isArray(response.body)).toBeTruthy();
    });
  });

  describe('User API', () => {
    it('should get user profile', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${token}`);

      expect(response.statusCode).toBe(200);
      expect(response.body.email).toBe('testuser@example.com');
    });

    it('should update user profile', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${token}`)
        .send({
          username: 'updateduser'
        });

      expect(response.statusCode).toBe(200);
      expect(response.body.username).toBe('updateduser');
    });
  });
});