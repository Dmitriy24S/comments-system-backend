import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function seed() {
  console.log('seed start?')
  await prisma.post.deleteMany()
  await prisma.user.deleteMany()
  const kyle = await prisma.user.create({ data: { name: 'Kyle' } })
  const sally = await prisma.user.create({ data: { name: 'Sally' } })

  const post1 = await prisma.post.create({
    data: {
      body: 'Lorem ipsum dolor sit, amet consectetur adipisicing elit. Nam, est quos ullam earum porro saepe impedit quisquam magnam inventore perspiciatis voluptatem commodi sapiente repellendus animi?',
      title: 'Post1',
    },
  })

  const post2 = await prisma.post.create({
    data: {
      body: 'Lorem ipsum dolor sit, amet consectetur adipisicing elit. Nam, est quos ullam earum porro saepe impedit quisquam magnam inventore perspiciatis voluptatem commodi sapiente repellendus animi?',
      title: 'Post2',
    },
  })

  const comment1 = await prisma.comment.create({
    data: {
      message: 'I am a root comment',
      userId: kyle.id,
      postId: post1.id,
    },
  })

  const comment2 = await prisma.comment.create({
    data: {
      parentId: comment1.id,
      message: 'I am a nested comment',
      userId: sally.id,
      postId: post1.id,
    },
  })

  const comment3 = await prisma.comment.create({
    data: {
      message: 'I am anoter root comment',
      userId: sally.id,
      postId: post1.id,
    },
  })
}

seed()
