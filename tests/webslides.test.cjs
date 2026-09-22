// Run with Playwright available: node tests/webslides.test.cjs <deck URL>.
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const url = process.argv[2];
assert(url, 'Pass the served deck URL, including index.html');

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.BROWSER_PATH });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, reducedMotion: 'reduce' });
    const errors = [], external = [];
    page.on('pageerror', error => errors.push(String(error)));
    page.on('request', request => {
      if (new URL(request.url()).origin !== new URL(url).origin) external.push(request.url());
    });
    await page.goto(url);
    await page.waitForFunction(() => window.ws?.initialised);
    const count = await page.locator('#webslides > section').count();
    assert.equal(count, 10);
    for (let i = 0; i < count; i++) {
      await page.evaluate(i => ws.goToSlide(i), i);
      await page.waitForFunction(i => !ws.isMoving && document.querySelector('section.current')?.dataset.slide === String(i + 1), i);
      assert.equal(await page.locator('section.current :is(a, .speaker-notes, .eyebrow):visible').count(), 0, 'Presenter material is visible to the audience');
      const content = await page.locator('section.current > .slide-content').boundingBox();
      assert(content.y >= 65 && content.y + content.height <= 655, `Slide ${i + 1} clips`);
      assert(await page.locator('section.current img').evaluateAll(images => images.every(image => image.complete && image.naturalWidth > 0)), `Slide ${i + 1} image missing`);
    }
    await page.keyboard.press('ArrowLeft');
    await page.waitForFunction(() => !ws.isMoving && document.querySelector('section.current').dataset.slide === '9');
    await page.locator('#counter a').click();
    await page.waitForFunction(() => document.querySelector('#webslides-zoomed').classList.contains('in'));
    await page.locator('#webslides-zoomed .column').first().click();
    await page.waitForFunction(() => !ws.isMoving && document.querySelector('section.current').dataset.slide === '1');
    await page.goto(url + '?notes');
    assert.equal(await page.locator('.speaker-notes:visible').count(), count);
    assert.equal(await page.locator('footer.sources:visible').count(), count);
    assert.equal(await page.locator('.code-source:visible').count(), await page.locator('pre').count(), 'Each code excerpt needs a source in the notes');
    assert.equal(await page.locator('[data-core="true"]').count(), 9);
    await page.setViewportSize({ width: 390, height: 844 });
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Notes overflow mobile viewport');
    const diagrams = await page.locator('#webslides img.diagram').evaluateAll(images => images.map(image => image.src));
    for (const diagram of diagrams) {
      await page.goto(diagram);
      const clipped = await page.evaluate(() => [...document.querySelectorAll('g.box')].flatMap(group => {
        const box = group.querySelector('rect').getBBox();
        return [...group.querySelectorAll('text')].filter(text => {
          const label = text.getBBox();
          return label.x < box.x || label.x + label.width > box.x + box.width || label.y < box.y || label.y + label.height > box.y + box.height;
        }).map(text => text.textContent);
      }));
      assert.deepEqual(clipped, [], `Clipped diagram labels in ${diagram}`);
      assert(await page.evaluate(() => [...document.querySelectorAll('text')].every(text => {
        const label = text.getBBox(), view = document.documentElement.viewBox.baseVal;
        return label.x >= 0 && label.x + label.width <= view.width && label.y >= 0 && label.y + label.height <= view.height;
      })), `Text extends outside ${diagram}`);
    }
    assert.deepEqual(errors, []);
    assert.deepEqual(external, [], 'The deck must work without external assets');
    console.log('WebSlides: 10 slides, navigation, overview, notes, mobile layout, and SVG labels passed.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
