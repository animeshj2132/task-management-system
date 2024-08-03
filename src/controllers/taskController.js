import Task from '../models/taskModel.js';
import User from '../models/userModel.js';
import moment from 'moment';
import { GET_ASYNC, SET_ASYNC } from '../utils/caching.js';
import mailgun from 'mailgun-js';
import dotenv from 'dotenv';

dotenv.config();

const validateDueDate = (dueDate) => {
  return moment(dueDate, 'DD/MM/YYYY', true).isValid();
};

// Initialize Mailgun
const mg = mailgun({
  apiKey: process.env.MAILGUN_API_KEY,
  domain: process.env.MAILGUN_DOMAIN,
});

// Email sending function
const sendEmailNotification = async (toEmail, subject, content) => {
  const data = {
    from: 'Task Management <no-reply@yourdomain.com>', // Replace with your sender email
    to: toEmail,
    subject: subject,
    html: content,
  };

  try {
    await mg.messages().send(data);
    console.log('Email sent to:', toEmail);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

// Create a new task (only admin can create)
export const createTask = async (req, res) => {
  try {
    const { role } = req.user;

    if (role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can create tasks' });
    }

    const { dueDate, assignedTo } = req.body;

    // Validate dueDate
    if (!validateDueDate(dueDate)) {
      return res.status(400).json({ message: 'Invalid due date format. Use DD/MM/YYYY.' });
    }

    // Format dueDate as string in YYYY-MM-DD
    const formattedDueDate = moment(dueDate, 'DD/MM/YYYY').format('YYYY-MM-DD');

    // Create a new task
    const task = new Task({
      ...req.body,
      dueDate: formattedDueDate,
      createdBy: req.user._id,
    });

    // Save the task
    await task.save();

    // Send email if task is assigned
    if (assignedTo) {
      const assignedUser = await User.findById(assignedTo);
      if (assignedUser && assignedUser.email) {
        const subject = 'New Task Assigned';
        const content = `<p>You have been assigned a new task. Task details: <br> Title: ${task.title} <br> Description: ${task.description} <br> Due Date: ${moment(task.dueDate).format('DD/MM/YYYY')}</p>`;
        try {
          await sendEmailNotification(assignedUser.email, subject, content);
        } catch (emailError) {
          console.error('Failed to send email:', emailError);
        }
      }
    }

    res.status(201).json({ message: 'Task created successfully', task });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};


// Assign a task (admin or manager can assign)
export const assignTask = async (req, res) => {
  try {
    const { role, _id } = req.user; // Assuming req.user contains the authenticated user info
    const taskId = req.params.id;
    const { assignedTo } = req.body;
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    // Ensure only admins or managers can assign tasks
    if (role !== 'admin' && role !== 'manager') {
      return res.status(403).json({ message: 'Only admins or managers can assign tasks' });
    }

    // Check if the task is already assigned
    if (task.assignedTo) {
      return res.status(403).json({ message: 'Task is already assigned. Unassign it first to reassign.' });
    }

    // Check if the assigned user is in the manager's team (if manager is assigning)
    if (role === 'manager') {
      const assignedUser = await User.findById(assignedTo);
      if (assignedUser.managerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'You can only assign tasks to users in your team' });
      }
    }

    // Assign the task
    task.assignedTo = assignedTo;
    await task.save();

    // Notify the user about the task assignment
    const assignedUser = await User.findById(assignedTo);
    if (assignedUser.email) {
      const subject = 'New Task Assigned';
      const content = `<p>You have been assigned a new task. Task details: <br> Title: ${task.title} <br> Description: ${task.description}</p>`;
      await sendEmailNotification(assignedUser.email, subject, content);
    }

    res.status(200).json({ message: 'Task assigned successfully', task });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getTaskById = async (req, res) => {
  try {
    const { role, _id } = req.user; // Assuming req.user contains the authenticated user info
    const taskId = req.params.id;

    // Try to get the task from cache
    let cachedTask = await GET_ASYNC(`task_${taskId}`);
    if (cachedTask) {
      cachedTask = JSON.parse(cachedTask);
      return res.status(200).json(cachedTask);
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (role === 'admin' ||
      (role === 'manager' &&
        (task.assignedTo && task.assignedTo.toString() === _id.toString() || !task.assignedTo)) ||
      (role === 'user' && task.assignedTo && task.assignedTo.toString() === _id.toString())) {
      
      // Cache the task before sending the response
      await SET_ASYNC(`task_${taskId}`, JSON.stringify(task));
      return res.status(200).json(task);
    } else {
      return res.status(403).json({ message: 'Access denied' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllTasks = async (req, res) => {
  try {
    const { role, _id } = req.user;
    const { dueDate, status, unassigned, priority, sortBy, sortOrder } = req.query;

    let filter = {};

    if (role === 'admin') {
      // Admin can see all tasks
    } else if (role === 'manager') {
      filter.$or = [
        { managerId: _id },
        { assignedTo: { $exists: false } } // Unassigned tasks
      ];
    } else if (role === 'user') {
      filter.assignedTo = _id;
    } else {
      return res.status(403).json({ message: 'Unauthorized operation' });
    }

    // Filter by due date
    if (dueDate) {
      const parsedDueDate = moment(dueDate, 'DD/MM/YYYY').startOf('day').toDate();
      if (!isNaN(parsedDueDate)) {
        filter.dueDate = { $gte: parsedDueDate, $lt: moment(parsedDueDate).add(1, 'days').toDate() };
      } else {
        return res.status(400).json({ message: 'Invalid due date format. Use DD/MM/YYYY.' });
      }
    }

    // Filter by status (multiple statuses allowed)
    if (status) {
      const statusArray = status.split(',').map(s => s.trim());
      filter.status = { $in: statusArray };
    }

    // Filter by unassigned tasks
    if (unassigned === 'true') {
      filter.assignedTo = { $exists: false };
    }

    let sort = {};
    if (sortBy) {
      if (sortBy === 'dueDate') {
        sort.dueDate = sortOrder === 'desc' ? -1 : 1;
      }
    } else {
      // Default sorting: by dueDate ascending
      sort = { dueDate: 1 };
    }

    const cacheKey = `tasks_${JSON.stringify(filter)}_${JSON.stringify(sort)}`;

    let cachedTasks = await GET_ASYNC(cacheKey);
    if (cachedTasks) {
      cachedTasks = JSON.parse(cachedTasks);
      return res.status(200).json(cachedTasks);
    }

    const tasks = await Task.find(filter).sort(sort).lean();

    await SET_ASYNC(cacheKey, JSON.stringify(tasks));
    
    res.status(200).json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


// Update a task (Admins can update all, managers can update within their team, users can update their own)
export const updateTask = async (req, res) => {
  try {
    const { role, _id } = req.user;
    const taskId = req.params.id;
    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    let notifyUpdate = false;

    if (role === 'admin') {
      if (req.body.dueDate) {
        if (!validateDueDate(req.body.dueDate)) {
          return res.status(400).json({ message: 'Invalid due date format. Use DD/MM/YYYY.' });
        }
        const formattedDueDate = moment(req.body.dueDate, 'DD/MM/YYYY').format('YYYY-MM-DD');
        req.body.dueDate = formattedDueDate;
      }
      Object.assign(task, req.body);
      notifyUpdate = true;
    } else if (role === 'manager') {
      if (task.managerId.toString() !== _id.toString()) {
        return res.status(403).json({ message: 'Managers can only update tasks within their team' });
      }
      if (req.body.dueDate) {
        if (!validateDueDate(req.body.dueDate)) {
          return res.status(400).json({ message: 'Invalid due date format. Use DD/MM/YYYY.' });
        }
        const formattedDueDate = moment(req.body.dueDate, 'DD/MM/YYYY').format('YYYY-MM-DD');
        req.body.dueDate = formattedDueDate;
      }
      const allowedUpdates = ['priority', 'status', 'dueDate'];
      const updates = Object.keys(req.body);
      updates.forEach(update => {
        if (allowedUpdates.includes(update)) {
          task[update] = req.body[update];
          notifyUpdate = true;
        }
      });
    } else if (role === 'user') {
      if (task.assignedTo.toString() !== _id.toString()) {
        return res.status(403).json({ message: 'Users can only update their own tasks' });
      }
      if (req.body.status) {
        task.status = req.body.status;
        notifyUpdate = true;
      } else {
        return res.status(403).json({ message: 'Users can only update the status of their tasks' });
      }
    } else {
      return res.status(403).json({ message: 'Unauthorized operation' });
    }

    if (notifyUpdate) {
      const assignedUser = await User.findById(task.assignedTo);
      if (assignedUser && assignedUser.email) {
        const subject = 'Task Updated';
        const content = `<p>Your task has been updated. Task details: <br> Title: ${task.title} <br> Description: ${task.description} <br> Status: ${task.status} <br> Due Date: ${moment(task.dueDate).format('DD/MM/YYYY')}</p>`;
        try {
          await sendEmailNotification(assignedUser.email, subject, content);
        } catch (emailError) {
          console.error('Failed to send email:', emailError);
        }
      }
    }

    task.updatedAt = new Date();
    await task.save();
    res.status(200).json({ message: 'Task updated successfully', task });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const { role } = req.user;
    const taskId = req.params.id;

    if (role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can delete tasks' });
    }

    const task = await Task.findByIdAndDelete(taskId);
    
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};