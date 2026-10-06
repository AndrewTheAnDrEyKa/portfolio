const {chromium}=require('C:/Users/Legion/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs');
const url=process.env.QA_URL||'http://localhost:5173';
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(url);await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(()=>document.querySelectorAll('img[src]').forEach(img=>img.loading='eager'));
 await page.waitForFunction(()=>[...document.querySelectorAll('img[src]')].every(img=>img.complete&&img.naturalWidth>0));
 await page.waitForTimeout(600);
 fs.mkdirSync('.qa/v3',{recursive:true});
 await page.screenshot({path:'.qa/v3/desktop.png',fullPage:true});
 if(await page.locator('#album-shelf button').count()!==2)throw Error('Featured albums');
 if(await page.locator('.house-album').getAttribute('open')!==null)throw Error('House visible');
 for(const id of ['city','royale']){
  const button=page.locator(`[data-project="${id}"]`);await button.click();
  if(!await page.locator('#project-dialog').isVisible())throw Error('Project dialog '+id);
  if(await page.locator('#project-dialog-content section').count()<3)throw Error('Project content '+id);
  if(id==='royale')await page.screenshot({path:'.qa/v3/project-dialog.png'});
  await page.keyboard.press('Escape');
  if(!await button.evaluate(el=>el===document.activeElement))throw Error('Project focus '+id);
 }
 await page.locator('#album-more').click();
 if(await page.locator('#project-dialog-title').innerText()!=='Авиация')throw Error('Album details');
 await page.locator('#close-project').click();
 if(await page.locator('#album-subtitle').count())throw Error('Subtitle retained');
 if(await page.locator('.project-technical').count())throw Error('Technical strip retained');
 const interlude=page.locator('.sculpture-interlude');await interlude.scrollIntoViewIfNeeded();
 if(await page.locator('.interlude-object').evaluateAll(els=>els.some(el=>getComputedStyle(el).animationName!=='none')))throw Error('Idle animation');
 const box=await interlude.boundingBox();await page.mouse.move(box.x+box.width*.8,box.y+box.height*.3);await page.waitForTimeout(400);
 if(await page.locator('.interlude-object').first().evaluate(el=>getComputedStyle(el).transform==='none'))throw Error('Cursor movement');
 await page.emulateMedia({reducedMotion:'reduce'});await page.mouse.move(box.x+box.width*.2,box.y+box.height*.4);
 if(await page.locator('.interlude-object').first().evaluate(el=>el.style.transform!==''))throw Error('Reduced motion');
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.locator('.archive-albums summary').click();
 for(const album of ['products','motolex']){
  const button=page.locator(`[data-album="${album}"]`);
  await button.click();
  if(!await page.locator('#album-content').isVisible())throw Error('Album did not open '+album);
  await button.click();
  if(await page.locator('#album-content').isVisible())throw Error('Album did not collapse '+album);
  if(await button.getAttribute('aria-expanded')!=='false')throw Error('Collapsed accessibility '+album);
  await button.press('Enter');
  if(!await page.locator('#album-content').isVisible())throw Error('Album did not reopen '+album);
  await button.click();
 }
 await page.locator('[data-album="motolex"]').click();
 if(await page.locator('#album-title').innerText()!=='MOTOROLEX')throw Error('Archive title');
 await page.locator('.image-tile').first().click();
 if(!await page.locator('#media-dialog').isVisible())throw Error('Gallery');
 await page.keyboard.press('Escape');
 await page.locator('[data-album="store"]').click();
 await page.locator('.image-tile').first().click();await page.keyboard.press('ArrowRight');
 if(await page.locator('#gallery-counter').innerText()!=='2 / 3')throw Error('Gallery navigation');
 await page.keyboard.press('Escape');
 await page.locator('.house-album summary').click();await page.locator('[data-film="0"]').first().click();
 await page.waitForTimeout(500);if(!await page.locator('#gallery-video').isVisible())throw Error('Film');await page.keyboard.press('Escape');
 for(const width of [320,390,768]){
  await page.setViewportSize({width,height:850});await page.goto(url);await page.waitForTimeout(400);
  await page.evaluate(()=>document.querySelectorAll('img[src]').forEach(img=>img.loading='eager'));
  await page.waitForFunction(()=>[...document.querySelectorAll('img[src]')].every(img=>img.complete&&img.naturalWidth>0));
  const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
  if(overflow){console.log(await page.evaluate(()=>[...document.querySelectorAll('body *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>({tag:el.tagName,cls:el.className,width:el.getBoundingClientRect().width,right:el.getBoundingClientRect().right})).slice(0,15)));await browser.close();throw Error('Horizontal overflow '+width);}
  if(width===390)await page.screenshot({path:'.qa/v3/mobile.png',fullPage:true});
  if(width===390)await page.locator('.hero').screenshot({path:'.qa/v3/mobile-hero.png'});
 }
 await browser.close();if(errors.length)throw Error(errors.join('\n'));console.log('Desktop and 320/390/768px: albums, archive, gallery, keyboard, films and layout passed.');
})().catch(e=>{console.error(e);process.exit(1)});
