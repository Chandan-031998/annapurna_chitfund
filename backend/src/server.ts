import dotenv from 'dotenv'
import app from './app'
import { closeDatabase } from './config/db'

dotenv.config()

const port = Number(process.env.PORT || 5000)

async function bootstrap() {
  app.listen(port, () => {
    console.log(`Annapurna API server running on http://localhost:${port}`)
  })
}

process.on('SIGINT', async () => {
  await closeDatabase()
  process.exit(0)
})

if (!process.env.VERCEL) {
  bootstrap().catch((error) => {
    console.error('Failed to start server', error)
    process.exit(1)
  })
}

export default app
