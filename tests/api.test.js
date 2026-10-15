const os = require('os');
const path = require('path');
const fs = require('fs');

process.env.NODE_ENV = 'test';
process.env.UPLOAD_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'aarvi-uploads-'));
process.env.ADMIN_EMAIL = 'admin@test.com';
process.env.ADMIN_PASSWORD = 'Admin@12345';

const request = require('supertest');
const mongoose = require('mongoose');
const env = require('../src/config/env');
const app = require('../src/app');
const User = require('../src/models/User');
const { run: seed } = require('../src/seed');

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

let token;
const auth = () => ({ Authorization: `Bearer ${token}` });
const api = () => request(app);

beforeAll(async () => {
  await mongoose.connect(env.mongoUri);
  await mongoose.connection.dropDatabase();
  await seed({ reset: true, quiet: true });
});

afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
  fs.rmSync(process.env.UPLOAD_DIR, { recursive: true, force: true });
});

describe('health & basics', () => {
  test('GET /api/health', async () => {
    const res = await api().get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });
  test('unknown route returns JSON 404', async () => {
    const res = await api().get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
  test('malformed JSON returns 400', async () => {
    const res = await api().post('/api/auth/login').set('Content-Type', 'application/json').send('{bad');
    expect(res.status).toBe(400);
  });
});

describe('auth', () => {
  test('rejects admin routes without a token', async () => {
    expect((await api().get('/api/admin/stats')).status).toBe(401);
    expect((await api().get('/api/admin/projects')).status).toBe(401);
    expect((await api().post('/api/admin/upload')).status).toBe(401);
  });
  test('rejects a forged token', async () => {
    const res = await api().get('/api/admin/stats').set('Authorization', 'Bearer abc.def.ghi');
    expect(res.status).toBe(401);
  });
  test('login fails with wrong password', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'admin@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });
  test('login validates input', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'not-an-email' });
    expect(res.status).toBe(400);
  });
  test('login succeeds and /me works', async () => {
    const res = await api().post('/api/auth/login').send({ email: 'admin@test.com', password: 'Admin@12345' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.passwordHash).toBeUndefined();
    token = res.body.token;
    const me = await api().get('/api/auth/me').set(auth());
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('admin@test.com');
  });
  test('change password requires current password and min length', async () => {
    let res = await api().post('/api/auth/change-password').set(auth()).send({ currentPassword: 'nope', newPassword: 'NewPass@123' });
    expect(res.status).toBe(400);
    res = await api().post('/api/auth/change-password').set(auth()).send({ currentPassword: 'Admin@12345', newPassword: 'short' });
    expect(res.status).toBe(400);
    res = await api().post('/api/auth/change-password').set(auth()).send({ currentPassword: 'Admin@12345', newPassword: 'NewPass@123' });
    expect(res.status).toBe(200);
    expect((await api().post('/api/auth/login').send({ email: 'admin@test.com', password: 'Admin@12345' })).status).toBe(401);
    res = await api().post('/api/auth/login').send({ email: 'admin@test.com', password: 'NewPass@123' });
    expect(res.status).toBe(200);
    token = res.body.token;
    // restore
    await api().post('/api/auth/change-password').set(auth()).send({ currentPassword: 'NewPass@123', newPassword: 'Admin@12345' });
    const again = await api().post('/api/auth/login').send({ email: 'admin@test.com', password: 'Admin@12345' });
    token = again.body.token;
  });
  test('update profile name', async () => {
    const res = await api().put('/api/auth/me').set(auth()).send({ name: 'New Name' });
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('New Name');
  });
  test('deactivated user token stops working', async () => {
    const u = new User({ name: 'Temp', email: 'temp@test.com' });
    await u.setPassword('Temp@12345');
    await u.save();
    const login = await api().post('/api/auth/login').send({ email: 'temp@test.com', password: 'Temp@12345' });
    expect(login.status).toBe(200);
    await User.updateOne({ _id: u._id }, { isActive: false });
    const res = await api().get('/api/auth/me').set('Authorization', `Bearer ${login.body.token}`);
    expect(res.status).toBe(401);
  });
});

describe('public: meta, settings, home', () => {
  test('settings', async () => {
    const res = await api().get('/api/settings');
    expect(res.status).toBe(200);
    expect(res.body.data.siteName).toBeTruthy();
    expect(res.body.data.phones.length).toBeGreaterThan(0);
  });
  test('meta lists categories, locations, developers and project types', async () => {
    const res = await api().get('/api/meta');
    expect(res.status).toBe(200);
    expect(res.body.data.categories.length).toBe(6);
    expect(res.body.data.locations.length).toBeGreaterThan(10);
    expect(res.body.data.projectTypes).toEqual(['New Launch', 'Rental', 'Resale']);
  });
  test('home aggregate', async () => {
    const res = await api().get('/api/home');
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.newLaunch.length).toBeGreaterThan(0);
    expect(d.newLaunch.every((p) => p.isNewLaunch)).toBe(true);
    expect(d.sections.length).toBeGreaterThan(2);
    expect(d.sections[0].projects.length).toBeLessThanOrEqual(8);
    expect(d.locations.some((l) => l.projectCount > 0)).toBe(true);
    expect(d.developers.length).toBeGreaterThan(10);
  });
  test('home category rows do not repeat new-launch cards', async () => {
    const res = await api().get('/api/home');
    const shown = new Set(res.body.data.newLaunch.map((p) => p._id));
    const residential = res.body.data.sections.find((s) => s.category.slug === 'residential');
    expect(residential.projects.length).toBeGreaterThan(0);
    expect(residential.projects.some((p) => shown.has(p._id))).toBe(false);
  });
});

describe('public: projects', () => {
  test('lists with pagination', async () => {
    const res = await api().get('/api/projects?limit=10&page=2');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(10);
    expect(res.body.meta.page).toBe(2);
    expect(res.body.meta.total).toBe(307);
    expect(res.body.meta.pages).toBe(31);
  });
  test('caps limit', async () => {
    const res = await api().get('/api/projects?limit=9999');
    expect(res.body.meta.limit).toBe(60);
  });
  test('filter by property category (slug, like the reference URL)', async () => {
    const res = await api().get('/api/projects?property=Residential-Plots&limit=60');
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThan(5);
    expect(res.body.data.every((p) => p.category.slug === 'residential-plots')).toBe(true);
  });
  test('filter by location slug', async () => {
    const res = await api().get('/api/projects?location=Dwarka-Expressway&limit=60');
    expect(res.body.data.length).toBeGreaterThan(5);
    expect(res.body.data.every((p) => p.location.slug === 'dwarka-expressway')).toBe(true);
  });
  test('filter by project type', async () => {
    const res = await api().get('/api/projects?projecttype=Resale&limit=60');
    expect(res.body.data.length).toBeGreaterThan(5);
    expect(res.body.data.every((p) => p.projectType === 'Resale')).toBe(true);
    const nt = await api().get('/api/projects?projecttype=New-Launch&limit=1');
    expect(nt.body.meta.total).toBeGreaterThan(100);
  });
  test('unknown filter values return empty, not everything', async () => {
    for (const q of ['location=Mars', 'property=Castles', 'projecttype=Lease', 'developer=nobody']) {
      const res = await api().get(`/api/projects?${q}`);
      expect(res.body.meta.total).toBe(0);
    }
  });
  test('search by name, developer and location', async () => {
    let res = await api().get('/api/projects?search=verano');
    expect(res.body.data.some((p) => p.name === 'Godrej Verano')).toBe(true);
    res = await api().get('/api/projects?search=godrej&limit=60');
    expect(res.body.data.length).toBeGreaterThan(3);
    res = await api().get('/api/projects?search=manesar');
    expect(res.body.meta.total).toBeGreaterThan(0);
  });
  test('search is regex-safe', async () => {
    const res = await api().get('/api/projects?search=' + encodeURIComponent('(.*'));
    expect(res.status).toBe(200);
    expect(res.body.meta.total).toBe(0);
  });
  test('combined filters', async () => {
    const res = await api().get('/api/projects?property=Residential&location=Golf-Course-Ext-Road&projecttype=New-Launch&limit=60');
    expect(res.body.data.every((p) => p.category.slug === 'residential' && p.location.slug === 'golf-course-ext-road')).toBe(true);
  });
  test('filter by a list of slugs (used by Saved projects)', async () => {
    const res = await api().get('/api/projects?slugs=godrej-verano,dlf-the-aureva,not-a-project');
    expect(res.status).toBe(200);
    expect(res.body.data.map((p) => p.slug).sort()).toEqual(['dlf-the-aureva', 'godrej-verano']);
  });
  test('detail by slug increments views and returns related', async () => {
    const a = await api().get('/api/projects/godrej-verano');
    expect(a.status).toBe(200);
    expect(a.body.data.name).toBe('Godrej Verano');
    expect(a.body.data.developer.name).toBe('Godrej Properties');
    expect(a.body.data.related.length).toBeGreaterThan(0);
    expect(a.body.data.related.some((r) => r.slug === 'godrej-verano')).toBe(false);
    const b = await api().get('/api/projects/godrej-verano');
    expect(b.body.data.views).toBe(a.body.data.views + 1);
  });
  test('detail 404', async () => {
    expect((await api().get('/api/projects/does-not-exist')).status).toBe(404);
  });
});

describe('admin: taxonomy CRUD', () => {
  let cat;
  let loc;
  let dev;
  test('category create (auto slug, unique slug), update, list', async () => {
    let res = await api().post('/api/admin/categories').set(auth()).send({ name: 'Farm Houses' });
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe('farm-houses');
    cat = res.body.data;
    res = await api().post('/api/admin/categories').set(auth()).send({ name: 'Farm Houses' });
    expect(res.status).toBe(201);
    expect(res.body.data.slug).toBe('farm-houses-2');
    await api().delete(`/api/admin/categories/${res.body.data._id}`).set(auth());
    res = await api().put(`/api/admin/categories/${cat._id}`).set(auth()).send({ description: 'Weekend homes', order: 9 });
    expect(res.body.data.description).toBe('Weekend homes');
    res = await api().get('/api/admin/categories?q=farm').set(auth());
    expect(res.body.data).toHaveLength(1);
  });
  test('category validation', async () => {
    const res = await api().post('/api/admin/categories').set(auth()).send({});
    expect(res.status).toBe(400);
  });
  test('location + developer create', async () => {
    let res = await api().post('/api/admin/locations').set(auth()).send({ name: 'Sector 99', city: 'Gurugram' });
    expect(res.status).toBe(201);
    loc = res.body.data;
    res = await api().post('/api/admin/developers').set(auth()).send({ name: 'Test Builders', description: 'x' });
    expect(res.status).toBe(201);
    dev = res.body.data;
  });
  test('invalid id returns 400, missing returns 404', async () => {
    expect((await api().get('/api/admin/categories/xyz').set(auth())).status).toBe(400);
    expect((await api().get('/api/admin/categories/64b000000000000000000000').set(auth())).status).toBe(404);
  });
  test('cannot delete a category that has projects', async () => {
    const meta = await api().get('/api/meta');
    const residential = meta.body.data.categories.find((c) => c.slug === 'residential');
    const res = await api().delete(`/api/admin/categories/${residential._id}`).set(auth());
    expect(res.status).toBe(409);
  });

  describe('project lifecycle', () => {
    let project;
    test('create project', async () => {
      const res = await api()
        .post('/api/admin/projects')
        .set(auth())
        .send({
          name: 'Test Heights',
          category: cat._id,
          location: loc._id,
          developer: dev._id,
          projectType: 'New Launch',
          configuration: '3 BHK',
          size: '1800 Sqft',
          reraNo: 'RERA/123',
          amenities: ['Pool', 'Gym'],
          landmarks: [{ name: 'Metro', distance: '2 km' }],
          faqs: [{ question: 'Q?', answer: 'A.' }],
          isFeatured: true,
          isNewLaunch: true,
          published: true,
        });
      expect(res.status).toBe(201);
      expect(res.body.data.slug).toBe('test-heights');
      expect(res.body.data.category.name).toBe('Farm Houses');
      project = res.body.data;
    });
    test('rejects bad project type & missing category', async () => {
      let res = await api().post('/api/admin/projects').set(auth()).send({ name: 'X', category: cat._id, projectType: 'Lease' });
      expect(res.status).toBe(400);
      res = await api().post('/api/admin/projects').set(auth()).send({ name: 'X' });
      expect(res.status).toBe(400);
    });
    test('appears publicly, in home new launches and in filters', async () => {
      let res = await api().get('/api/projects/test-heights');
      expect(res.status).toBe(200);
      expect(res.body.data.amenities).toEqual(['Pool', 'Gym']);
      res = await api().get('/api/projects?property=farm-houses&location=sector-99&search=heights');
      expect(res.body.meta.total).toBe(1);
      res = await api().get('/api/home');
      expect(res.body.data.newLaunch.some((p) => p.slug === 'test-heights')).toBe(true);
      res = await api().get('/api/developers/test-builders');
      expect(res.body.data.projects).toHaveLength(1);
    });
    test('update and unpublish hides from public', async () => {
      let res = await api().put(`/api/admin/projects/${project._id}`).set(auth()).send({ priceLabel: '₹ 3.5 Cr', views: 9999 });
      expect(res.body.data.priceLabel).toBe('₹ 3.5 Cr');
      expect(res.body.data.views).not.toBe(9999);
      res = await api().put(`/api/admin/projects/${project._id}`).set(auth()).send({ published: false });
      expect(res.body.data.published).toBe(false);
      expect((await api().get('/api/projects/test-heights')).status).toBe(404);
      res = await api().get('/api/projects?search=test heights');
      expect(res.body.meta.total).toBe(0);
      res = await api().get('/api/admin/projects?published=false').set(auth());
      expect(res.body.data.some((p) => p._id === project._id)).toBe(true);
    });
    test('slug change keeps uniqueness', async () => {
      const res = await api().put(`/api/admin/projects/${project._id}`).set(auth()).send({ slug: 'godrej-verano' });
      expect(res.body.data.slug).toBe('godrej-verano-2');
    });
    test('category delete blocked while used, location/developer delete unlinks', async () => {
      expect((await api().delete(`/api/admin/categories/${cat._id}`).set(auth())).status).toBe(409);
      expect((await api().delete(`/api/admin/locations/${loc._id}`).set(auth())).status).toBe(200);
      expect((await api().delete(`/api/admin/developers/${dev._id}`).set(auth())).status).toBe(200);
      const res = await api().get(`/api/admin/projects/${project._id}`).set(auth());
      expect(res.body.data.location).toBeNull();
      expect(res.body.data.developer).toBeNull();
    });
    test('delete project then category', async () => {
      expect((await api().delete(`/api/admin/projects/${project._id}`).set(auth())).status).toBe(200);
      expect((await api().get(`/api/admin/projects/${project._id}`).set(auth())).status).toBe(404);
      expect((await api().delete(`/api/admin/categories/${cat._id}`).set(auth())).status).toBe(200);
    });
  });
});

describe('enquiries', () => {
  let id;
  test('validates required fields', async () => {
    let res = await api().post('/api/enquiries').send({ name: 'A', phone: '1' });
    expect(res.status).toBe(400);
    expect(res.body.details.length).toBeGreaterThan(0);
    res = await api().post('/api/enquiries').send({ name: 'Rahul', phone: '9999999999', email: 'bad' });
    expect(res.status).toBe(400);
  });
  test('stores a quick enquiry linked to a project', async () => {
    const res = await api().post('/api/enquiries').send({
      name: 'Rahul Sharma',
      phone: '+91 99999 99999',
      email: 'rahul@example.com',
      message: 'Please call me',
      enquiryType: 'Quick Enquiry',
      projectSlug: 'godrej-verano',
      pageUrl: 'http://localhost:3000/projects/godrej-verano',
    });
    expect(res.status).toBe(201);
    id = res.body.id;
    const one = await api().get(`/api/admin/enquiries/${id}`).set(auth());
    expect(one.body.data.projectName).toBe('Godrej Verano');
    expect(one.body.data.status).toBe('new');
  });
  test('instant callback needs only name + phone', async () => {
    const res = await api().post('/api/enquiries').send({ name: 'Anita', phone: '9876543210', enquiryType: 'Instant Callback' });
    expect(res.status).toBe(201);
  });
  test('honeypot submissions are silently dropped', async () => {
    const before = (await api().get('/api/admin/enquiries?limit=1').set(auth())).body.meta.total;
    const res = await api().post('/api/enquiries').send({ name: 'Bot Bot', phone: '9876543210', website: 'http://spam' });
    expect(res.status).toBe(201);
    const after = (await api().get('/api/admin/enquiries?limit=1').set(auth())).body.meta.total;
    expect(after).toBe(before);
  });
  test('admin list/search/filter/update/delete', async () => {
    let res = await api().get('/api/admin/enquiries?q=rahul').set(auth());
    expect(res.body.data).toHaveLength(1);
    res = await api().get('/api/admin/enquiries?enquiryType=Instant%20Callback').set(auth());
    expect(res.body.data).toHaveLength(1);
    res = await api().put(`/api/admin/enquiries/${id}`).set(auth()).send({ status: 'contacted', notes: 'Called at 5pm' });
    expect(res.body.data.status).toBe('contacted');
    expect((await api().put(`/api/admin/enquiries/${id}`).set(auth()).send({ status: 'weird' })).status).toBe(400);
    res = await api().get('/api/admin/enquiries?status=contacted').set(auth());
    expect(res.body.data).toHaveLength(1);
  });
  test('CSV export escapes quotes and formulas', async () => {
    await api().post('/api/enquiries').send({ name: 'Eve "Quote"', phone: '9876543210', message: '=HYPERLINK("http://x")' });
    const res = await api().get('/api/admin/enquiries/export.csv').set(auth());
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.text.split('\n')[0]).toContain('Name,Phone');
    expect(res.text).toContain('"Eve ""Quote"""');
    expect(res.text).toContain(`"'=HYPERLINK`);
  });
  test('export requires auth', async () => {
    expect((await api().get('/api/admin/enquiries/export.csv')).status).toBe(401);
  });
  test('delete enquiry', async () => {
    expect((await api().delete(`/api/admin/enquiries/${id}`).set(auth())).status).toBe(200);
  });
});

describe('blogs, testimonials, awards', () => {
  let blog;
  test('blog create/list/detail/unpublish', async () => {
    let res = await api().post('/api/admin/blogs').set(auth()).send({ title: 'Hello World Post', content: '# Hi', excerpt: 'ex' });
    expect(res.status).toBe(201);
    blog = res.body.data;
    expect(blog.slug).toBe('hello-world-post');
    res = await api().get('/api/blogs');
    expect(res.body.data.some((b) => b.slug === 'hello-world-post')).toBe(true);
    expect(res.body.data[0].content).toBeUndefined();
    res = await api().get('/api/blogs/hello-world-post');
    expect(res.body.data.content).toBe('# Hi');
    await api().put(`/api/admin/blogs/${blog._id}`).set(auth()).send({ published: false });
    expect((await api().get('/api/blogs/hello-world-post')).status).toBe(404);
    await api().delete(`/api/admin/blogs/${blog._id}`).set(auth());
  });
  test('future-dated blog is hidden until its date', async () => {
    const res = await api()
      .post('/api/admin/blogs')
      .set(auth())
      .send({ title: 'Future Post', publishedAt: new Date(Date.now() + 86400000 * 5).toISOString() });
    const list = await api().get('/api/blogs');
    expect(list.body.data.some((b) => b.slug === 'future-post')).toBe(false);
    await api().delete(`/api/admin/blogs/${res.body.data._id}`).set(auth());
  });
  test('testimonials and awards show up publicly and on home', async () => {
    const t = await api().post('/api/admin/testimonials').set(auth()).send({ name: 'Priya', text: 'Great service', rating: 5 });
    expect(t.status).toBe(201);
    expect((await api().post('/api/admin/testimonials').set(auth()).send({ name: 'No text' })).status).toBe(400);
    const a = await api().post('/api/admin/awards').set(auth()).send({ title: 'Best Advisor 2025' });
    expect(a.status).toBe(201);
    const home = await api().get('/api/home');
    expect(home.body.data.testimonials.some((x) => x.name === 'Priya')).toBe(true);
    expect(home.body.data.awards.some((x) => x.title === 'Best Advisor 2025')).toBe(true);
    expect((await api().get('/api/testimonials')).body.data).toHaveLength(1);
    expect((await api().get('/api/awards')).body.data).toHaveLength(1);
    await api().put(`/api/admin/testimonials/${t.body.data._id}`).set(auth()).send({ published: false });
    expect((await api().get('/api/testimonials')).body.data).toHaveLength(0);
  });
});

describe('settings', () => {
  test('update persists and is public', async () => {
    const res = await api()
      .put('/api/admin/settings')
      .set(auth())
      .send({
        siteName: 'Aarvi Test',
        phones: ['+91-1111111111', '+91-2222222222'],
        hero: { title: 'New hero title', subtitle: 'Sub', image: '' },
        stats: [{ value: '99+', label: 'Things' }],
        key: 'hacked',
      });
    expect(res.status).toBe(200);
    const pub = await api().get('/api/settings');
    expect(pub.body.data.siteName).toBe('Aarvi Test');
    expect(pub.body.data.phones).toHaveLength(2);
    expect(pub.body.data.hero.title).toBe('New hero title');
    expect(pub.body.data.stats[0].value).toBe('99+');
    expect(pub.body.data.key).toBe('site');
  });
  test('requires auth', async () => {
    expect((await api().put('/api/admin/settings').send({ siteName: 'x' })).status).toBe(401);
  });
});

describe('uploads', () => {
  test('accepts an image and serves it', async () => {
    const res = await api().post('/api/admin/upload').set(auth()).attach('file', PNG, { filename: 'My Photo.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.data.url).toMatch(/^\/uploads\/my-photo-[a-f0-9]+\.png$/);
    const file = await api().get(res.body.data.url);
    expect(file.status).toBe(200);
    expect(file.headers['content-type']).toMatch(/image\/png/);
  });
  test('rejects disallowed type', async () => {
    const res = await api().post('/api/admin/upload').set(auth()).attach('file', Buffer.from('<script>alert(1)</script>'), { filename: 'x.html', contentType: 'text/html' });
    expect(res.status).toBe(400);
  });
  test('rejects svg (script carrier)', async () => {
    const res = await api().post('/api/admin/upload').set(auth()).attach('file', Buffer.from('<svg/>'), { filename: 'x.svg', contentType: 'image/svg+xml' });
    expect(res.status).toBe(400);
  });
  test('rejects missing file', async () => {
    const res = await api().post('/api/admin/upload').set(auth());
    expect(res.status).toBe(400);
  });
  test('multiple upload', async () => {
    const res = await api()
      .post('/api/admin/upload-multiple')
      .set(auth())
      .attach('files', PNG, { filename: 'a.png', contentType: 'image/png' })
      .attach('files', PNG, { filename: 'b.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body.data).toHaveLength(2);
  });
  test('accepts pdf brochure', async () => {
    const res = await api().post('/api/admin/upload').set(auth()).attach('file', Buffer.from('%PDF-1.4 test'), { filename: 'brochure.pdf', contentType: 'application/pdf' });
    expect(res.status).toBe(201);
    expect(res.body.data.url.endsWith('.pdf')).toBe(true);
  });
  test('missing upload 404 JSON', async () => {
    const res = await api().get('/uploads/not-there.png');
    expect(res.status).toBe(404);
  });
});

describe('developers + stats', () => {
  test('public developers list has project counts', async () => {
    const res = await api().get('/api/developers');
    expect(res.status).toBe(200);
    const dlf = res.body.data.find((d) => d.slug === 'dlf');
    expect(dlf.projectCount).toBeGreaterThan(5);
  });
  test('developer detail', async () => {
    const res = await api().get('/api/developers/m3m-india');
    expect(res.status).toBe(200);
    expect(res.body.data.projects.length).toBeGreaterThan(10);
    expect((await api().get('/api/developers/none')).status).toBe(404);
  });
  test('admin stats', async () => {
    const res = await api().get('/api/admin/stats').set(auth());
    expect(res.status).toBe(200);
    expect(res.body.data.projects).toBe(307);
    expect(res.body.data.enquiries).toBeGreaterThan(0);
    expect(Array.isArray(res.body.data.daily)).toBe(true);
    expect(res.body.data.topProjects.length).toBeGreaterThan(0);
  });
});
