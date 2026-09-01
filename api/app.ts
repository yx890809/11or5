/**
 * This is a API server
 */

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import authRoutes from './routes/auth.js'
import lotteryRoutes from './routes/lottery.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// load env
dotenv.config()

const app: express.Application = express()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

/**
 * API Routes
 */
app.use('/api/auth', authRoutes)
app.use('/api/lottery', lotteryRoutes)

/**
 * health
 */
app.use(
  '/api/health',
  (req: Request, res: Response, next: NextFunction): void => {
    res.status(200).json({
      success: true,
      message: 'ok',
    })
  },
)

/**
 * 生产环境：serve Vite 构建的静态文件
 * 只有当 dist 目录存在时才启用（本地开发用 vite dev server）
 */
const distPath = path.resolve(__dirname, '..', 'dist')
if (existsSync(distPath)) {
  app.use(express.static(distPath))
  // SPA fallback：所有非 API 路由都返回 index.html
  app.get('*', (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith('/api/')) return next()
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

/**
 * error handler middleware
 */
app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
  res.status(500).json({
    success: false,
    error: 'Server internal error',
  })
})

/**
 * 404 handler（仅对 /api/ 路由）
 */
app.use((req: Request, res: Response) => {
  if (req.path.startsWith('/api/')) {
    res.status(404).json({
      success: false,
      error: 'API not found',
    })
  } else {
    res.status(404).send('Not Found')
  }
})

export default app
