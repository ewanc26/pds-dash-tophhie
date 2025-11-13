<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/4.7.0/css/font-awesome.min.css">

<script lang="ts">
  import PostComponent from "./lib/PostComponent.svelte";
  import AccountComponent from "./lib/AccountComponent.svelte";
  import InfiniteLoading from "svelte-infinite-loading";
  import { getNextPosts, Post, getAllMetadataFromPds, fetchPostsForUser } from "./lib/pdsfetch";
  import { getContributors, getHeatmapData } from "./lib/tcapifetch"
  import { Config } from "../config";
  import { onMount } from "svelte";
  import type { ComAtprotoRepoListRecords } from "@atcute/client/lexicons";
  import Heatmap from "svelte5-heatmap";
  import ContributorsModal from "./lib/ContributorsModal.svelte";

  let showModal = false;
  
  let posts: Post[] = [];
  let postsLoaded = false;

  let heatmapData: Record<string, number> = {};
  let year = new Date().getFullYear();
  let accountsData: any[] = [];
  let accountsError: Error | null = null;
  let accountsLoaded = false;

  let contributors: any[] = [];

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

    try {
      heatmapData = await getHeatmapData()
    } catch (error) {
      console.error("Error fetching heatmap data:", error);
    }

    try {
      contributors = await getContributors();
    } catch (error) {
      console.error("Error fetching contributors:", error)
    }
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
        <p>
          {@html Config.FOOTER_TEXT}
          <br />
          Thank you also to our <a href="/#" onclick={() => (showModal = true)}>contributors!</a>
        </p>
      </div>
    {/if}

    <div id="Feed">
      {#if heatmapData}
        <div id="postContainer" style="padding:20px;">
          <a style={window.innerWidth <= 768 ? "padding-bottom: 10px" : ""}>Tophhie Social Posts</a>
          <Heatmap data={heatmapData} {year} lday={false} lmonth={window.innerWidth >= 768} />
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
  <ContributorsModal bind:showModal>
    {#snippet header()}
      <p id="Header" style="font-size:20px; padding: 10px;">
        Thank you to everyone who has contributed to the Tophhie Social dashboard!
      </p>
    {/snippet}

    <ul class="contributor-list">
      {#each contributors as contributor}
        <li>
          {#if contributor.avatar_url}
            <img
              alt="Avatar of {contributor.login}"
              src="{contributor.avatar_url}"
              id="avatar"
            />
          {/if}
          <p>{contributor.login} • {contributor.contributions} contributions</p>
          <a href="https://github.com/{contributor.login}"><i class="fa fa-brands fa-github" style="font-size: 20px"></i></a>
        </li>
      {/each}
    </ul>
  </ContributorsModal>
</main>

<style>
</style>
