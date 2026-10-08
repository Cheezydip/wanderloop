import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function fixPermissions(targetPath) {
  try {
    const stats = fs.statSync(targetPath);
    if (stats.isDirectory()) {
      fs.chmodSync(targetPath, 0o755);
      const entries = fs.readdirSync(targetPath);
      for (const entry of entries) {
        fixPermissions(path.join(targetPath, entry));
      }
    } else {
      fs.chmodSync(targetPath, 0o644);
    }
  } catch (err) {
    // Non-fatal on Windows, crucial on Linux/Docker
  }
}

['dist', 'build', 'out'].forEach(dirName => {
  const full = path.resolve(__dirname, dirName);
  if (fs.existsSync(full)) {
    console.log(`[build] Setting 755/644 world-readable permissions on ${dirName}/`);
    fixPermissions(full);
  }
});
