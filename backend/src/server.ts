import dotenv from 'dotenv'
import app from './app'
import { connectDatabase, prisma } from './config/db'

dotenv.config()

const port = Number(process.env.PORT || 5000)

async function bootstrap() {
  await connectDatabase()
  app.listen(port, () => {
    console.log(`Annapurna API server running on http://localhost:${port}`)
  })
}

bootstrap().catch((error) => {
  console.error('Failed to start server', error)
  process.exit(1)
})

process.on('SIGINT', async () => {
  await prisma.$disconnect()
  process.exit(0)
})
