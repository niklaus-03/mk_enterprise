const { createClient } = require('@supabase/supabase-js');

let supabase = null;
if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY) {
  try {
    supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );
  } catch (err) {
    console.warn('⚠️ Failed to initialize Supabase client:', err.message);
  }
}

const cleanupInvoices = async () => {
  if (!supabase) {
    console.log('ℹ️ Supabase credentials not configured. Skipping invoice storage cleanup.');
    return;
  }

  try {
    const { data, error } = await supabase.storage
      .from('invoices')
      .list('', { limit: 1000 });

    if (error) {
      // Check if it is a DNS or network resolution issue to display a clean warning
      const isNetworkErr = 
        error.originalError?.message?.includes('fetch failed') || 
        error.originalError?.message?.includes('ENOTFOUND') ||
        error.message?.includes('fetch failed') ||
        error.name === 'TypeError' ||
        error.originalError?.code === 'ENOTFOUND';
      
      if (isNetworkErr) {
        console.warn('⚠️ Supabase cleanup skipped: DNS/Network connection offline (Supabase project may be paused or unreachable).');
      } else {
        console.error('❌ Supabase storage error:', error);
      }
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
    console.error('❌ Supabase cleanup task failed:', err.message);
  }
};

module.exports = { cleanupInvoices };