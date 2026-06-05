import { getAllPosts } from "@/lib/blog";
import LinksClient from "./LinksClient";

export const metadata = {
  title: "Kuya Ken — Links",
  description: "Meta Ads and full funnel builder for Philippine businesses. Connect with Kuya Ken.",
  alternates: { canonical: "/links" }
};

export default function LinksPage() {
  const posts = getAllPosts().slice(0, 5);
  return <LinksClient posts={posts} />;
}
