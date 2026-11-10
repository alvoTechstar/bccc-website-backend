/**
 * Seed starter blog posts so the Blog + Latest Updates sections have content.
 *
 * Usage:
 *   npm run seed            # inserts only when blog_posts is empty
 *   npm run seed -- --force  # wipes blog_posts and re-seeds (tsx passes args through)
 *
 * Requires DATABASE_URL in .env
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type SeedPost = {
  title: string;
  content: string;
  excerpt: string;
  category: string;
  author: string;
  imageUrl: string;
};

const posts: SeedPost[] = [
  {
    title: "Dominion Summit 2026: Five Days That Set Our Year",
    excerpt:
      "7th–11th December at Mawanga Kwa Buda — join Bishop JB Tajeu and the BCC family as the word for 2027 is proclaimed.",
    category: "Church Development",
    author: "Bishop JB Tajeu",
    imageUrl: "/photos/dominion-summit-2026.jpg",
    content: `Every December, Beautiful Courts Christian Church gathers for the Dominion Summit — our 19th annual convention and the most important week of our church calendar.

For five glorious days, from the 7th to the 11th of December 2026, we will fill the Mawanga Kwa Buda grounds with worship, the Word, and fellowship. Convened by Bishop JB Tajeu, this year's summit carries a special weight: the theme for the entire year 2027 will be proclaimed here.

In our house, the summit is not just another conference. The word released during these five days becomes the lens for every sermon, every fast, and every outreach for the twelve months that follow. Come expecting direction for your family, your business, and your calling.

Morning Glory sessions begin at dawn, evening celebrations run late into the night, and intercessors cover every hour in between. Accommodation guidance is available for visitors travelling from Narok and beyond — reach out through our contact page and our team will host you.

Mark the dates. Invite a friend. And come ready — dominion belongs to the saints.`,
  },
  {
    title: "21 Days of Ascend: Prayer 'n Fasting (Nov 9–29)",
    excerpt:
      "Morning Glory 5:45 AM, Evening Prayers 5 PM, Midnight 11 PM–12 AM. Fasting 6AM–6PM daily at the church grounds.",
    category: "Spiritual Growth",
    author: "Bishop JB Tajeu",
    imageUrl: "/photos/ascend-fasting-2026.jpg",
    content: `Before the year closes, we climb. From the 9th to the 29th of November 2026, the BCC family sets apart twenty-one days of prayer and fasting under the banner of ASCEND.

The fast runs daily from 6AM to 6PM, and the altar never goes quiet: Morning Glory at 5:45 AM, Evening Prayers at 5:00 PM, and Midnight Prayers from 11 PM to midnight — all at the Mawanga, Kwa Buda church grounds.

Fasting is not a hunger strike; it is a tuning of the spirit. As we deny the flesh, heaven leans closer. Come with a written list: your family, your health, your business, your children, and the 2027 theme that will be unveiled at the Dominion Summit.

You do not need to be a member to join. Dress warmly for the midnight hour, bring your Bible and a notebook, and ascend with us.`,
  },
  {
    title: "Welcome Home: What to Expect on Your First Sunday",
    excerpt:
      "Service times, kids check-in, what to wear, and why nobody will embarrass you — your first visit, demystified.",
    category: "Community Outreach",
    author: "BCC Media Team",
    imageUrl: "/photos/congregation.jpg",
    content: `Visiting a new church can feel like walking into someone else's family reunion. At BCC, we work hard to make your first Sunday feel like a homecoming instead.

Two services run every Sunday, at 8:30 AM and 10:30 AM. Arrive fifteen minutes early and look for the Welcome Tent — our hosts will help you find a seat, check your children into BCC Kids Church, and answer every question you have.

What should you wear? Whatever honours God and keeps you comfortable. You will see suits, lesos, jeans, and everything in between. What about your children? They are safe with us — vetted volunteers, fun lessons, and crafts in our kids church.

And here is our promise: we will not single you out, ask you to stand, or pressure you to give. Explore at your own pace. When you are ready, our pastors would love to meet you after the service.`,
  },
  {
    title: "Raising Kingdom Champions in Business and Family",
    excerpt:
      "Faith was never meant to stay inside the sanctuary walls. How BCC equips believers for Monday as well as Sunday.",
    category: "Leadership Training",
    author: "Bishop JB Tajeu",
    imageUrl: "/photos/bishop-jb-tajeu.jpg",
    content: `Our confession is simple: we are raising Kingdom Champions — men and women who carry God into business, family, education, and public life.

Too many believers live double lives: fiery on Sunday, fearful on Monday. But the same Holy Spirit who falls in our services goes with you to the shop, the farm, the office, and the classroom. Excellence is a ministry. Integrity is a sermon. A well-run business that employs people justly preaches louder than a thousand posters.

This is why our discipleship Ministry pairs every new believer with a mentor, why our youth learn leadership alongside Scripture, and why our sermons always land with a Monday application.

Ask yourself this week: if your colleagues followed you for a day, would they meet Jesus? If the answer troubles you, good — that is where growth begins. Join a Bible study group on Wednesdays and let us build with you.`,
  },
  {
    title: "The Coming Sanctuary: Building for the Next Generation",
    excerpt:
      "A 1,000-seat sanctuary is rising at our headquarters. Here is the vision, the progress, and how you can cement your name in it.",
    category: "Church Development",
    author: "BCC Media Team",
    imageUrl: "/photos/sanctuary-render.jpg",
    content: `Every generation must leave the next one a place to meet God. Our coming sanctuary — a 1,000-seat house of worship at our Mawanga headquarters — is that inheritance.

The vision is already on paper: a soaring glass-front sanctuary beside a multi-storey ministry complex with training halls, offices, and rooms for our children and youth. What you see in the artist's impression is not a dream — foundations of faith are already laid, and the building rises course by course as the Lord provides.

Seventy-five percent of the journey is complete, and the final stretch belongs to all of us. Through the Building Fund, every shilling goes directly into cement, steel, and roofing. M-Pesa Pay Bill 522522, Account BCC CHURCH — or speak to the building committee after any Sunday service for a full financial report.

One day your grandchildren will worship under that roof. Help us finish it.`,
  },
];

async function main() {
  const force = process.argv.includes("--force");

  const count = await prisma.blogPost.count();
  if (count > 0 && !force) {
    console.log(
      `blog_posts already has ${count} post(s). Nothing to do. Use --force to re-seed.`
    );
    return;
  }

  if (force && count > 0) {
    await prisma.blogPost.deleteMany({});
    console.log(`Cleared ${count} existing post(s).`);
  }

  const result = await prisma.blogPost.createMany({ data: posts });
  console.log(`Seeded ${result.count} blog post(s):`);
  for (const p of posts) console.log(` - [${p.category}] ${p.title}`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
