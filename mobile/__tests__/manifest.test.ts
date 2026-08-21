import fs from 'fs';
import path from 'path';

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

describe('PWA manifest', () => {
  it('manifest.json has the fields required for install prompts', () => {
    const manifest = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, 'manifest.json'), 'utf8'));
    expect(manifest.name).toBe('HAPP');
    expect(manifest.display).toBe('standalone');
    expect(manifest.start_url).toBe('.');
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes);
    expect(sizes).toContain('192x192');
    expect(sizes).toContain('512x512');
  });

  it('index.html links the manifest', () => {
    const html = fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8');
    expect(html).toContain('rel="manifest"');
  });

  it('icon files referenced by the manifest exist on disk', () => {
    expect(fs.existsSync(path.join(PUBLIC_DIR, 'icon.png'))).toBe(true);
    expect(fs.existsSync(path.join(PUBLIC_DIR, 'apple-touch-icon.png'))).toBe(true);
  });
});
