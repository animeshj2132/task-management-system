import moment from 'moment';
import mailgun from 'mailgun-js';
import dotenv from 'dotenv';
import Task from '../models/taskModel.js';
import User from '../models/userModel.js';
import { GET_ASYNC, SET_ASYNC } from '../utils/caching.js';
import { getBroadcastFunction } from '../utils/webSocket.js';

dotenv.config();

const validateDueDate = (dueDate) => moment(dueDate, 'DD/MM/YYYY', true).isValid();

const mg = mailgun({
  apiKey: process.env.MAILGUN_API_KEY,
  domain: process.env.MAILGUN_DOMAIN,
});

const sendEmailNotification = async (toEmail, subject, content) => {
  const data = {
    from: 'Task Management <no-reply@yourdomain.com>',
    to: toEmail,
    subject,
    html: content,
  };

  try {
    await mg.messages().send(data);
    console.log('Email sent to:', toEmail);
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

export const createTask = async (req, res) => {
  try {
    const { role } = req.user;

    if (role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can create tasks' });
    }

    const { dueDate, assignedTo } = req.body;

    if (!validateDueDate(dueDate)) {
      return res.status(400).json({ message: 'Invalid due date format. Use DD/MM/YYYY.' });
    }

    const formattedDueDate = moment(dueDate, 'DD/MM/YYYY').format('YYYY-MM-DD');

    const task = new Task({
      ...req.body,
      dueDate: formattedDueDate,
      createdBy: req.user._id,
    });

    await task.save();

    getBroadcastFunction({ type: 'task_created', task });

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

export const assignTask = async (req, res) => {
  try {
    const { role, _id } = req.user;
    const taskId = req.params.id;
    const { assignedTo } = req.body;
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (role !== 'admin' && role !== 'manager') {
      return res.status(403).json({ message: 'Only admins or managers can assign tasks' });
    }

    if (task.assignedTo) {
      return res.status(403).json({ message: 'Task is already assigned. Unassign it first to reassign.' });
    }

    if (role === 'manager') {
      const assignedUser = await User.findById(assignedTo);
      if (assignedUser.managerId.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: 'You can only assign tasks to users in your team' });
      }
    }

    task.assignedTo = assignedTo;
    await task.save();

    getBroadcastFunction({ type: 'task_assigned', task });

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
    const { role, _id } = req.user;
    const taskId = req.params.id;

    let cachedTask = await GET_ASYNC(`task_${taskId}`);
    if (cachedTask) {
      cachedTask = JSON.parse(cachedTask);
      return res.status(200).json(cachedTask);
    }

    const task = await Task.findById(taskId);

    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (role === 'admin'
      || (role === 'manager'
        && (task.assignedTo && task.assignedTo.toString() === _id.toString() || !task.assignedTo))
      || (role === 'user' && task.assignedTo && task.assignedTo.toString() === _id.toString())) {
      await SET_ASYNC(`task_${taskId}`, JSON.stringify(task));
      return res.status(200).json(task);
    }
    return res.status(403).json({ message: 'Access denied' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllTasks = async (req, res) => {
  try {
    const { role, _id } = req.user;
    const {
      dueDate, status, unassigned, priority, sortBy, sortOrder,
    } = req.query;

    const filter = {};

    if (role === 'admin') {
    } else if (role === 'manager') {
      filter.$or = [
        { managerId: _id },
        { assignedTo: { $exists: false } },
      ];
    } else if (role === 'user') {
      filter.assignedTo = _id;
    } else {
      return res.status(403).json({ message: 'Unauthorized operation' });
    }

    if (dueDate) {
      const parsedDueDate = moment(dueDate, 'DD/MM/YYYY').startOf('day').toDate();
      if (!isNaN(parsedDueDate)) {
        filter.dueDate = { $gte: parsedDueDate, $lt: moment(parsedDueDate).add(1, 'days').toDate() };
      } else {
        return res.status(400).json({ message: 'Invalid due date format. Use DD/MM/YYYY.' });
      }
    }

    if (status) {
      const statusArray = status.split(',').map((s) => s.trim());
      filter.status = { $in: statusArray };
    }

    if (unassigned === 'true') {
      filter.assignedTo = { $exists: false };
    }

    let sort = {};
    if (sortBy) {
      if (sortBy === 'dueDate') {
        sort.dueDate = sortOrder === 'desc' ? -1 : 1;
      }
    } else {
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
      Object.assign(task, req.body);
      notifyUpdate = true;
    } else if (role === 'user') {
      if (task.assignedTo.toString() !== _id.toString()) {
        return res.status(403).json({ message: 'You can only update your own tasks' });
      }
      Object.assign(task, req.body);
    } else {
      return res.status(403).json({ message: 'Unauthorized operation' });
    }

    await task.save();

    getBroadcastFunction({ type: 'task_updated', task });

    if (notifyUpdate) {
      const assignedUser = await User.findById(task.assignedTo);
      if (assignedUser && assignedUser.email) {
        const subject = 'Task Updated';
        const content = `<p>The task assigned to you has been updated. Task details: <br> Title: ${task.title} <br> Description: ${task.description} <br> Due Date: ${moment(task.dueDate).format('DD/MM/YYYY')}</p>`;
        await sendEmailNotification(assignedUser.email, subject, content);
      }
    }

    res.status(200).json({ message: 'Task updated successfully', task });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const deleteTask = async (req, res) => {
  try {
    const { role } = req.user;
    const taskId = req.params.id;

    if (role !== 'admin') {
      return res.status(403).json({ message: 'Only admins can delete tasks' });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    await task.remove();

    getBroadcastFunction({ type: 'task_deleted', task });

    const assignedUser = await User.findById(task.assignedTo);
    if (assignedUser && assignedUser.email) {
      const subject = 'Task Deleted';
      const content = `<p>The task assigned to you has been deleted. Task details: <br> Title: ${task.title} <br> Description: ${task.description}</p>`;
      await sendEmailNotification(assignedUser.email, subject, content);
    }

    res.status(200).json({ message: 'Task deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const unassignTask = async (req, res) => {
  try {
    const { role, _id } = req.user;
    const taskId = req.params.id;

    if (role !== 'admin' && role !== 'manager') {
      return res.status(403).json({ message: 'Only admins or managers can unassign tasks' });
    }

    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({ message: 'Task not found' });
    }

    if (role === 'manager' && task.managerId.toString() !== _id.toString()) {
      return res.status(403).json({ message: 'You can only unassign tasks within your team' });
    }

    task.assignedTo = null;
    await task.save();

    getBroadcastFunction({ type: 'task_unassigned', task });

    const assignedUser = await User.findById(task.assignedTo);
    if (assignedUser && assignedUser.email) {
      const subject = 'Task Unassigned';
      const content = `<p>The task previously assigned to you has been unassigned. Task details: <br> Title: ${task.title} <br> Description: ${task.description}</p>`;
      await sendEmailNotification(assignedUser.email, subject, content);
    }

    res.status(200).json({ message: 'Task unassigned successfully', task });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getTaskAnalytics = async (req, res) => {
  try {
    const { role, _id } = req.user;

    const filter = {};

    if (role === 'admin') {
      // Admins can see all tasks
    } else if (role === 'manager') {
      // Managers can see tasks assigned to their team or unassigned tasks
      filter.$or = [
        { managerId: _id },
        { assignedTo: { $exists: false } },
      ];
    } else if (role === 'user') {
      // Users can only see their own tasks
      filter.assignedTo = _id;
    } else {
      return res.status(403).json({ message: 'Unauthorized operation' });
    }

    const totalTasks = await Task.countDocuments(filter);

    const completedTasks = await Task.countDocuments({ ...filter, status: 'completed' });
    const pendingTasks = await Task.countDocuments({ ...filter, status: 'pending' });
    const inProgressTasks = await Task.countDocuments({ ...filter, status: 'in-progress' });

    const overdueTasks = await Task.countDocuments({
      ...filter,
      dueDate: { $lt: new Date() },
      status: { $ne: 'completed' },
    });

    res.status(200).json({
      totalTasks,
      completedTasks,
      pendingTasks,
      inProgressTasks,
      overdueTasks,
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};
