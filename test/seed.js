const { db } = require('../server/db');
const { users } = require('../shared/schema');

async function seedTestData() {
  const adminEmail = 'admin@sandwich.project';
  const existing = await db.select().from(users).where(users.email.eq(adminEmail));
  if (existing.length === 0) {
    await db.insert(users).values({
      id: 'admin_test',
      email: adminEmail,
      firstName: 'Admin',
      lastName: 'User',
      role: 'admin',
      permissions: [],
      isActive: true,
      profileImageUrl: null,
      metadata: { password: 'admin123' },
    });
    console.log('Seeded admin user for tests');
  } else {
    console.log('Admin user already exists in test DB');
  }
}

module.exports = { seedTestData };
