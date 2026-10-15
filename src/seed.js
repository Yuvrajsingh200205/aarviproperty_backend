/* Seeds the database with starter content. Safe to re-run (upserts by slug).
   Usage: npm run seed        -> add / refresh starter data
          npm run seed:reset  -> wipe content collections first */
const path = require('path');
const mongoose = require('mongoose');
const env = require('./config/env');
const User = require('./models/User');
const Category = require('./models/Category');
const Location = require('./models/Location');
const Developer = require('./models/Developer');
const Project = require('./models/Project');
const Blog = require('./models/Blog');
const Settings = require('./models/Settings');
const Testimonial = require('./models/Testimonial');
const Award = require('./models/Award');
const Enquiry = require('./models/Enquiry');

const projectsSeed = require(path.join('..', 'seed', 'projects.json'));
const developersSeed = require(path.join('..', 'seed', 'developers.json'));

const CATEGORIES = [
  { name: 'Residential', description: 'Apartments, high-rise towers and premium homes across Gurugram.' },
  { name: 'Commercial', description: 'Office spaces, retail shops, food courts and service apartments.' },
  { name: 'Residential Plots', description: 'Plotted developments and freehold plots in prime sectors.' },
  { name: 'SCO Plots', description: 'Shop-cum-office plots in high-footfall commercial belts.' },
  { name: 'Villa House', description: 'Independent villas and luxury houses.' },
  { name: 'Builder Floors', description: 'Low-rise independent builder floors with private entry.' },
];

const LOCATIONS = [
  ['Dwarka Expressway', 'Gurugram'],
  ['Golf Course Ext Road', 'Gurugram'],
  ['Golf Course Road', 'Gurugram'],
  ['New Gurgaon', 'Gurugram'],
  ['Sohna Road', 'Gurugram'],
  ['Southern Peripheral Road', 'Gurugram'],
  ['Gwal Pahari', 'Gurugram'],
  ['NH8', 'Gurugram'],
  ['Northern Peripheral Road', 'Gurugram'],
  ['MG Road', 'Gurugram'],
  ['Manesar', 'Gurugram'],
  ['Old Gurgaon', 'Gurugram'],
  ['Dwarka', 'Delhi'],
  ['Chandni Chowk', 'Delhi'],
  ['Jhajjar', 'Haryana'],
];

const AMENITIES = {
  Residential: ['Clubhouse', 'Swimming Pool', 'Gymnasium', 'Landscaped Gardens', "Children's Play Area", 'Jogging Track', '24x7 Security', 'Power Backup', 'Covered Parking', 'Multipurpose Hall'],
  Commercial: ['High-speed Elevators', 'Ample Parking', 'Food Court', '24x7 Security', 'Power Backup', 'Central Air Conditioning', 'Fire Safety', 'Reception & Lobby'],
  'Residential Plots': ['Wide Internal Roads', 'Gated Community', 'Street Lighting', 'Parks & Green Belts', 'Water & Sewage Lines', '24x7 Security', 'Community Centre'],
  'SCO Plots': ['Prime Frontage', 'Wide Road Access', 'Ample Parking', 'High Footfall Location', 'Metro / Expressway Connectivity'],
  'Villa House': ['Private Garden', 'Clubhouse', 'Gated Community', '24x7 Security', 'Power Backup', 'Landscaped Greens'],
  'Builder Floors': ['Private Entry', 'Stilt Parking', 'Lift', 'Power Backup', 'Gated Community', '24x7 Security'],
};

function splitSize(raw) {
  const s = (raw || '').trim();
  if (!s || /^na$/i.test(s)) return { configuration: '', size: '' };
  if (/bhk/i.test(s)) return { configuration: s.replace(/bhk/gi, 'BHK'), size: '' };
  if (/sq|yd|yrd|yard/i.test(s)) return { configuration: '', size: s };
  return { configuration: s, size: '' };
}

function overviewFor(p, catName, devName, locName) {
  const cfg = p.configuration ? `**Configuration:** ${p.configuration}  \n` : '';
  const sz = p.size ? `**Size:** ${p.size}  \n` : '';
  return [
    `## About ${p.name}`,
    '',
    `${p.name} is a ${catName.toLowerCase()} offering${devName ? ` by ${devName}` : ''} located on ${locName || 'Gurugram'}, one of the most sought-after corridors of the Delhi-NCR region.`,
    '',
    `${cfg}${sz}**Category:** ${catName}  \n**Location:** ${locName || 'Gurugram'}`,
    '',
    '## Why consider this project',
    '',
    '- Well-connected micro-market with strong social and physical infrastructure',
    '- Reputed developer with a track record of delivery',
    '- Planned open spaces and contemporary amenities',
    '',
    'Final specifications, pricing and availability are confirmed in the official brochure. Get in touch with our advisors for the latest details, site visits and pricing.',
  ].join('\n');
}

const BLOGS = [
  {
    title: 'What to Know Before Buying Property in Gurgaon',
    excerpt: 'A practical checklist for first-time and seasoned buyers: RERA, location, builder track record and payment plans.',
    content:
      '## Start with the basics\n\nBuying property is one of the largest financial decisions you will make. Before you shortlist projects, decide your budget, preferred micro-market and timeline.\n\n## Checklist\n\n1. **Verify RERA registration** of the project and the agent.\n2. **Check the developer\'s delivery record** on earlier projects.\n3. **Visit the location** at different times of the day.\n4. **Compare payment plans** and read the builder-buyer agreement carefully.\n5. **Evaluate connectivity** to work, schools and hospitals.\n\n## Talk to an advisor\n\nOur team can walk you through shortlisted projects and arrange site visits.',
    tags: ['buying guide', 'gurgaon'],
  },
  {
    title: 'Residential Plots vs Apartments: Which Is Better for You?',
    excerpt: 'Compare appreciation potential, maintenance, flexibility and total cost of ownership.',
    content:
      '## Plots\n\nPlots offer flexibility to design your own home and often show strong long-term appreciation, but require construction time and capital.\n\n## Apartments\n\nApartments provide ready amenities, security and lower maintenance effort, usually with better rental yields in managed societies.\n\n## How to decide\n\nThink about your time horizon, budget and whether you want to build or move in quickly.',
    tags: ['plots', 'apartments'],
  },
  {
    title: 'Top Locations in Gurugram to Invest in',
    excerpt: 'Dwarka Expressway, Golf Course Extension Road, Sohna Road and more: what makes each micro-market tick.',
    content:
      '## Golf Course Extension Road\n\nEstablished social infrastructure and premium developments.\n\n## Dwarka Expressway\n\nStrong connectivity to Delhi and the airport with many new launches.\n\n## Sohna Road\n\nA mix of affordable and premium options with improving infrastructure.',
    tags: ['investment', 'locations'],
  },
  {
    title: 'How to Choose a Real Estate Consultant You Can Trust',
    excerpt: 'Questions to ask, documents to check and red flags to avoid when working with an agent.',
    content:
      '## Check credentials\n\nAsk for the agent\'s RERA registration number and verify it on the state RERA portal.\n\n## Ask for transparency\n\nA good consultant explains pros and cons, shares official brochures and never pressures you.\n\n## Look at references\n\nRead online reviews and speak with previous clients.',
    tags: ['advice'],
  },
];

async function run({ reset = false, quiet = false } = {}) {
  const log = (...a) => !quiet && console.log(...a);
  if (reset) {
    await Promise.all([Category, Location, Developer, Project, Blog, Testimonial, Award, Enquiry, Settings].map((M) => M.deleteMany({})));
    log('Content collections cleared');
  }

  // Admin user
  let admin = await User.findOne({ email: env.adminEmail.toLowerCase() });
  if (!admin) {
    admin = new User({ name: env.adminName, email: env.adminEmail });
    await admin.setPassword(env.adminPassword);
    await admin.save();
    log(`Admin created: ${env.adminEmail}`);
  }

  // Settings
  const settings = await Settings.getSite();
  if (!settings.phones.length) {
    settings.phones = ['+91-0000000000'];
    settings.whatsapp = '910000000000';
    settings.emails = ['info@aarviproperty.com'];
    settings.address = 'Your office address, Gurugram, Haryana';
    settings.workingHours = 'Mon - Sat: 10:00 AM - 7:00 PM';
    settings.stats = [
      { value: '10+', label: 'Years of experience' },
      { value: '1000+', label: 'Happy clients' },
      { value: '500+', label: 'Properties sold' },
    ];
    settings.about = {
      heading: 'About Aarvi Property',
      intro: 'We help you buy, sell and rent homes, commercial spaces and plots across Gurugram and Delhi-NCR.',
      mission:
        'To simplify real estate for our clients by offering honest advice, transparent processes and access to the best projects in the market.',
      vision: 'To be the most trusted real estate advisory in Delhi-NCR, where every transaction brings clients closer to their goals.',
      body:
        'Whether you are a first-time buyer, an investor or a business looking for office space, our advisors guide you at every step: shortlisting, site visits, negotiation, paperwork and post-sales support.',
      image: '',
    };
    settings.privacyPolicy =
      '## Privacy Policy\n\nWe collect the details you submit through our enquiry forms (name, phone, email and message) only to respond to your request and share relevant property information. We do not sell your data. Contact us to update or delete your information.';
    settings.terms =
      '## Terms & Conditions\n\nInformation on this website is for general guidance and may change without notice. Prices, availability and specifications must be confirmed with the developer. Images are for illustration only.';
    settings.footerText = 'Real estate consultants for residential, commercial and plotted properties in Gurugram.';
    settings.seoDescription =
      'Browse residential, commercial and plotted projects in Gurugram and Delhi-NCR. Talk to our real estate advisors today.';
    await settings.save();
  }

  // Categories
  const catBySlug = {};
  for (const [i, c] of CATEGORIES.entries()) {
    let doc = await Category.findOne({ name: c.name });
    if (!doc) doc = new Category({ name: c.name });
    doc.description = doc.description || c.description;
    doc.order = i;
    await doc.save();
    catBySlug[c.name] = doc;
  }

  // Locations
  const locByName = {};
  for (const [i, [name, city]] of LOCATIONS.entries()) {
    let doc = await Location.findOne({ name });
    if (!doc) doc = new Location({ name, city });
    doc.order = i;
    await doc.save();
    locByName[name] = doc;
  }

  // Developers
  const devBySeedSlug = {};
  for (const [i, d] of developersSeed.entries()) {
    let doc = await Developer.findOne({ name: d.name });
    if (!doc) doc = new Developer({ name: d.name, slug: d.slug });
    if (!doc.description) {
      doc.description = `${d.name} is a real estate developer with projects across Gurugram and Delhi-NCR. Explore all the projects listed with Aarvi Property.`;
    }
    doc.order = i;
    await doc.save();
    devBySeedSlug[d.slug] = doc;
  }

  // Projects
  let created = 0;
  const featuredCounter = {};
  for (const [i, p] of projectsSeed.entries()) {
    const exists = await Project.findOne({ slug: p.slug });
    if (exists) continue;
    const cat = catBySlug[p.propertyCategory] || catBySlug.Residential;
    const loc = locByName[p.location] || null;
    const dev = p.developer ? devBySeedSlug[p.developer] : null;
    const { configuration, size } = splitSize(p.size);
    featuredCounter[cat.name] = (featuredCounter[cat.name] || 0) + 1;
    await Project.create({
      name: p.name,
      slug: p.slug,
      category: cat._id,
      projectType: p.projectType,
      location: loc?._id,
      developer: dev?._id,
      configuration,
      size,
      priceLabel: 'On Request',
      shortDescription: `${p.name}${dev ? ` by ${dev.name}` : ''}${loc ? `, ${loc.name}` : ''}. ${configuration || size || cat.name}.`,
      overview: overviewFor({ name: p.name, configuration, size }, cat.name, dev?.name, loc?.name),
      amenities: AMENITIES[cat.name] || [],
      isNewLaunch: Boolean(p.isNewLaunch),
      isFeatured: featuredCounter[cat.name] <= 4,
      published: true,
      order: i,
    });
    created += 1;
  }
  log(`Projects: ${created} created, ${projectsSeed.length - created} already present`);

  // Blogs
  for (const b of BLOGS) {
    if (!(await Blog.findOne({ title: b.title }))) await Blog.create(b);
  }

  log('Seed complete');
}

module.exports = { run };

if (require.main === module) {
  (async () => {
    await mongoose.connect(env.mongoUri);
    await run({ reset: process.argv.includes('--reset') });
    await mongoose.disconnect();
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
