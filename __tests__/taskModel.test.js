import mongoose from 'mongoose';
import Task from '../models/taskModel.js';
import User from '../models/userModel.js';

describe('Task Model Test', () => {
  let testUser;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URL, { useNewUrlParser: true, useUnifiedTopology: true });
    testUser = await User.create({
      username: 'taskuser',
      email: 'taskuser@example.com',
      password: 'password123'
    });
  });

  afterAll(async () => {
    await User.deleteMany({});
    await Task.deleteMany({});
    await mongoose.connection.close();
  });

  it('should create & save task successfully', async () => {
    const validTask = new Task({
      title: 'Test Task',
      description: 'This is a test task',
      dueDate: new Date(),
      priority: 'medium',
      status: 'pending',
      assignedTo: testUser._id,
      createdBy: testUser._id
    });
    const savedTask = await validTask.save();
    
    expect(savedTask._id).toBeDefined();
    expect(savedTask.title).toBe(validTask.title);
    expect(savedTask.description).toBe(validTask.description);
    expect(savedTask.priority).toBe(validTask.priority);
    expect(savedTask.status).toBe(validTask.status);
    expect(savedTask.assignedTo).toEqual(testUser._id);
    expect(savedTask.createdBy).toEqual(testUser._id);
  });

  it('should fail to create task without required fields', async () => {
    const taskWithoutRequiredField = new Task({ title: 'Incomplete Task' });
    let err;
    try {
      await taskWithoutRequiredField.save();
    } catch (error) {
      err = error;
    }
    expect(err).toBeInstanceOf(mongoose.Error.ValidationError);
  });
});