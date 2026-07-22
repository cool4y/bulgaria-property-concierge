const { z } = require('zod');

const contactSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  email: z.string().trim().email('Valid email is required').max(200),
  phoneCode: z.string().trim().min(1, 'Country code is required').max(10),
  phone: z.string().trim().min(3, 'Phone number is required').max(50),
  apartmentType: z.string().trim().min(1, 'Apartment type is required'),
  investmentGoal: z.string().trim().min(1, 'Investment goal is required'),
  purchaseTimeline: z.string().trim().min(1, 'Purchase timeline is required'),
  budget: z.string().trim().min(1, 'Budget is required'),
  finishTier: z.string().trim().min(1, 'Finish tier is required'),
  message: z.string().trim().max(5000).optional().or(z.literal('')),
});

const listingSchema = z.object({
  title: z.string().trim().min(1).max(200),
  category: z.enum(['completed', 'listing']),
  status: z.string().trim().min(1).max(50),
  city: z.string().trim().min(1).max(100),
  area: z.string().trim().min(1).max(100),
  type: z.string().trim().min(1).max(50),
  bedrooms: z.coerce.number().int().min(0).max(20),
  tier: z.string().trim().max(50).optional().nullable(),
  price: z.string().trim().max(50).optional().nullable(),
  year: z.string().trim().max(10).optional().nullable(),
  imageUrl: z.string().trim().url().max(2000),
  imageAlt: z.string().trim().min(1).max(300),
  description: z.string().trim().max(2000).optional().nullable(),
  featured: z.coerce.boolean().optional(),
  published: z.coerce.boolean().optional(),
  sortOrder: z.coerce.number().int().optional(),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
});

module.exports = { contactSchema, listingSchema, loginSchema };
