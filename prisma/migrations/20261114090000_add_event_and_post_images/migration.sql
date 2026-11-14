-- Multiple uploaded images per blog post (first doubles as cover)
ALTER TABLE "blog_posts" ADD COLUMN "images" TEXT[] NOT NULL DEFAULT '{}';

-- Events managed from the admin console (replaces frontend localStorage)
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "time" TEXT,
    "venue" TEXT,
    "category" TEXT NOT NULL DEFAULT 'General',
    "imageUrl" TEXT,
    "images" TEXT[] NOT NULL DEFAULT '{}',
    "published" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);
