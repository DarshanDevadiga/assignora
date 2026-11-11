import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

function readFile(relPath) {
  return fs.readFileSync(path.join(rootDir, relPath), 'utf8')
}

test('Global UI/UX Architecture — Portals, Z-Index Scale & Responsive Layouts', async (t) => {
  const modalSrc = readFile('src/components/common/Modal.jsx')
  const drawerSrc = readFile('src/components/common/NotificationsDrawer.jsx')
  const overlaySrc = readFile('src/utils/overlayManager.js')
  const layoutSrc = readFile('src/components/layout/DashboardLayout.jsx')
  const headerSrc = readFile('src/components/layout/Header.jsx')
  const sidebarSrc = readFile('src/components/layout/Sidebar.jsx')
  const mobileNavSrc = readFile('src/components/layout/MobileNav.jsx')
  const tailwindSrc = readFile('tailwind.config.js')
  const indexCssSrc = readFile('src/index.css')
  const joinModalSrc = readFile('src/components/class/JoinClassModal.jsx')
  const inviteModalSrc = readFile('src/components/class/InviteStudentModal.jsx')
  const classesMgmtSrc = readFile('src/pages/admin/ClassesManagement.jsx')
  const groupDetailsSrc = readFile('src/pages/shared/GroupDetailsPage.jsx')
  const joinPageSrc = readFile('src/pages/shared/JoinClassPage.jsx')

  await t.test('1.1 Modal renders via React Portal into document.body with full-viewport backdrop & scroll lock', () => {
    assert.ok(modalSrc.includes("createPortal("), 'Modal must render via createPortal')
    assert.ok(modalSrc.includes('document.body'), 'Modal portal target must be document.body')
    assert.ok(modalSrc.includes('z-modal'), 'Modal must use semantic z-modal token')
    assert.ok(modalSrc.includes('role="dialog"'), 'Modal must define ARIA role="dialog"')
    assert.ok(modalSrc.includes('aria-modal="true"'), 'Modal must define aria-modal="true"')
    assert.ok(modalSrc.includes('registerOverlay'), 'Modal must use shared stacked overlay manager')
    assert.ok(modalSrc.includes('MODAL_SIZE_MAP'), 'Modal must support size presets (sm/md/lg/xl/2xl/full)')
    assert.ok(modalSrc.includes('max-h-[calc(100dvh-2rem)]'), 'Modal must clamp height and scroll internally')
    assert.ok(!modalSrc.includes('sm:p-0'), 'Modal must preserve horizontal margins on all viewports')
  })

  await t.test('1.2 NotificationsDrawer renders via React Portal with z-drawer and shared overlay stack', () => {
    assert.ok(drawerSrc.includes('createPortal('), 'NotificationsDrawer must portal to document.body')
    assert.ok(drawerSrc.includes('z-drawer'), 'NotificationsDrawer must use semantic z-drawer token')
    assert.ok(drawerSrc.includes('registerOverlay'), 'NotificationsDrawer must use shared overlay manager')
    assert.ok(drawerSrc.includes('role="dialog"'), 'NotificationsDrawer must declare ARIA role="dialog"')
  })

  await t.test('1.3 Shared overlayManager handles stacked scroll locks & top-most Escape dismissal', () => {
    assert.ok(overlaySrc.includes('activeOverlayIds'), 'overlayManager must maintain open overlay stack')
    assert.ok(overlaySrc.includes("document.body.style.overflow = 'hidden'"), 'overlayManager must lock body scroll')
    assert.ok(overlaySrc.includes("event.key !== 'Escape'"), 'overlayManager must handle Escape for top overlay')
  })

  await t.test('1.4 Global design tokens & z-index scale prevent stacking-context collisions & transform traps', () => {
    assert.ok(tailwindSrc.includes("header: '20'"), 'tailwind.config.js must define z-header')
    assert.ok(tailwindSrc.includes("dropdown: '30'"), 'tailwind.config.js must define z-dropdown')
    assert.ok(tailwindSrc.includes("sidebar: '40'"), 'tailwind.config.js must define z-sidebar')
    assert.ok(tailwindSrc.includes("drawer: '50'"), 'tailwind.config.js must define z-drawer')
    assert.ok(tailwindSrc.includes("modal: '60'"), 'tailwind.config.js must define z-modal')
    assert.ok(tailwindSrc.includes("toast: '70'"), 'tailwind.config.js must define z-toast')
    assert.ok(tailwindSrc.includes("xs: '2px'"), 'tailwind.config.js must define backdropBlur.xs')
    assert.ok(!/\.page-enter\s*\{[^}]*forwards/s.test(indexCssSrc), '.page-enter must not retain forwards transform containing block')
  })

  await t.test('1.5 Dashboard shell (DashboardLayout, Header, Sidebar, MobileNav) enforces unified hierarchy', () => {
    assert.ok(layoutSrc.includes('overflow-x-clip'), 'DashboardLayout must prevent horizontal overflow while preserving sticky header')
    assert.ok(headerSrc.includes('z-header'), 'Header must use z-header')
    assert.ok(headerSrc.includes('z-dropdown'), 'Header profile dropdown must use z-dropdown')
    assert.ok(sidebarSrc.includes('z-sidebar'), 'Sidebar must use z-sidebar on mobile drawer')
    assert.ok(sidebarSrc.includes('registerOverlay'), 'Mobile Sidebar drawer must close on Escape via overlayManager')
    assert.ok(mobileNavSrc.includes('z-header'), 'MobileNav must sit below drawers and modals')
  })

  await t.test('1.6 JoinClassModal, InviteStudentModal, ClassesManagement & Class/Group pages follow responsive consistency', () => {
    assert.ok(joinModalSrc.includes('flex-col-reverse sm:flex-row'), 'JoinClassModal footers must stack cleanly on mobile')
    assert.ok(inviteModalSrc.includes('flex-col sm:flex-row'), 'InviteStudentModal code & link rows must adapt cleanly on mobile')
    assert.ok(!classesMgmtSrc.includes('overflow-hidden cursor-pointer flex flex-col justify-between'), 'ClassesManagement cards must not clip their 3-dot dropdown menus')
    assert.ok(!groupDetailsSrc.includes('max-w-6xl mx-auto p-4 sm:p-6 page-enter'), 'GroupDetailsPage must align with DashboardLayout max-w-7xl width')
    assert.ok(!joinPageSrc.includes('bg-brand-appBg'), 'JoinClassPage must use valid bg-brand-bg color token')
  })
})
