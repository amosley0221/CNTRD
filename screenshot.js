const { chromium } = require('/opt/node22/lib/node_modules/playwright');

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });

  // Mobile view
  const mobile = await browser.newPage();
  await mobile.setViewportSize({ width: 390, height: 844 });

  // Desktop view for profile editing
  const desktop = await browser.newPage();
  await desktop.setViewportSize({ width: 1280, height: 900 });

  // 1. Login page (mobile)
  await mobile.goto('http://localhost:3000/');
  await mobile.waitForTimeout(600);
  await mobile.screenshot({ path: '/home/user/CNTRD/screenshots/01_login.png' });
  console.log('01 login done');

  // 2. Register view (mobile)
  await mobile.click('#show-register');
  await mobile.waitForTimeout(400);
  await mobile.screenshot({ path: '/home/user/CNTRD/screenshots/02_register.png' });
  console.log('02 register done');

  // 3. Login (mobile)
  await mobile.click('#show-login');
  await mobile.fill('#login-field', 'testuser');
  await mobile.fill('#login-password', 'password123');
  await mobile.click('#login-btn');
  await mobile.waitForURL('**/feed.html', { timeout: 6000 });
  await mobile.waitForTimeout(1000);
  await mobile.screenshot({ path: '/home/user/CNTRD/screenshots/03_feed.png' });
  console.log('03 feed done');

  // 4. Compose a post (mobile)
  await mobile.fill('#compose-text', "Just joined CNTRD! First post 🏀 Go Lakers!");
  await mobile.waitForTimeout(300);
  await mobile.screenshot({ path: '/home/user/CNTRD/screenshots/04_composing.png' });
  await mobile.click('#post-btn');
  await mobile.waitForTimeout(800);
  await mobile.fill('#compose-text', "Anyone watching the game tonight? This season is 🔥");
  await mobile.click('#post-btn');
  await mobile.waitForTimeout(600);
  await mobile.screenshot({ path: '/home/user/CNTRD/screenshots/05_feed_posts.png' });
  console.log('05 feed with posts done');

  // 5. Like a post (mobile)
  const likeBtns = await mobile.locator('.like-btn').all();
  if (likeBtns.length > 0) await likeBtns[0].click();
  await mobile.waitForTimeout(400);
  await mobile.screenshot({ path: '/home/user/CNTRD/screenshots/06_liked.png' });
  console.log('06 liked done');

  // 6. Explore tab (mobile)
  await mobile.click('#tab-explore-btn');
  await mobile.waitForTimeout(800);
  await mobile.screenshot({ path: '/home/user/CNTRD/screenshots/07_explore.png' });
  console.log('07 explore done');

  // --- Desktop screenshots ---
  // Login on desktop
  await desktop.goto('http://localhost:3000/');
  await desktop.fill('#login-field', 'testuser');
  await desktop.fill('#login-password', 'password123');
  await desktop.click('#login-btn');
  await desktop.waitForURL('**/feed.html', { timeout: 6000 });
  await desktop.waitForTimeout(1000);
  await desktop.screenshot({ path: '/home/user/CNTRD/screenshots/08_feed_desktop.png' });
  console.log('08 feed desktop done');

  // Profile page on desktop
  await desktop.goto('http://localhost:3000/profile.html?u=testuser');
  await desktop.waitForTimeout(1200);
  await desktop.screenshot({ path: '/home/user/CNTRD/screenshots/09_profile_desktop.png' });
  console.log('09 profile desktop done');

  // Open edit profile on desktop
  await desktop.click('#edit-profile-btn');
  await desktop.waitForTimeout(500);
  await desktop.waitForSelector('#edit-bio', { state: 'visible', timeout: 5000 });
  await desktop.fill('#edit-bio', 'Sports fan. Lakers all day. Cowboys nation. Just here to talk ball.');
  const tagInput = desktop.locator('#tag-input');
  await tagInput.fill('LAKERS');
  await tagInput.press('Enter');
  await tagInput.fill('COWBOYS');
  await tagInput.press('Enter');
  await tagInput.fill('DODGERS');
  await tagInput.press('Enter');
  await desktop.waitForTimeout(300);
  await desktop.screenshot({ path: '/home/user/CNTRD/screenshots/10_edit_profile.png' });
  console.log('10 edit profile done');

  // Save and show updated profile
  await desktop.click('#save-profile-btn');
  await desktop.waitForTimeout(900);
  await desktop.screenshot({ path: '/home/user/CNTRD/screenshots/11_profile_updated.png' });
  console.log('11 profile updated done');

  // Profile on mobile
  await mobile.goto('http://localhost:3000/profile.html?u=testuser');
  await mobile.waitForTimeout(1200);
  await mobile.screenshot({ path: '/home/user/CNTRD/screenshots/12_profile_mobile.png' });
  console.log('12 profile mobile done');

  await browser.close();
  console.log('ALL DONE');
})();
