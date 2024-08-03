import { validationResult } from 'express-validator';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/userModel.js';
import { addToBlacklist } from '../utils/tokenBlacklist.js';
import { GET_ASYNC, SET_ASYNC } from '../utils/caching.js';

// Register User
export const register = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }

  const {
    username, email, password, role, managerId,
  } = req.body;

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ msg: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role: role || 'user',
      managerId: role === 'user' ? managerId : undefined,
    });

    await newUser.save();

    res.status(201).json({
      msg: 'User registered successfully',
      user: {
        userId: newUser._id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        managerId: newUser.managerId,
      },
    });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Login User
export const login = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ msg: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ msg: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });

    res.json({ msg: 'Login successful', token });
  } catch (err) {
    res.status(500).json({ msg: 'Server error' });
  }
};

// Logout User
export const logout = async (req, res) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');

  if (token) {
    await addToBlacklist(token);
  }

  res.status(200).json({ message: 'Logout successful' });
};

// View Profile
// Get Profile
export const getProfile = async (req, res) => {
  try {
    const reqUser = req.user; // The currently logged-in user
    const cacheKey = `profile_${reqUser._id}_${JSON.stringify(req.query)}`;

    // Try to get the profile from cache
    let cachedProfile = await GET_ASYNC(cacheKey);
    if (cachedProfile) {
      cachedProfile = JSON.parse(cachedProfile);
      return res.status(200).json(cachedProfile);
    }

    // Prepare query object based on role
    const query = {};
    if (reqUser.role === 'admin') {
      // Admin can view all profiles, optionally filter by roles
      const { roles, hasManager } = req.query;
      if (roles) {
        const roleArray = roles.split(',').map((role) => role.trim()); // Assuming roles are comma-separated
        query.role = { $in: roleArray };
      }
      if (hasManager === 'false') {
        query.managerId = { $exists: false };
      } else if (hasManager === 'true') {
        query.managerId = { $exists: true };
      }
    } else if (reqUser.role === 'manager') {
      // Manager can view all profiles of their team
      query.managerId = reqUser._id;
    } else {
      // Regular user can view their own profile
      query._id = reqUser._id;
    }

    // Apply sorting
    const sort = req.query.sort === 'asc' ? 'createdAt' : '-createdAt'; // Ascending or descending by createdAt
    const users = await User.find(query).select('-password').sort(sort);

    // Cache the profile before sending the response
    await SET_ASYNC(cacheKey, JSON.stringify({ users }));

    return res.status(200).json({ users });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', err });
  }
};

// Get Profile by ID
export const getProfileById = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ message: 'User ID is required' });
    }

    const cacheKey = `profile_${userId}`;

    // Try to get the profile from cache
    let cachedProfile = await GET_ASYNC(cacheKey);
    if (cachedProfile) {
      cachedProfile = JSON.parse(cachedProfile);
      return res.status(200).json(cachedProfile);
    }

    const user = await User.findById(userId).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const reqUser = req.user;

    if (
      reqUser.role === 'admin'
      || (reqUser.role === 'manager' && user.managerId?.toString() === reqUser._id.toString())
      || reqUser._id.toString() === userId
    ) {
      // Cache the profile before sending the response
      await SET_ASYNC(cacheKey, JSON.stringify(user));

      return res.status(200).json(user);
    }
    return res.status(403).json({ message: 'Access denied' });
  } catch (err) {
    return res.status(500).json({ message: 'Server error', err });
  }
};

export const assignManager = async (req, res) => {
  const { userId } = req.params;
  const { managerId } = req.body;

  try {
    // Find the user to be updated
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ msg: 'User not found' });
    }

    // Check if the user is already assigned a manager
    if (user.managerId) {
      return res.status(400).json({ msg: 'User already has a manager assigned' });
    }

    // Update the user with the new manager
    user.managerId = managerId;
    await user.save();

    // Respond with the updated user
    return res.status(200).json({
      msg: 'Manager assigned successfully',
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        managerId: user.managerId,
      },
    });
  } catch (err) {
    return res.status(500).json({ msg: 'Server error', err });
  }
};
