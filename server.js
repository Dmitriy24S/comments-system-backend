import sensible from '@fastify/sensible'
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import fastify from 'fastify'
dotenv.config()

const app = fastify()
app.register(sensible)
const prisma = new PrismaClient()

app.get('/posts', async (req, res) => {
  //   return await prisma.post.findMany({
  //     select: {
  //       id: true,
  //       title: true,
  //     },
  //   })

  return await commitToDb(
    prisma.post.findMany({
      select: {
        id: true,
        title: true,
      },
    })
  )
})

async function commitToDb(promise) {
  // const { error, data } = await app.to(promise)
  const [error, data] = await app.to(promise)
  if (error) return app.httpErrors.internalServerError(error.message) // 500 error server error
  return data
}

app.listen({ port: process.env.PORT })
