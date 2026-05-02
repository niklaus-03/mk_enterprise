const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

const cleanupInvoices = async () => {
  try {
    const { data, error } = await supabase.storage
      .from('invoices')
      .list('', { limit: 1000 });

    if (error) {
      console.error(error);
      return;
    }

    const now = Date.now();

    const oldFiles = data.filter(file => {
      const created = new Date(file.created_at).getTime();
      const days = (now - created) / (1000 * 60 * 60 * 24);
      return days > 7;
    });

    const fileNames = oldFiles.map(f => f.name);

    if (fileNames.length === 0) return;

    const { error: delError } = await supabase.storage
      .from('invoices')
      .remove(fileNames);

    if (delError) console.error(delError);
    else console.log("Deleted:", fileNames);

  } catch (err) {
    console.error(err);
  }
};

module.exports = { cleanupInvoices };