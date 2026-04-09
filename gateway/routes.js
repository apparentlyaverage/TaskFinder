// gateway/routes.js
module.exports = {
  auth: {
    target: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    description: 'Authentication & user management',
  },
  tasks: {
    target: process.env.TASKS_SERVICE_URL || 'http://localhost:3002',
    description: 'Task engine & bidding',
  },
  payments: {
    target: process.env.PAYMENTS_SERVICE_URL || 'http://localhost:3003',
    description: 'Stripe escrow & transfers',
  },
  messaging: {
    target: process.env.MESSAGING_SERVICE_URL || 'http://localhost:3004',
    description: 'Direct messages & notifications',
  },
  matching: {
    target: process.env.MATCHING_SERVICE_URL || 'http://localhost:3005',
    description: 'Skill-based matching engine',
  },
  reviews: {
    target: process.env.REVIEWS_SERVICE_URL || 'http://localhost:3006',
    description: 'Reviews & ratings',
  },
  disputes: {
    target: process.env.DISPUTES_SERVICE_URL || 'http://localhost:3007',
    description: 'Dispute resolution',
  },
}