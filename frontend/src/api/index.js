import client from './client'

export const auth = {
  register: (data)  => client.post('/auth/register', data),
  login:    (data)  => client.post('/auth/login', data),
}

export const tasks = {
  list:      (params)        => client.get('/tasks', { params }),
  get:       (taskId)        => client.get(`/tasks/${taskId}`),
  create:    (data)          => client.post('/tasks', data),
  submitBid: (taskId, data)  => client.post(`/tasks/${taskId}/bids`, data),
  acceptBid: (taskId, bidId) => client.patch(`/tasks/${taskId}/bids/${bidId}/accept`),
}

export const payments = {
  onboard: ()       => client.post('/payments/connect/onboard'),
  fund:    (taskId) => client.post(`/payments/tasks/${taskId}/fund`),
  release: (taskId) => client.post(`/payments/tasks/${taskId}/release`),
}

export const messaging = {
  send:             (data)          => client.post('/messages', data),
  getThread:        (userId, params)=> client.get(`/messages/${userId}`, { params }),
  getNotifications: (params)        => client.get('/notifications', { params }),
  markAllRead:      ()              => client.patch('/notifications/read'),
}

export const matching = {
  suggestions: (params) => client.get('/matching/suggestions', { params }),
  explain:     (taskId) => client.get(`/matching/suggestions/explain/${taskId}`),
}

export const reviews = {
  submit: (data)   => client.post('/reviews', data),
  getFor: (userId) => client.get(`/reviews/user/${userId}`),
}

export const disputes = {
  raise:   (data)     => client.post('/disputes', data),
  list:    (params)   => client.get('/disputes', { params }),
  get:     (id)       => client.get(`/disputes/${id}`),
  assign:  (id)       => client.patch(`/disputes/${id}/assign`),
  addNote: (id, data) => client.patch(`/disputes/${id}/note`, data),
  resolve: (id, data) => client.post(`/disputes/${id}/resolve`, data),
}
