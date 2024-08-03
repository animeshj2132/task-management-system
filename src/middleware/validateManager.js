import User from '../models/userModel.js';

export const validateManagerAssignment = async (req, res, next) => {
  const { managerId, email } = req.body;

  try {
    // During registration, there won't be a userId parameter
    const isRegistration = !req.params.userId;

    // If it's not a registration request, fetch the user to get their current role
    if (!isRegistration) {
      const user = await User.findById(req.params.userId);
      if (!user) {
        return res.status(404).json({ msg: 'User not found' });
      }

      // Only users can have a manager
      if (managerId && user.role !== 'user') {
        return res.status(400).json({ msg: 'Only users can have a manager' });
      }
    }

    // If managerId is provided, check if it's a valid manager ID
    if (managerId) {
      const manager = await User.findById(managerId);
      if (!manager || manager.role !== 'manager') {
        return res.status(400).json({ msg: 'Invalid manager ID' });
      }
    }

    // If email is provided, check if the user already has a manager
    if (email) {
      const existingUser = await User.findOne({ email });
      if (existingUser && existingUser.managerId) {
        return res.status(400).json({ msg: 'User already has a manager assigned' });
      }
    }

    next();
  } catch (error) {
    res.status(500).json({ msg: 'Server error' });
  }
};
