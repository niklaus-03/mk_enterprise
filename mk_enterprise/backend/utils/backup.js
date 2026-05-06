const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const BACKUP_DIR = path.join(__dirname, '../../backups');

// Ensure backup directory exists
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

/**
 * Create a JSON backup of all critical collections.
 * Runs at 3:00 AM daily via cron, or manually via API.
 */
async function createBackup() {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const backupFile = path.join(BACKUP_DIR, `backup_${timestamp}.json`);

    // Dynamically load all models
    const models = ['Invoice', 'Product', 'Customer', 'Admin', 'Settlement', 'Trip', 'StockMovement', 'Notification', 'ActivityLog'];
    const data = {};

    for (const modelName of models) {
      try {
        const Model = mongoose.model(modelName);
        data[modelName] = await Model.find({}).lean();
      } catch (err) {
        // Model might not be registered yet
        data[modelName] = [];
      }
    }

    data._meta = {
      created_at: new Date().toISOString(),
      collections: Object.keys(data).filter(k => k !== '_meta'),
      total_records: Object.values(data).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0),
    };

    fs.writeFileSync(backupFile, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✅ Backup created: ${backupFile} (${(fs.statSync(backupFile).size / 1024).toFixed(1)} KB)`);

    // Keep only last 30 backups
    const files = fs.readdirSync(BACKUP_DIR)
      .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (files.length > 30) {
      for (const old of files.slice(30)) {
        fs.unlinkSync(path.join(BACKUP_DIR, old));
      }
      console.log(`🗑️ Cleaned up ${files.length - 30} old backups`);
    }

    return { success: true, file: backupFile, size: fs.statSync(backupFile).size };
  } catch (err) {
    console.error('❌ Backup failed:', err.message);
    return { success: false, error: err.message };
  }
}

/**
 * List available backups
 */
function listBackups() {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('backup_') && f.endsWith('.json'))
    .sort()
    .reverse()
    .map(f => ({
      filename: f,
      size: fs.statSync(path.join(BACKUP_DIR, f)).size,
      created: f.replace('backup_', '').replace('.json', '').replace(/-/g, (m, i) => i < 13 ? '-' : ':'),
    }));
}

module.exports = { createBackup, listBackups, BACKUP_DIR };
