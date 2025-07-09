import { nanoid } from 'nanoid';

import { DatabaseService } from '@/config/database';

const seedData = async () => {
  try {
    console.log('Starting database seeding...');

    // Create admin user
    const adminUser = await DatabaseService.entities.users.create({
      id: nanoid(),
      email: 'admin@ivokun.com',
      firstName: 'Admin',
      lastName: 'User',
      username: 'admin',
      role: 'admin',
      provider: 'local',
      providerId: 'admin-local',
      isActive: true,
    }).go();

    console.log('Created admin user:', adminUser.data.email);

    // Create default category
    const generalCategory = await DatabaseService.entities.categories.create({
      id: nanoid(),
      name: 'General',
      description: 'General category for posts and galleries',
      slug: 'general',
      status: 'published',
      createdBy: adminUser.data.id,
    }).go();

    console.log('Created general category:', generalCategory.data.name);

    // Create tech category
    const techCategory = await DatabaseService.entities.categories.create({
      id: nanoid(),
      name: 'Technology',
      description: 'Technology-related posts and content',
      slug: 'technology',
      status: 'published',
      createdBy: adminUser.data.id,
    }).go();

    console.log('Created tech category:', techCategory.data.name);

    // Create home page
    const home = await DatabaseService.entities.home.create({
      id: 'home',
      title: 'Welcome to Ivokun',
      description: 'Personal blog and gallery showcasing technology, thoughts, and creativity.',
      shortDescription: 'Personal blog and gallery',
      keywords: 'blog, gallery, personal, technology, development',
      status: 'published',
      createdBy: adminUser.data.id,
    }).go();

    console.log('Created home page:', home.data.title);

    // Create sample post
    const samplePost = await DatabaseService.entities.posts.create({
      id: nanoid(),
      title: 'Welcome to the New Hono-powered Blog',
      content: 'This is the first post on our new Hono-powered blog system, built with Effect.ts and DynamoDB.',
      excerpt: 'Introduction to our new blog system built with modern technologies.',
      slug: 'welcome-to-hono-blog',
      readTimeMinute: 3,
      categoryId: techCategory.data.id,
      locale: 'en',
      status: 'published',
      publishedAt: new Date().toISOString(),
      createdBy: adminUser.data.id,
    }).go();

    console.log('Created sample post:', samplePost.data.title);

    // Create sample gallery
    const sampleGallery = await DatabaseService.entities.galleries.create({
      id: nanoid(),
      title: 'Development Setup',
      description: 'Screenshots and images from setting up the development environment',
      slug: 'development-setup',
      categoryId: techCategory.data.id,
      imageIds: [], // Will be populated when media is uploaded
      status: 'published',
      publishedAt: new Date().toISOString(),
      createdBy: adminUser.data.id,
    }).go();

    console.log('Created sample gallery:', sampleGallery.data.title);

    // Create API token for external access
    const apiToken = await DatabaseService.entities.tokens.create({
      id: nanoid(),
      name: 'Development API Token',
      token: `ivk_${nanoid(32)}`,
      permissions: ['read:posts', 'read:categories', 'read:galleries', 'read:media'],
      isActive: true,
      createdBy: adminUser.data.id,
    }).go();

    console.log('Created API token:', apiToken.data.name);

    console.log('\n✅ Database seeding completed successfully!');
    console.log('\nCreated entities:');
    console.log(`- Admin user: ${adminUser.data.email}`);
    console.log(`- Categories: ${generalCategory.data.name}, ${techCategory.data.name}`);
    console.log(`- Home page: ${home.data.title}`);
    console.log(`- Sample post: ${samplePost.data.title}`);
    console.log(`- Sample gallery: ${sampleGallery.data.title}`);
    console.log(`- API token: ${apiToken.data.name}`);

  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  }
};

if (import.meta.url === `file://${process.argv[1]}`) {
  seedData().catch(console.error);
}