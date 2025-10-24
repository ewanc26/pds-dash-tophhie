
<script lang="ts">
  import PostComponent from "./lib/PostComponent.svelte";
  import AccountComponent from "./lib/AccountComponent.svelte";
  import InfiniteLoading from "svelte-infinite-loading";
  import { getNextPosts, Post, getAllMetadataFromPds, fetchPostsForUser } from "./lib/pdsfetch";
  import { Config } from "../config";
  import { onMount } from "svelte";
  import type { ComAtprotoRepoListRecords } from "@atcute/client/lexicons";
  import Heatmap from "svelte5-heatmap";

  
  let posts: Post[] = [];
  let postsLoaded = false;

  let heatmapData: Record<string, number> = {};
  let year = new Date().getFullYear();
  let accountsData: any[] = [];
  let accountsError: Error | null = null;
  let accountsLoaded = false;

  let hue: number = 1;
  const cycleColors = async () => {
    while (true) {
      hue += 1;
      if (hue > 360) {
        hue = 0;
      }
      document.documentElement.style.setProperty("--primary-h", hue.toString());
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  };

  let clickCounter = 0;
  const carameldansenfusion = async () => {
    clickCounter++;
    if (clickCounter >= 10) {
      clickCounter = 0;
      cycleColors();
    }
  };

  function groupPostsByDate(posts: ComAtprotoRepoListRecords.Record[]): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const post of posts) {
      const value = post.value as any;
      if (value && typeof value.createdAt === "string") {
        const date = new Date(value.createdAt);
        if (!isNaN(date.getTime())) {
          const dayKey = date.toISOString().split("T")[0];
          counts[dayKey] = (counts[dayKey] || 0) + 1;
        }
      }
    }
    console.log("Grouped post counts (object):", counts);
    return counts;
  }

  onMount(async () => {
    try {
      accountsData = await getAllMetadataFromPds();
      accountsLoaded = true;
    } catch (error: unknown) {
      if (error instanceof Error) {
        accountsError = error;
      } else {
        accountsError = new Error(String(error));
      }
    }

    const initialPosts = await getNextPosts();
    posts = [...posts, ...initialPosts];
    postsLoaded = true;

    const allPosts: ComAtprotoRepoListRecords.Record[] = [];
    for (const account of accountsData) {
      let cursor: string | null = null;
      let userPosts: ComAtprotoRepoListRecords.Record[] = [];
      do {
        const { records, cursor: nextCursor } = await fetchPostsForUser(account.did, cursor);
        userPosts.push(...records);
        cursor = nextCursor;
      } while (cursor);
      allPosts.push(...userPosts);
    }
    console.log("Posts for heatmap:", allPosts);
    heatmapData = groupPostsByDate(allPosts);
    console.log("Heatmap Data:", heatmapData);
  });


  const onInfinite = ({
    detail: { loaded, complete },
  }: {
    detail: { loaded: () => void; complete: () => void };
  }) => {
    if (!postsLoaded) {
      console.warn("Infinite scroll triggered before initial posts loaded.");
      return;
    }

    getNextPosts().then((newPosts) => {
      if (newPosts.length > 0) {
        posts = [...posts, ...newPosts];
        loaded();
      } else {
        complete();
      }
    });
  };

</script>

<main>
  <div id="Content">
    {#if !accountsLoaded && !accountsError}
      <p>Loading...</p>
    {:else if accountsError}
      <p>Error: {accountsError.message}</p>
    {:else}
      <div id="Account">
        <div>
          <img src="https://blob.tophhie.cloud/tophhiecloud-resources/Logos/tophhiecloud-colour.png" height=50 alt="Tophhie Social Logo" id="Logo" style="padding:20px" />
          <h1 onclick={carameldansenfusion} id="Header">Tophhie Social</h1>
          <p style="font-weight:bold;">Home to {accountsData.length} accounts/repos 🎉</p>
        </div>
        <div style="margin-bottom:20px;">
          <p>Want to join us?<br /><a href="https://signup.tophhie.social">Sign up now!</a></p>
          <p>Already on Bluesky?<br /><a href="https://migrate.tophhie.social">Migrate your account now!</a></p>
          <p>Join the Tophhie Social Community!<br /><a href="https://aka.tophhie.cloud/socialcommunitysignup">Join today!</a></p>
        </div>
        <div id="accountsList">
          {#each accountsData as accountObject}
            <AccountComponent account={accountObject} />
          {/each}
        </div>
        <p>{@html Config.FOOTER_TEXT}</p>
      </div>
    {/if}

    <div id="Feed">
      {#if heatmapData}
        <div id="postContainer" style="padding:20px;">
          <a>Tophhie Social Posts</a>
          <Heatmap data={heatmapData} {year} lday={false} />
        </div>
      {/if}
      {#if accountsLoaded}
        <AccountComponent account={accountsData[accountsData.length - 1]} welcome />
      {/if}
      {#each posts as postObject}
        <PostComponent post={postObject as Post} />
      {/each}
      <InfiniteLoading on:infinite={onInfinite} distance={3000} />
    </div>
  </div>
</main>

<style>
</style>
