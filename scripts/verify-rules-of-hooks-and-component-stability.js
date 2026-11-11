import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

describe('ZERO-RUNTIME-ERROR STABILIZATION: React Rules of Hooks Audit', () => {
  const adPath = path.resolve('src/pages/student/AssignmentDetails.jsx')
  const adContent = fs.readFileSync(adPath, 'utf8')

  const caPath = path.resolve('src/pages/admin/CreateAssignment.jsx')
  const caContent = fs.readFileSync(caPath, 'utf8')

  test('1.1 AssignmentDetails declares backNavigation before any early return', () => {
    const lines = adContent.split('\n')
    let backNavLine = -1
    let firstEarlyReturnLine = -1

    lines.forEach((l, idx) => {
      if (l.includes('const backNavigation = useMemo(') && backNavLine === -1) {
        backNavLine = idx + 1
      }
      if (/if\s*\((loading|!assignment)\)/.test(l) && firstEarlyReturnLine === -1) {
        firstEarlyReturnLine = idx + 1
      }
    })

    assert.ok(backNavLine > 0, 'backNavigation useMemo must be declared')
    assert.ok(firstEarlyReturnLine > 0, 'Early returns must exist')
    assert.ok(
      backNavLine < firstEarlyReturnLine,
      `backNavigation hook (line ${backNavLine}) must be declared before any early return (line ${firstEarlyReturnLine})`
    )
  })

  test('1.2 AssignmentDetails contains zero hooks after the loading or missing assignment returns', () => {
    const lines = adContent.split('\n')
    let passedLoadingReturn = false
    const hookRegex = /\b(useState|useEffect|useMemo|useCallback|useRef|useContext)\s*\(/

    lines.forEach((l, idx) => {
      if (/if\s*\((loading|!assignment)\)/.test(l)) {
        passedLoadingReturn = true
      }
      if (passedLoadingReturn && hookRegex.test(l)) {
        assert.fail(`Found hook after early return on line ${idx + 1}: ${l.trim()}`)
      }
    })
  })

  test('1.3 CreateAssignment declares backNavigation before the initialLoading early return', () => {
    const lines = caContent.split('\n')
    let backNavLine = -1
    let initialLoadingReturnLine = -1

    lines.forEach((l, idx) => {
      if (l.includes('const backNavigation = useMemo(') && backNavLine === -1) {
        backNavLine = idx + 1
      }
      if (/if\s*\(initialLoading\)/.test(l) && initialLoadingReturnLine === -1) {
        initialLoadingReturnLine = idx + 1
      }
    })

    assert.ok(backNavLine > 0, 'backNavigation useMemo must be declared')
    assert.ok(initialLoadingReturnLine > 0, 'initialLoading return must exist')
    assert.ok(
      backNavLine < initialLoadingReturnLine,
      `CreateAssignment backNavigation (line ${backNavLine}) must be declared before initialLoading early return (line ${initialLoadingReturnLine})`
    )
  })

  test('1.4 ESLint validates 0 rules-of-hooks errors across all 65 source files', () => {
    try {
      const output = execSync('npx eslint src --ext .js,.jsx -f json', { encoding: 'utf8' })
      const reports = JSON.parse(output)
      const hookErrors = []
      reports.forEach((r) => {
        r.messages.forEach((m) => {
          if (m.ruleId === 'react-hooks/rules-of-hooks') {
            hookErrors.push(`${r.filePath}:${m.line} ${m.message}`)
          }
        })
      })
      assert.equal(hookErrors.length, 0, `Expected 0 rules-of-hooks errors, found: ${hookErrors.join(', ')}`)
    } catch (e) {
      if (e.stdout) {
        const reports = JSON.parse(e.stdout)
        const hookErrors = []
        reports.forEach((r) => {
          r.messages.forEach((m) => {
            if (m.ruleId === 'react-hooks/rules-of-hooks') {
              hookErrors.push(`${r.filePath}:${m.line} ${m.message}`)
            }
          })
        })
        assert.equal(hookErrors.length, 0, `Expected 0 rules-of-hooks errors, found: ${hookErrors.join(', ')}`)
      } else {
        throw e
      }
    }
  })

  test('1.5 All package scripts include npm run lint and build', () => {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'))
    assert.ok(pkg.scripts.lint, 'package.json must contain "lint" script')
    assert.ok(pkg.scripts.build, 'package.json must contain "build" script')
  })
})
