-- Seed data for development
-- Note: Passwords should be hashed in production (using bcrypt/argon2)

-- Example user (password: "password123" - to be hashed by the application)
INSERT INTO users (email, full_name, password)
VALUES
  ('demo@example.com', 'Demo User', '$argon2id$v=19$m=65536,t=3,p=4$placeholder')
ON CONFLICT (email) DO NOTHING;
