  import { Router } from 'express';
  import { check } from 'express-validator';
  import { register, login, logout, getProfile, getProfileById, assignManager } from '../controllers/userController.js';
  import { authMiddleware, authorizeRoles } from '../middleware/authMiddleware.js';
  import { createTask, getAllTasks, getTaskById,updateTask, deleteTask, assignTask } from '../controllers/taskController.js';
  import { validateManagerAssignment } from '../middleware/validateManager.js';

  const router = Router();

  /*----------------------------------------------------------------------user routes----------------------------------------------------------------*/

  /**
   * @swagger
   * /auth/register:
   *   post:
   *     summary: Register a new user
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               username:
   *                 type: string
   *               email:
   *                 type: string
   *               password:
   *                 type: string
   *               role:
   *                 type: string
   *     responses:
   *       201:
   *         description: User registered successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 msg:
   *                   type: string
   *                 user:
   *                   type: object
   *                   properties:
   *                     username:
   *                       type: string
   *                     email:
   *                       type: string
   *                     role:
   *                       type: string
   *       400:
   *         description: Bad request
   */
  router.post(
    '/register',
    [
      check('username')
        .isString()
        .notEmpty()
        .withMessage('Username must be a string and cannot be empty'),
      check('email')
        .isEmail()
        .notEmpty()
        .withMessage('Email must be a valid email address and cannot be empty'),
      check('password')
        .isLength({ min: 8, max: 15 })
        .withMessage('Password must be between 8 to 15 characters')
        .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@#$&!])/)
        .withMessage('Password must contain at least one lowercase letter, one uppercase letter, one number, and one special character from @#$&!'),
      check('role')
        .optional()
        .isIn(['admin', 'manager', 'user'])
        .withMessage('Role must be one of the following: admin, manager, user'),
      check('managerId')
        .optional()
        .isMongoId()
        .withMessage('Manager ID must be a valid MongoDB ID'),
    ],
    validateManagerAssignment,
    register
  );
  
  /**
   * @swagger
   * /auth/login:
   *   post:
   *     summary: Log in a user
   *     tags: [Auth]
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               email:
   *                 type: string
   *               password:
   *                 type: string
   *     responses:
   *       200:
   *         description: Successful login
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 msg:
   *                   type: string
   *                 token:
   *                   type: string
   *       401:
   *         description: Invalid credentials
   */
  router.post('/login', login);

  /**
   * @swagger
   * /auth/logout:
   *   post:
   *     summary: Logout a user
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   *     responses:
   *       200:
   *         description: Logout successful
   *       401:
   *         description: No token provided or token invalidated
   *       500:
   *         description: Internal server error
   */
  router.post('/logout', logout);

  /**
   * @swagger
   * /auth/profile:
   *   get:
   *     summary: Get user profiles with optional filtering and sorting
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: role
   *         in: query
   *         description: Filter profiles by user role (e.g., 'user', 'manager', 'admin')
   *         required: false
   *         schema:
   *           type: string
   *       - name: hasManager
   *         in: query
   *         description: Filter profiles to include only users who do not have a manager assigned. Set to 'true' to get users without a manager.
   *         required: false
   *         schema:
   *           type: boolean
   *       - name: sort
   *         in: query
   *         description: Sort profiles by fields (e.g., 'username,-createdAt'). Prefix with '-' for descending order
   *         required: false
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of user profiles
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 users:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       _id:
   *                         type: string
   *                         description: User ID
   *                       username:
   *                         type: string
   *                         description: User's username
   *                       email:
   *                         type: string
   *                         description: User's email
   *                       role:
   *                         type: string
   *                         description: User's role
   *                       managerId:
   *                         type: string
   *                         description: Manager ID
   *       403:
   *         description: Forbidden
   *       500:
   *         description: Internal server error
   */
  router.get('/auth/profile', authMiddleware, getProfile);

  /**
   * @swagger
   * /auth/profile/{userId}:
   *   get:
   *     summary: Get user profile by ID
   *     tags: [Auth]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: string
   *         description: User ID
   *     responses:
   *       200:
   *         description: User profile
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 user:
   *                   type: object
   *                   properties:
   *                     _id:
   *                       type: string
   *                       description: User ID
   *                     username:
   *                       type: string
   *                       description: User's username
   *                     email:
   *                       type: string
   *                       description: User's email
   *                     role:
   *                       type: string
   *                       description: User's role
   *                     managerId:
   *                       type: string
   *                       description: Manager ID
   *       400:
   *         description: Bad request
   *       403:
   *         description: Access denied
   *       404:
   *         description: User not found
   *       500:
   *         description: Server error
   */
  router.get('/auth/profile/:userId', authMiddleware, getProfileById);

  /**
   * @swagger
   * /users/{userId}/assign-manager:
   *   patch:
   *     summary: Assign a manager to a user
   *     tags: [Users]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: userId
   *         required: true
   *         schema:
   *           type: string
   *         description: The ID of the user to whom the manager will be assigned
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               managerId:
   *                 type: string
   *                 description: The ID of the manager to be assigned
   *     responses:
   *       200:
   *         description: Manager assigned successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 msg:
   *                   type: string
   *                 user:
   *                   type: object
   *                   properties:
   *                     _id:
   *                       type: string
   *                     username:
   *                       type: string
   *                     email:
   *                       type: string
   *                     role:
   *                       type: string
   *                     managerId:
   *                       type: string
   *       400:
   *         description: Bad request due to invalid manager ID or other assignment errors
   *       403:
   *         description: Access denied if the user is not an admin
   *       404:
   *         description: User not found
   *       500:
   *         description: Server error
   */
  router.patch(
    '/users/:userId/assign-manager',
    [
      authMiddleware,
      authorizeRoles('admin'),
      check('managerId').isMongoId().withMessage('Manager ID must be a valid MongoDB ID'),
      validateManagerAssignment
    ],
    assignManager
  );

  /*----------------------------------------------------------------------task routes----------------------------------------------------------------*/

  /**
   * @swagger
   * /tasks:
   *   post:
   *     summary: Create a new task
   *     tags: [Tasks]
   *     security:
   *       - bearerAuth: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title:
   *                 type: string
   *               description:
   *                 type: string
   *               dueDate:
   *                 type: string
   *                 format: date
   *               priority:
   *                 type: string
   *                 enum: [low, medium, high]
   *               assignedTo:
   *                 type: string
   *     responses:
   *       201:
   *         description: Task created successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 msg:
   *                   type: string
   *                 task:
   *                   type: object
   *                   properties:
   *                     title:
   *                       type: string
   *                     description:
   *                       type: string
   *                     dueDate:
   *                       type: string
   *                       format: date
   *                     priority:
   *                       type: string
   *                     assignedTo:
   *                       type: string
   *       400:
   *         description: Bad request
   */
  router.post(
    '/tasks',
    [
      check('title').isString().notEmpty().withMessage('Title is required'),
      check('description').isString().notEmpty().withMessage('Description is required'),
      check('dueDate').matches(/^\d{2}\/\d{2}\/\d{4}$/).withMessage('Due date must be in DD/MM/YYYY format'),
      check('priority').isIn(['low', 'medium', 'high']).withMessage('Priority is required'),
      check('assignedTo').optional().isMongoId().withMessage('AssignedTo must be a valid user ID'),
    ],
    authMiddleware,
    authorizeRoles('admin'),
    createTask
  );

  /**
   * @swagger
   * /tasks:
   *   get:
   *     summary: Get all tasks with optional filtering and sorting
   *     tags: [Tasks]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - name: dueDate
   *         in: query
   *         description: Filter tasks by due date (e.g., '2024-08-15')
   *         required: false
   *         schema:
   *           type: string
   *           format: date
   *       - name: priority
   *         in: query
   *         description: Filter tasks by priority (e.g., 'low', 'medium', 'high')
   *         required: false
   *         schema:
   *           type: string
   *       - name: status
   *         in: query
   *         description: Filter tasks by status (e.g., 'pending', 'completed')
   *         required: false
   *         schema:
   *           type: string
   *       - name: sort
   *         in: query
   *         description: Sort tasks by fields (e.g., 'dueDate,-priority'). Prefix with '-' for descending order
   *         required: false
   *         schema:
   *           type: string
   *     responses:
   *       200:
   *         description: List of tasks
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 tasks:
   *                   type: array
   *                   items:
   *                     type: object
   *                     properties:
   *                       _id:
   *                         type: string
   *                         description: Task ID
   *                       title:
   *                         type: string
   *                         description: Task title
   *                       description:
   *                         type: string
   *                         description: Task description
   *                       dueDate:
   *                         type: string
   *                         format: date
   *                         description: Task due date
   *                       priority:
   *                         type: string
   *                         description: Task priority
   *                       status:
   *                         type: string
   *                         description: Task status
   *                       assignedTo:
   *                         type: string
   *                         description: ID of the user the task is assigned to
   *                       createdBy:
   *                         type: string
   *                         description: ID of the user who created the task
   *       403:
   *         description: Forbidden
   *       500:
   *         description: Internal server error
   */
  router.get('/tasks', authMiddleware, authorizeRoles('admin', 'manager', 'user'), getAllTasks);

  /**
   * @swagger
   * /tasks/{id}:
   *   get:
   *     summary: Get a task by ID
   *     tags: [Tasks]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Task ID
   *     responses:
   *       200:
   *         description: Task details
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 _id:
   *                   type: string
   *                   description: Task ID
   *                 title:
   *                   type: string
   *                   description: Task title
   *                 description:
   *                   type: string
   *                   description: Task description
   *                 dueDate:
   *                   type: string
   *                   format: date
   *                   description: Task due date
   *                 priority:
   *                   type: string
   *                   description: Task priority
   *                 status:
   *                   type: string
   *                   description: Task status
   *                 assignedTo:
   *                   type: string
   *                   description: ID of the user the task is assigned to
   *                 createdBy:
   *                   type: string
   *                   description: ID of the user who created the task
   *       403:
   *         description: Forbidden
   *       404:
   *         description: Task not found
   *       500:
   *         description: Internal server error
   */
  router.get('/tasks/:id', authMiddleware, authorizeRoles('admin', 'manager', 'user'), getTaskById);

  /**
   * @swagger
   * /tasks/{id}:
   *   put:
   *     summary: Update a task
   *     tags: [Tasks]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Task ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               title:
   *                 type: string
   *               description:
   *                 type: string
   *               dueDate:
   *                 type: string
   *                 format: date
   *               priority:
   *                 type: string
   *                 enum: [low, medium, high]
   *               status:
   *                 type: string
   *                 enum: [pending, in progress, completed]
   *     responses:
   *       200:
   *         description: Task updated successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 msg:
   *                   type: string
   *                 task:
   *                   type: object
   *                   properties:
   *                     title:
   *                       type: string
   *                     description:
   *                       type: string
   *                     dueDate:
   *                       type: string
   *                       format: date
   *                     priority:
   *                       type: string
   *                     status:
   *                       type: string
   *       403:
   *         description: Forbidden
   */
  router.put(
    '/tasks/:id',
    [
      check('title').optional().isString().notEmpty().withMessage('Title must be a non-empty string'),
      check('description').optional().isString().notEmpty().withMessage('Description must be a non-empty string'),
      check('dueDate').optional().matches(/^\d{2}\/\d{2}\/\d{4}$/).withMessage('Due date must be in DD/MM/YYYY format'),
      check('priority').optional().isIn(['low', 'medium', 'high']).withMessage('Priority must be one of: low, medium, high'),
      check('status').optional().isIn(['pending', 'in progress', 'completed']).withMessage('Status must be one of: pending, in progress, completed'),
    ],
    authMiddleware,
    authorizeRoles('admin', 'manager', 'user'),
    updateTask
  );

  /**
   * @swagger
   * /tasks/{id}:
   *   delete:
   *     summary: Delete a task
   *     tags: [Tasks]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Task ID
   *     responses:
   *       200:
   *         description: Task deleted successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 msg:
   *                   type: string
   *       403:
   *         description: Forbidden
   */
  router.delete(
    '/tasks/:id',
    authMiddleware,
    authorizeRoles('admin'),
    deleteTask
  );

  /**
   * @swagger
   * /tasks/{id}/assign:
   *   patch:
   *     summary: Assign a task to a user
   *     tags: [Tasks]
   *     security:
   *       - bearerAuth: []
   *     parameters:
   *       - in: path
   *         name: id
   *         required: true
   *         schema:
   *           type: string
   *         description: Task ID
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             properties:
   *               assignedTo:
   *                 type: string
   *     responses:
   *       200:
   *         description: Task assigned successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 msg:
   *                   type: string
   *                 task:
   *                   type: object
   *                   properties:
   *                     title:
   *                       type: string
   *                     description:
   *                       type: string
   *                     dueDate:
   *                       type: string
   *                       format: date
   *                     priority:
   *                       type: string
   *                     status:
   *                       type: string
   *                     assignedTo:
   *                       type: string
   *       400:
   *         description: Bad request
   */
  router.patch(
    '/tasks/:id/assign',
    [
      check('assignedTo').isMongoId().withMessage('AssignedTo must be a valid user ID'),
    ],
    authMiddleware,
    authorizeRoles('admin', 'manager'),
    assignTask
  );

  export default router;
