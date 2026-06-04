const mongoose = require('mongoose');
const Customer = require('c:/Users/Dell/OneDrive/Desktop/mk_enterprise/mk_enterprise/backend/models/Customer');

mongoose.connect('mongodb://127.0.0.1:27017/mk_enterprise', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const prefixes = ['Shree', 'Shreemati', 'Mr.', 'Mrs.', 'Ms.', 'श्री', 'श्रीमती'];
const suffixes = ['jii', 'ji', 'जी'];

const cleanName = (fullName) => {
  if (!fullName) return '';
  let name = fullName.trim();
  
  for (const p of prefixes) {
    if (name.toLowerCase().startsWith(p.toLowerCase() + ' ')) {
      name = name.slice(p.length + 1).trim();
      break;
    }
  }
  
  for (const s of suffixes) {
    if (name.toLowerCase().endsWith(' ' + s.toLowerCase())) {
      name = name.slice(0, name.length - s.length - 1).trim();
      break;
    }
  }
  return name;
};

const run = async () => {
  try {
    const customers = await Customer.find({});
    let updated = 0;
    for (const c of customers) {
      const cleaned = cleanName(c.name);
      if (cleaned !== c.name) {
        c.name = cleaned;
        await c.save();
        updated++;
      }
    }
    console.log(`Cleaned ${updated} customers.`);
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
