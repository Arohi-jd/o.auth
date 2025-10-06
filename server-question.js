// Single-file Express backend
// Usage:
//   npm init -y
//   npm i express cookie-parser jsonwebtoken bcryptjs
//   node server.js
//
// Then open: http://localhost:4000

const express = require('express')
const path = require('path')
// TODO: what more do we need to require?
const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')


const app = express()
const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret_change_me'
const isProd = process.env.NODE_ENV === 'production'

// Middleware
app.use(express.json())
app.use(cookieParser())

// Serve the single HTML file from the same folder (keeps same-origin; no CORS headaches)
app.use(express.static(__dirname, { extensions: ['html'] }))

// In-memory user "database" for workshop purposes
// Structure: { email: { name, email, passwordHash, createdAt } }
const users = {}

// Helper: sign a JWT and set as HTTP-only cookie
const setAuthCookie = (res, payload) => {
  const token = jwt.sign(payload, JWT_SECRET,{ expiresIn: '7d' })
  res.cookie('token', token, {
    httpOnly:true,
    secure:isProd,
    sameSite:'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7days
  })
}


// Auth guard
const requireAuth = (req, res, next) => {
  const token = req.cookies.token
  if (!token) return res.status(401).json({ ok: false, error: 'Not authenticated' })
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user =decoded
    next()
  } catch (err) {
    return res.status(401).json({ ok: false, error: 'Invalid token' })
  }
}


// Routes
app.post('/api/signup', async (req, res) => {
  try {
    const { name, email, password } = req.body || {}
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ ok: false, error: 'name, email, password are required' })
    }
    if (password.length < 6) {
      return res
        .status(400)
        .json({ ok: false, error: 'Password must be at least 6 characters' })
    }
    const key = String(email).toLowerCase().trim()
    if (users[key]) {
      return res
        .status(409)
        .json({ ok: false, error: 'Email already registered' })
    }

    // TODO: hash password
    const passwordHash =await bcrypt.hash(password, 10)
 // <-- hash this

    users[key] = {
      name: name.trim(),
      email: key,
      passwordHash,
      createdAt: new Date().toISOString(),
    }

    // TODO: something needs to be done here
      setAuthCookie(res, { email: key})
    return res.json({ ok: true, user: { name: users[key].name, email: key } })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ ok: false, error: 'Server error' })
  }
})

app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body || {}
    if (!email || !password) {
      return res
        .status(400)
        .json({ ok: false, error: 'email and password are required' })
    }
    const key = String(email).toLowerCase().trim()
    const user = users[key]
    if (!user) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' })
    }

    // TODO: validate password
    const valid= await bcrypt.compare(password,user.passwordHash)
 // <-- check this

    if (!valid) {
      return res.status(401).json({ ok: false, error: 'Invalid credentials' })
    }

    // TODO: something needs to be done here
     setAuthCookie(res, { email: key})

    return res.json({ ok: true, user: { name: user.name, email: key } })
  } catch (e) {
    console.error(e)
    return res.status(500).json({ ok: false, error: 'Server error' })
  }
})

app.get('/api/me', requireAuth, (req, res) => {
  const key=req.user.email // TODO: where do we get this from?
  const user = users[key]
  if (!user) return res.status(401).json({ ok: false, error: 'User not found' })
  return res.json({ ok: true, user: { name: user.name, email: user.email } })
})

app.post('/api/logout', (req, res) => {
  res.clearCookie('token',{
  httpOnly:true,
  secure:isProd,
  sameSite:'lax',
})
  return res.json({ ok: true, message: 'Logged out' })
})

// Fallback to index.html for root
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'))
})

app.listen(PORT, () => {
  console.log(`server running on http://localhost:${PORT}`)
})
