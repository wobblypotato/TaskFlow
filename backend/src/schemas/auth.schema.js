const { z } = require('zod');

const registerSchema = {
  body: z.object({
    name: z
      .string({ required_error: 'Please provide name, email, and password' })
      .trim()
      .min(1, 'Please provide name, email, and password')
      .max(100, 'Name cannot exceed 100 characters'),
    email: z
      .string({ required_error: 'Please provide name, email, and password' })
      .trim()
      .toLowerCase()
      .email('Provide a valid email address'),
    password: z
      .string({ required_error: 'Please provide name, email, and password' })
      .min(6, 'Password must be at least 6 characters long')
  })
};

const loginSchema = {
  body: z.object({
    email: z
      .string({ required_error: 'Please provide email and password' })
      .trim()
      .toLowerCase()
      .email('Please provide a valid email address'),
    password: z
      .string({ required_error: 'Please provide email and password' })
      .min(1, 'Please provide email and password')
  })
};

const profileUpdateSchema = {
  body: z.object({
    name: z.string().trim().min(1, 'Name cannot be empty').max(100, 'Name cannot exceed 100 characters').optional(),
    email: z.string().trim().toLowerCase().email('Provide a valid email address').optional(),
    password: z.string().min(6, 'Password must be at least 6 characters long').optional(),
    avatar: z.union([
      z.string()
        .max(1_400_000, 'Profile image must be 1 MB or smaller')
        .regex(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/, 'Profile image must be a PNG, JPEG, or WebP image'),
      z.null()
    ]).optional()
  }).refine((profile) => Object.keys(profile).length > 0, {
    message: 'Provide at least one profile field to update'
  })
};

module.exports = {
  registerSchema,
  loginSchema,
  profileUpdateSchema
};
