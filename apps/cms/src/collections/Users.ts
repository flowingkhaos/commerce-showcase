import type { CollectionConfig } from 'payload'

import { isAdmin, isAdminField } from '../fields'

export const Users: CollectionConfig = {
  slug: 'users',
  versions: false,
  admin: { useAsTitle: 'email', group: 'Admin', defaultColumns: ['email', 'role'] },
  // API keys let each site's seed script write its own domain over REST.
  auth: { useAPIKey: true, maxLoginAttempts: 5, lockTime: 10 * 60 * 1000 },
  access: {
    read: ({ req: { user } }) =>
      (user as { role?: string } | null)?.role === 'admin' || (user ? { id: { equals: user.id } } : false),
    create: isAdmin,
    update: ({ req: { user } }) =>
      (user as { role?: string } | null)?.role === 'admin' || (user ? { id: { equals: user.id } } : false),
    delete: isAdmin,
  },
  fields: [
    {
      name: 'role',
      type: 'select',
      options: ['admin', 'visitor'],
      defaultValue: 'visitor',
      required: true,
      saveToJWT: true,
      access: { create: isAdminField, update: isAdminField },
    },
  ],
}
