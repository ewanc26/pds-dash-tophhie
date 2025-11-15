import { simpleFetchHandler, XRPC } from "@atcute/client";
import "@atcute/bluesky/lexicons";
import type {
  AppBskyActorDefs,
  AppBskyActorProfile,
  AppBskyFeedPost,
  At,
  ComAtprotoRepoListRecords,
} from "@atcute/client/lexicons";
import {
  CompositeDidDocumentResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
} from "@atcute/identity-resolver";
import { Config } from "../../config";
import { Mutex } from "mutex-ts"
// import { ComAtprotoRepoListRecords.Record } from "@atcute/client/lexicons";
// import { AppBskyFeedPost } from "@atcute/client/lexicons";
// import { AppBskyActorDefs } from "@atcute/client/lexicons";

interface AccountMetadata {
  did: At.Did;
  displayName: string;
  handle: string;
  avatarCid: string | null;
  currentCursor?: string;
  deactivated?: boolean;
}

let accountsMetadata: AccountMetadata[] = [];

interface atUriObject {
  repo: string;
  collection: string;
  rkey: string;
}
class Post {
  authorDid: string;
  authorAvatarCid: string | null;
  postCid: string;
  recordName: string;
  authorHandle: string;
  displayName: string;
  text: string;
  timestamp: number;
  timenotstamp: string;
  quotingUri: atUriObject | null;
  replyingUri: atUriObject | null;
  imagesCid: string[] | null;
  videosLinkCid: string | null;
  gifLink: string | null;
  facets: any[] | null;
  imageAlts: string[] | null;
  externalLink: { uri: string; title: string; description?: string; thumb?: string } | null;

  constructor(
    record: ComAtprotoRepoListRecords.Record,
    account: AccountMetadata,
  ) {
    this.postCid = record.cid;
    this.recordName = processAtUri(record.uri).rkey;
    this.authorDid = account.did;
    this.authorAvatarCid = account.avatarCid;
    this.authorHandle = account.handle;
    this.displayName = account.displayName;
    const post = record.value as AppBskyFeedPost.Record;
    this.timenotstamp = post.createdAt;
    this.text = post.text;
    this.timestamp = Date.parse(post.createdAt);
    this.facets = post.facets || null;
    this.imageAlts = null;
    this.externalLink = null;
    if (post.reply) {
      this.replyingUri = processAtUri(post.reply.parent.uri);
    } else {
      this.replyingUri = null;
    }
    this.quotingUri = null;
    this.imagesCid = null;
    this.videosLinkCid = null;
    this.gifLink = null;
    switch (post.embed?.$type) {
      case "app.bsky.embed.images":
        this.imagesCid = post.embed.images.map(
          (imageRecord: any) => imageRecord.image.ref.$link,
        );
        this.imageAlts = post.embed.images.map(
          (imageRecord: any) => imageRecord.alt || '',
        );
        break;
      case "app.bsky.embed.video":
        this.videosLinkCid = post.embed.video.ref.$link;
        break;
      case "app.bsky.embed.record":
        this.quotingUri = processAtUri(post.embed.record.uri);
        break;
      case "app.bsky.embed.recordWithMedia":
        this.quotingUri = processAtUri(post.embed.record.record.uri);
        switch (post.embed.media.$type) {
          case "app.bsky.embed.images":
            this.imagesCid = post.embed.media.images.map(
              (imageRecord) => imageRecord.image.ref.$link,
            );
            this.imageAlts = post.embed.media.images.map(
              (imageRecord) => imageRecord.alt || '',
            );

            break;
          case "app.bsky.embed.video":
            this.videosLinkCid = post.embed.media.video.ref.$link;

            break;
        }
        break;
      case "app.bsky.embed.external":
        // Check if it's a GIF
        if (post.embed.external.uri.includes(".gif")) {
          this.gifLink = post.embed.external.uri;
        } else {
          // It's a regular external link
          this.externalLink = {
            uri: post.embed.external.uri,
            title: post.embed.external.title || post.embed.external.uri,
            description: post.embed.external.description,
            thumb: post.embed.external.thumb?.ref?.$link || undefined,
          };
        }
        break;
    }
  }
}

const processAtUri = (aturi: string): atUriObject => {
  const parts = aturi.split("/");
  return {
    repo: parts[2],
    collection: parts[3],
    rkey: parts[4],
  };
};

const rpc = new XRPC({
  handler: simpleFetchHandler({
    service: Config.PDS_URL,
  }),
});

const getDidsFromPDS = async (): Promise<At.Did[]> => {
  const { data } = await rpc.get("com.atproto.sync.listRepos", {
    params: {},
  });

  return data.repos
    .filter((repo: any) => repo.active !== false)
    .map((repo: any) => repo.did) as At.Did[];
};

const getAccountMetadata = async (
  did: `did:${string}:${string}`,
) => {
  const account: AccountMetadata = {
    did: did,
    handle: "", // Guaranteed to be filled out later
    displayName: "",
    avatarCid: null,
    deactivated: false,
  };

  try {
    const { data } = await rpc.get("com.atproto.repo.getRecord", {
      params: {
        repo: did,
        collection: "app.bsky.actor.profile",
        rkey: "self",
      },
    });
    const value = data.value as AppBskyActorProfile.Record;
    account.displayName = value.displayName || "";
    if (value.avatar) {
      account.avatarCid = value.avatar.ref["$link"];
    }
  } catch (e) {
    console.warn(`Error fetching profile for ${did}:`, e);
  }

  try {
    account.handle = await blueskyHandleFromDid(did);
  } catch (e) {
    console.error(`Error fetching handle for ${did}:`, e);
    return null;
  }

  return account;
};

const getAllMetadataFromPds = async (): Promise<AccountMetadata[]> => {
  const dids = await getDidsFromPDS();
  const metadata = await Promise.all(
    dids.map(async (repo: `did:${string}:${string}`) => {
      return await getAccountMetadata(repo);
    }),
  );
  return metadata.filter((account) => account !== null) as AccountMetadata[];
};

const identityResolve = async (did: At.Did) => {
  const resolver = new CompositeDidDocumentResolver({
    methods: {
      plc: new PlcDidDocumentResolver(),
      web: new WebDidDocumentResolver(),
    },
  });

  if (did.startsWith("did:plc:") || did.startsWith("did:web:")) {
    const doc = await resolver.resolve(
      did as `did:plc:${string}` | `did:web:${string}`,
    );
    return doc;
  } else {
    throw new Error(`Unsupported DID type: ${did}`);
  }
};

const blueskyHandleFromDid = async (did: At.Did) => {
  const doc = await identityResolve(did);
  if (doc.alsoKnownAs) {
    const handleAtUri = doc.alsoKnownAs.find((url) => url.startsWith("at://"));
    const handle = handleAtUri?.split("/")[2];
    if (!handle) {
      return "Handle not found";
    } else {
      return handle;
    }
  } else {
    return "Handle not found";
  }
};

interface PostsAcc {
  posts: ComAtprotoRepoListRecords.Record[];
  account: AccountMetadata;
}
const getCutoffDate = (postAccounts: PostsAcc[]) => {
  const now = Date.now();
  let cutoffDate: Date | null = null;
  postAccounts.forEach((postAcc) => {
    const latestPost = new Date(
      (postAcc.posts[postAcc.posts.length - 1].value as AppBskyFeedPost.Record)
        .createdAt,
    );
    if (!cutoffDate) {
      cutoffDate = latestPost;
    } else {
      if (latestPost > cutoffDate) {
        cutoffDate = latestPost;
      }
    }
  });
  if (cutoffDate) {
    return cutoffDate;
  } else {
    return new Date(now);
  }
};

const filterPostsByDate = (posts: PostsAcc[], cutoffDate: Date) => {
  // filter posts for each account that are older than the cutoff date and save the cursor of the last post included
  const filteredPosts: PostsAcc[] = posts.map((postAcc) => {
    const filtered = postAcc.posts.filter((post) => {
      const postDate = new Date(
        (post.value as AppBskyFeedPost.Record).createdAt,
      );
      return postDate >= cutoffDate;
    });
    if (filtered.length > 0) {
      postAcc.account.currentCursor = processAtUri(filtered[filtered.length - 1].uri).rkey;
    }
    return {
      posts: filtered,
      account: postAcc.account,
    };
  });
  return filteredPosts;
};

const postsMutex = new Mutex();

const getNextPosts = async (): Promise<Post[]> => {
  const release = await postsMutex.obtain();
  try {
    // Ensure metadata is loaded
    if (!accountsMetadata.length) {
      accountsMetadata = await getAllMetadataFromPds();
    }

    // Fetch posts for all accounts
    const postsAcc: PostsAcc[] = await Promise.all(
      accountsMetadata.map(async (account) => {
        const result = await fetchPostsForUser(
          account.did,
          account.currentCursor || null
        );

        const records = result?.records ?? [];

        // Always update cursor, even if no posts
        if (result?.cursor) {
          account.currentCursor = result.cursor;
        }

        return {
          posts: records,
          account,
        };
      })
    );

    // Flatten posts
    let records = postsAcc.flatMap((p) => p.posts);

    // Sort by timestamp (newest first)
    records.sort((a, b) => {
      const aDate = new Date((a.value as AppBskyFeedPost.Record).createdAt).getTime();
      const bDate = new Date((b.value as AppBskyFeedPost.Record).createdAt).getTime();
      return bDate - aDate;
    });

    // Filter out future posts if needed
    if (!Config.SHOW_FUTURE_POSTS) {
      const now = Date.now();
      records = records.filter((post) => {
        const postDate = new Date((post.value as AppBskyFeedPost.Record).createdAt).getTime();
        return postDate <= now;
      });
    }

    // Map to Post objects
    const newPosts = records.map((record) => {
      const account = accountsMetadata.find(
        (acc) => acc.did === processAtUri(record.uri).repo
      );
      if (!account) {
        throw new Error(`Account with DID ${processAtUri(record.uri).repo} not found`);
      }
      return new Post(record, account);
    });

    console.log(`Fetched ${newPosts.length} posts`);
    return newPosts;
  } finally {
    release();
  }
};

const fetchPostsForUser = async (did: At.Did, cursor: string | null) => {
  try {
    const { data } = await rpc.get("com.atproto.repo.listRecords", {
      params: {
        repo: did as At.Identifier,
        collection: "app.bsky.feed.post",
        limit: Config.MAX_POSTS,
        cursor: cursor || undefined,
      },
    });

    return {
      records: data.records as ComAtprotoRepoListRecords.Record[],
      cursor: data.cursor ?? null,
    };
  } catch (e) {
    console.error(`Error fetching posts for ${did}:`, e);
    return {
      records: [],
      cursor: null,
    };
  }
};

export { getAllMetadataFromPds, getNextPosts, Post, fetchPostsForUser };
export type { AccountMetadata };
