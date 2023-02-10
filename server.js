import cookie from '@fastify/cookie'
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
app.register(cookie, {
  secret: process.env.COOKIE_SECRET,
})
app.addHook('onRequest', (req, res, done) => {
  if (req.cookies.userId !== CURRENT_USER_ID) {
    req.cookies.userId = CURRENT_USER_ID
    res.clearCookie('userId')
    res.setCookie('userId', CURRENT_USER_ID)
  }
  done()
  // -> fake that we are logged in
})
const prisma = new PrismaClient()
const CURRENT_USER_ID = (
  await prisma.user.findFirst({
    where: { name: 'Kyle' },
  })
).id
// console.log('CURRENT_USER_ID', CURRENT_USER_ID)
// CURRENT_USER_ID a22cafa5-5a53-4ddf-ab0b-1cf5decdf48c

const COMMENT_SELECT_FIELDS = {
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
}

app.get('/posts', async (req, res) => {
  // return await prisma.post.findMany({
  //    select: {
  //      id: true,
  //      title: true,
  //    },
  // })
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
          select: COMMENT_SELECT_FIELDS,
          // select: {
          //   id: true,
          //   message: true,
          //   parentId: true,
          //   createdAt: true,
          //   user: {
          //     select: {
          //       id: true,
          //       name: true,
          //     },
          //   },
          // },
        },
      },
    })
  )
})

app.post('/posts/:id/comments', async (req, res) => {
  console.log('body msg?:', req.body.message)
  if (req.body.message === '' || req.body.message === null) {
    return res.send(app.httpErrors.badRequest('Message is required'))
  }

  return await commitToDb(
    prisma.comment.create({
      data: {
        message: req.body.message,
        userId: req.cookies.userId,
        parentId: req.body.parentId,
        postId: req.params.id,
      },
      select: COMMENT_SELECT_FIELDS,
    })
  )
})

// app.patch('/posts/:postId/comments/:commentId', async (req, res) => {
app.put('/posts/:postId/comments/:commentId', async (req, res) => {
  console.log('update comment')
  if (req.body.message === '' || req.body.message === null) {
    return res.send(app.httpErrors.badRequest('Message is required'))
  }
  // get userId from comment in DB
  const { userId } = await prisma.comment.findUnique({
    where: { id: req.params.commentId },
    select: { userId: true },
  })
  if (userId !== req.cookies.userId) {
    return res.send(
      app.httpErrors.unauthorized('You do not have permission to edit this message')
    )
  }

  return await commitToDb(
    prisma.comment.update({
      where: { id: req.params.commentId },
      data: { message: req.body.message },
      select: { message: true },
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
