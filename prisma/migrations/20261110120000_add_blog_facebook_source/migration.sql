-- AlterTable
ALTER TABLE "blog_posts" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "blog_posts" ADD COLUMN "sourceUrl" TEXT;
ALTER TABLE "blog_posts" ADD COLUMN "facebookPostId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "blog_posts_facebookPostId_key" ON "blog_posts"("facebookPostId");
