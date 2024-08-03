import Task from '../models/taskModel.js';
import User from '../models/userModel.js';
import { notifyUser, clients } from './webSocket.js';

const calculateAnalytics = async () => {
  const totalTasks = await Task.countDocuments();
  const pendingTasks = await Task.countDocuments({ status: 'pending' });
  const inProgressTasks = await Task.countDocuments({ status: 'in-progress' });
  const completedTasks = await Task.countDocuments({ status: 'completed' });
  const overdueTasks = await Task.countDocuments({
    status: { $ne: 'completed' },
    dueDate: { $lt: new Date() },
  });

  const analytics = {
    totalTasks,
    pendingTasks,
    inProgressTasks,
    completedTasks,
    overdueTasks,
  };

  return analytics;
};

const sendAnalytics = async () => {
  const analytics = await calculateAnalytics();

  for (const userId in clients) {
    const ws = clients[userId];
    const user = await User.findById(userId);
    if (user.role === 'admin') {
      notifyUser(userId, { type: 'TASK_ANALYTICS', analytics });
    }
  }
};

const updateAnalytics = async () => {
  await sendAnalytics();
};

export { updateAnalytics, sendAnalytics }; // Ensure both functions are exported
