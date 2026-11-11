import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const playwrightPath =
  process.env.PLAYWRIGHT_PATH ||
  'C:\\Users\\keert\\AppData\\Local\\npm-cache\\_npx\\e41f203b7505f1fb\\node_modules\\playwright'
const { chromium } = require(playwrightPath)

const VIEWPORTS = [
  { name: 'desktop-fhd', width: 1920, height: 1080 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'laptop-1280', width: 1280, height: 800 },
  { name: 'tablet-landscape', width: 1024, height: 768 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'mobile-large', width: 430, height: 932 },
  { name: 'mobile-small', width: 375, height: 812 },
]

const PREVIEW_URL = 'http://localhost:4173'
const CLASS_ID = 'e2e398f5-5fd1-4964-8e91-8a2c306293b5'
const GROUP_ID = 'cc887d59-6ccb-490e-b787-d8c9eb1048b2'
const GROUP_ASSIGNMENT_ID = 'be665af0-7b57-41b2-a69b-df445996357c'

async function waitForServer(url, timeoutMs = 20000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url)
      if (res.ok) return
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  throw new Error(`Preview server did not respond within ${timeoutMs}ms`)
}

async function assertNoHorizontalOverflow(page, label) {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }))
  assert.ok(
    metrics.scrollWidth <= metrics.innerWidth + 1,
    `[${label}] Horizontal overflow detected: scrollWidth=${metrics.scrollWidth} > innerWidth=${metrics.innerWidth}`
  )
}

async function assertFullViewportModalGeometry(page, label) {
  const geom = await page.evaluate(() => {
    const dialog = document.querySelector('[role="dialog"]')
    if (!dialog) return { found: false }
    const isPortalToBody = dialog.parentElement === document.body
    const backdrop = dialog.querySelector('[aria-hidden="true"]')
    const backdropRect = backdrop ? backdrop.getBoundingClientRect() : null
    const panel = dialog.querySelector('[tabindex="-1"]')
    const panelRect = panel ? panel.getBoundingClientRect() : null
    return {
      found: true,
      isPortalToBody,
      bodyOverflow: document.body.style.overflow,
      winW: window.innerWidth,
      winH: window.innerHeight,
      backdropRect: backdropRect
        ? { left: backdropRect.left, top: backdropRect.top, width: backdropRect.width, height: backdropRect.height }
        : null,
      panelRect: panelRect
        ? {
            left: panelRect.left,
            top: panelRect.top,
            right: panelRect.right,
            bottom: panelRect.bottom,
            width: panelRect.width,
            height: panelRect.height,
          }
        : null,
    }
  })

  assert.ok(geom.found, `[${label}] Dialog [role="dialog"] not found`)
  assert.ok(geom.isPortalToBody, `[${label}] Dialog is not portaled directly under document.body`)
  assert.equal(geom.bodyOverflow, 'hidden', `[${label}] Body scroll must be locked while modal is open`)
  assert.ok(geom.backdropRect, `[${label}] Modal backdrop not found`)
  assert.ok(Math.abs(geom.backdropRect.left) <= 1, `[${label}] Backdrop left=${geom.backdropRect.left} != 0`)
  assert.ok(Math.abs(geom.backdropRect.top) <= 1, `[${label}] Backdrop top=${geom.backdropRect.top} != 0`)
  assert.ok(
    geom.backdropRect.width >= geom.winW - 1,
    `[${label}] Backdrop width=${geom.backdropRect.width} < window.innerWidth=${geom.winW}`
  )
  assert.ok(
    geom.backdropRect.height >= geom.winH - 1,
    `[${label}] Backdrop height=${geom.backdropRect.height} < window.innerHeight=${geom.winH}`
  )
  assert.ok(geom.panelRect, `[${label}] Modal panel not found`)
  assert.ok(geom.panelRect.left >= 8, `[${label}] Panel left=${geom.panelRect.left} clipped`)
  assert.ok(geom.panelRect.right <= geom.winW - 8, `[${label}] Panel right=${geom.panelRect.right} > ${geom.winW - 8}`)
  assert.ok(geom.panelRect.top >= 8, `[${label}] Panel top=${geom.panelRect.top} clipped`)
  assert.ok(geom.panelRect.bottom <= geom.winH - 8, `[${label}] Panel bottom=${geom.panelRect.bottom} > ${geom.winH - 8}`)
}

async function login(page, email, password, expectedPathPrefix) {
  await page.goto(`${PREVIEW_URL}/login`, { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((url) => url.pathname.startsWith(expectedPathPrefix), { timeout: 20000 })
  await page.waitForLoadState('networkidle')
}

async function logout(page) {
  await page.click('header button:has(div.rounded-full)')
  await page.click('button:has-text("Log out")')
  await page.waitForURL((url) => url.pathname === '/login', { timeout: 15000 })
}

async function main() {
  const preview = spawn(
    process.execPath,
    ['./node_modules/vite/bin/vite.js', 'preview', '--port', '4173', '--strictPort'],
    {
      stdio: 'ignore',
      windowsHide: true,
    }
  )

  let browser
  const consoleErrors = []
  const pageErrors = []

  try {
    await waitForServer(PREVIEW_URL)
    browser = await chromium.launch({
      headless: true,
      executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    })

    const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
    const page = await context.newPage()

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text())
      }
    })
    page.on('pageerror', (err) => {
      pageErrors.push(err.message)
    })

    // 1. Student Login & Multi-Viewport Join Class Modal + Dashboard + Class/Group/Assignment Checks
    await login(page, 'student1@assignora.demo', 'Student@123', '/student')
    await page.waitForSelector('button:has-text("Join Class")', { timeout: 15000 })

    for (const vp of VIEWPORTS) {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.waitForTimeout(120)
      await assertNoHorizontalOverflow(page, `student-dashboard-${vp.name}`)

      // Open JoinClassModal and verify full-viewport portal + backdrop + centered geometry
      await page.click('button:has-text("Join Class")')
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
      await page.waitForTimeout(150)
      await assertFullViewportModalGeometry(page, `join-modal-${vp.name}`)

      // Close via Escape and verify scroll unlock
      await page.keyboard.press('Escape')
      await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 5000 })
      const unlockedOverflow = await page.evaluate(() => document.body.style.overflow)
      assert.notEqual(unlockedOverflow, 'hidden', `[${vp.name}] Body overflow remained hidden after Escape`)
    }

    // Verify JoinClassModal code validation UI (E2E398 already enrolled check)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.click('button:has-text("Join Class")')
    await page.fill('#join-class-code-input', 'E2E398')
    await page.click('button:has-text("Verify Code")')
    await page.waitForTimeout(1500)
    await page.keyboard.press('Escape')

    // Verify NotificationsDrawer portal + full-viewport backdrop on desktop & mobile
    for (const vp of [VIEWPORTS[1], VIEWPORTS[6]]) {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.click('button[aria-label="Notifications"]')
      await page.waitForSelector('[role="dialog"][aria-label="Notifications"]', { timeout: 5000 })
      const drawerCheck = await page.evaluate(() => {
        const d = document.querySelector('[role="dialog"][aria-label="Notifications"]')
        const bd = d?.querySelector('[aria-hidden="true"]')?.getBoundingClientRect()
        return {
          inBody: d?.parentElement === document.body,
          bd: bd ? { left: bd.left, top: bd.top, w: bd.width, h: bd.height } : null,
          winW: window.innerWidth,
          winH: window.innerHeight,
        }
      })
      assert.ok(drawerCheck.inBody, `NotificationsDrawer must portal to body on ${vp.name}`)
      assert.ok(Math.abs(drawerCheck.bd.left) <= 1 && Math.abs(drawerCheck.bd.top) <= 1)
      assert.ok(drawerCheck.bd.w >= drawerCheck.winW - 1 && drawerCheck.bd.h >= drawerCheck.winH - 1)
      await page.keyboard.press('Escape')
      await page.waitForSelector('[role="dialog"][aria-label="Notifications"]', { state: 'detached', timeout: 5000 })
    }

    // Check Student routes across desktop, tablet, mobile
    for (const route of [
      '/student/classes',
      `/student/classes/${CLASS_ID}`,
      `/student/classes/${CLASS_ID}/groups/${GROUP_ID}`,
      `/student/assignments/${GROUP_ASSIGNMENT_ID}`,
    ]) {
      await page.goto(`${PREVIEW_URL}${route}`, { waitUntil: 'networkidle' })
      await page.waitForTimeout(400)
      for (const vp of [VIEWPORTS[1], VIEWPORTS[4], VIEWPORTS[6]]) {
        await page.setViewportSize({ width: vp.width, height: vp.height })
        await page.waitForTimeout(100)
        await assertNoHorizontalOverflow(page, `student-${route}-${vp.name}`)
      }
    }

    // Student Logout
    await page.setViewportSize({ width: 1440, height: 900 })
    await logout(page)

    // 2. Admin / Professor Login + Dashboards, Class Cards, 3-dot Menu, Submission Tracking & Modals
    await login(page, 'admin@assignora.demo', 'Admin@12345', '/admin')
    await page.waitForTimeout(500)

    for (const vp of [VIEWPORTS[0], VIEWPORTS[2], VIEWPORTS[4], VIEWPORTS[6]]) {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.waitForTimeout(120)
      await assertNoHorizontalOverflow(page, `admin-dashboard-${vp.name}`)
    }

    // Open Create New Class modal on AdminDashboard and check geometry on desktop & mobile
    for (const vp of [VIEWPORTS[1], VIEWPORTS[6]]) {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.click('button:has-text("New Course")')
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
      await page.waitForTimeout(150)
      await assertFullViewportModalGeometry(page, `create-class-modal-${vp.name}`)
      await page.keyboard.press('Escape')
      await page.waitForSelector('[role="dialog"]', { state: 'detached', timeout: 5000 })
    }

    // Check /admin/classes 3-dot menu is NOT clipped by card bounds
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto(`${PREVIEW_URL}/admin/classes`, { waitUntil: 'networkidle' })
    await page.waitForSelector('h1:has-text("My Classes")', { timeout: 15000 })
    await page.waitForTimeout(300)
    await assertNoHorizontalOverflow(page, 'admin-classes-1440')

    // Check /admin/assignments/:id (SubmissionTracking) & View Work modal
    await page.goto(`${PREVIEW_URL}/admin/assignments/${GROUP_ASSIGNMENT_ID}`, { waitUntil: 'networkidle' })
    await page.waitForTimeout(600)
    for (const vp of [VIEWPORTS[1], VIEWPORTS[4], VIEWPORTS[6]]) {
      await page.setViewportSize({ width: vp.width, height: vp.height })
      await page.waitForTimeout(120)
      await assertNoHorizontalOverflow(page, `submission-tracking-${vp.name}`)
    }

    await page.setViewportSize({ width: 1440, height: 900 })
    const viewWorkBtn = page.locator('button:has-text("View Work")').first()
    if ((await viewWorkBtn.count()) > 0) {
      await viewWorkBtn.click()
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 })
      await page.waitForTimeout(200)
      await assertFullViewportModalGeometry(page, 'submitted-work-viewer-modal')
      await page.keyboard.press('Escape')
    }

    // Admin Logout
    await logout(page)

    assert.equal(pageErrors.length, 0, `Uncaught page errors: ${pageErrors.join(' | ')}`)
    assert.equal(consoleErrors.length, 0, `Console errors: ${consoleErrors.join(' | ')}`)

    console.log(
      JSON.stringify(
        {
          status: 'PASS',
          viewportsChecked: VIEWPORTS.map((v) => `${v.width}x${v.height}`),
          consoleErrors: consoleErrors.length,
          pageErrors: pageErrors.length,
        },
        null,
        2
      )
    )
  } finally {
    if (browser) await browser.close()
    preview.kill()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
