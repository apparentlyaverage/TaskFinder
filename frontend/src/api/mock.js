// src/api/mock.js
// Demo data — used when backend is not connected

export const MOCK_TASKS = [
  { task_id:"1", creator_id:"u1", assigned_to:null, status:"open", title:"Build a REST API for e-commerce platform", description:"Need an experienced Node.js developer to build a scalable REST API with authentication, product management, and order processing. Must include rate limiting, JWT auth, and full test coverage.", budget:"850", deadline:"2025-05-15T00:00:00Z", skill_tags:["node.js","express","postgres","REST API"], created_at:"2025-04-01T10:00:00Z" },
  { task_id:"2", creator_id:"u2", assigned_to:"u3", status:"in_progress", title:"React Native mobile app for task tracking", description:"Convert our existing React web app into a cross-platform mobile app with offline support, push notifications, and biometric login.", budget:"1200", deadline:"2025-06-01T00:00:00Z", skill_tags:["react native","mobile","javascript","firebase"], created_at:"2025-03-28T09:00:00Z" },
  { task_id:"3", creator_id:"u1", assigned_to:null, status:"open", title:"Design system for fintech dashboard", description:"Create a comprehensive design system including components, tokens, and documentation for a financial analytics platform. Figma deliverables required.", budget:"650", deadline:"2025-05-20T00:00:00Z", skill_tags:["UI/UX","figma","design systems","fintech"], created_at:"2025-04-02T14:00:00Z" },
  { task_id:"4", creator_id:"u2", assigned_to:"u3", status:"completed", title:"PostgreSQL performance optimization", description:"Analyze slow queries and optimize database performance for a high-traffic SaaS application. Includes index strategy and query rewriting.", budget:"400", deadline:"2025-04-30T00:00:00Z", skill_tags:["postgres","SQL","performance","database"], created_at:"2025-03-20T11:00:00Z" },
  { task_id:"5", creator_id:"u4", assigned_to:null, status:"open", title:"Laundry pickup & delivery service", description:"Need someone to pick up laundry from my apartment in Claremont, wash, fold, and return within 24 hours. 2 large bags.", budget:"45", deadline:"2025-04-12T00:00:00Z", skill_tags:["laundry","delivery","errands"], created_at:"2025-04-05T08:00:00Z" },
  { task_id:"6", creator_id:"u1", assigned_to:"u3", status:"disputed", title:"Python data pipeline for ML training", description:"Build an ETL pipeline to preprocess CSV datasets, handle missing values, normalize columns, and output clean parquet files for model training.", budget:"520", deadline:"2025-05-10T00:00:00Z", skill_tags:["python","pandas","ETL","machine learning"], created_at:"2025-03-15T16:00:00Z" },
]

export const MOCK_BIDS = [
  { bid_id:"b1", task_id:"1", bidder_id:"u3", amount:"780", status:"pending", pitch:"5 years Node.js experience, built 12+ production REST APIs. Can deliver in 3 weeks with full test coverage and Swagger docs.", display_name:"Alex Chen", avg_rating:4.8, created_at:"2025-04-02T12:00:00Z" },
  { bid_id:"b2", task_id:"1", bidder_id:"u5", amount:"850", status:"pending", pitch:"Senior backend engineer. Specialized in Express + PostgreSQL. Clean architecture, CI/CD pipeline included.", display_name:"Maria Santos", avg_rating:4.5, created_at:"2025-04-03T09:00:00Z" },
  { bid_id:"b3", task_id:"1", bidder_id:"u6", amount:"700", status:"pending", pitch:"Quick turnaround. Node + Postgres is my daily stack. 8 years experience.", display_name:"James Kim", avg_rating:3.9, created_at:"2025-04-03T15:00:00Z" },
]

export const MOCK_NOTIFICATIONS = [
  { notification_id:"n1", type:"bid.submitted", title:"New bid on your task", body:"Alex Chen submitted a bid of $780 on \"Build a REST API\"", is_read:false, created_at:"2025-04-02T12:00:00Z", reference_id:"1" },
  { notification_id:"n2", type:"bid.submitted", title:"New bid on your task", body:"Maria Santos submitted a bid of $850 on \"Build a REST API\"", is_read:false, created_at:"2025-04-03T09:00:00Z", reference_id:"1" },
  { notification_id:"n3", type:"task.matched", title:"New task matches your skills", body:"\"Python data pipeline\" — Budget: $520. Deadline: May 10 2025.", is_read:true, created_at:"2025-04-01T10:00:00Z", reference_id:"6" },
  { notification_id:"n4", type:"payment.released", title:"Payment released!", body:"$400 has been transferred to your account.", is_read:true, created_at:"2025-03-25T14:00:00Z", reference_id:"4" },
]

export const MOCK_MESSAGES = [
  { message_id:"m1", sender_id:"u3", receiver_id:"u1", content:"Hey, I saw your REST API task. I have strong experience with this stack. Any specific requirements?", created_at:"2025-04-02T10:00:00Z", sender_name:"Alex Chen" },
  { message_id:"m2", sender_id:"u1", receiver_id:"u3", content:"Hi Alex! Yes — we need JWT auth, rate limiting, and the API needs to handle ~10k req/min at peak.", created_at:"2025-04-02T10:15:00Z", sender_name:"You" },
  { message_id:"m3", sender_id:"u3", receiver_id:"u1", content:"Absolutely doable. I'd suggest Redis for rate limiting. Can we schedule a quick call to align on the data model?", created_at:"2025-04-02T10:22:00Z", sender_name:"Alex Chen" },
  { message_id:"m4", sender_id:"u1", receiver_id:"u3", content:"Sounds great. I'll accept your bid and we can kick off from there.", created_at:"2025-04-02T10:30:00Z", sender_name:"You" },
]

export const MOCK_DISPUTES = [
  { dispute_id:"d1", task_id:"6", task_title:"Python data pipeline for ML training", creator_email:"creator@example.com", earner_email:"earner@example.com", reason:"The delivered pipeline crashes on datasets over 1GB. The earner claims this is out of scope but the requirements clearly state 'handle CSV datasets' without size limitations.", status:"open", opened_at:"2025-04-04T09:00:00Z", amount_cents:52000, evidence_urls:[] },
]

export const MOCK_SUGGESTIONS = [
  { task_id:"1", title:"Build a REST API for e-commerce platform", budget:"850", deadline:"2025-05-15T00:00:00Z", skill_tags:["node.js","express","postgres"], match_score:0.87, status:"open" },
  { task_id:"6", title:"Python data pipeline for ML training", budget:"520", deadline:"2025-05-10T00:00:00Z", skill_tags:["python","pandas","ETL"], match_score:0.74, status:"disputed" },
  { task_id:"3", title:"Design system for fintech dashboard", budget:"650", deadline:"2025-05-20T00:00:00Z", skill_tags:["UI/UX","figma","design systems"], match_score:0.52, status:"open" },
]
