import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('依赖锁文件使用公共 npm 源，防止本地镜像地址进入云端构建', () => {
  const lock = JSON.parse(fs.readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'));
  assert.equal(lock.lockfileVersion, 3);
  for (const [path, item] of Object.entries(lock.packages)) {
    if (!path) continue;
    assert.ok(item.resolved, `${path} 必须锁定下载地址`);
    const url = new URL(item.resolved);
    assert.equal(url.origin, 'https://registry.npmjs.org', `${path} 必须使用公共 npm 源`);
    assert.ok(item.integrity, `${path} 必须保留完整性校验`);
  }
});
