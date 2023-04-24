import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import { PrismaClient } from '@prisma/client'
import dotenv from 'dotenv'
import fastify from 'fastify'
dotenv.config()

// const app = fastify()
const app = fastify({ trustProxy: true, sameSite: 'none', secure: true })
app.register(cors, {
  origin: process.env.CLIENT_URL,
  credentials: true,
  // credentials: false,
  sameSite: 'none',
  secure: true,
})
app.register(sensible)
app.register(cookie, {
  secret: process.env.COOKIE_SECRET,
  // SameSite: None,
  sameSite: 'none',
  secure: true,
})
app.addHook('onRequest', (req, res, done) => {
  if (req.cookies.userId !== CURRENT_USER_ID) {
    req.cookies.userId = CURRENT_USER_ID
    res.clearCookie('userId', { sameSite: 'none' })
    res.setCookie('userId', CURRENT_USER_ID, {
      sameSite: 'none', // ! no?
      // sameSite: 'lax',
      secure: true,
    })
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
// )?.id
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

// Get/show all posts
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

// Get/show single post info with comments, etc.
app.get('/posts/:id', async (req, res) => {
  return await commitToDb(
    prisma.post
      .findUnique({
        where: { id: req.params.id },
        select: {
          body: true,
          title: true,
          comments: {
            orderBy: {
              createdAt: 'desc',
            },
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
            // select: COMMENT_SELECT_FIELDS,
            select: {
              ...COMMENT_SELECT_FIELDS,
              _count: {
                select: {
                  likes: true,
                },
              },
            },
          },
        },
      })
      .then(async (post) => {
        // console.log('post', post)
        // get logged in users likes/liked comments from current post
        const likes = await prisma.like.findMany({
          where: {
            userId: req.cookies.userId,
            commentId: { in: post.comments.map((comment) => comment.id) },
          },
        })
        // console.log('likes', likes)
        // likes [
        //   {
        //     userId: 'a22cafa5-5a53-4ddf-ab0b-1cf5decdf48c',
        //     commentId: '61910d17-b615-429c-add5-24228865a0da'
        //   },
        //   {
        //     userId: 'a22cafa5-5a53-4ddf-ab0b-1cf5decdf48c',
        //     commentId: '3dcb0391-c0e9-4806-aa73-4454b019b987'
        //   }
        // ]

        const postData = {
          ...post,
          // add 2 extra fields to posts comments object for likes info
          comments: post.comments.map((comment) => {
            const { _count, ...commentFields } = comment
            // console.log('_count', _count)
            // _count { likes: 1 }

            // console.log('commentFields', commentFields)
            // commentFields {
            //   id: '3dcb0391-c0e9-4806-aa73-4454b019b987',
            //   message: 'test1',
            //   parentId: null,
            //   createdAt: 2023-02-07T13:20:41.330Z,
            //   user: { id: 'a22cafa5-5a53-4ddf-ab0b-1cf5decdf48c', name: 'Kyle' }
            // }

            return {
              // normal old post info
              ...commentFields,
              // 2 additional fields for likes info
              likedByMe: likes.find((like) => like.commentId === comment.id),
              likeCount: _count.likes,
            }
          }),
        }
        // console.log('postData', postData)
        // {
        //   id: '626b37de-5543-4268-b815-b573d6d83f1c',
        //   message: 'reply1',
        //   parentId: '3dcb0391-c0e9-4806-aa73-4454b019b987',
        //   createdAt: 2023-02-08T10:28:12.638Z,
        //   user: [Object],
        //   likedByMe: undefined,
        //   likeCount: 0
        // },
        // {
        //   id: '61910d17-b615-429c-add5-24228865a0da',
        //   message: 'test2 w/ edit',
        //   parentId: null,
        //   createdAt: 2023-02-07T15:27:56.064Z,
        //   user: [Object],
        //   likedByMe: undefined,
        //   likeCount: 0
        // },

        return postData
        // return {
        //   ...post,
        //   comments: post.comments.map((comment) => {
        //     const { _count, ...commentFields } = comment
        //     return {
        //       ...commentFields,
        //       likedByMe: likes.find((like) => like.commentId === comment.id),
        //       likeCount: _count.likes,
        //     }
        //   }),
        // }
      })
  )
})

// Create comment
app.post('/posts/:id/comments', async (req, res) => {
  console.log('body msg?:', req.body.message)
  if (req.body.message === '' || req.body.message === null) {
    return res.send(app.httpErrors.badRequest('Message is required'))
  }

  return await commitToDb(
    prisma.comment
      .create({
        data: {
          message: req.body.message,
          userId: req.cookies.userId,
          parentId: req.body.parentId,
          postId: req.params.id,
        },
        select: COMMENT_SELECT_FIELDS,
      })
      .then((comment) => {
        // return/create comment + with 0 likes and initially not liked
        return {
          ...comment,
          likeCount: 0,
          likedByMe: false,
        }
      })
  )
})

// Edit comment
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

// Delete comment
app.delete('/posts/:postId/comments/:commentId', async (req, res) => {
  console.log('delete comment')

  // get user id and compare it with logged in cookie
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
    prisma.comment.delete({
      where: { id: req.params.commentId },
      select: { id: true }, // returns the ID of the deleted comment
    })
  )
})

// Like comment
app.post('/posts/:postId/comments/:commentId/toggleLike', async (req, res) => {
  console.log('like comment')

  const data = {
    commentId: req.params.commentId,
    userId: req.cookies.userId,
  }
  // console.log('like comment data:', data)
  // like comment data: {
  //   commentId: '61910d17-b615-429c-add5-24228865a0da',
  //   userId: 'a22cafa5-5a53-4ddf-ab0b-1cf5decdf48c'
  // }
  const like = await prisma.like.findUnique({
    where: { userId_commentId: data },
  })
  // console.log('like comment like:', like)
  // like comment like: null

  if (like === null) {
    return await commitToDb(prisma.like.create({ data })).then(() => {
      console.log('like comment')
      return { addLike: true }
    })
  } else {
    return await commitToDb(
      prisma.like.delete({
        where: {
          userId_commentId: data,
        },
      })
    ).then(() => {
      console.log('unlike comment')
      return {
        addLike: false,
      }
    })
  }
})

// Helper functions
// Handle the result of a promise, return either the data or an HTTP error
async function commitToDb(promise) {
  // const { error, data } = await app.to(promise)
  const [error, data] = await app.to(promise)
  if (error) return app.httpErrors.internalServerError(error.message) // 500 error server error
  return data
}

// Start server
app.listen({ port: process.env.PORT || 3000 })
