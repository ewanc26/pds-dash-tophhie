<script lang="ts">
  import { Post } from "./pdsfetch";
  import { Config } from "../../config";
  import { onMount } from "svelte";
  import moment from "moment";
  import type { AppBskyFeedPost, AppBskyRichtextFacet } from "@atcute/client/lexicons";

  let { post }: { post: Post } = $props();

  // State for image carousel
  let currentImageIndex = $state(0);

  // State for lightbox
  let lightboxImage = $state<{ url: string; index: number } | null>(null);

  // Functions to navigate carousel
  function nextImage() {
    if (post.imagesCid && currentImageIndex < post.imagesCid.length - 1) {
      currentImageIndex++;
    }
  }

  function prevImage() {
    if (currentImageIndex > 0) {
      currentImageIndex--;
    }
  }

  // Function to preload an image
  function preloadImage(index: number): void {
    if (!post.imagesCid || index < 0 || index >= post.imagesCid.length) return;

    const img = new Image();
    img.src = `${Config.PDS_URL}/xrpc/com.atproto.sync.getBlob?did=${post.authorDid}&cid=${post.imagesCid[index]}`;
  }

  // Lightbox functions
  function openLightbox(index: number) {
    if (!post.imagesCid) return;
    const url = `${Config.PDS_URL}/xrpc/com.atproto.sync.getBlob?did=${post.authorDid}&cid=${post.imagesCid[index]}`;
    lightboxImage = { url, index };
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightboxImage = null;
    document.body.style.overflow = '';
  }

  // Keyboard navigation for lightbox
  function handleLightboxKeydown(e: KeyboardEvent) {
    if (!lightboxImage || !post.imagesCid) return;
    
    if (e.key === 'Escape') {
      closeLightbox();
    } else if (e.key === 'ArrowLeft' && lightboxImage.index > 0) {
      lightboxImage = {
        url: `${Config.PDS_URL}/xrpc/com.atproto.sync.getBlob?did=${post.authorDid}&cid=${post.imagesCid[lightboxImage.index - 1]}`,
        index: lightboxImage.index - 1
      };
    } else if (e.key === 'ArrowRight' && lightboxImage.index < post.imagesCid.length - 1) {
      lightboxImage = {
        url: `${Config.PDS_URL}/xrpc/com.atproto.sync.getBlob?did=${post.authorDid}&cid=${post.imagesCid[lightboxImage.index + 1]}`,
        index: lightboxImage.index + 1
      };
    }
  }

  // Rich text rendering function
  function renderRichText(text: string, facets: any[] | null): string {
    if (!facets || facets.length === 0) return escapeHtml(text);
    
    const sortedFacets = [...facets].sort((a, b) => a.index.byteStart - b.index.byteStart);

    // Convert text to UTF-8 bytes for proper facet indexing
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();
    const bytes = encoder.encode(text);

    let result = '';
    let lastByteIndex = 0;

    for (const facet of sortedFacets) {
      const { byteStart, byteEnd } = facet.index;
      
      // Extract text before facet
      if (lastByteIndex < byteStart) {
        const beforeBytes = bytes.slice(lastByteIndex, byteStart);
        result += escapeHtml(decoder.decode(beforeBytes));
      }
      
      // Extract facet text
      const facetBytes = bytes.slice(byteStart, byteEnd);
      const facetText = decoder.decode(facetBytes);
      const feature = facet.features?.[0];

      if (feature) {
        if (feature.$type === 'app.bsky.richtext.facet#link') {
          result += `<a href="${escapeHtml(feature.uri)}" target="_blank" rel="noopener noreferrer" class="post-link">${escapeHtml(facetText)}</a>`;
        } else if (feature.$type === 'app.bsky.richtext.facet#mention') {
          result += `<a href="${Config.FRONTEND_URL}/profile/${escapeHtml(feature.did)}" target="_blank" rel="noopener noreferrer" class="post-mention">${escapeHtml(facetText)}</a>`;
        } else if (feature.$type === 'app.bsky.richtext.facet#tag') {
          result += `<a href="${Config.FRONTEND_URL}/hashtag/${escapeHtml(feature.tag)}" target="_blank" rel="noopener noreferrer" class="post-hashtag">${escapeHtml(facetText)}</a>`;
        } else {
          result += escapeHtml(facetText);
        }
      } else {
        result += escapeHtml(facetText);
      }

      lastByteIndex = byteEnd;
    }

    // Add remaining text after last facet
    if (lastByteIndex < bytes.length) {
      const remainingBytes = bytes.slice(lastByteIndex);
      result += escapeHtml(decoder.decode(remainingBytes));
    }

    return result;
  }

  function escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }



  // Preload adjacent images when current index changes
  $effect(() => {
    if (post.imagesCid && post.imagesCid.length > 1) {
      // Preload next image if available
      if (currentImageIndex < post.imagesCid.length - 1) {
        preloadImage(currentImageIndex + 1);
      }

      // Preload previous image if available
      if (currentImageIndex > 0) {
        preloadImage(currentImageIndex - 1);
      }
    }
  });

  // Initial preload of images
  onMount(() => {
    if (post.imagesCid && post.imagesCid.length > 1) {
      // Preload the next image if it exists
      if (post.imagesCid.length > 1) {
        preloadImage(1);
      }
    }

    // Add keyboard listener for lightbox
    window.addEventListener('keydown', handleLightboxKeydown);
    return () => {
      window.removeEventListener('keydown', handleLightboxKeydown);
    };
  });
</script>

<div id="postContainer">
  <div id="postHeader">
    {#if post.authorAvatarCid}
      <img
        id="avatar"
        src="{Config.PDS_URL}/xrpc/com.atproto.sync.getBlob?did={post.authorDid}&cid={post.authorAvatarCid}"
        alt="avatar of {post.displayName}"
      />
    {:else}
      <div class="avatar-placeholder">
        <span>{post.displayName.charAt(0).toUpperCase()}</span>
      </div>
    {/if}
    <div id="headerText">
      <a id="displayName" href="{Config.FRONTEND_URL}/profile/{post.authorHandle}"
        >{post.displayName}</a
      >
      <p id="handle">
        <a href="{Config.FRONTEND_URL}/profile/{post.authorHandle}"
          >@{post.authorHandle}</a
        >
        <span class="separator">·</span>
        <a
          id="postLink"
          href="{Config.FRONTEND_URL}/profile/{post.authorHandle}/post/{post.recordName}"
          >{moment(post.timenotstamp).isBefore(moment().subtract(1, "month"))
            ? moment(post.timenotstamp).format("MMM D, YYYY")
            : moment(post.timenotstamp).fromNow()}</a
        >
      </p>
    </div>
  </div>
  <div id="postContent">
    {#if post.replyingUri}
      <div class="context-badge reply-badge">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
        </svg>
        <span>Replying to
          <a
            href="{Config.FRONTEND_URL}/profile/{post.replyingUri.repo}/post/{post.replyingUri.rkey}"
            class="context-link"
            >@{post.replyingUri.repo}</a
          >
        </span>
      </div>
    {/if}
    {#if post.quotingUri}
      <div class="context-badge quote-badge">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="17 1 21 5 17 9"></polyline>
          <path d="M3 11V9a4 4 0 0 1 4-4h14"></path>
          <polyline points="7 23 3 19 7 15"></polyline>
          <path d="M21 13v2a4 4 0 0 1-4 4H3"></path>
        </svg>
        <span>Quoting
          <a
            href="{Config.FRONTEND_URL}/profile/{post.quotingUri.repo}/post/{post.quotingUri.rkey}"
            class="context-link"
            >@{post.quotingUri.repo}</a
          >
        </span>
      </div>
    {/if}
    
    <!-- Rich text with facets support -->
    <div id="postText">
      {@html renderRichText(post.text, post.facets)}
    </div>

    <!-- External Link Card -->
    {#if post.externalLink}
      <a
        href={post.externalLink.uri}
        target="_blank"
        rel="noopener noreferrer"
        class="external-link-card"
      >
        {#if post.externalLink.thumb}
          <img
            src="{Config.PDS_URL}/xrpc/com.atproto.sync.getBlob?did={post.authorDid}&cid={post.externalLink.thumb}"
            alt={post.externalLink.title}
            class="external-link-thumb"
            loading="lazy"
          />
        {/if}
        <div class="external-link-content">
          <h3 class="external-link-title">
            {post.externalLink.title}
          </h3>
          {#if post.externalLink.description}
            <p class="external-link-description">
              {post.externalLink.description}
            </p>
          {/if}
          <p class="external-link-domain">
            {new URL(post.externalLink.uri).hostname}
          </p>
        </div>
      </a>
    {/if}

    <!-- Images with carousel and lightbox -->
    {#if post.imagesCid && post.imagesCid.length > 0}
      <div id="carouselContainer">
        <button
          type="button"
          class="image-button"
          onclick={() => openLightbox(currentImageIndex)}
        >
          <img
            id="embedImages"
            alt="Post Image {currentImageIndex + 1} of {post.imagesCid.length}"
            src="{Config.PDS_URL}/xrpc/com.atproto.sync.getBlob?did={post.authorDid}&cid={post.imagesCid[currentImageIndex]}"
          />
        </button>

        {#if post.imagesCid.length > 1}
          <div id="carouselControls">
            <button
              id="prevBtn"
              onclick={prevImage}
              disabled={currentImageIndex === 0}
              aria-label="Previous image"
              >←</button
            >
            <div id="carouselIndicators">
              {#each post.imagesCid as _, i}
                <button
                  type="button"
                  class="indicator {i === currentImageIndex ? 'active' : ''}"
                  onclick={() => { currentImageIndex = i; }}
                  aria-label="Go to image {i + 1}"
                ></button>
              {/each}
            </div>
            <button
              id="nextBtn"
              onclick={nextImage}
              disabled={currentImageIndex === post.imagesCid.length - 1}
              aria-label="Next image"
              >→</button
            >
          </div>
        {/if}
      </div>
    {/if}

    <!-- Video -->
    {#if post.videosLinkCid}
      <video
        id="embedVideo"
        src="{Config.PDS_URL}/xrpc/com.atproto.sync.getBlob?did={post.authorDid}&cid={post.videosLinkCid}"
        controls
        preload="metadata"
      >
        <track kind="captions" />
        Your browser does not support the video tag.
      </video>
    {/if}

    <!-- GIF -->
    {#if post.gifLink}
      <img
        id="embedVideo"
        src="{post.gifLink}"
        alt="Post GIF"
      />
    {/if}
  </div>
</div>

<!-- Lightbox Modal -->
{#if lightboxImage && post.imagesCid}
  <div
    class="lightbox-overlay"
    onclick={closeLightbox}
    role="button"
    tabindex="0"
    aria-label="Close image lightbox"
  >
    <button
      type="button"
      class="lightbox-close"
      onclick={closeLightbox}
      aria-label="Close"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="6" x2="6" y2="18"></line>
        <line x1="6" y1="6" x2="18" y2="18"></line>
      </svg>
    </button>
    
    {#if post.imagesCid.length > 1}
      <button
        type="button"
        class="lightbox-nav lightbox-nav-prev"
        onclick={(e) => { 
          e.stopPropagation(); 
          if (lightboxImage && lightboxImage.index > 0) {
            lightboxImage = {
              url: `${Config.PDS_URL}/xrpc/com.atproto.sync.getBlob?did=${post.authorDid}&cid=${post.imagesCid![lightboxImage.index - 1]}`,
              index: lightboxImage.index - 1
            };
          }
        }}
        disabled={lightboxImage.index === 0}
        aria-label="Previous image"
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="15 18 9 12 15 6"></polyline>
        </svg>
      </button>
      
      <button
        type="button"
        class="lightbox-nav lightbox-nav-next"
        onclick={(e) => { 
          e.stopPropagation(); 
          if (lightboxImage && post.imagesCid && lightboxImage.index < post.imagesCid.length - 1) {
            lightboxImage = {
              url: `${Config.PDS_URL}/xrpc/com.atproto.sync.getBlob?did=${post.authorDid}&cid=${post.imagesCid[lightboxImage.index + 1]}`,
              index: lightboxImage.index + 1
            };
          }
        }}
        disabled={lightboxImage.index === post.imagesCid.length - 1}
        aria-label="Next image"
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="9 18 15 12 9 6"></polyline>
        </svg>
      </button>
    {/if}

    <div class="lightbox-content" onclick={(e) => e.stopPropagation()}>
      <img
        src={lightboxImage.url}
        alt="Full size post image {lightboxImage.index + 1}"
        class="lightbox-image"
      />
      {#if post.imagesCid.length > 1}
        <div class="lightbox-counter">
          {lightboxImage.index + 1} / {post.imagesCid.length}
        </div>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Avatar placeholder */
  .avatar-placeholder {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: linear-gradient(135deg, var(--link-color), var(--time-color));
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: 600;
    font-size: 1.2em;
    border: 2px solid white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }

  /* Context badges */
  .context-badge {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 0.85em;
    padding: 6px 12px;
    border-radius: 12px;
    margin-bottom: 10px;
    font-weight: 500;
  }

  .reply-badge {
    background-color: rgba(99, 102, 241, 0.1);
    color: #6366f1;
    border: 1px solid rgba(99, 102, 241, 0.2);
  }

  .quote-badge {
    background-color: rgba(139, 92, 246, 0.1);
    color: #8b5cf6;
    border: 1px solid rgba(139, 92, 246, 0.2);
  }

  .context-badge svg {
    flex-shrink: 0;
  }

  .context-link {
    color: inherit;
    font-weight: 600;
    text-decoration: none;
  }

  .context-link:hover {
    text-decoration: underline;
  }

  .separator {
    color: #9ca3af;
    margin: 0 4px;
  }

  /* Rich text links */
  :global(.post-link) {
    color: var(--link-color);
    text-decoration: none;
    transition: color 0.15s ease;
  }

  :global(.post-link:hover) {
    color: var(--link-hover-color);
    text-decoration: underline;
  }

  :global(.post-mention) {
    color: var(--link-color);
    font-weight: 500;
    text-decoration: none;
    transition: color 0.15s ease;
  }

  :global(.post-mention:hover) {
    color: var(--link-hover-color);
    text-decoration: underline;
  }

  :global(.post-hashtag) {
    color: var(--time-color);
    font-weight: 500;
    text-decoration: none;
    transition: color 0.15s ease;
  }

  :global(.post-hashtag:hover) {
    opacity: 0.8;
    text-decoration: underline;
  }

  /* Image button for lightbox */
  .image-button {
    all: unset;
    cursor: pointer;
    display: block;
    width: 100%;
  }

  .image-button:focus-visible {
    outline: 2px solid var(--link-color);
    outline-offset: 2px;
    border-radius: 8px;
  }

  /* Make indicators clickable */
  .indicator {
    cursor: pointer;
    border: none;
    padding: 0;
  }

  .indicator:focus-visible {
    outline: 2px solid var(--link-color);
    outline-offset: 2px;
  }

  /* Lightbox styles */
  .lightbox-overlay {
    position: fixed;
    inset: 0;
    z-index: 1000;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(0, 0, 0, 0.95);
    padding: 20px;
    cursor: zoom-out;
  }

  .lightbox-content {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    max-width: 90vw;
    max-height: 90vh;
    cursor: default;
  }

  .lightbox-image {
    max-width: 100%;
    max-height: 85vh;
    object-fit: contain;
    border-radius: 8px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  }

  .lightbox-close {
    position: absolute;
    top: 20px;
    right: 20px;
    z-index: 1001;
    background-color: rgba(0, 0, 0, 0.7);
    border: none;
    border-radius: 50%;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: white;
    transition: background-color 0.2s ease, transform 0.2s ease;
  }

  .lightbox-close:hover {
    background-color: rgba(0, 0, 0, 0.9);
    transform: scale(1.1);
  }

  .lightbox-close:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  .lightbox-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 1001;
    background-color: rgba(0, 0, 0, 0.7);
    border: none;
    border-radius: 50%;
    width: 44px;
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    color: white;
    transition: background-color 0.2s ease, transform 0.2s ease, opacity 0.2s ease;
  }

  .lightbox-nav:hover:not(:disabled) {
    background-color: rgba(0, 0, 0, 0.9);
    transform: translateY(-50%) scale(1.1);
  }

  .lightbox-nav:disabled {
    opacity: 0.3;
    cursor: not-allowed;
  }

  .lightbox-nav:focus-visible {
    outline: 2px solid white;
    outline-offset: 2px;
  }

  .lightbox-nav-prev {
    left: 20px;
  }

  .lightbox-nav-next {
    right: 20px;
  }

  .lightbox-counter {
    margin-top: 16px;
    padding: 8px 16px;
    background-color: rgba(0, 0, 0, 0.7);
    border-radius: 20px;
    color: white;
    font-size: 0.9em;
    font-weight: 500;
  }

  /* External link card */
  .external-link-card {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: 12px;
    border: 1px solid var(--border-color);
    background-color: var(--header-background-color);
    margin-top: 12px;
    transition: background-color 0.15s ease, transform 0.15s ease;
    text-decoration: none;
    color: inherit;
  }

  .external-link-card:hover {
    background-color: var(--button-hover);
    transform: translateY(-2px);
  }

  .external-link-thumb {
    width: 100%;
    height: 200px;
    object-fit: cover;
    background-color: var(--border-color);
  }

  .external-link-content {
    padding: 12px;
  }

  .external-link-title {
    font-size: 0.95em;
    font-weight: 600;
    color: var(--text-color);
    margin: 0 0 6px 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .external-link-description {
    font-size: 0.85em;
    color: var(--text-secondary-color);
    margin: 0 0 8px 0;
    line-height: 1.4;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  .external-link-domain {
    font-size: 0.8em;
    color: #9ca3af;
    margin: 0;
  }

  /* Mobile responsiveness for lightbox */
  @media screen and (max-width: 768px) {
    .lightbox-overlay {
      padding: 10px;
    }

    .lightbox-image {
      max-height: 80vh;
    }

    .lightbox-close {
      top: 10px;
      right: 10px;
      width: 36px;
      height: 36px;
    }

    .lightbox-nav {
      width: 36px;
      height: 36px;
    }

    .lightbox-nav-prev {
      left: 10px;
    }

    .lightbox-nav-next {
      right: 10px;
    }

    .lightbox-counter {
      font-size: 0.8em;
      padding: 6px 12px;
    }

    .external-link-thumb {
      height: 160px;
    }
  }
</style>
