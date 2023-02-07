import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import fastify from 'fastify'
dotenv.config()

const app = fastify()
app.register(cors, {
  origin: process.env.CLIENT_URL,
  credentials: true,
})
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

app.get('/posts/:id', async (req, res) => {
  return await commitToDb(
    prisma.post.findUnique({
      where: { id: req.params.id },
      select: {
        body: true,
        title: true,
        comments: {
          orderBy: {
            createdAt: 'desc',
          },
          select: {
            id: true,
            message: true,
            parentId: true,
            createdAt: true,
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
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
